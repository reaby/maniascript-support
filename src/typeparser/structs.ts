import * as vscode from "vscode";
import { structureType, nameType, includeType } from "./types/typeClasses";
import { removeDuplicates } from "../utils";

export class StructureParser {
  parse(docText: string): structureType[] {
    const output: structureType[] = [];
    const allLines = docText.split("\n");
    for (const line of allLines) {
      const regex = /#Struct\s*([\w:]+)\s*(as\s+(\w+)\s*){0,1}(\{){0,1}/;
      const m = regex.exec(line);
      let name = "";
      if (m != null) {
        name = m[1];
        const elemTypes: nameType[] = [];
        let structInfo = "";
        let isExt = false;
        let extType = "";
        if (m[3] != undefined) {
          name = m[3];
          structInfo = "";
          isExt = true;
          extType = m[1];
        } else {
          const start = docText.indexOf(line);
          let end = start;
          for (end; end < docText.length && docText.charAt(end) != "}"; end++);

          if (docText.charAt(end) == "}") {
            structInfo = docText.slice(start + m[0].length, end);
            const variableRegex = /(\w+(?:\[(?:\w+?)?\]){0,4})\s*(\w+)\s*;/gm;

            variableRegex.lastIndex = 0;
            const structVar = structInfo.match(variableRegex);

            if (structVar !== null) {
              structVar.forEach((vari) => {
                variableRegex.lastIndex = 0;
                const types = variableRegex.exec(vari);
                if (types !== null) {
                  elemTypes.push({ name: types[2], type: types[1] });
                }
              });
            }
          }
        }
        const offset = docText.indexOf(m[0].trim());
        const lines = docText.slice(0, offset).split("\n");
        const i = lines.length - 1;
        const start2 = allLines[i].indexOf(name);
        const range = new vscode.Range(i, start2, i, start2 + name.length);

        output.push({
          range: range,
          structName: name,
          members: elemTypes,
          codeBlock: m[0] + structInfo + "\n}",
          ext: isExt,
          extType: extType,
        });
      }
    }

    return removeDuplicates(output, "structName");
  }
}
