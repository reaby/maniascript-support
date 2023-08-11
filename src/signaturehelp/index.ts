import {
  SignatureHelp,
  SignatureInformation,
  TextDocument,
  Position,
  ParameterInformation,
} from "vscode";
import Api from "../api";
import Completer from "../completions";
import TypeParser from "../typeparser";

export default class SignatureHelper {
  api: Api;
  typeParser: TypeParser;
  completions: Completer;

  constructor(typeParser: TypeParser, api: Api, completions: Completer) {
    this.typeParser = typeParser;
    this.api = api;
    this.completions = completions;
  }

  provideHelp(lineText: string, idx: number, doctext:string) {
    let found = false;
    const requireContext = this.typeParser.getRequireContext(doctext);
    const res = this.resolveFunc(lineText);
    if (res == null) return null;

    const reserved = [
      "if",
      "switch",
      "switchtype",
      "for",
      "foreach",
      "main",
      "log",
      "sleep",
      "while",
    ];
    const arrayFunctions = [
      "add",
      "addfirst",
      "clear",
      "sort",
      "sortreverse",
      "sortkey",
      "sortkeyreverse",
      "removekey",
      "remove",
      "existskey",
      "exists",
      "containsonly",
      "containsoneof",
      "slice",
      "tojson",
      "fromjson",
    ];
    if (reserved.includes(res.function)) return;
    const signature = new SignatureHelp();
    signature.activeSignature = idx;
    signature.activeParameter = res.params.split(",").length - 1;

    if (res.function.indexOf(".") !== -1) {
      const parts = res.function.split(".");
      if (parts.length < 1) return;

      if (arrayFunctions.includes(parts[parts.length - 1])) return;
      let resolved = this.findFunc(parts, requireContext);
      const classes: any = this.api.get().classes;

      if (Object.prototype.hasOwnProperty.call(classes, resolved)) {
        do {
          const groupMethods = classes[resolved].methods || {};
          for (const func of groupMethods) {
            if (func.name == parts[parts.length - 1]) {
              const outParam = [];
              const vals = [];
              for (const param of func.params) {
                outParam.push(new ParameterInformation(param.argument));
                vals.push(param.argument + ":" + param.identifier);
              }
              const si = new SignatureInformation(
                `${func.name}(${vals.join(", ")}): ${func.returns}`
              );
              si.parameters = outParam;
              signature.signatures.push(si);
              found = true;
            }
          }

          resolved = classes[resolved].inherit;
        } while (!(resolved == ""));
      }

      if (found) return signature;
      return null;
    }

    if (res.function.indexOf("::") !== -1) {
      const parts = res.function.split("::");
      if (parts.length == 2) {
        for (const file of this.typeParser.includes) {
          if (file.variableName == parts[0]) {
            const namespaces: any = this.api.get().namespaces;
            for (const i in namespaces) {
              if (i == file.includeName) {
                for (const func of namespaces[i].methods) {
                  if (func.name == parts[1]) {
                    const outParam = [];
                    const vals = [];
                    for (const param of func.params) {
                      outParam.push(new ParameterInformation(param.argument));
                      vals.push(param.argument + ":" + param.identifier);
                    }
                    const si = new SignatureInformation(
                      `${func.name}(${vals.join(", ")}): ${func.returns}`
                    );
                    si.parameters = outParam;
                    signature.signatures.push(si);
                  }
                }
                return signature;
              }
            }
          }
        }

        for (const file of this.typeParser.functionsExternal) {
          if (file.var == parts[0]) {
            for (const func of file.functions) {
              if (func.name == parts[1]) {
                const outparam = [];
                let helpTxt = "";
                for (const param of func.params) {
                  outparam.push(new ParameterInformation(param.name));
                  helpTxt += param.name + ":" + param.type + ", ";
                }
                helpTxt = helpTxt.slice(0, helpTxt.length - 2);

                const si = new SignatureInformation(
                  `${func.name}(${helpTxt}): ${func.returnValue}`
                );
                si.parameters = outparam;
                signature.signatures.push(si);
              }
            }
          }
        }
        return signature;
      }
      return null;
    }

    // plain function
    found = false;
    for (const func of this.typeParser.functions) {
      if (res.function == func.name) {
        const outparam = [];
        let helpTxt = "";
        for (const param of func.params) {
          outparam.push(new ParameterInformation(param.name));
          helpTxt += param.name + ":" + param.type + ", ";
        }
        helpTxt = helpTxt.substr(0, helpTxt.length - 2);

        const si = new SignatureInformation(
          `${func.name}(${helpTxt}): ${func.returnValue}`
        );
        si.parameters = outparam;
        signature.signatures.push(si);
        found = true;
      }
    }
    if (found) return signature;

    const classes: any = this.api.get().classes;
    let resolved = requireContext;
    found = false;
    if (Object.prototype.hasOwnProperty.call(classes, resolved)) {
      do {
        const groupMethods = classes[resolved].methods || {};
        for (const func of groupMethods) {
          if (func.name == res.function) {
            const outParam = [];
            const vals = [];
            for (const param of func.params) {
              outParam.push(new ParameterInformation(param.argument));
              vals.push(param.argument + ":" + param.identifier);
            }
            const si = new SignatureInformation(
              `${func.name}(${vals.join(", ")}): ${func.returns}`
            );
            si.parameters = outParam;
            signature.signatures.push(si);
            found = true;
          }
        }

        resolved = classes[resolved].inherit;
      } while (!(resolved == ""));
    }
    if (found) return signature;
    return null;
  }

  resolveFunc(text: string): any | null {
    const matches = text.match(/\b([a-zA-Z_][\w.:[\]]+)\b\s*\(/);
    let func = "";
    let params = "";
    if (matches != null && matches.length > 0) {
      params = text.slice(text.indexOf(matches[0]) + matches[0].length);
      func = matches[0].replace(/\s+|\(/g, "");

      const paramFunc = params.match(/\b([a-zA-Z_][\w.:]+)\b\s*\(/);
      if (paramFunc !== null && paramFunc.length > 0) {
        func = paramFunc[0].replace(/\s+|\(/g, "");
        params = text.slice(text.indexOf(paramFunc[0]) + paramFunc[0].length);
      }
      return { function: func, params: params };
    }
    return null;
  }

  findFunc(searchChain: string[], requireContext: string) {  
    let vari =
      this.completions.findTypesInContext(searchChain[0], requireContext) ??
      requireContext;
    let resolved = vari;

    for (let count = 0; count < searchChain.length - 1; count++) {
      vari = vari.replace(/\[(.*?)\]/g, "");
      vari = this.completions.findTypesInContext(vari, requireContext) ?? vari;

      const next = searchChain[count + 1].replace(/\[(.*?)\]/g, "");
      for (const member of this.api.getClassProperties(vari)) {
        if (member.name == next) {
          resolved = vari = member.type;
          break;
        }
      }
    }

    // resolved at this point hold the class we're about to need
    return resolved.replace(/\[(.*?)\]/g, "");
  }
}
