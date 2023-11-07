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
import { type } from "os";


// this method is called when vs code is activated
export async function activate(context: vscode.ExtensionContext) {
  console.info("ManiaScript support is enabled.");
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
  let activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

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
        async provideHover(document, position, token) {
          return await hoverHelper.onHover(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "xml", scheme: "file" },
      {
        async provideHover(document, position, token) {
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
          await typeParser.update(document.getText(startToCurrent));
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
          return SymbolHelper.update(document.getText());
        }
      }
    )
  );

  if (langs.includes("jinja-xml")) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { language: "jinja-xml", scheme: "file" },
        {
          async provideHover(document, position, token) {
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

            await typeParser.update(document.getText(startToCurrent));
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
        async provideSignatureHelp(document, position, token, context) {
          const line = new vscode.Range(
            new vscode.Position(position.line, 0),
            position
          );

          const lineText = document.getText(line).replace(/\r/g, "");
          let text = document.getText();
          const idx = context.activeSignatureHelp?.activeSignature ?? 0;
          for (const lang of await typeParser.getEmbeddedLanguages(text)) {
            if (lang.type == "maniascript") {
              if (lang.range.contains(position)) {
                text = lang.value;
                break;
              }
            }
          }
          await typeParser.update(text, false, false);
          return signatureHelper.provideHelp(lineText, idx, text);
        },
      },
      "("
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: "maniascript", scheme: "file" },
      {
        async provideDefinition(document, position, token) {
          await typeParser.update(document.getText());
          return definitionHelper.provideDefinitions(document, position);
        },
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: "xml", scheme: "file" },
      {
        async provideDefinition(document, position, token) {
          await typeParser.update(document.getText());
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
          async provideDefinition(document, position, token) {
            await typeParser.update(document.getText());
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
        async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
			const text = document.getText();
			let out: vscode.CompletionItem[] = [];
			let index = 0;
			const word = document.getText(document.getWordRangeAtPosition(position, /\b[.:\w]+\b/));
			await typeParser.update(text, true, true);

			for (const lang of await typeParser.getEmbeddedLanguages(text)) {
				if (lang.type == "maniascript") {
				index += 1;
				if (lang.range.contains(position)) {
					await typeParser.update(lang.value, false, true);
					const newPos = new vscode.Position(position.line + 1 - lang.range.start.line, position.character);
					out = await completions.complete(lang.value, newPos, word);
					return out;
				}
				}
			}
			
			out = await completions.complete(text, position, word);
			return out;
        }
      },
      ".")
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "xml", scheme: "file" },
      {
        async provideCompletionItems(document, position, token) {
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
          const text = document.getText();
          const word = document.getText(document.getWordRangeAtPosition(position, /\b[.:\w]+\b/));
          await typeParser.update(text);
          const completionItems = await completions.complete(text, position, word);
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
          async provideCompletionItems(document, position, token) {
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
            const searchFor = document.getText(startToCurrent); //limit reading file from start to current line, so variables gets parsed right            
            const word = document.getText(document.getWordRangeAtPosition(position, /\b[.:\w]+\b/));
            await typeParser.update(searchFor);
            const completionItems = await completions.complete(searchFor, position, word);

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