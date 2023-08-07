import { SourceLocation, SourceRange } from '@maniascript/parser/dist/lib/position';
import { Position, Range } from 'vscode';
import * as parser from "@maniascript/parser";

/**
 * remove duplicates by property
 *
 * @export
 * @param {*} arr
 * @param {string} prop
 * @returns {*}
 */
export function removeDuplicates(arr: any, prop: string): any {
  return arr
    .slice()
    .reverse()
    .filter(
      (v: any, i: any, a: any) =>
        a.findIndex((t: any) => t[prop] === v[prop]) === i
    )
    .reverse();
}

export function getRange(i: SourceLocation | undefined): Range {
  if (i == undefined) return new Range(0, 0, 0, 0);
  return new Range(i.start.line - 1, i.start.column, i.end.line - 1, i.end.column);
}

export function getValue(i: parser.Type | undefined): string {
  if (i) {
    if (i.kind == "SimpleType") return (i as parser.SimpleType).name;
    if (i.kind == "CustomType") return (i as parser.CustomType).name.name;
    if (i.kind == "ClassType") return (i as parser.ClassType).name;
    if (i.kind == "ArrayType") {
      return getValue((i as parser.ArrayType).value) + "[]";
    }
    if (i.kind == "EnumType") {
      const o = i as parser.EnumType;
      return o.class?.name + "::" + o.name.name;
    }
    console.log(i.kind);
  }
  return "unknown";
}
