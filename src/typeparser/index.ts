import * as fs from "fs";
import { workspace, TextDocument, Position, Range } from "vscode";
import { parse } from '@maniascript/parser';
import * as parser from "@maniascript/parser";
import { getRange, removeDuplicates, getValue, getText } from '../utils';
import * as vscode from 'vscode';
import {
  includeType,
  structureType,
  structureTypeExternal,
  functionType,
  functionTypeExternal,
  nameType,
  constTypeExternal,
  nameTypeRange,
  nameTypeValueRange
} from "./types/typeClasses";

export default class TypeParser {
  includes: includeType[] = [];
  extend: includeType[] = [];
  structures: structureType[] = [];
  structuresExternal: structureTypeExternal[] = [];
  functions: functionType[] = [];
  functionsExternal: functionTypeExternal[] = [];
  consts: nameTypeValueRange[] = [];
  constExternal: constTypeExternal[] = [];
  labels: nameTypeRange[] = [];
  scopemanager: parser.ScopeManager = new parser.ScopeManager();

  async updateStructs(text: string | undefined) {
    if (text == undefined) return;

    const tree = await parse(text, { twoStepsParsing: false, buildScopes: false, buildAst: true });
    if (tree.ast.program == undefined) return;
    this.parseDirectives(text, tree.ast.program.directives ?? [], false);
  }

  getRequireContext(text: string): string {
    const match = text.match(/(#RequireContext|@context)\s+(\w+)/);
    let requireContext = "CSmMlScriptIngame";
    if (match) {
      requireContext = match[2] ?? "CSmMlScriptIngame";
    }

    console.log(requireContext);
    return requireContext;
  }

  extractEmbeddedLanguage(content: string, range: Range): nameTypeValueRange[] {
    const embeddedLanguages: nameTypeValueRange[] = [];
    const regex = content.match(/^"""(\s*(\/\/!)[\t ]*(\w+){0,1}){1}/);
    let lang = "xml";
    if (regex && regex[2] == "//!") {
      lang = "maniascript";
      if (regex[3]) {
        lang = regex[3];
      }
    }
    embeddedLanguages.push({
      name: "embedded",
      type: lang,
      value: content.replace(/"""/g, "").replace(/\s*\/\/!(\s*\w+){0,1}/, "\n"),
      range: range
    });
    return embeddedLanguages;
  }

  async getEmbeddedLanguages(text: string): Promise<nameTypeValueRange[]> {
    const embeddedLanguages: nameTypeValueRange[] = [];

    const tree = await parse(text, { twoStepsParsing: false, buildScopes: false, buildAst: true });
    this.scopemanager.analyze(tree.ast);
    if (!tree.success) {
      for (const err of tree.errors) {
        console.error(err.message);
      }
      return [];
    }

    tree.ast.program?.visit((node) => {
      if (node.kind == "TemplateTextLiteral") {
        const nod = node as parser.TemplateTextLiteral;
        const range = getRange(nod.source.loc);
        embeddedLanguages.push(...this.extractEmbeddedLanguage(getText(text, range), range));
      }
      if (node.kind == "TextLiteral") {
        const nod = node as parser.TextLiteral;
        if (nod.isMultiline) {
          embeddedLanguages.push(...this.extractEmbeddedLanguage(nod.raw, getRange(nod.source.loc)));
        }
      }
    }, () => { });

    return embeddedLanguages;


  }

  async update(text: string, processExternals = true): Promise<void> {
    const tree = await parse(text, { twoStepsParsing: false, buildScopes: false, buildAst: true });

    this.includes = [];
    this.extend = [];

    this.structures = [];
    this.structuresExternal = [];

    this.functions = [];
    this.functionsExternal = [];

    this.consts = [];
    this.constExternal = [];
    this.labels = [];    

    if (!tree.success) {
      for (const err of tree.errors) {
        console.error(err.message);
      }
      return;
    }

    this.parseDirectives(text, tree.ast.program?.directives ?? [], false);
    this.parseFunctions(text, tree.ast.program?.declarations ?? [], false);
    this.parseLabels(text, tree.ast.program?.declarations ?? [], false);

    if (processExternals) {
      for (const include of this.includes) {
        const extText = this.getExternalFile(include.includeName);
        if (!extText) continue;
        const extTree = await parse(extText, { twoStepsParsing: false, buildScopes: false, buildAst: true });
        this.parseDirectives(extText, extTree.ast.program?.directives ?? [], include);
        this.parseFunctions(extText, extTree.ast.program?.declarations ?? [], include);
      }
    }
  }

  getExternalFile(filename: string): string | undefined {
    if (filename.match(/\.[sS]cript\.txt/) === null) return;
    for (const path of workspace.workspaceFolders ?? []) {
      try {
        const file = path.uri.fsPath + "/" + filename;
        if (fs.existsSync(file)) {
          return fs
            .readFileSync(path.uri.fsPath + "/" + filename)
            .toString();
        }
      } catch (e) {
        console.log(e);
      }
    }
    return;
  }

  parseLabels(text: string, declarations: parser.Declaration[], extfile: includeType | false): void {
    const labels: nameTypeRange[] = [];

    for (const node of declarations) {
      if (node.kind === "LabelDeclaration") {
        const nod = (node as parser.LabelDeclaration);
        labels.push({
          name: nod.name.name,
          type: "label",
          range: getRange(nod.name.source.loc)
        });
      }
    }
    this.labels = labels;
  }

  parseFunctions(text: string, declarations: parser.Declaration[], extFile: includeType | false): void {
    const functions: functionType[] = [];

    for (const node of declarations) {
      if (node.kind === "FunctionDeclaration") {
        const nod = (node as parser.FunctionDeclaration);
        const params: nameTypeRange[] = [];
        for (const param of nod.parameters) {
          params.push({
            name: param.name.name,
            type: getValue(param.type),
            range: getRange(param.name.source.loc)
          });
        }

        const funct: functionType = {
          name: nod.name.name,
          returnValue: getValue(nod.type),
          codeBlock: getText(text, getRange(nod.source.loc)),
          params: params,
          docBlock: this.parseDocBlock(text.split("\n"), nod.source.loc.start.line - 1),
          nameRange: getRange(nod.name.source.loc),
          range: getRange(nod.source.loc)
        };
        functions.push(funct);
      }
    }

    if (extFile === false) {
      this.functions = functions;
    } else {
      this.functionsExternal.push({
        file: extFile.includeName,
        var: extFile.variableName,
        functions: functions,
        range: extFile.range
      });
    }
  }

  parseDirectives(text: string, directives: parser.Directive[], extFile: includeType | false): void {
    const includes: includeType[] = [];
    const structures: structureType[] = [];
    const consts: nameTypeValueRange[] = [];
    const extend: includeType[] = [];

    for (const node of directives) {
      switch (node.kind) {
        case "IncludeDirective": {
          includes.push({
            includeName: (node as parser.IncludeDirective).path.value,
            variableName: (node as parser.IncludeDirective).alias?.name ?? "",
            range: getRange((node as parser.IncludeDirective).source.loc),
            rangeName: getRange((node as parser.IncludeDirective).alias?.source.loc)
          });
          break;
        }

        case "ExtendsDirective": {
          extend.push({
            includeName: (node as parser.ExtendsDirective).path.value,
            variableName: "",
            rangeName: getRange((node as parser.ExtendsDirective).path.source.loc),
            range: getRange((node as parser.ExtendsDirective).source.loc)
          });
          break;
        }

        case "StructDirective": {
          const nod = (node as parser.StructDirective);
          let dec = nod.declaration;
          if (dec == undefined) {
            dec = (nod.aliasing?.alias.parent as parser.StructDeclaration);
          }
          const alias = nod.aliasing?.alias;
          const isExt = (nod.aliasing != undefined);
          const members: nameType[] = [];

          for (const i of nod.declaration?.members ?? []) {
            members.push({
              name: i.name.name,
              type: (i.type as parser.SimpleType).name,
              range: getRange(i.name.source.loc)
            });
          }

          const out: structureType = {
            structName: isExt ? alias?.name ?? "" : dec.name.name,
            ext: isExt,
            extType: isExt ? dec.name.namespace + "::" + dec.name.name : '',
            members: members,
            range: getRange(dec.name.source.loc),
            codeBlock: getText(text, getRange(nod.source.loc))
          };

          structures.push(out);
          break;
        }

        case "ConstDirective": {
          const nod = (node as parser.ConstDirective);
          if (nod.aliasing) {
            consts.push({
              name: nod.aliasing.alias.name ?? "",
              type: nod.aliasing.name.namespace + "::" + nod.aliasing.name.name,
              value: "",
              range: getRange(nod.aliasing.source.loc),
            });
          } else {
            consts.push({
              name: nod.declaration?.name.name ?? "",
              type: (nod.declaration?.value.kind ?? "").replace("Literal", ""),
              value: getText(text, getRange(nod.declaration?.value.source.loc)),
              range: getRange(nod.declaration?.source.loc)
            });
          }
          break;
        }

        case "SettingDirective": {
          const nod = (node as parser.SettingDirective);
          consts.push({
            name: nod.name.name ?? "",
            type: (nod.value.kind ?? "").replace("Literal", ""),
            value: getText(text, getRange(nod.value.source.loc)),
            range: getRange(nod.source.loc)
          });
          break;
        }
      }
    }

    if (extFile === false) {
      this.includes = includes;
      this.extend = extend;
      this.structures = removeDuplicates(structures, "structName");
      this.consts = consts;
    } else {
      this.structuresExternal.push({
        file: extFile.includeName,
        var: extFile.variableName,
        structs: removeDuplicates(structures, "structName"),
        range: extFile.range
      });
      this.constExternal.push({
        file: extFile.includeName,
        var: extFile.variableName,
        const: consts,
        range: extFile.range
      });
    }
  }

  parseDocBlock(docLines: string[], line: number): string {
    let out = "";
    let process = false;
    for (let i = 1; i < 30; i++) {
      const loc = line - i;
      if (loc >= 0) {
        if (docLines[loc].includes("*/") && i <= 3) process = true;
        if (process) out = docLines[loc] + "\n" + out;
        if (docLines[loc].includes("/**")) return out;
      }
      if (loc < 0) break;
    }
    return "";
  }

}
