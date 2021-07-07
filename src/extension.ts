import * as vscode from "vscode";
import TypeParser from "./typeparser";
import Decorator from "./decorator";
import Completer from "./completions";
import SignatureHelper from "./signaturehelp";
import RenameHelper from "./rename";
import DefinitionHelper from "./definition";
import HoverHelper from "./hover";
import FoldingHelper from "./folding";
import ManialinkPreview from "./ManialinkPreview";
import Api from "./api";
import FoldingRangeHelper from "./folding";

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
  console.log("ManiaScript support is enabled.");

  let timeout: NodeJS.Timer | undefined = undefined;
  const api = new Api();
  api.init();
  const typeParser = new TypeParser();
  const decorator = new Decorator(typeParser);
  const completions = new Completer(typeParser, api);
  const signatureHelper = new SignatureHelper(typeParser, api, completions);
  const renameHelper = new RenameHelper(typeParser);
  const definitionHelper = new DefinitionHelper(typeParser);
  const hoverHelper = new HoverHelper(typeParser, api, completions);
  const foldingHelper = new FoldingRangeHelper();
  let activeEditor: vscode.TextEditor | undefined =
    vscode.window.activeTextEditor;

  if (activeEditor) {
    triggerUpdateDocument();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("manialink.preview", () => {
      if (vscode.window.activeTextEditor) {
        ManialinkPreview.createOrShow(
          vscode.window.activeTextEditor.document.getText(),
          context.extensionUri
        );
      }
    })
  );

  /*if (vscode.window.registerWebviewPanelSerializer) {
    // Make sure we register a serializer in activation event
    vscode.window.registerWebviewPanelSerializer(ManialinkPreview.viewType, {
      async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        state: any
      ) {
        console.log(`Got state: ${state}`);
        // Reset the webview options so we use latest uri for `localResourceRoots`.
        webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
        if (vscode.window.activeTextEditor) {
          ManialinkPreview.revive(
            webviewPanel,
            context.extensionUri,
            vscode.window.activeTextEditor.document.getText()
          );
        }
      },
    });
  } */

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "maniascript", scheme: "file" },
      {
        provideHover(document, position, token) {
          typeParser.update(document.getText().replace(/\r/g, "") || "");
          return hoverHelper.onHover(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "xml", scheme: "file" },
      {
        provideHover(document, position, token) {
          let startToCurrent = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(position.line, 0)
          );
          const index = document.getText(startToCurrent).indexOf("<script>");
          if (index == -1) return null;

          startToCurrent = new vscode.Range(
            document.positionAt(index),
            new vscode.Position(position.line, 0)
          );

          typeParser.update(
            document.getText(startToCurrent).replace(/\r/g, "") || ""
          );
          return hoverHelper.onHover(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "jinja-xml", scheme: "file" },
      {
        provideHover(document, position, token) {
          let startToCurrent = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(position.line, 0)
          );
          const index = document.getText(startToCurrent).indexOf("<script>");
          if (index == -1) return null;

          startToCurrent = new vscode.Range(
            document.positionAt(index),
            new vscode.Position(position.line, 0)
          );

          typeParser.update(
            document.getText(startToCurrent).replace(/\r/g, "") || ""
          );
          return hoverHelper.onHover(document, position);
        },
      }
    )
  );

  /*context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { language: "maniascript", scheme: "file" },
      {
        provideFoldingRanges(document, context, token) {
          return foldingHelper.fold(document);
        },
      }
    )
  );*/

  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      { language: "maniascript", scheme: "file" },
      {
        provideSignatureHelp(document, position, token, context) {
          const line = new vscode.Range(
            new vscode.Position(position.line, 0),
            position
          );

          const text = document.getText(line).replace(/\r/g, "");
          const idx = context.activeSignatureHelp?.activeSignature ?? 0;
          typeParser.update(document.getText().replace(/\r/g, ""));
          return signatureHelper.provideHelp(text, idx);
        },
      },
      "("
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: "maniascript", scheme: "file" },
      {
        provideDefinition(document, position, token) {
          typeParser.update(document.getText().replace(/\r/g, ""));
          return definitionHelper.provideDefinitions(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: "xml", scheme: "file" },
      {
        provideDefinition(document, position, token) {
          typeParser.update(document.getText().replace(/\r/g, ""));
          return definitionHelper.provideDefinitions(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: "jinja-xml", scheme: "file" },
      {
        provideDefinition(document, position, token) {
          typeParser.update(document.getText().replace(/\r/g, ""));
          return definitionHelper.provideDefinitions(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerRenameProvider(
      { language: "maniascript", scheme: "file" },
      {
        prepareRename(document, position, token) {
          const range1 = new vscode.Range(
            new vscode.Position(position.line, 0),
            position
          );
          const range2 = new vscode.Range(
            new vscode.Position(position.line, 0),
            new vscode.Position(position.line + 1, 0)
          );

          const text = document.getText(range1).trim();
          const line = document.getText(range2).trim();

          return renameHelper.check(document, line, text, position);
        },
        provideRenameEdits(document, position, newname, token) {
          const range1 = new vscode.Range(
            new vscode.Position(position.line, 0),
            position
          );
          const range2 = new vscode.Range(
            new vscode.Position(position.line, 0),
            new vscode.Position(position.line + 1, 0)
          );

          const text = document.getText(range1).trim();
          const line = document.getText(range2).trim();

          return renameHelper.rename(document, line, text, position, newname);
        },
      }
    )
  );

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
          const searchFor = document
            .getText(docStartToCurrentLine)
            .replace(/\r/g, ""); //limit reading file from start to current line, so variables gets parsed right
          typeParser.update(searchFor);

          const text = document
            .getText(line)
            .replace(/^\s*/, "")
            .split(/([ |(])/);

          return completions.complete(text, searchFor);
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
            .replace(/\r/g, "")
            .split(/([ |(])/);
          const searchFor = document.getText(startToCurrent); //limit reading file from start to current line, so variables gets parsed right
          typeParser.update(searchFor);
          const completionItems = completions.complete(text, searchFor);

          return completionItems;
        },
      },
      "."
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
            .replace(/\r/g, "")
            .split(/([ |(])/);
          const searchFor = document.getText(startToCurrent); //limit reading file from start to current line, so variables gets parsed right
          typeParser.update(searchFor);
          const completionItems = completions.complete(text, searchFor);

          return completionItems;
        },
      },
      "."
    )
  );

  function triggerUpdateDocument() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    timeout = setTimeout(() => {
      typeParser.updateStructs(activeEditor?.document.getText() ?? "");
      decorator.update(activeEditor);
      if (
        activeEditor?.document.languageId == "xml" &&
        ManialinkPreview.currentPanel
      ) {
        ManialinkPreview.update(
          activeEditor.document.getText(),
          context.extensionUri
        );
      }
    }, 1000);
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
