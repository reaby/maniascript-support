import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    // Enable javascript in the webview
    enableScripts: true,

    // And restrict the webview to only loading content from our extension's `media` directory.
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "resources")],
  };
}

export default class ManialinkPreview {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: ManialinkPreview | undefined;

  public static readonly viewType = "manialinkpreview";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  public doc: string;

  public static createOrShow(text: string, extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Two
      : undefined;

    // If we already have a panel, show it.
    if (ManialinkPreview.currentPanel) {
      ManialinkPreview.currentPanel.doc = text;
      ManialinkPreview.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      ManialinkPreview.viewType,
      "Preview",
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri)
    );

    ManialinkPreview.currentPanel = new ManialinkPreview(
      panel,
      extensionUri,
      text
    );
  }

  public static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: string
  ) {
    ManialinkPreview.currentPanel = new ManialinkPreview(
      panel,
      extensionUri,
      document
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    doc: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this.doc = doc;
    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public doRefactor() {
    // Send a message to the webview webview.
    // You can send any JSON serializable data.
    this._panel.webview.postMessage({ command: "refactor" });
  }

  public dispose() {
    ManialinkPreview.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;

    this._updateForString(webview, "Preview", this.doc);
    return;
  }

  private _updateForString(
    webview: vscode.Webview,
    title: string,
    content: string
  ) {
    this._panel.title = title;
    this._panel.webview.html = this._getHtmlForWebview(webview, content);
  }

  private _getHtmlForWebview(webview: vscode.Webview, content: string) {
    // Local path to main script run in the webview
    const scriptPathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "resources",
      "app.js"
    );

    // And the uri we use to load this script in the webview
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    // Local path to css styles
    const stylePath = vscode.Uri.joinPath(
      this._extensionUri,
      "resources",
      "style.css"
    );

    const fontPath = vscode.Uri.joinPath(
      this._extensionUri,
      "resources",
      "kenney-icons.css"
    );

    // Uri to load styles into webview
    const stylesUri = webview.asWebviewUri(stylePath);

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
	<html>
	<meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; style-src-elem ${
    webview.cspSource
  } ;img-src ${webview.cspSource} https: http:; script-src 'nonce-${nonce}';">
    <title>Preview</title>
    <script nonce="${nonce}" src="https://maniaplanet.github.io/maniaplanet-style-js-parser/bin/mp-style-parser.js"></script>
   	<link href="${stylesUri}" rel="stylesheet">
	<script nonce="${nonce}" src="${scriptUri}"></script>
</head>

<body>
	<textarea id="data" style="display:none";>${addslashes(content)}</textarea>
    <div id="manialink">

    </div>


	<script nonce="${nonce}">
	renderManialink(document.querySelector("#data").value);
	</script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function addslashes(str: string): string {
  return str.replace(/[\\x26\\x0A<>'"&]/g, function (r) {
    return "&#" + r.charCodeAt(0) + ";";
  });
}
