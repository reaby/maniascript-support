import * as vscode from "vscode";
import TypeParser from "./typeparser";
import Decorator from "./decorator";
import Completer from "./completions";
import SignatureHelper from "./signaturehelp";

import Api from "./api";

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
  console.log("ManiaScript support is enabled.");

  let timeout: NodeJS.Timer | undefined = undefined;
  const api = new Api();
  api.init();
  const typeParser = new TypeParser();
  const decorator = new Decorator(typeParser);
  const completions = new Completer(typeParser, api);
  const signatureHelper = new SignatureHelper(typeParser, api,  completions);

  let activeEditor: vscode.TextEditor | undefined =
    vscode.window.activeTextEditor;

  if (activeEditor) {
    triggerUpdateDocument();
  }

  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider({language: "maniascript", scheme: "file"},
    {
      provideSignatureHelp(document, position, token, context) {
        const line = new vscode.Range(
          new vscode.Position(position.line, 0),
          position
        );

        const text = document.getText(line);
        const idx = context.activeSignatureHelp?.activeSignature ?? 0;
        typeParser.update(document.getText());
        return signatureHelper.provideHelp(text, idx);
      }
    },
    "("         
    ));

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "maniascript", scheme: "file" },
      {
        provideCompletionItems(document, position, token) {
          const line = new vscode.Range(
            new vscode.Position(position.line, 0),
            position
          );
          const docStartToCurrentLine = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(position.line + 1, 0)
          );
          const text2 = document.getText(docStartToCurrentLine); //limit reading file from start to current line, so variables gets parsed right
          typeParser.update(text2);

          const text = document
            .getText(line)
            .replace(/^\s*/, "")
            .split(/([ |(])/);

          return completions.complete(text, text2);
        },
      },
      "."
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "xml", scheme: "file" },
      {
        provideCompletionItems(document, position, token) {
          const start = new vscode.Position(position.line, 0);
          const range = new vscode.Range(start, position);

          let startToCurrent = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(position.line, 0)
          );
          const index = document.getText(startToCurrent).indexOf("<script>");
          if (index == -1) return [];

          startToCurrent = new vscode.Range(
            document.positionAt(index),
            new vscode.Position(position.line, 0)
          );
          const text = document
            .getText(range)
            .replace(/^\s*/, "")
            .split(/([ |(])/);
          const text2 = document.getText(startToCurrent); //limit reading file from start to current line, so variables gets parsed right
          typeParser.update(text2);
          const completionItems = completions.complete(text, text2);

          return completionItems;
        },
      },
      ".",
      ":",
      "#"
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "jinja-xml", scheme: "file" },
      {
        provideCompletionItems(document, position, token) {
          const start = new vscode.Position(position.line, 0);
          const range = new vscode.Range(start, position);

          let startToCurrent = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(position.line, 0)
          );
          const index = document.getText(startToCurrent).indexOf("<script>");
          if (index == -1) return [];

          startToCurrent = new vscode.Range(
            document.positionAt(index),
            new vscode.Position(position.line, 0)
          );
          const text = document
            .getText(range)
            .replace(/^\s*/, "")
            .split(/([ |(])/);
          const text2 = document.getText(startToCurrent); //limit reading file from start to current line, so variables gets parsed right
          typeParser.update(text2);
          const completionItems = completions.complete(text, text2);

          return completionItems;
        },
      },
      ".",
      ":",
      "#"
    )
  );

  function triggerUpdateDocument() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    timeout = setTimeout(() => {
      decorator.update(activeEditor);
    }, 500);
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        triggerUpdateDocument();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDocument();
      }
    },
    null,
    context.subscriptions
  );
}
