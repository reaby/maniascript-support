import Api from "../api";
import TypeParser from "../typeparser";
import Completer from "../completions";
import * as vscode from "vscode";
import { getText } from "../utils";

export default class HoverHelper {
  typeParser: TypeParser;
  api: Api;
  completions: Completer;

  constructor(typeParser: TypeParser, api: Api, completions: Completer) {
    this.typeParser = typeParser;
    this.api = api;
    this.completions = completions;
  }

  async onHover(document: vscode.TextDocument, position: vscode.Position) {
    const range = document.getWordRangeAtPosition(position, /(\b[\w]+\b)/);
    if (!range) return null;    
    let text = document.getText();
    await this.typeParser.update(text);
    let index = 0;
    let newPosition = position;
    for (const language of await this.typeParser.getEmbeddedLanguages(text)) {
      if (language.type == "maniascript") {
        index += 1;
        if (language.range.contains(position)) {
          text = language.value;                    
          newPosition = new vscode.Position(position.line + 1 - language.range.start.line, position.character);
          await this.typeParser.update(language.value);
          break;
        }
      }
    }
    const word = document.getText(range);
    const line = getText(text,
      new vscode.Range(new vscode.Position(newPosition.line, 0), new vscode.Position(newPosition.line, range.end.character))
    );
    const variable = this.wordAtCaret(line);    
    const requireContext = this.typeParser.getRequireContext(text);    
    this.completions.genVars(newPosition);
    if (variable.indexOf("::") === -1) {
      try {
        // functions
        for (const func of this.typeParser.functions) {
          if (func.name == word) {
            const doc = new vscode.MarkdownString();
            if (func.docBlock) {
              doc.appendCodeblock(func.docBlock + "\n", "typescript");
            }
            const body = func.codeBlock;        
            doc.appendCodeblock(body, "maniascript");
            return new vscode.Hover(doc);
          }
          for (const param of func.params) {
            if (param.name == word) {
              const doc = new vscode.MarkdownString();
              doc.appendCodeblock(param.type, "maniascript");
              return new vscode.Hover(doc);
            }
          }
        }
        const func = this.getClassMethods(requireContext, word);
        if (func !== "") {
          const doc = new vscode.MarkdownString();
          doc.appendCodeblock(func, "maniascript");
          return new vscode.Hover(doc);
        }

        for (const incl of this.typeParser.includes) {
          if (incl.variableName == variable) {
            const out = new vscode.MarkdownString();
            const doc = '#Include "' + incl.includeName + '"';
            out.appendCodeblock(doc, "maniascript");
            return new vscode.Hover(out);
          }
        }
        
        for(const cons of this.typeParser.consts) {        
          if (cons.name == variable) {
            const out = new vscode.MarkdownString();
            const doc = `${cons.name} ${cons.value} (${cons.type})`;
            out.appendCodeblock(doc, "maniascript");
            return new vscode.Hover(out);
          }        
        }

        // variables
        const { resolved, searchChain } =
          this.completions.searchVariableType(variable, requireContext);
        if (resolved) {
          const out =
            this.getClassVariableType(resolved, word) ||
            this.getClassMethods(resolved, word) ||
            this.getStruct(resolved, word) ||
            resolved;
          const doc = new vscode.MarkdownString();
          doc.appendCodeblock(out, "maniascript");
          return new vscode.Hover(doc);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      // enums and externals
      const parts = variable.split("::");
      if (parts.length == 2) {
        const out =
          this.getNamespaceContents(parts[0], parts[1]) ||
          this.getExternals(parts[0], parts[1], variable);
        if (out == "") return null;
        const doc = new vscode.MarkdownString();
        doc.appendCodeblock(out, "maniascript");
        return new vscode.Hover(doc);
      }
      return null;
    }

    for(const key in this.api.completions.classes) {
       if (variable == key) {
        const elem = this.api.completions.classes[key];
        let doc = "";
        if (elem.documentation) {
          doc += elem.documentation + "\n";
         }

        const out = new vscode.MarkdownString();
        out.appendCodeblock(doc + key);
        return new vscode.Hover(out);
       }
    }

    return null;
  }

  getNamespaceContents(search: string, word: string): string {
    // resolve variable to namespace name
    let needle: string | null = null;
    for (const elem of this.typeParser.includes) {
      if (search == elem.variableName) {
        needle = elem.includeName;
      }
    }
    if (needle == null) return "";

    const namespaces: any = this.api.get().namespaces;
    const out = "";
    for (const i in namespaces) {
      if (i === needle) {
        for (const func of namespaces[i].methods) {
          if (func.name === word) {
            let out = "";
            if (func.documentation) {
              out += "/**\n" + func.documentation + "\n*/\n";
            }
            const outpar = [];
            for (const param of func.params) {
              outpar.push(param.identifier + " " + param.argument);
            }

            return out + `${func.returns} ${func.name}(${outpar.join(", ")});`;
          }
        }
      }
    }
    return "";
  }

  getExternals(file: string, structName: string, word: string): string {
    for (const extStruct of this.typeParser.structuresExternal) {
      if (extStruct.var == file) {
        for (const struct of extStruct.structs) {
          for (const element of struct.members) {
            if (element.name == word) {
              return element.type;
            }
          }
          if (struct.structName == structName) {
            let doc = "";
            if (struct.docBlock) {
              doc += struct.docBlock + "\n";
            }
            return doc + struct.codeBlock.split("\n")[0];
          }
        }
      }
    }

    for (const extFunc of this.typeParser.functionsExternal) {
      if (extFunc.var == file) {
        for (const func of extFunc.functions) {
          if (func.name == structName) {
            let doc = "";
            if (func.docBlock) {
              doc += func.docBlock + "\n";
            }
            return doc + func.codeBlock.split("\n")[0];
          }
        }
      }
    }
    return "";
  }

  getStruct(structName: string, word: string): string {
    for (const struct of this.typeParser.structures) {
      //if (struct.structName == structName.replace(/\[.*?\]/, "")) {
        if (struct.structName == structName) {
        if (struct.ext) {
          const m = struct.extType?.split("::");
          if (m) {
            return this.getExternals(m[0], m[1], word);
          }
          return "";
        }
        for (const element of struct.members) {
          if (element.name == word) {
            return element.type;
          }
        }
        let docs = "";
        if (struct.docBlock) {
          docs = struct.docBlock;
        }
        return docs + struct.codeBlock;
      }
    }
    return "";
  }

  getClassVariableType(className: string, type: string): string {
    let out = "";
    const classes = this.api.get().classes;
    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const props = classes[className].props || {};
        Object.keys(props).forEach((groupName) => {
          props[groupName].forEach((prop: any) => {
            if (prop.name == type) {
              let docs = "";
              if (prop.documentation) {
                docs = "/**\n" + prop.documentation + "\n*/\n";
              }
              out =
                docs + groupName + (prop.readonly == true ? " *readonly*" : "");
            }
          });
        });

        className = classes[className].inherit;
      } while (!(className === ""));
    }
    return out;
  }

  getClassMethods(className: string, search: string): string {
    let out = "";
    const classes = this.api.get().classes;
    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const groupMethods = classes[className].methods || {};
        Object.keys(groupMethods).map((label) => {
          const params = groupMethods[label].params;
          const name = groupMethods[label].name;
          const returns = groupMethods[label].returns;

          if (name == search) {
            const args = [];
            const vals = [];
            let index = 0;
            for (const param of params) {
              args.push(param.argument + ":" + param.identifier);
              vals.push("${" + (index + 1) + ":" + param.argument + "}");
              index += 1;
            }
            let doc = "";
            if (groupMethods[label].documentation) {
              doc = "/**\n" + groupMethods[label].documentation + "\n*/\n";
            }
            out = doc + `${returns} ${name}(${args.join(", ")})`;
          }
        });
        className = classes[className].inherit;
      } while (!(className == ""));
    }

    return out;
  }

  wordAtCaret(line: string): string {
    const current = line.split(/[\s({[^!]/);
    return current.pop() ?? "";
  }
}
