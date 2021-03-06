import * as vscode from 'vscode';
import { structureType, nameType, includeType } from "./types/typeClasses";
import { removeDuplicates } from "../utils";

export class StructureParser {
  parse(docText: string): structureType[] {
    const output: structureType[] = [];
    const structLines = docText.match(/#Struct\s*(\w+)\s*\{/gm);
    if (structLines !== null) {
      structLines.forEach((struct) => {
        const name = struct.split(/\s/)[1];
        const start = docText.indexOf(struct);
        let end = start;
        for (end; end < docText.length && docText.charAt(end) != "}"; end++);

        if (docText.charAt(end) == "}") {
          const structInfo: string = docText.slice(start + struct.length, end);
          const variableRegex = /(\w+(?:\[(?:\w+?)?\]){0,4})\s*(\w+)\s*;/gm;

          variableRegex.lastIndex = 0;
          const structVar = structInfo.match(variableRegex);
          const elemTypes: nameType[] = [];
          if (structVar !== null) {
            structVar.forEach((vari) => {
              variableRegex.lastIndex = 0;
              const types = variableRegex.exec(vari);
              if (types !== null) {
                elemTypes.push({ name: types[2], type: types[1] });
              }
            });
          }   
          
    
          const offset = docText.indexOf(struct.trim());   
          const lines = docText.slice(0, offset).split("\n");
          const allLines = docText.split("\n");
          const i = lines.length-1;
          const start2 = allLines[i].indexOf(name);
          const range = new vscode.Range(
            i,
            start2,
            i,
            start2 + name.length
          );  

          output.push({
            range: range,
            structName: name,
            members: elemTypes,
            codeBlock: `#Struct ${name} {\n` + structInfo + "}\n",
          });
        }
      });
    }
    return removeDuplicates(output, "structName");
  }
}
