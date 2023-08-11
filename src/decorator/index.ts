import * as vscode from "vscode";
import TypeParser from "../typeparser";
import Api from "../api";
import Completer from "../completions";

export default class Decorator {
  typeParser: TypeParser;
  api: Api;
  completer: Completer;

  templatestringColor: vscode.TextEditorDecorationType =
    vscode.window.createTextEditorDecorationType({
      isWholeLine: false,
      backgroundColor: { id: "textCodeBlock.background" },
    });

  /**
   * @type {vscode.TextEditorDecorationType}
   * @memberof Decorator
   */
  templatestringBgColor: vscode.TextEditorDecorationType =
    vscode.window.createTextEditorDecorationType({
      overviewRulerColor: { id: "textBlockQuote.border" },
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      isWholeLine: true,
      backgroundColor: { id: "textCodeBlock.background" },
    });

  structColor = vscode.window.createTextEditorDecorationType({
    color: { id: "maniascript.structColor" },
  });

  constColor = vscode.window.createTextEditorDecorationType({
    color: { id: "maniascript.constColor" }
  });

  constructor(type: TypeParser, api: Api, completer: Completer) {
    this.typeParser = type;
    this.api = api;
    this.completer = completer;
  }

  getContextProperties(className: string): string[] {
    const out: string[] = [];
    const classes = this.api.get().classes;

    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const props = classes[className].props || {};
        Object.keys(props).forEach((groupName) => {
          props[groupName].forEach((prop: any) => {
            out.push(prop.name);
          });
        });

        className = classes[className].inherit;
      } while (!(className === ""));
    }
    return out;
  }

  async update(activeEditor: vscode.TextEditor | undefined): Promise<void> {
    if (!activeEditor) {
      return;
    }

    const regEx = /"{3}([\s\S]*?"{3})/g;
    const text = activeEditor.document.getText();
    const singleLineTemplateStrings: vscode.DecorationOptions[] = [];
    const multiLineTemplateStrings: vscode.DecorationOptions[] = [];
    const structs: vscode.DecorationOptions[] = [];
    const consts: vscode.DecorationOptions[] = [];    
    let match;
    
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

    await this.typeParser.update(text, false);

    for (const struct of this.typeParser.structures) {
      const re = new RegExp(`(?:(?<![.]))\\b(${struct.structName})\\b`, "g");
      let line;
      while ((line = re.exec(text))) {
        if (line[1].startsWith("K_")) continue;
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

    const re = new RegExp(/(\s+for\s+)(\w+)(.*?)?\s*;/, "g");
    let line;
    while ((line = re.exec(text))) {
      const pos = line.index + line[1].length;
      const startPos = activeEditor.document.positionAt(pos);
      const endPos = activeEditor.document.positionAt(pos + line[2].length);

      const decoration: vscode.DecorationOptions = {
        range: new vscode.Range(startPos, endPos),
      };
      structs.push(decoration);
    }

    for (const obj of this.typeParser.consts) {
      const re = new RegExp(`\\b(${obj.name})\\b`, "gm");
      let line;
      while ((line = re.exec(text))) {
        if (line[1].startsWith("C_")) continue;        
        const pos = line.index;
        const startPos = activeEditor.document.positionAt(pos);
        const endPos = activeEditor.document.positionAt(pos + line[1].length);
        const decoration: vscode.DecorationOptions = {
          range: new vscode.Range(startPos, endPos),
        };
        consts.push(decoration);
      }
    }

    const vars = this.getContextProperties(this.typeParser.getRequireContext(text));
    for (const obj of vars) {
      const re = new RegExp(`\\b(${obj})\\b`, "g");
      let line;
      while ((line = re.exec(text))) {
        const pos = line.index;
        const startPos = activeEditor.document.positionAt(pos);
        const endPos = activeEditor.document.positionAt(pos + line[1].length);
        const decoration: vscode.DecorationOptions = {
          range: new vscode.Range(startPos, endPos),
        };
        consts.push(decoration);
      }
    }

    for (const lang of await this.typeParser.getEmbeddedLanguages(text)) {
      if (lang.type == "maniascript") {
        const vars = this.getContextProperties(this.typeParser.getRequireContext(lang.value));
        for (const obj of vars) {
          const re = new RegExp(`\\b(${obj})\\b`, "g");
          let line;
          while ((line = re.exec(text))) {
            const pos = line.index;
            const startPos = activeEditor.document.positionAt(pos);
            const endPos = activeEditor.document.positionAt(pos + line[1].length);
            const decoration: vscode.DecorationOptions = {
              range: new vscode.Range(startPos, endPos),
            };
            consts.push(decoration);
          }
        }
      }
    }

    for (const key in this.api.completions.classes) {
      const not = this.api.completions.primitives;
      if (not.includes(key)) continue;
      const _class = this.api.completions.classes[key];

      const re = new RegExp(`(?:(?<![.]))\\b(${key})\\b`, "g");
      let match;
      while ((match = re.exec(text))) {
        const startPos = activeEditor.document.positionAt(match.index);
        const endPos = activeEditor.document.positionAt(
          match.index + match[1].length
        );

        const message = new vscode.MarkdownString();
        message.appendCodeblock(key, "maniascript");

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
    activeEditor.setDecorations(this.constColor, consts);
  }


}
