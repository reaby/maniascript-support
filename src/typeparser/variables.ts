import * as vscode from "vscode";
import { nameType, nameTypeRange } from "./types/typeClasses";

export class VariableParser {
  parseConstAndSettings(text: string): nameTypeRange[] {
    if (text == undefined) return [];
    const output: nameTypeRange[] = [];
    const allLines = text.replace(/\r/g, "").split("\n");
    const regex2 = /(\s+)?(#Const|#Setting)\s+(\w+)/g;
    for (const line in allLines) {
      let m2;
      while ((m2 = regex2.exec(allLines[line])) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m2.index === regex2.lastIndex) {
          regex2.lastIndex++;
        }

        const i = Number.parseInt(line);
        const start = allLines[i].indexOf(m2[3]);
        const range = new vscode.Range(i, start, i, start + m2[3].length);
        output.push({ name: m2[3], type: "", range: range });
      }
    }

    return output;
  }

  parse(text: string): nameType[] {
    if (text == undefined) return [];
    const output: nameType[] = [];
    const allLines = text.replace(/\r/g, "").split("\n");
    const regex =
      /(\s+)?declare\s+(metadata\s+|netread\s+|netwrite\s+|persistent\s+)?([\w[\]:]+)\s+(\w+)\s*(for\s+.+?){0,1}\s*(=|<=>|;)/g;
    const regex2 = /(\s+)?(#Const|#Setting)\s+(\w+)/g;

    for (const line in allLines) {
      let m;
      let m2;
      while ((m = regex.exec(allLines[line])) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
          regex.lastIndex++;
        }

        const i = Number.parseInt(line);
        const start = allLines[i].indexOf(m[4], 9 + m[3].length);
        const range = new vscode.Range(i, start, i, start + m[4].length);
        output.push({ name: m[4], type: m[3], range: range });
      }

      while ((m2 = regex2.exec(allLines[line])) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m2.index === regex2.lastIndex) {
          regex2.lastIndex++;
        }

        const i = Number.parseInt(line);
        const start = allLines[i].indexOf(m2[3]);
        const range = new vscode.Range(i, start, i, start + m2[3].length);
        output.push({ name: m2[3], type: "", range: range });
      }
    }

    return output;
  }

  parseForeach(text: string): nameType[] {
    if (text == undefined) return [];
    const output: nameType[] = [];
    const allLines = text.replace(/\r/g, "").split("\n");
    const foreachRegex =
      /foreach\s*\(\s*(?:(\w+)\s*=>\s*)?(\w+)\s+in\s+(.*)\s*\)/gm;
    for (const match of text.match(foreachRegex) ?? []) {
      foreachRegex.lastIndex = -1;
      const mArray = foreachRegex.exec(match);
      if (Array.isArray(mArray) && mArray.length == 4) {
        const keyName = mArray[1];
        const name = mArray[2];
        const type = mArray[3];
        const offset = text.indexOf(match.trim());
        const lines = text.slice(0, offset).split("\n");
        const i = lines.length - 1;

        if (keyName) {
          const start2 = allLines[i].indexOf(keyName);
          const range2 = new vscode.Range(
            i,
            start2,
            i,
            start2 + keyName.length
          );
          output.push({ name: keyName, type: "Integer", range: range2 });
        }
        const start = allLines[i].indexOf(name);
        const range = new vscode.Range(i, start, i, start + name.length);
        output.push({ name: name, type: type, range: range });
      }
    }
    return output;
  }
}
