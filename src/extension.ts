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
import formatDocument from "./formatter";
import SymbolsHelper from "./symbols";


// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  console.log("ManiaScript support is enabled.");
  const langs = await vscode.languages.getLanguages();

  let timeout: NodeJS.Timer | undefined = undefined;
  const api = new Api();
  api.init();
  const typeParser = new TypeParser();
  const completions = new Completer(typeParser, api);
  const decorator = new Decorator(typeParser, api, completions);
  const signatureHelper = new SignatureHelper(typeParser, api, completions);
  const renameHelper = new RenameHelper(typeParser);
  const definitionHelper = new DefinitionHelper(typeParser, completions);
  const hoverHelper = new HoverHelper(typeParser, api, completions);
  const foldingHelper = new FoldingRangeHelper();
  const SymbolHelper = new SymbolsHelper(typeParser);
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

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "maniascript", scheme: "file" },
      {
        provideHover(document, position, token) {
          typeParser.update(document);
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
          const index = document.getText().indexOf("<script>");
          if (index == -1) return null;

          startToCurrent = new vscode.Range(
            document.positionAt(index),
            new vscode.Position(position.line, 0)
          );

          typeParser.update(document);
          return hoverHelper.onHover(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: "maniascript", scheme: "file" },
      {
        provideDocumentSymbols(document, token) {
          return SymbolHelper.update(document);
        }
      }
    )
  );

  if (langs.includes("jinja-xml")) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { language: "jinja-xml", scheme: "file" },
        {
          provideHover(document, position, token) {
            let startToCurrent = new vscode.Range(
              new vscode.Position(0, 0),
              new vscode.Position(position.line, 0)
            );
            const index = document.getText().indexOf("<script>");
            if (index == -1) return null;

            startToCurrent = new vscode.Range(
              document.positionAt(index),
              new vscode.Position(position.line, 0)
            );

            typeParser.update(document);
            return hoverHelper.onHover(document, position);
          },
        }
      )
    );
  }


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
          typeParser.update(document);
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
          typeParser.update(document);
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
          typeParser.update(document);
          return definitionHelper.provideDefinitions(document, position);
        },
      }
    )
  );
  if (langs.includes("jinja-xml")) {
    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(
        { language: "jinja-xml", scheme: "file" },
        {
          provideDefinition(document, position, token) {
            typeParser.update(document);
            return definitionHelper.provideDefinitions(document, position);
          },
        }
      )
    );
  }

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
          typeParser.update(document);
          return completions.complete(document, position);
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
          const fullLine = new vscode.Range(
            new vscode.Position(position.line, 0),
            new vscode.Position(position.line + 1, 0)
          );
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
          typeParser.update(document);
          const completionItems = completions.complete(
            document, position
          );

          return completionItems;
        },
      },
      "."
    )
  );
  if (langs.includes("jinja-xml")) {
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        { language: "jinja-xml", scheme: "file" },
        {
          provideCompletionItems(document, position, token) {
            const start = new vscode.Position(position.line, 0);
            const range = new vscode.Range(start, position);
            const fullLine = new vscode.Range(
              new vscode.Position(position.line, 0),
              new vscode.Position(position.line + 1, 0)
            );
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
            typeParser.update(document);
            const completionItems = completions.complete(document, position);

            return completionItems;
          },
        },
        "."
      )
    );
  }

  function triggerUpdateDocument() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    timeout = setTimeout(() => {
      typeParser.updateStructs(activeEditor?.document);
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

  /*context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("maniascript", {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): vscode.TextEdit[] {
        return formatDocument(document);
      },
    })
  ); */
}
