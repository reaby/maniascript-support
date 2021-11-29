import * as vscode from "vscode";
const close = /[}]((?=[^"]*(?:"[^"]*"[^"]*)*$)(?=[^']*(?:'[^']*'[^']*)*$))/g;
const open = /[{]((?=[^"]*(?:"[^"]*"[^"]*)*$)(?=[^']*(?:'[^']*'[^']*)*$))/g;

function getIndent(val: number): number {
  if (val < 0) return 0;
  return val;
}

export default (document: vscode.TextDocument): vscode.TextEdit[] => {
  const edits: vscode.TextEdit[] = [];
  let templateString = false;
  let indent = 0;
  let templateIdent = 0;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const text = line.text;
    const matches = text.matchAll(/["]{3}/g);
    if (matches) {
      for (const match of matches) {
        if (match != null) {
          templateString = !templateString;
        }
      }
    }

    if (templateString) {
      const out = "\t".repeat(getIndent(indent + templateIdent)) + text.trim();
      const edit = new vscode.TextEdit(line.range, out);
      edits.push(edit);
      if (text.match(close)) templateIdent -= 1;
      if (text.match(open)) templateIdent += 1;
    } else {
      const out = "\t".repeat(getIndent(indent)) + text.trim();
      const edit = new vscode.TextEdit(line.range, out);
      edits.push(edit);
      if (text.match(close)) indent -= 1;
      if (text.match(open)) indent += 1;
    }
  }

  return edits;
};
