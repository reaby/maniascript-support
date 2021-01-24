import * as doch from "./doch.json";
import { completionsTemplate } from "./completions";

import * as fs from "fs";
import { ApiParser } from "./types";

export default class ManiaplanetApiParser implements ApiParser {
  parse(fileName: string): any {
    if (fileName == null) {
      console.log("Using build-in completions for ManiaPlanet maniascript!");
      return doch;
    }
    let completions: any = completionsTemplate;

    if (fs.existsSync(fileName)) {
      try {
        completions = {
          primitives: [],
          namespaces: {},
          classes: {
            Vec2: {
              inherit: "",
              enums: {},
              methods: [],
              props: {
                Real: ["X", "Y"],
              },
            },
            Vec3: {
              inherit: "",
              enums: {},
              methods: [],
              props: {
                Real: ["X", "Y", "Z"],
              },
            },
            Int3: {
              inherit: "",
              enums: {},
              methods: [],
              props: {
                Integer: ["X", "Y", "Z"],
              },
            },
          },
        };

        let file = fs.readFileSync(fileName).toString();
        file = file.replace(/\*(.|\n)*?\*/g, "");
        const fileArray = file.split("\n");
        const regexPrimitives = /class\s*(?<name>.*?)\s*\{\};/g;
        for (const line of file.match(regexPrimitives) ?? []) {
          regexPrimitives.lastIndex = -1;
          const primitive = regexPrimitives.exec(line);
          if (primitive) {
            completions.primitives.push(primitive.groups?.name);
          }
        }

        const regexNamespaces = /namespace\s+(.*?)\s*\{/g;
        for (const match of file.match(regexNamespaces) ?? []) {
          const startLine = fileArray.indexOf(match);
          const scopeArray: string[] = [];
          let line = startLine;
          while (!fileArray[line].match(/^};/gm)) {
            scopeArray.push(fileArray[line]);
            line += 1;
          }
          this.processNamespace(scopeArray, completions);
        }

        const regexClasses = /struct\s+(.*?)\s+(.*?)\{/g;
        const matches = file.match(regexClasses) ?? [];
        for (const match of matches) {
          const startLine = fileArray.indexOf(match);
          let line = startLine;
          const scopeArray: string[] = [];
          while (!fileArray[line].match(/^\};/gm)) {
            scopeArray.push(fileArray[line]);
            line += 1;
          }
          this.processClasses(scopeArray, completions);
        }
      } catch (err) {
        console.log("doc.h read error: " + err);
        //  console.log(err.stack);
        console.log("Using build-in completions for ManiaPlanet maniascript!");
        return doch;
      }

      console.log(
        "Using file: " + fileName + " for ManiaPlanet maniascript completions!"
      );
      return completions;
    }
    return doch;
  }

  processNamespace(data: string[], completions: any): void {
    const regexNamespaces = /namespace\s+(.*?)\s*\{/g;
    regexNamespaces.lastIndex = -1;
    const name = regexNamespaces.exec(data[0]);
    if (name) {
      const namespaceObj = {
        enums: this.parseEnums(data),
        methods: this.parseMethods(data) ?? [],
      };
      completions.namespaces[name[1]] = namespaceObj;
    }
  }

  processClasses(data: string[], completions: any): void {
    const regex = /struct\s+\b(.*?)\b\s+(:\s+public\s+\b(.*?)\b\s+){0,1}/gm;
    regex.lastIndex = -1;
    const value = regex.exec(data[0]);
    if (value) {
      const classObj = {
        inherit: value[3] || "",
        enums: this.parseEnums(data),
        props: this.parseProperties(data) ?? {},
        methods: this.parseMethods(data) ?? [],
      };

      completions.classes[value[1]] = classObj;
    }
  }

  parseEnums(data: string[]): any {
    const out: any = {};
    const stringData = data.join("\n");
    const regex = /\s*enum\s+\b(.+?)\b.*/g;
    regex.lastIndex = -1;
    const lines2 = stringData.match(regex);
    if (lines2) {
      for (const enumLine of lines2) {
        regex.lastIndex = -1;
        const enumval = regex.exec(enumLine);
        if (enumval) {
          let line = data.indexOf(enumLine.replace("\n", "")) + 1;
          if (line != 0) {
            const enumValues = [];
            while (!data[line].match(/\s*\};/g)) {
              enumValues.push(data[line].trim());
              line += 1;
            }
            out[enumval[1]] = enumValues;
          }
        }
      }
    }
    return out;
  }

  parseMethods(data: string[]): any | undefined {
    const out: any = [];    
    const regex = /\s*\b(.+?)\b\s+(.*(?=\()).*/g;
    regex.lastIndex = -1;
    for (const line of data) {
      regex.lastIndex = -1;
      const value = regex.exec(line);
      if (value) {
        const methodParams: any = [];
        const getTypes = value.input.match(/\((.*)\)/);
        if (!getTypes) return;
        for (const type of getTypes[1].split(",")) {
          if (type !== "") {
            const param = type.trim().split(" ");
            methodParams.push({
              identifier: param[0],
              argument: param[1],
            });
          }
        }
        out.push({
          name: value[2],
          returns: value[1],
          params: methodParams,
        });
      }
    }

    return out;
  }

  parseProperties(data: string[]): any | undefined {
    const out: any = {};
    const regex = /^\s*(const){0,1}\s*(.+?)\s+\b(.+?)\b;/g;
    regex.lastIndex = -1;
    for (const line of data) {
      regex.lastIndex = -1;
      const value = regex.exec(line);
      if (value) {
        if (!Object.prototype.hasOwnProperty.call(out, value[2])) {
          out[value[2]] = [];
        }
        const readOnly = value[1] == "const" ? true : false;
        out[value[2]].push({
          name: value[3],
          readonly: readOnly,
        });
      }
    }

    return out;
  }
}
