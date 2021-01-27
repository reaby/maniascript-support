import {
  CompletionItem,
  CompletionItemKind,
  MarkdownString,
  SnippetString,
} from "vscode";
import Api from "../api";
import TypeParser from "../typeparser";
import { functionType, structureType } from "../typeparser/types/typeClasses";

export default class Completer {
  readonly typeParser: TypeParser;
  readonly api: Api;
  requireContext = "";

  constructor(parser: TypeParser, api: Api) {
    this.typeParser = parser;
    this.api = api;
  }

  complete(searchFor: string[], docText: string) {
    const requireContext = this.typeParser.requireContext;

    this.requireContext = requireContext;

    if (
      searchFor.includes("#RequireContext") ||
      searchFor.includes("@context")
    ) {
      return [...this.getClasses()];
    }

    // Check variables
    const caret = searchFor.pop();

    if (caret != null) {
      // if is namespace or enum
      if (caret.indexOf("::") > -1) {
        let search: string = caret.slice(0, caret.indexOf("::"));
        if (caret == "::") {
          search = requireContext;
        }

        return [
          ...this.getNamespaceContents(search),
          ...this.getExternals(search),
          ...this.getEnums(search),
        ];
      }

      // variable...
      if (caret.indexOf(".") > -1) {
        const searchChain = caret.split(".");
        searchChain.pop();
        let search = caret;

        if (search.indexOf("[") !== -1 && search.indexOf("]") == -1) {
          search = search.slice(search.indexOf("[") + 1, search.length);
        }

        return this.resolveVariable(search, requireContext);
      }
    }

    // rules for declares
    if (
      searchFor[0] === "declare" ||
      searchFor[0] === "#Struct" ||
      searchFor[0] === "#Const"
    ) {
      if (searchFor.length == 2) {
        return [
          ...this.getPrimitives(),
          ...this.getClasses(),
          ...this.getStructs(this.typeParser.structures),
          new CompletionItem("persistent", CompletionItemKind.Keyword),
        ];
      } else {
        return [];
      }
    }

    return [
      ...(this.find(requireContext) ?? []),
      ...this.getClasses(),
      ...this.getStructs(this.typeParser.structures),
      ...this.getNamespaces(),
      ...this.getKeywords(),
      ...this.getVariables(),
      ...this.getFunctions(this.typeParser.functions),
      ...this.getPrimitives(),
    ];
  }

  getArrayMethods(): CompletionItem[] {
    const methods: CompletionItem[] = [];
    const methodCompletions = [
      // filter value, display value, completion
      ["add", "add(value)", "add(${1:value})"],
      ["addfirst", "addfirst(value)", "add(${1:value})"],
      ["clear", "clear()", "clear()"],
      ["sort", "sort()", "sort()"],
      ["sortreverse", "sortreverse()", "sortreverse()"],
      ["sortkey", "sortkey()", "sortkey()"],
      ["sortkeyreverse", "sortkeyreverse()", "sortkeyreverse()"],
      ["removekey", "removekey(index)", "removekey(${1:index})"],
      ["remove", "remove()", "remove(${1:value})"],
      ["existskey", "existskey(key)", "existskey(${1:key})"],
      ["exists", "exists()", "exists(${1:value})"],
      ["keyof", "keyof(value)", "keyof(${1:value})"],
      ["containsonly", "containsonly(value)", "containsonly(${1:value})"],
      ["containsoneof", "containsoneof(value)", "containsoneof(${1:value})"],
      ["slice", "slice(start,count)", "slice(${1:start}, ${2:count}"],
      ["tojson", "tojson() : Text", "tojson()"],
      ["fromjson", "fromjson(value) : Text", "fromjson(${1:value})"],
    ];

    methodCompletions.forEach((method) => {
      const item = new CompletionItem(method[1], CompletionItemKind.Function);
      item.insertText = new SnippetString(method[2]);
      item.filterText = method[0];
      methods.push(item);
    });

    return methods;
  }

  resolveVariable(search: string, requireContext: string): CompletionItem[] {
    let resolved = "";
    const searchChain = search.split(".");
    searchChain.pop();

    if (searchChain.length >= 0) {
      let vari = "";
      if (searchChain.length == 1) {
        vari = searchChain[0].replace(/\[(.*?)\]/g, "");
        resolved =
          this.getTypeVariable(vari) ??
          this.findTypesInContext(vari, requireContext) ??
          "";
      } else {
        vari = searchChain[0].replace(/\[(.*?)\]/g, "");
        for (let count = 0; count < searchChain.length - 1; count++) {
          vari = vari.replace(/\[(.*?)\]/g, "");
          vari =
            this.getTypeVariable(vari) ??
            this.findTypesInContext(vari, requireContext) ??
            vari;

          const next = searchChain[count + 1].replace(/\[(.*?)\]/g, "");
          for (const member of this.api.getClassProperties(vari)) {
            if (member.name == next) {
              resolved = vari = member.type;
              break;
            }
          }
          for (const elem of this.typeParser.structures) {
            for (const member of elem.members) {
              if (member.name == next) {
                resolved = vari = member.type;
                break;
              }
            }
          }
        }
      }
    } else {
      resolved =
        this.getTypeVariable(search) ??
        this.findTypesInContext(search, requireContext) ??
        "";
    }

    // spit autocomplete
    if (resolved != null) {
      const array = resolved.match(/\[(.*?)\]/g);
      const arrLen = searchChain.pop();

      resolved = resolved.replace(/\[(.*?)\]/g, "");
      const match = arrLen?.match(/\w+(?!\[\])?/g);

      if (match != null && match.length > 0) {
        if (array != null && match != null) {
          // if array accessor level is equal to array type
          if (match.length - 1 == array.length) {
            if (this.isStruct(resolved)) {
              return [
                ...this.getStructElems(resolved),
                new CompletionItem("fromjson", CompletionItemKind.Method),
                new CompletionItem("tojson", CompletionItemKind.Method),
              ];
            }
            const out =
              this.find(resolved) || this.getClass(resolved, requireContext);
            return out;
          } else {
            if (match.length >= 1) {
              return this.getArrayMethods();
            }
          }
        }
      }
      const out =
        this.find(resolved) || this.getClass(resolved, requireContext);
      return out ?? [];
    }
    return [];
  }

  getTypeVariable(search: string): string | null {
    for (const elem of this.typeParser.variables) {
      if (search == elem.name) return elem.type;
    }

    return null;
  }

  findTypesInContext(elem: string, context: string): string | null {
    let className = context;
    const classes: any = this.api.get().classes;

    if (Object.prototype.hasOwnProperty.call(classes, context)) {
      do {
        const props = classes[className].props || {};
        for (const groupName of Object.keys(props)) {
          for (const prop of props[groupName]) {
            if (prop.name === elem) {
              return groupName;
            }
          }
        }
        className = classes[className].inherit;
      } while (className !== "");
    }
    return null;
  }

  find(context: string): CompletionItem[] | null {
    if (this.isStruct(context)) {
      return [
        ...this.getStructElems(context),
        new CompletionItem("fromjson", CompletionItemKind.Method),
        new CompletionItem("tojson", CompletionItemKind.Method),
      ];
    }
    const out = [
      ...this.getClassProperties(context),
      ...this.getClassMethods(context),
    ];
    if (out.length == 0) return null;
    return out;
  }

  getVariables(): CompletionItem[] {
    const out: CompletionItem[] = [];
    for (const vari of this.typeParser.variables) {
      const item = new CompletionItem(vari.name, CompletionItemKind.Variable);
      item.detail = vari.type;
      out.push(item);
    }

    return out;
  }

  getClass(property: string, className: string): CompletionItem[] {
    let out: CompletionItem[] = [];
    if (property == "") return [];
    if (this.api.get().primitives.includes(property)) return [];

    const classes = this.api.get().classes;
    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const groupEnum = classes[className].enums || {};
        Object.keys(groupEnum).forEach((groupName) => {
          groupEnum[groupName].forEach((enumValue: string) => {
            const item = new CompletionItem(
              className + "::" + groupName + "::" + enumValue,
              CompletionItemKind.Enum
            );
            item.detail = className;
            item.filterText = groupName + "::" + enumValue;
            item.insertText = className + "::" + groupName + "::" + enumValue;
            out.push(item);
          });
        });

        const props = classes[className].props || {};
        Object.keys(props).forEach((groupName) => {
          if (groupName == property) {
            props[groupName].forEach((prop: any) => {
              const item = new CompletionItem(
                prop.name,
                CompletionItemKind.Field
              );
              item.detail =
                groupName + (prop.readonly == true ? " (readonly)" : "");
              item.insertText = prop.name;
              item.filterText = prop.name;
              out.push(item);
            });
          }
        });

        const groupMethods = classes[className].methods || {};
        out = out.concat(
          Object.keys(groupMethods).map((label) => {
            const params = groupMethods[label].params;
            const name = groupMethods[label].name;
            const args = [];
            const vals = [];
            let index = 0;
            for (const param of params) {
              args.push(param.argument + ":" + param.identifier);
              vals.push("${" + (index + 1) + ":" + param.argument + "}");
              index += 1;
            }

            const item = new CompletionItem(
              `${name}(${args.join(", ")})`,
              CompletionItemKind.Method
            );
            item.detail = groupMethods[label].returns;
            item.documentation = new MarkdownString();
            item.filterText = name;
            item.insertText = new SnippetString(name + `(${vals.join(", ")})`);

            return item;
          })
        );
        className = classes[className].inherit;
      } while (!(className === ""));
    }
    return out;
  }

  getClassProperties(className: string): CompletionItem[] {
    const out: CompletionItem[] = [];
    const classes = this.api.get().classes;

    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const props = classes[className].props || {};
        Object.keys(props).forEach((groupName) => {
          props[groupName].forEach((prop: any) => {
            const item = new CompletionItem(
              prop.name,
              CompletionItemKind.Field
            );
            item.detail =
              groupName + (prop.readonly == true ? " (readonly)" : "");
            item.insertText = prop.name;
            item.filterText = prop.name;
            out.push(item);
          });
        });

        className = classes[className].inherit;
      } while (!(className === ""));
    }
    return out;
  }

  getClassMethods(className: string): CompletionItem[] {
    let items: CompletionItem[] = [];
    const classes = this.api.get().classes;
    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const groupMethods = classes[className].methods || {};
        items = items.concat(
          Object.keys(groupMethods).map((label) => {
            const params = groupMethods[label].params;
            const name = groupMethods[label].name;
            const args = [];
            const vals = [];
            let index = 0;
            for (const param of params) {
              args.push(param.argument + ":" + param.identifier);
              vals.push("${" + (index + 1) + ":" + param.argument + "}");
              index += 1;
            }

            const item = new CompletionItem(
              `${name}(${args.join(", ")})`,
              CompletionItemKind.Method
            );
            item.detail = groupMethods[label].returns;
            item.documentation = new MarkdownString();
            item.filterText = name;
            item.insertText = new SnippetString(name + `(${vals.join(", ")})`);

            return item;
          })
        );

        className = classes[className].inherit;
      } while (!(className == ""));
    }

    return items;
  }

  getKeywords(): CompletionItem[] {
    return [
      "break",
      "case",
      "continue",
      "log",
      "do",
      "else",
      "yield",
      "sleep",
      "wait",
      "return",
      "in",
      "metadata",
      "meanwhile",
      "dump",
    ].map((label) => new CompletionItem(label, CompletionItemKind.Keyword));
  }

  getNamespaces(): CompletionItem[] {
    const out: CompletionItem[] = [];
    for (const elem of this.typeParser.includes) {
      const Item = new CompletionItem(
        elem.variableName,
        CompletionItemKind.Interface
      );
      Item.detail = elem.includeName;
      Item.insertText = elem.variableName;
      Item.filterText = elem.variableName;
      out.push(Item);
    }

    return out;
  }

  getExternals(search: string): CompletionItem[] {
    let out: CompletionItem[] = [];

    for (const extStruct of this.typeParser.structuresExternal) {
      if (extStruct.var == search) {
        out = this.getStructs(extStruct.structs);
      }
    }

    for (const extFunc of this.typeParser.functionsExternal) {
      if (extFunc.var == search) {
        out = [...out, ...this.getFunctions(extFunc.functions)];
      }
    }
    return out;
  }

  getEnums(className: string): CompletionItem[] {
    const out: CompletionItem[] = [];
    const classes = this.api.get().classes;
    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const groupEnum = classes[className].enums || {};
        Object.keys(groupEnum).forEach((groupName) => {
          groupEnum[groupName].forEach((enumValue: string) => {
            const item = new CompletionItem(
              className + "::" + groupName + "::" + enumValue,
              CompletionItemKind.Enum
            );
            item.detail = className;
            item.filterText = groupName + "::" + enumValue;
            item.insertText = groupName + "::" + enumValue;
            out.push(item);
          });
        });
        className = classes[className].inherit;
      } while (!(className === ""));
    }
    return out;
  }

  getNamespaceContents(search: string): CompletionItem[] {
    // resolve variable to namespace name
    let needle: string | null = null;
    for (const elem of this.typeParser.includes) {
      if (search == elem.variableName) {
        needle = elem.includeName;
      }
    }
    if (needle == null) return [];

    const namespaces: any = this.api.get().namespaces;
    const out: CompletionItem[] = [];
    for (const i in namespaces) {
      if (i == needle) {
        for (const func of namespaces[i].methods) {
          const args = [];
          const vals = [];
          let index = 0;
          for (const param of func.params) {
            args.push(param.identifier + " " + param.argument);
            vals.push("${" + (index + 1) + ":" + param.argument + "}");
            index += 1;
          }

          const item = new CompletionItem(
            `${func.name}(${args.join(", ")})`,
            CompletionItemKind.Method
          );
          item.detail = func.returns;
          item.documentation = new MarkdownString();
          item.filterText = func.name;
          item.insertText = new SnippetString(
            func.name + `(${vals.join(", ")})`
          );
          const doc = `${i}::${func.name}(${args.join(", ")}) {}`;
          item.documentation.appendCodeblock(doc, "maniascript");
          out.push(item);
        }
        const groupEnum = namespaces[i].enums ?? {};
        Object.keys(groupEnum).forEach((groupName) => {
          groupEnum[groupName].forEach((enumValue: string) => {
            const item = new CompletionItem(
              groupName + "::" + enumValue,
              CompletionItemKind.Enum
            );
            out.push(item);
          });
        });

        return out;
      }
    }
    return [];
  }

  getClasses(): CompletionItem[] {
    const classes = this.api.get().classes;
    return Object.keys(classes).map(
      (label) => new CompletionItem(label, CompletionItemKind.Class)
    );
  }

  getPrimitives(): CompletionItem[] {
    return this.api
      .get()
      .primitives.map(
        (label) => new CompletionItem(label, CompletionItemKind.Value)
      );
  }

  isStruct(name: string): boolean {
    for (const struct of this.typeParser.structures) {
      if (struct.structName == name) return true;
    }
    return false;
  }

  getStructElems(name: string): CompletionItem[] {
    const out: CompletionItem[] = [];
    for (const struct of this.typeParser.structures) {
      if (struct.structName == name) {
        for (const member of struct.members) {
          const item = new CompletionItem(
            member.name,
            CompletionItemKind.Variable
          );
          item.detail = member.type;
          out.push(item);
        }
        return out;
      }
    }
    return out;
  }

  getStructs(stucture: structureType[]): CompletionItem[] {
    const out: CompletionItem[] = [];
    for (const struct of stucture) {
      const item = new CompletionItem(
        struct.structName,
        CompletionItemKind.Struct
      );
      item.detail = "struct";
      let doc = `#Struct ${struct.structName} {` + "\n";
      for (const member of struct.members) {
        doc += `\t ${member.type} ${member.name};` + "\n";
      }
      doc += "}";
      item.documentation = new MarkdownString();
      item.documentation.appendCodeblock(doc, "maniascript");
      out.push(item);
    }
    return out;
  }

  getFunctions(data: functionType[]): CompletionItem[] {
    const out: CompletionItem[] = [];
    for (const func of data) {
      const args = [];
      const vals = [];
      let index = 0;
      for (const param of func.params) {
        args.push(param.type + " " + param.name);
        vals.push("${" + (index + 1) + ":" + param.name + "}");
        index += 1;
      }

      const item = new CompletionItem(
        `${func.name}(${args.join(", ")})`,
        CompletionItemKind.Method
      );
      item.detail = func.returnValue;
      item.documentation = new MarkdownString();
      item.documentation.appendCodeblock(func.docBlock ?? "", "maniascript");
      item.filterText = func.name;
      item.insertText = new SnippetString(func.name + `(${vals.join(", ")})`);

      out.push(item);
    }

    return out;
  }
}
