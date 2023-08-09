import * as vscode from "vscode";
import TypeParser from "../typeparser";

export default class SymbolsHelper {
  typeParser: TypeParser;

  constructor(typeParser: TypeParser) {
    this.typeParser = typeParser;
  }
  /**
   * 
   * @param doc 
   * @returns 
   */
  async update(doc: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
    const out: vscode.DocumentSymbol[] = [];
    await this.typeParser.update(doc, false);

    for (const elem of this.typeParser.includes) {
      if (elem.includeName) {
        const item = new vscode.DocumentSymbol(
          elem.variableName,
          elem.includeName,
          vscode.SymbolKind.Module,
          elem.range,
          elem.rangeName
        );
        out.push(item);
      }
    }

    for (const elem of this.typeParser.structures) {
      if (elem.structName) {
        const item = new vscode.DocumentSymbol(
          elem.structName,
          "",
          vscode.SymbolKind.Struct,
          elem.range,
          elem.range,
        );
        out.push(item);
      }
    }

    for (const elem of this.typeParser.consts) {
      if (elem.name) {
        const item = new vscode.DocumentSymbol(
          elem.name,
          elem.type,
          vscode.SymbolKind.Constant,
          elem.range,
          elem.range
        );
        out.push(item);
      }
    }

    for (const elem of this.typeParser.labels) {
      if (elem.name) {
        const item = new vscode.DocumentSymbol(
          elem.name,
          "",
          vscode.SymbolKind.Field,
          elem.range,
          elem.range,
        );
        out.push(item);
      }
    }

    for (const func of this.typeParser.functions) {
      if (func.name) {
        const item = new vscode.DocumentSymbol(
          func.name,
          func.returnValue,
          vscode.SymbolKind.Function,
          func.range,
          func.nameRange
        );
        out.push(item);
      }
    }
    
    return out;
  }
}
