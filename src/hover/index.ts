import Api from "../api";
import TypeParser from "../typeparser";
import Completer from "../completions";
import * as vscode from "vscode";

export default class HoverHelper {
  typeParser: TypeParser;
  api: Api;
  completions: Completer;

  constructor(typeParser: TypeParser, api: Api, completions: Completer) {
    this.typeParser = typeParser;
    this.api = api;
    this.completions = completions;
  }

  onHover(document: vscode.TextDocument, position: vscode.Position) {
    const range = document.getWordRangeAtPosition(position, /(\b\w+\b)/);
    if (!range) return null;

    const word = document.getText(range);
    const line2 = document.getText(
      new vscode.Range(new vscode.Position(position.line, 0), range.end)
    );
    const line = document.getText(
      new vscode.Range(
        new vscode.Position(position.line, 0),
        new vscode.Position(position.line + 1, 0)
      )
    );

    const variable = this.wordAtCaret(line, line2);
    this.completions.requireContext = this.typeParser.requireContext;

    if (variable.indexOf("::") === -1) {
      try {
        // functions
        for (const func of this.typeParser.functions) {
          if (func.name == word) {
            const doc = new vscode.MarkdownString();
            // doc.appendCodeblock(func.codeBlock, "maniascript");
            if (func.docBlock) {
              doc.appendCodeblock(func.docBlock + "\n", "javascript");
            }
            doc.appendCodeblock(func.codeBlock.split("\n")[0], "maniascript");
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
        const func = this.getClassMethods(this.typeParser.requireContext, word);
        if (func !== "") {
          const doc = new vscode.MarkdownString();
          doc.appendCodeblock(func, "maniascript");
          return new vscode.Hover(doc);
        }

        const { resolved, searchChain } =
          this.completions.searchVariableType(variable);
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
        console.log(err);
      }
    } else {
      const parts = variable.split("::");
      if (parts.length == 2) {
        const out =
          this.getNamespaceContents(parts[0], parts[1]) ||
          this.getExternals(parts[0], parts[1]);
        if (out == "") return null;
        const doc = new vscode.MarkdownString();
        doc.appendCodeblock(out, "maniascript");
        return new vscode.Hover(doc);
      }
      return null;
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
              out += func.documentation + "\n\n";
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

  getExternals(search: string, word: string): string {
    for (const extStruct of this.typeParser.structuresExternal) {
      if (extStruct.var == search) {
        for (const struct of extStruct.structs) {
          if (struct.structName == word) {
            let doc = "";
            if (struct.docBlock) {
              doc += struct.docBlock + "\n";
            }

            return doc + struct.codeBlock;
          }
        }
      }
    }

    for (const extFunc of this.typeParser.functionsExternal) {
      if (extFunc.var == search) {
        for (const func of extFunc.functions) {
          if (func.name == word) {
            let doc = "";
            if (func.docBlock) {
              doc += func.docBlock + "\n";
            }
            return doc + func.codeBlock;
          }
        }
      }
    }
    return "";
  }

  getStruct(structName: string, word: string): string {
    for (const struct of this.typeParser.structures) {
      if (struct.structName == structName.replace(/\[.*?\]/, "")) {
        for (const element of struct.members) {
          if (element.name == word) {
            return element.type;
          }
        }
        const doc = struct.docBlock ?? "";
        return doc + "\n" + struct.codeBlock;
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
                docs = prop.documentation + "\n";
              }
              out =
                docs + groupName + (prop.readonly == true ? " (readonly)" : "");
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
              doc = groupMethods[label].documentation + "\n";
            }
            out = doc + `${returns} ${name}(${args.join(", ")})`;
          }
        });
        className = classes[className].inherit;
      } while (!(className == ""));
    }

    return out;
  }

  wordAtCaret(line: string, line2: string): string {
    const current = line2.split(/[\s({[^]/);
    return current.pop() ?? "";
  }
}
