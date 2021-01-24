export interface includeType {
  includeName: string;
  variableName: string;
}

export interface nameType {
  name: string;
  type: string;
}

export interface structureType {
  structName: string;
  members: nameType[];
  codeBlock: string;
  docBlock?: string;
}
export interface structureTypeExternal {
  file: string;
  var: string;
  structs: structureType[];
}

export interface functionType {
  name: string;
  returnValue: string;
  params: nameType[];
  docBlock?: string;
  codeBlock: string;
}

export interface functionTypeExternal {
  file: string;
  var: string;
  functions: functionType[];
}
