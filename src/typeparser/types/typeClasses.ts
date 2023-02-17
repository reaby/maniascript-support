import * as vscode from "vscode";

export interface includeType {
  includeName: string;
  variableName: string;
  range: vscode.Range;
}

export interface nameType {
  name: string;
  type: string;
  range?: vscode.Range;
}

export interface nameTypeRange {
  name: string;
  type: string;
  range: vscode.Range;
}

export interface structureType {
  structName: string;
  members: nameType[];
  codeBlock: string;
  docBlock?: string;
  range: vscode.Range;
  ext: boolean;
  extType: string;
}

export interface structureTypeExternal {
  file: string;
  var: string;
  structs: structureType[];
  range: vscode.Range;
}

export interface constTypeExternal {
  file: string;
  var: string;
  const: nameType[];
  range: vscode.Range;
}

export interface functionType {
  name: string;
  returnValue: string;
  params: nameTypeRange[];
  docBlock?: string;
  codeBlock: string;
  range: vscode.Range;
}

export interface functionTypeExternal {
  file: string;
  var: string;
  functions: functionType[];
  range: vscode.Range;
}
