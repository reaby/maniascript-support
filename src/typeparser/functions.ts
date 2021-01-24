import { functionType, nameType } from "./types/typeClasses";

export class FunctionParser {
  parse(docText: string): functionType[] {
    if (docText == "") return [];
    const docArray = docText.split("\n");
    const output: functionType[] = [];
    const lines = docText.match(
      /^\s*\b(.*?)\b \b([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)\s*\{/gm
    );

    if (lines == null) return [];

    for (const line of lines) {
      if (line == null) continue;
      const method = line.replace(/^s*/, "").match(/\b([^()]+)\((.*)\)/);
      if (method == null) continue;
      if (method.length == 3) {
        const returnType = method[1].split(" ")[0];
        const funcName = method[1].split(" ")[1];
        // parse docblock
        const docs = this.parseDocBlock(
          docArray,
          docArray.findIndex((value) => value == line.trim())
        );

        const body = this.parseFuncBlock(
          docArray,
          docArray.findIndex((value) => value == line.trim())
        );
        if (method[2].replace(/^\s*/, "") == "") {
          output.push({
            name: funcName,
            params: [],
            returnValue: returnType,
            docBlock: docs,
            codeBlock: body,
          });
          continue;
        }
        const outParam: nameType[] = [];
        const params = method[2].match(/([^,]+\(.+?\))|([^,]+)/g);
        if (params != null) {
          for (const vari of params) {
            if (vari == null) continue;
            const type = vari.trim().split(/\s/);
            outParam.push({ name: type[1], type: type[0] });
          }
        }

        output.push({
          name: funcName,
          params: outParam,
          returnValue: returnType,
          docBlock: docs,
          codeBlock: body,
        });
      }
    }
    return output;
  }

  parseFuncBlock(docLines: string[], line: number): string {
    let out = "";
    if (line != -1) {
      for (let i = 0; i < 10; i++) {
        out += docLines[line + i];
        if (docLines[line + i].trim() == "}") return out;
      }
      return out;
    }
    return "";
  }

  parseDocBlock(docLines: string[], line: number): string {
    let out = "";
    if (line != -1) {
      if (docLines[line - 1].includes("*/")) {
        for (let i = 1; i < 30; i++) {
          if (line - i > 0) {
            out = docLines[line - i] + out;
            if (docLines[line - i].includes("/**")) return out;
          }
        }
      }
    }
    return "";
  }
}
