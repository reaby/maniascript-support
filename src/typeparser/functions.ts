import { Range } from "vscode";
import { functionType, nameType } from "./types/typeClasses";

export class FunctionParser {
  parse(docText: string): functionType[] {
    if (docText == "") return [];
    const docArray = docText.split("\n");
    const output: functionType[] = [];
    const lines = docText.match(
      /^(\t| )*\b(.*?)\b \b([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)\s*\{(\t| )*/gm
    );

    if (lines == null) return [];

    for (let line of lines) {
      if (line == null) continue;
      if (line.indexOf("\n") != -1) line = line.split("\n")[0];
      const method = line.replace(/^s*/, "").match(/\b([^()]+)\((.*)\)/);
      if (method == null) continue;
      if (method.length == 3) {
        const returnType = method[1].split(" ")[0];
        const funcName = method[1].split(" ")[1];
        // parse docblock

        const lineNb = docArray.indexOf(line);
        const docs = this.parseDocBlock(docArray, lineNb);
        const body = this.parseFuncBlock(docArray, lineNb);

        const offset = docText.indexOf(line.trim());
        const lines = docText.slice(0, offset).split("\n");
        let i = lines.length - 1;
        if (i < 0) i = 0;
        const start = lineNb;
        const range = new Range(i, start, i, start + funcName.length);

        if (method[2].replace(/^\s*/, "") == "") {
          output.push({
            name: funcName,
            params: [],
            returnValue: returnType,
            docBlock: docs,
            codeBlock: body,
            range: range,
          });
          continue;
        }
        const outParam: nameType[] = [];
        const params = method[2].match(/([^,]+\(.+?\))|([^,]+)/g);
        let counter = 0;
        if (params != null) {
          for (const vari of params) {
            if (vari == null) continue;
            const type = vari.trim().split(/\s/);
            const start2 = docArray[i].indexOf(
              type[1],
              method[1].length + 1 + type[0].length
            );
            counter += type[1].length;
            const range2 = new Range(i, start2, i, start2 + type[1].length);
            outParam.push({ name: type[1], type: type[0], range: range2 });
          }
        }

        output.push({
          name: funcName,
          params: outParam,
          returnValue: returnType,
          docBlock: docs,
          codeBlock: body,
          range: range,
        });
      }
    }
    return output;
  }

  parseFuncBlock(docLines: string[], line: number): string {
    let out = "";
    if (line != -1) {
      for (let i = 0; i <= 5; i++) {
        out += docLines[line + i] + "\n";
        if (docLines[line + i]??"".trim() == "}") return out;
      }
      return out;
    }
    return "";
  }

  parseDocBlock(docLines: string[], line: number): string {
    let out = "";
    if (line != -1) {
      if (
        docLines[line - 1].includes("*/") ||
        docLines[line - 2].includes("*/")
      ) {
        for (let i = 1; i < 30; i++) {
          if (line - i > 0) {
            out = docLines[line - i] + "\n" + out;
            if (docLines[line - i].includes("/**")) return out;
          }
        }
      }
    }
    return "";
  }
}
