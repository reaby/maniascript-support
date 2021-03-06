import * as vscode from "vscode";

import { nameType } from "./types/typeClasses";

export class VariableParser {
  parse(text: string): nameType[] {
    if (text == undefined) return [];
    const output: nameType[] = [];
    const allLines = text.split("\n");
    const variableRegex = /((^(\s+)?declare\s+(metadata\s+|netread\s+|netwrite\s+|persistent\s+){0,1}(.*?)\s)|(#Const\s))\w+/gm;

    for (const line in allLines) {
      const lineText = allLines[line];
      const regex = lineText.match(variableRegex);
      if (regex == null) continue;      
      const match = regex[0];
      const result = this.parseVariable(match);
      if (result) {
        const i = Number.parseInt(line);
        const start = allLines[i].indexOf(result.name, 9+result.type.length);
        const range = new vscode.Range(i, start, i, start + result.name.length);
        result.range = range;
        output.push(result);
      }
    }

    const foreachRegex = /foreach\s*\(\s*(?:(\w+)\s*=>\s*)?(\w+)\s+in\s+(.*)\s*\)/gm;
    for (const match of text.match(foreachRegex) ?? []) {
      foreachRegex.lastIndex = -1;
      const mArray = foreachRegex.exec(match);
      if (Array.isArray(mArray) && mArray.length == 4) {
        const name = mArray[2];
        const type = mArray[3];
        const offset = text.indexOf(match.trim());
        const lines = text.slice(0, offset).split("\n");
        const allLines = text.split("\n");
        const i = lines.length - 1;
        const start = allLines[i].indexOf(name);
        const range = new vscode.Range(i, start, i, start + name.length);

        output.push({ name: name, type: type, range: range });
      }
    }

    const lines = text.match(
      /^\s*\b(.*?)\b \b([a-zA-Z0-9_]*)\((.*)\)\s*\{/gm
    );

    if (lines != null) {
      for (const line of lines) {
        if (line == null) continue;
        const method = line.replace(/^s*/, "").match(/\b([^()]+)\((.*)\)/);
        if (method == null) continue;
        if (method.length == 3) {
          const params = method[2].match(/([^,]+\(.+?\))|([^,]+)/g);
          if (params != null) {
            for (const vari of params) {
              if (vari == null) continue;
              const type = vari.split(/\s/);

              const offset = text.indexOf(line.trim());
              const lines = text.slice(0, offset).split("\n");
              const allLines = text.split("\n");
              const i = lines.length - 1;
              const start = allLines[i].indexOf(type[1]);
              const range = new vscode.Range(
                i,
                start,
                i,
                start + type[1].length
              );
              output.push({ name: type[1], type: type[0], range: range });
            }
          }
        }
      }
    }
    return output;
  }

  parseVariable(variableString: string): nameType | undefined {
    const mArray = variableString.replace(/^\s+/, "").split(/\s/);

    const name = mArray.pop() ?? "";
    const type = mArray.pop() ?? "";

    const storageKeywords = [
      "declare",
      "#Const",
      "persistent",
      "metadata",
      "netwrite",
      "netread",
    ];

    if (storageKeywords.includes(type) == false) {
      // if type matches [], it must be array
      if (type.match(/\[(.*)?\]/g)) {
        // var types = type.match(/\w+(?!\[\])?/g);
        // arrayTypes[variablesNames.indexOf(name)] = types;
      }
      return { name: name, type: type };
    }
    return;
  }
}
