import { nameType } from "./types/typeClasses";

export class VariableParser {
  parse(text: string): nameType[] {
    const output: nameType[] = [];

    const variableRegex = /((^(\s+)?declare\s+(metadata\s+|netread\s+|netwrite\s+|persistent\s+){0,1}(.*?)\s)|(#Const\s))\w+/gm;

    const variableMatch = [...new Set(text.match(variableRegex))];
    variableMatch.forEach((match) => {
      const result = this.parseVariable(match);
      if (result) {
        output.push(result);
      }
    });
    const foreachRegex = /foreach\s*\(\s*(?:(\w+)\s*=>\s*)?(\w+)\s+in\s+(.*)\s*\)/gm;
    for (const match of text.match(foreachRegex) ?? []) {
      foreachRegex.lastIndex = -1;
      const mArray = foreachRegex.exec(match);
      if (Array.isArray(mArray) && mArray.length == 4) {
        const name = mArray[2];
        const type = mArray[3];
        output.push({ name: name, type: type });
      }
    }

    const lines = text.match(
      /^\s*\b(.*?)\b \b([a-zA-Z][a-zA-Z0-9_]*)\((.*)\)\s*\{/gm
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
              output.push({ name: type[1], type: type[0] });
            }
          }
        }
      }
    }
    return output;
  }

  /* parseForeach(text: string): nameType[] {
    const out: nameType[] = [];
    const foreachRegex = /foreach\s*\(\s*(?:(\w+)\s*=>\s*)?(\w+)\s+in\s+(.*)\s*\)/gm;
    for (const match of text.match(foreachRegex) ?? []) {
      foreachRegex.lastIndex = -1;
      const mArray = foreachRegex.exec(match);
      if (Array.isArray(mArray) && mArray.length == 4) {
        const name = mArray[2];
        const type = mArray[3];
        out.push({ name: name, type: type });
      }
    }
    return out;
  } */

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
