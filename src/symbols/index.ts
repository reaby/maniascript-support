import * as vscode from "vscode";
import TypeParser from "../typeparser";

export default class SymbolsHelper {
  typeParser: TypeParser;

  constructor(typeParser: TypeParser) {
    this.typeParser = typeParser;
  }

  update(docText: string): vscode.DocumentSymbol[] {
    const out: vscode.DocumentSymbol[] = [];
    this.typeParser.update(docText);

    for (const elem of this.typeParser.includes) {
      const item = new vscode.DocumentSymbol(
        elem.variableName,
        elem.includeName,
        vscode.SymbolKind.Module,
        elem.range,
        elem.range
      );
      out.push(item);
    }

    for (const elem of this.typeParser.structures) {
      const item = new vscode.DocumentSymbol(
        elem.structName,
        "",
        vscode.SymbolKind.Struct,
        elem.range,
        elem.range
      );
      out.push(item);
    }

    for (const elem of this.typeParser.consts) {
      const item = new vscode.DocumentSymbol(
        elem.name,
        elem.type,
        vscode.SymbolKind.Constant,
        elem.range,
        elem.range
      );
      out.push(item);
    }

    for (const func of this.typeParser.functions) {
      const item = new vscode.DocumentSymbol(
        func.name,
        func.returnValue,
        vscode.SymbolKind.Function,
        func.range,
        func.range
      );
      out.push(item);
    }

    return out;
  }
}
