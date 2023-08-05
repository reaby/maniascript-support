import * as vscode from "vscode";
import ManiaplanetApiParser from "./maniaplanetApi";
import TrackmaniaApiParser from "./trackmaniaApi";
import type { ApiParser } from "./types";
import { completionsType, completionsTemplate } from "./completions";
import { nameType } from "../typeparser/types/typeClasses";

export default class Api {
  completions: completionsType = completionsTemplate;

  init() {
    const isManiaplanetApi = vscode.workspace
      .getConfiguration()
      .get("maniascript.useManiaplanetApi");
    const apiFile: string =
      vscode.workspace.getConfiguration().get("maniascript.apidocPath") ?? "";
    let api: ApiParser = new TrackmaniaApiParser();
    if (isManiaplanetApi) {
      api = new ManiaplanetApiParser();
    }

    this.completions = api.parse(apiFile);
    
  }

  get(): completionsType {
    return this.completions;
  }

  isNameSpace(search: string): boolean {
    for (const namespace in this.completions.namespaces) {
      if (search === namespace) return true;
    }
    return false;
  }

  getClassProperties(search: string) {
    const out: nameType[] = [];
    let className = search;
    const classes = this.completions.classes;
    if (Object.prototype.hasOwnProperty.call(classes, className)) {
      do {
        const props = classes[className].props || {};
        Object.keys(props).forEach((type) => {
          props[type].forEach((elem: any) => {
            out.push({ name: elem.name, type: type });
          });
        });
        className = classes[className].inherit;
      } while (!(className === ""));
    }
    return out;
  }
}
