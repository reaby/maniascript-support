import * as vscode from "vscode";

export default class FoldingHelper {
  fold(document: vscode.TextDocument): vscode.FoldingRange[] {
    const ranges: vscode.FoldingRange[] = [];
    const text = document.getText();
    const range = /[*]{3}\s*\w+\s*[*]{3}\n\s*[*]{3}(?:(.|\s))*?[*]{3}/gm;
    const matches = text.matchAll(range);

    for (const m of matches) {
      if (m && m.index) {
        const start = document.positionAt(m.index);
        const end = document.positionAt(m.index + m[0].length);
        ranges.push(
          new vscode.FoldingRange(
            start.line,
            end.line,
            vscode.FoldingRangeKind.Region
          )
        );
      }
    }

    return ranges;
  }
}
