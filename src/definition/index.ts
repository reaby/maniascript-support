import TypeParser from "../typeparser";
import * as vscode from "vscode";

export default class DefinitionHelper {
  typeParser: TypeParser;
  constructor(typeParser: TypeParser) {
    this.typeParser = typeParser;
  }

  async provideDefinitions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Location | undefined> {
    const range = document.getWordRangeAtPosition(position, /(\b\w+\b)/);
    if (!range) return;

    const caret = document.getText(
      new vscode.Range(new vscode.Position(position.line, 0), range.end)
    );

    const search = document.getText(range);
    const word = this.wordAtCaret(caret);

    let found = false;
    let out = new vscode.Location(document.uri, new vscode.Position(0, 0));

    for (const func of this.typeParser.functions) {
      if (func.range) {
        if (func.name == search) {
          return new vscode.Location(document.uri, func.range);
        }
      }

      for (const param of func.params) {
        if (param.name == search) {
          if (
            param.range &&
            position.line >= param.range.start.line &&
            param.range.start >= out.range.start
          ) {
            found = true;
            out = new vscode.Location(document.uri, param.range);
          }
        }
      }
    }

    if (found) return out;

    out = new vscode.Location(document.uri, new vscode.Position(0, 0));
    for (const variable of this.typeParser.variables) {
      if (variable.name == search) {
        if (
          variable.range &&
          position.line >= variable.range.start.line &&
          variable.range.start >= out.range.start
        ) {
          found = true;
          out = new vscode.Location(document.uri, variable.range);
        }
      }
    }
    if (found) return out;

    for (const struct of this.typeParser.structures) {
      if (struct.range) {
        if (struct.structName == search) {
          if (struct.ext) {
            const parts = struct.extType.split("::");
            for (const ext of this.typeParser.structuresExternal) {
              if (ext.var == parts[0]) {
                try {
                  const files = await vscode.workspace.findFiles(
                    ext.file,
                    null,
                    1
                  );
                  if (files.length < 1) return;
                  for (const struct of ext.structs) {
                    if (struct.structName == parts[1]) {
                      return new vscode.Location(files[0], struct.range);
                    }
                  }
                  return new vscode.Location(
                    files[0],
                    new vscode.Position(0, 0)
                  );
                } catch (e) {
                  return;
                }
              }
            }
          }
          if (position.line >= struct.range.start.line) {
            return new vscode.Location(document.uri, struct.range);
          }
        }
      }
    }

    if (word.indexOf("::") != -1) {
      const parts = word.split("::");
      for (const ext of this.typeParser.structuresExternal) {
        if (ext.var == parts[0]) {
          for (const func of ext.structs) {
            if (func.structName == parts[1]) {
              try {
                const files = await vscode.workspace.findFiles(
                  ext.file,
                  null,
                  1
                );
                if (files.length < 1) return;
                return new vscode.Location(files[0], func.range);
              } catch (e) {
                return;
              }
            }
          }
        }
      }

      for (const ext of this.typeParser.functionsExternal) {
        if (ext.var == parts[0]) {
          for (const func of ext.functions) {
            if (func.name == parts[1]) {
              try {
                const files = await vscode.workspace.findFiles(
                  ext.file,
                  null,
                  1
                );
                if (files.length < 1) return;
                return new vscode.Location(files[0], func.range);
              } catch (e) {
                return;
              }
            }
          }
        }
      }

      for (const ext of this.typeParser.constExternal) {
        if (ext.var == parts[0]) {
          for (const _const of ext.const) {
            if (_const.name == parts[1]) {
              try {
                const files = await vscode.workspace.findFiles(
                  ext.file,
                  null,
                  1
                );
                if (files.length < 1) return;
                if (_const.range) {
                  return new vscode.Location(files[0], _const.range);
                }
                return;
              } catch (e) {
                return;
              }
            }
          }
        }
      }
    }

    for (const include of this.typeParser.includes) {
      if (include.range) {
        if (include.variableName == search) {
          if (position.line >= include.range.start.line) {
            if (include.includeName.endsWith(".Script.txt")) {
              const files = await vscode.workspace.findFiles(
                include.includeName,
                null,
                1
              );
              if (files.length < 1) return;
              return new vscode.Location(files[0], new vscode.Position(0, 0));
            }
            return new vscode.Location(document.uri, include.range);
          }
        }
      }
    }

    return;
  }

  wordAtCaret(line: string): string {
    const current = line.split(/[\s({[^!]/);
    return current.pop() ?? "";
  }
}
