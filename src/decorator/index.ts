import * as vscode from "vscode";
import TypeParser from "../typeparser";

export default class Decorator {
  // create a decorator type that we use to decorate small numbers
  typeParser: TypeParser;

  templatestringColor: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType(
    {
      isWholeLine: false,
      backgroundColor: { id: "textCodeBlock.background" },
    }
  );

  templatestringBgColor: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType(
    {
      overviewRulerColor: { id: "textBlockQuote.border" },
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      isWholeLine: true,
      backgroundColor: { id: "textCodeBlock.background" },
    }
  );
  structColor = vscode.window.createTextEditorDecorationType({
    color: { id: "maniascript.structColor" },
  });

  constructor(type: TypeParser) {
    this.typeParser = type;
  }

  update(activeEditor: vscode.TextEditor | undefined): void {
    if (!activeEditor) {
      return;
    }

    const regEx = /"{3}([\s\S]*?"{3})/g;
    const text = activeEditor.document.getText();
    let match;

    const singleLineTemplateStrings: vscode.DecorationOptions[] = [];
    const multiLineTemplateStrings: vscode.DecorationOptions[] = [];
    const structs: vscode.DecorationOptions[] = [];

    while ((match = regEx.exec(text))) {
      const startPos = activeEditor.document.positionAt(match.index);
      const endPos = activeEditor.document.positionAt(
        match.index + match[0].length
      );
      const decoration: vscode.DecorationOptions = {
        range: new vscode.Range(startPos, endPos),
      };
      if (startPos.line == endPos.line) {
        singleLineTemplateStrings.push(decoration);
      } else {
        multiLineTemplateStrings.push(decoration);
      }
    }

    for (const struct of this.typeParser.structures) {
      const re = new RegExp(`(?:(?<![.]))\\b(${struct.structName})\\b`, "g");
      let line;
      while ((line = re.exec(text))) {
        const startPos = activeEditor.document.positionAt(line.index);
        const endPos = activeEditor.document.positionAt(
          line.index + line[1].length
        );
        const message = new vscode.MarkdownString();
        message.appendCodeblock(struct.codeBlock);

        const decoration: vscode.DecorationOptions = {
          range: new vscode.Range(startPos, endPos),
          hoverMessage: message,
        };
        structs.push(decoration);
      }
    }

    activeEditor.setDecorations(
      this.templatestringColor,
      singleLineTemplateStrings
    );
    activeEditor.setDecorations(
      this.templatestringBgColor,
      multiLineTemplateStrings
    );
    activeEditor.setDecorations(this.structColor, structs);
  }
}
