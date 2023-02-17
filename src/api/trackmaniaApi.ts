import * as fs from "fs";
import { completionsTemplate } from "./completions";
import * as doch from "./doch.json";
import { ApiParser } from "./types";

export default class TrackmaniaApiParser implements ApiParser {
  parse(fileName: string): any {
    let completions: any = completionsTemplate;

    if (fileName == null) {
      console.log("Using build-in completions for Trackmania maniascript!");
      return doch;
    }

    if (fs.existsSync(fileName)) {
      try {
        completions = completionsTemplate;
        const file = fs.readFileSync(fileName).toString();
        const fileArray = file.split("\n");

        const regexNamespaces = /^namespace\s+(.*?)\s*\{/gm;
        for (const match of file.match(regexNamespaces) || []) {
          const startLine = fileArray.indexOf(match);
          let line = startLine;
          const scopeArray = [];
          while (!fileArray[line].match(/^\};/gm)) {
            scopeArray.push(fileArray[line]);
            line += 1;
          }
          completions = this.processNamespace(scopeArray, completions);
        }

        const regexClasses =
          /^class\s+\b(.*?)\b\s+(:\s+public\s+\b(.*?)\b\s+){0,1}.*/gm;
        const matches = file.match(regexClasses) ?? [];
        for (const match of matches) {
          const startLine = fileArray.indexOf(match);
          let line = startLine;
          const scopeArray = [];
          if (startLine == -1) continue;
          while (!fileArray[line].match(/^\};/gm)) {
            scopeArray.push(fileArray[line]);
            line += 1;
          }

          completions = this.processClasses(scopeArray, fileArray, completions);
        }
      } catch (err: any) {
        console.log("doc.h read error: " + err);
        console.log(err.stack);
        console.log("No completions in use!");
        return doch;
      }
      console.log(
        "Using file: " + fileName + " for Trackmania maniascript completions!"
      );
      return completions;
    }
    return doch;
  }

  processNamespace(data: string[], completions: any): any {
    const regexNamespaces = /namespace\s+(.*?)\s*\{/g;
    regexNamespaces.lastIndex = -1;
    const name = regexNamespaces.exec(data[0]);
    if (name) {
      const namespaceObj = {
        enums: this.parseEnums(data) ?? {},
        methods: this.parseMethods(data) ?? []
      };
      completions.namespaces[name[1]] = namespaceObj;
    }
    return completions;
  }

  processClasses(data: string[], fileArray: string[], completions: any): any {
    const regex = /class\s+\b(.*?)\b\s+(:\s+public\s+\b(.*?)\b\s+){0,1}/g;
    regex.lastIndex = -1;
    const value = regex.exec(data[0]) ?? null;
    if (value != null) {
      const classObj = {
        inherit: value[3] || "",
        enums: this.parseEnums(data) ?? {},
        props: this.parseProperties(data) ?? {},
        methods: this.parseMethods(data) ?? [],
        documentation: this.parseDoc(fileArray, data[0]) ?? "",
      };
      completions.classes[value[1]] = classObj;
    }
    return completions;
  }

  parseEnums(data: string[]): any {
    const out: any = {};
    const stringData = data.join("\n");
    const regex = /[\t\v ]*enum\s+\b(\w+?)\b.*/g;
    regex.lastIndex = -1;
    const lines2 = stringData.match(regex);
    if (lines2) {
      for (const enumLine of lines2) {
        regex.lastIndex = -1;
        const enumval = regex.exec(enumLine);
        let line = data.indexOf(enumLine) + 1;
        if (line != 0) {
          const enumValues = [];
          while (!data[line].match(/\s*\};/g)) {
            enumValues.push(data[line].trim().replace(",", ""));
            line += 1;
          }
          if (enumval) {
            out[enumval[1]] = enumValues;
          }
        }
      }
    }
    return out;
  }

  fixArrays(value: string): string {
    const result = /Array<(.*?)>/g.exec(value);
    if (result) {
      return result[1] + "[]";
    }
    return value;
  }

  parseMethods(data: string[]): any {
    const out = [];
    const regex = /\s*(.+?)\s+(.*(?=\()).*;/g;
    regex.lastIndex = -1;
    for (const idx in data) {
      const line = data[idx];
      regex.lastIndex = -1;
      const value = regex.exec(line);
      if (value) {
        const methodParams = [];
        const getTypes = value.input.match(/\((.*)\)/);
        if (getTypes) {
          for (const type of getTypes[1].split(",")) {
            if (type != "") {
              const param = type.trim().split(" ");
              methodParams.push({
                identifier: this.fixArrays(param[0]),
                argument: param[1],
              });
            }
          }
        }
        out.push({
          name: value[2],
          returns: this.fixArrays(value[1]),
          params: methodParams,
          documentation: this.parseDoc(data, idx),
        });
      }
    }

    return out;
  }

  parseDoc(data: string[], line: string) {
    const regex = /\s*\/\*!/g;
    const lines = [];
    for (let i = 0; i <= 20; i++) {
      const lineData = data[parseInt(line) - 1 - i];
      if (lineData && lineData.match(regex)) {
        return lines.reverse().join("\n");
      }
      const docLine = (lineData ?? "")
        .replace(/(\s*\/\*!)|(\s*\*\/)|(\s*\*)/g, "")
        .trim();
      if (docLine !== "") {
        lines.push(docLine);
      }
    }
    return "";
  }

  parseProperties(data: string[]): any {
    const out: any = {};
    const regex = /\s*([\w:*]+)\s*[*]{0,1}\s*(const){0,1}\s*([\w[\]<>:]+?);/;
    regex.lastIndex = -1;
    const regex2 = /Array<([\w:]+)\s*[*]{0,1}\s*(const){0,1}\s*>\s+([\w[\]<>:]+?);/;
    regex2.lastIndex = -1;
    for (const idx in data) {
      const line = data[idx].trim();
      if (line.startsWith("Array")){
        regex2.lastIndex = -1;
        const value = regex2.exec(line);
        if (value !== null) {
          if (
            !Object.prototype.hasOwnProperty.call(out, value[1]+"[]")
          ) {
            out[value[1]+"[]"] = [];
          }
          const readOnly = value[2] !== undefined ? true : false;
          out[value[1]+"[]"].push({
            name: value[3],
            readonly: readOnly,
            documentation: this.parseDoc(data, idx),
          });
        }
        continue;
      }

      regex.lastIndex = -1;
      const value = regex.exec(line);
      if (value !== null) {
        if (
          !Object.prototype.hasOwnProperty.call(out, value[1])
        ) {
          out[value[1]] = [];
        }
        const readOnly = value[2] !== undefined ? true : false;
        out[value[1]].push({
          name: value[3],
          readonly: readOnly,
          documentation: this.parseDoc(data, idx),
        });
      }
    }
    return out;
  }
}
