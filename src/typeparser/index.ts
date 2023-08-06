import * as fs from "fs";
import { workspace, TextDocument } from "vscode";
import { parse } from '@maniascript/parser';
import * as parser from "@maniascript/parser";
import { getRange, removeDuplicates, getValue } from '../utils';

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

  requireContext = "";
  scopemanager: parser.ScopeManager = new parser.ScopeManager();

  async updateStructs(doc: TextDocument | undefined) {
    if (doc == undefined) return;
    const tree = await parse(doc.getText(), { twoStepsParsing: false, buildScopes: false, buildAst: true });
    if (tree.ast.program == undefined) return;
    this.parseDirectives(doc, tree.ast.program.directives ?? [], false);
  }

  getRequireContext(text: string): string {
    const match = text.match(/(#RequireContext\s+\w+)|(@context\s+\w+)/m);
    let requireContext = "";
    if (match) {
      requireContext = match[0]?.split(" ")?.pop() ?? "";
    }
    this.requireContext = requireContext;
    return this.requireContext;
  }

  async update(doc: TextDocument) {
    this.requireContext = this.getRequireContext(doc.getText());
    const text = doc.getText();
    const tree = await parse(text, { twoStepsParsing: false, buildScopes: false, buildAst: true });
    if (tree.ast.program == undefined) return;
    
    this.includes = [];
    this.extend = [];

    this.structures = [];
    this.structuresExternal = [];
    
    this.functions = [];
    this.functionsExternal = [];
    
    this.consts = [];
    this.constExternal = [];

    this.scopemanager = new parser.ScopeManager();
    this.scopemanager.analyze(tree.ast);


    this.parseDirectives(doc, tree.ast.program?.directives ?? [], false);
    this.parseFunctions(doc, tree.ast.program?.declarations ?? [], false);

    for (const include of this.includes) {
      const extDoc = await this.getExternalFile(include.includeName);
      if (!extDoc) continue;
      const extTree = await parse(extDoc.getText(), { twoStepsParsing: false, buildScopes: false, buildAst: true });
      this.parseDirectives(extDoc, extTree.ast.program?.directives ?? [], include);
      this.parseFunctions(extDoc, extTree.ast.program?.declarations ?? [], include);
    }
  }
  
  async getExternalFile(filename: string): Promise<TextDocument | undefined> {
    try {
      if (filename.match(/\.[sS]cript\.txt/) === null) return;

      for (const path of workspace.workspaceFolders ?? []) {
        const file = path.uri.fsPath + "/" + filename;
        if (fs.existsSync(file)) {
          return await workspace.openTextDocument(file);
        }
      }
    } catch (e) {
      console.log(e);
    }
    return;
  }

  parseFunctions(docum: TextDocument, declarations: parser.Declaration[], extFile: includeType | false): void {
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
          codeBlock: docum.getText(getRange(nod.source.loc)),
          params: params,
          docBlock: this.parseDocBlock(docum.getText().split("\n"), nod.source.loc.start.line - 1),
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

  parseDirectives(doc: TextDocument, directives: parser.Directive[], extFile: includeType | false): void {
    const includes: includeType[] = [];
    const structures: structureType[] = [];
    const consts: nameTypeValueRange[] = [];
    const extend: includeType[]= [];

    for (const node of directives) {
      switch (node.kind) {
        case "IncludeDirective": {
          includes.push({
            includeName: (node as parser.IncludeDirective).path.value,
            variableName: (node as parser.IncludeDirective).alias?.name ?? "",
            range: getRange((node as parser.IncludeDirective).path.source.loc),
          });
          break;
        }

        case "ExtendsDirective": {
          extend.push({
            includeName: (node as parser.ExtendsDirective).path.value,
            variableName: "",
            range: getRange((node as parser.ExtendsDirective).path.source.loc),
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
            codeBlock: doc.getText(getRange(nod.source.loc))
          };

          structures.push(out);
          break;
        }

        case "ConstDirective": {
          const nod = (node as parser.ConstDirective);
          consts.push({
            name: nod.declaration?.name.name ?? "",
            type: (nod.declaration?.value.kind ?? "").replace("Literal", ""),
            value: doc.getText(getRange(nod.declaration?.value.source.loc)),
            range: getRange(nod.declaration?.source.loc)
          });
          break;
        }

        case "SettingDirective": {
          const nod = (node as parser.SettingDirective);
          consts.push({
            name: nod.name.name ?? "",
            type: (nod.value.kind ?? "").replace("Literal", ""),
            value: doc.getText(getRange(nod.value.source.loc)),
            range: getRange(nod.source.loc)
          });
          break;
        }
      }

    }

    if (extFile === false) {
      this.includes.push(...includes);
      this.extend.push(...extend);
      this.structures.push(...removeDuplicates(structures, "structName"));
      this.consts.push(...consts);
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
