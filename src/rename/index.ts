import { groupCollapsed } from "console";
import { parse } from "path";
import * as vscode from "vscode";
import TypeParser from "../typeparser";

export default class RenameHelper {
  typeParser: TypeParser;
  constructor(typeParser: TypeParser) {
    this.typeParser = typeParser;
  }

  rename(
    document: vscode.TextDocument,
    line: string,
    text: string,
    position: vscode.Position,
    newName: string
  ): vscode.WorkspaceEdit {
    const variableRegex = /((^(\s+)?declare\s+(metadata\s+|netread\s+|netwrite\s+|persistent\s+){0,1}(?<type>.*?)\s)|(#Const\s*|#Struct\s*))(?<var>\w+)/gm;
    const functionRegex = /^\s*\b(.*?)\b \b(?<func>[a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)\s*\{/gm;

    const doc: string[] = document.getText().split("\n");
    const caret = this.wordAtCaret(line, text);

    const varResult = variableRegex.exec(line);
    const funcResult = functionRegex.exec(line);
    let search: string | null = null;
    if (varResult != null) {
      if (varResult.groups !== undefined) {
        if (caret == varResult.groups["var"]) search = caret;
      }
    }

    if (funcResult != null) {
      if (funcResult.groups !== undefined) {
        if (this.wordAtCaret(line, text) == funcResult.groups["func"]) {
          search = caret;
        }
      }
    }

    const edit = new vscode.WorkspaceEdit();
    if (search !== null) {
      let i = 0;
      for (const dline of doc) {
        const re = new RegExp(`(?<![.])${search}(?=([^"]*"[^"]*")*[^"]*$)`, "g");
        const matches = dline.matchAll(re);
        for (const match of matches) {
          const start = match.index;
          if (start) {
            const range = new vscode.Range(
              i,
              start,
              i,
              start + match[0].length
            );
            edit.replace(document.uri, range, newName);
          }
        }
        i += 1;
      }
    }
    return edit;
  }

  check(
    document: vscode.TextDocument,
    line: string,
    text: string,
    position: vscode.Position
  ) {
    const tokens = text.trim().split(" ");

    const variableRegex = /((^(\s+)?declare\s+(metadata\s+|netread\s+|netwrite\s+|persistent\s+){0,1}(?<type>.*?)\s)|(#Const\s*|#Struct\s*))(?<var>\w+)/gm;
    const functionRegex = /^\s*\b(.*?)\b \b(?<func>[a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)\s*\{/gm;
    const caret = this.wordAtCaret(line, text);
    const varResult = variableRegex.exec(line);
    const funcResult = functionRegex.exec(line);
    const r = this.rangeAtCaret(line, text);

    const range = new vscode.Range(position.line, r[0], position.line, r[1]);
    if (varResult != null) {
      if (varResult.groups !== undefined) {
        if (caret == varResult.groups["var"])
          return { placeholder: caret, range: range }; // allow rename;
      }
    }

    if (funcResult != null) {
      if (funcResult.groups !== undefined) {
        if (caret == funcResult.groups["func"])
          return { placeholder: caret, range: range };
      }
    }

    throw Error("Can't rename here");
  }

  wordAtCaret(line: string, text: string): string {
    const current = text.trim().split(" ").length - 1;
    const tokens = line.trim().split(" ");

    if (tokens.length - 1 >= current) {
      const re = /\w+/.exec(tokens[current]);
      if (re != null) return re[0];
      return "";
    }
    return "";
  }

  hasComment(line: string) {
    const test = line.match(/["].*["]/);
    if (test != null) return true;
    return false;
  }

  rangeAtCaret(line: string, text: string): number[] {
    const current = text.trim().split(" ").length - 1;
    const tokens = line.trim().split(" ");

    if (tokens.length - 1 >= current) {
      const re = /\w+/.exec(tokens[current]);
      if (re != null) {
        return [line.indexOf(tokens[current]), tokens[current].length];
      }
      return [];
    }
    return [];
  }
}
