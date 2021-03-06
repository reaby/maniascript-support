import TypeParser from "../typeparser";
import * as vscode from "vscode";

export default class SymbolHelper {
  typeParser: TypeParser;
  constructor(typeParser: TypeParser) {
    this.typeParser = typeParser;
  }

  provideDefinitions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Location | undefined {
    const line = document.getText(
      new vscode.Range(
        new vscode.Position(position.line, 0),
        new vscode.Position(position.line + 1, 0)
      )
    );

    const caret = document.getText(
      new vscode.Range(new vscode.Position(position.line, 0), position)
    );

    const search = this.wordAtCaret(line, caret);

    let found = false;
    let out = new vscode.Location(document.uri, new vscode.Position(0, 0));
    for (const func of this.typeParser.functions) {
      if (func.range) {
        if (func.name == search) {
          if (position.line >= func.range.start.line) {
            return new vscode.Location(document.uri, func.range);
          }
        }
      }
      for (const param of func.params) {
        if (param.name == search) {
          if (
            param.range &&
            position.line >= param.range.start.line &&
            param.range.start >= out.range.start
          ) {
            found = true;
            out = new vscode.Location(document.uri, param.range);
          }
        }
      }
    }

    if (found) return out;
   
    out = new vscode.Location(document.uri, new vscode.Position(0, 0));
    for (const variable of this.typeParser.variables) {
      if (variable.name == search) {
        if (
          variable.range &&
          position.line >= variable.range.start.line &&
          variable.range.start >= out.range.start
        ) {
          found = true;
          out = new vscode.Location(document.uri, variable.range);
        }
      }
    }
    if (found) return out;

    for (const struct of this.typeParser.structures) {
      if (struct.range) {
        if (struct.structName == search) {
          if (position.line >= struct.range.start.line) {
            return new vscode.Location(document.uri, struct.range);
          }
        }
      }
    }

    for (const include of this.typeParser.includes) {
      if (include.range) {
        if (include.variableName == search) {
          if (position.line >= include.range.start.line) {
            return new vscode.Location(document.uri, include.range);
          }
        }
      }
    }

    return;
  }

  wordAtCaret(line: string, text: string): string {
    const current = text.split(/[ ([]/).length - 1;
    const tokens = line.split(/[ ([]/);

    if (tokens.length - 1 >= current) {
      const re = /\w+/.exec(tokens[current]);
      if (re != null) {
        return re[0];
      }
      return "";
    }

    return "";
  }
}
