import * as fs from "fs";
import { TextEditor, workspace } from "vscode";
import {
  includeType,
  structureType,
  structureTypeExternal,
  functionType,
  functionTypeExternal,
  nameType,
} from "./types/typeClasses";
import { StructureParser } from "./structs";
import { FunctionParser } from "./functions";
import { VariableParser } from "./variables";

export default class TypeParser {
  includes: includeType[] = [];
  structures: structureType[] = [];
  structuresExternal: structureTypeExternal[] = [];
  functionsExternal: functionTypeExternal[] = [];
  functions: functionType[] = [];
  variables: nameType[] = [];
  requireContext = "";
  constructor() {
    // do stuff
  }

  update(text: string) {
    const match = text.match(/(#RequireContext\s+\w+)|(@context\s+\w+)/m);
    let requireContext = "";
    if (match) {
      requireContext = match[0]?.split(" ")?.pop() ?? "";
    }
    this.requireContext = requireContext;

    this.includes = this.parseIncludes(text);
    const struct = new StructureParser();
    const functions = new FunctionParser();
    const variables = new VariableParser();

    this.structures = struct.parse(text);
    this.structuresExternal = [];
    this.functionsExternal = [];
    for (const include of this.includes) {
      this.structuresExternal.push({
        file: include.includeName,
        var: include.variableName,
        structs: struct.parse(this.getExternalFile(include.includeName)),
      });
      this.functionsExternal.push({
        file: include.includeName,
        var: include.variableName,
        functions: functions.parse(this.getExternalFile(include.includeName)),
      });
    }

    this.functions = functions.parse(text);
    this.variables = variables.parse(text);
  }

  getExternalFile(filename: string): string {
    try {
      if (filename.match(/\.[sS]cript\.txt/) === null) return "";

      for (const path of workspace.workspaceFolders ?? []) {
        const file = path.uri.fsPath + "/" + filename;
        if (fs.existsSync(file)) {
          return fs.readFileSync(path.uri.fsPath + "/" + filename).toString();
        }
      }
    } catch (e) {
      console.log(e);
    }
    return "";
  }

  parseIncludes(text: string): includeType[] {
    const includes: includeType[] = [];

    const namespacesMatch = text.match(/^\s*#Include "(\S+)" as (\w+)/gm);
    const matches = [...new Set(namespacesMatch)];

    matches.forEach((definition) => {
      const ref = definition.split('"')[1] ?? "";
      const name = definition.split(" ")?.pop()?.replace("s*", "") ?? "";
      includes.push({ includeName: ref, variableName: name });
    });

    return includes;
  }
}
