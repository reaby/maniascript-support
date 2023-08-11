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
  }
  return "unknown";
}

export function getText(str: string, range: Range | undefined) {
  if (range == undefined) return str;

  const arr = str.replace("\r", "").split("\n");
  if (arr.length <= range.start.line && arr.length >= range.end.line) {
    throw new Error("Invalid range");
  }
  const out = [];
  for (let line = range.start.line; line <= range.end.line; line++) {
    if (line == range.start.line && line == range.end.line) {
      if (range.end.character > 0) {        
        return arr[line].slice(range.start.character, range.end.character);
      } else {
        return arr[line].slice(range.start.character);
      }
    } else if (line == range.start.line) {
      out.push(arr[line].slice(range.start.character));
    } else if (line == range.end.line) {
      out.push(arr[line].slice(0, range.end.character));
    }
    else {
      out.push(arr[line]);
    }
  }  
  return out.join("\n");
}