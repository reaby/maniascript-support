import {
	CompletionItem,
	CompletionItemKind,
	MarkdownString,
	SnippetString,
	TextDocument,
	Position,
	Range
} from "vscode";
import Api from "../api";
import TypeParser from "../typeparser";
import {
	functionType,
	nameType,
	structureType,
} from "../typeparser/types/typeClasses";
import { getRange, getValue, getText } from "../utils";
import * as parser from "@maniascript/parser";

export default class Completer {
	readonly typeParser: TypeParser;
	readonly api: Api;
	availableVars: nameType[] = [];
	foreach: nameType[] = [];

	constructor(parser: TypeParser, api: Api) {
		this.typeParser = parser;
		this.api = api;
		this.availableVars = [];
		this.foreach = [];
	}

	async complete(text: string, position: Position, word: string) {
		const requireContext = this.typeParser.getRequireContext(text);
		this.genVars(position);
		const line = getText(text, new Range(position.line, 0, position.line + 1, 0));
		const searchFor = getText(text, new Range(position.line, 0, position.line, position.character))
			.trimLeft()
			.split(/([ |(])/);

		if (
			searchFor.includes("#RequireContext") ||
			searchFor.includes("@context")
		) {
			return [...this.getClasses()];
		}

		// Check variables
		const caret = searchFor.pop();

		if (caret != null) {
			// if is namespace or enum
			if (caret.indexOf("::") > -1) {
				let search: string = caret.slice(0, caret.indexOf("::"));

				const re = new RegExp("\\s+(" + search + "::(.*?))\\s+");
				const match = re.exec(line) ?? [""];

				if (caret == "::") {
					search = requireContext;
				}

				return [
					...this.getNamespaceContents(search),
					...this.getExternals(search),
					...this.getEnums(search, caret, match[0]),
				];
			}

			// variable...
			if (caret.indexOf(".") > -1) {
				const searchChain = caret.split(".");
				searchChain.pop();
				let search = caret;

				if (search.indexOf("[") !== -1 && search.indexOf("]") == -1) {
					search = search.slice(search.indexOf("[") + 1, search.length);
				}

				return this.resolveVariable(search, requireContext);
			}
		}

		// rules for declares
		if (
			searchFor[0] === "declare" ||
			searchFor[0] === "#Struct" ||
			searchFor[0] === "#Const"
		) {
			if (searchFor.length == 2) {
				return [
					...this.getPrimitives(),
					...this.getClasses(),
					...this.getStructs(this.typeParser.structures),
					new CompletionItem("persistent", CompletionItemKind.Keyword),
					new CompletionItem("netread", CompletionItemKind.Keyword),
					new CompletionItem("netwrite", CompletionItemKind.Keyword),
				];
			} else {
				return [];
			}
		}

		const everything = [
			...(this.find(requireContext) ?? []),
			...this.getStructs(this.typeParser.structures),
			...this.getKeywords(),
			...this.getVariables(),
			...this.getIncludes(),
			...this.getFunctions(this.typeParser.functions),
			...this.getPrimitives(),
		];

		if (caret?.startsWith("C")) {
			everything.push(...this.getClasses());
			return everything;
		}

		return everything;
	}


	genVars(position: Position) {
		const vars: nameType[] = [];
		const foreach: nameType[] = [];
		for (const scope of this.typeParser.scopemanager.scopes) {
			if (position.line >= scope.node.source.loc.start.line && position.line <= scope.node.source.loc.end.line) {
				for (const vari of scope.variables) {
					if (vari[1].node.parent?.kind == "ForeachStatement") {
						const fore = vari[1].node.parent as parser.ForeachStatement;
						foreach.push({
							name: vari[1].name,
							type: this.ParseExression(fore.expression),
							range: getRange(vari[1].node.source.loc)
						});
					} else {
						vars.push({
							name: vari[1].name,
							type: getValue((vari[1].node.parent as parser.VariableDeclaration).type),
							range: getRange(vari[1].node.source.loc)
						});
					}
				}
			}
		}
		this.foreach = foreach;
		this.availableVars = vars;
	}

	ParseExression(expression: parser.Expression): string {
		if (expression.kind == "Identifier") {
			return (expression as parser.Identifier).name;
		}
		if (expression.kind == "DotAccessExpression") {
			const temp = (expression as parser.DotAccessExpression);
			return (temp.object as parser.Identifier).name + "." + (temp.member as parser.Identifier).name;
		}
		return "";
	}

	getArrayMethods(): CompletionItem[] {
		const methods: CompletionItem[] = [];
		const methodCompletions = [
			// filter value, display value, completion
			["add", "add(value)", "add(${1:value})", "Void"],
			["addfirst", "addfirst(value)", "add(${1:value})", "Void"],
			["clear", "clear()", "clear()", "Void"],
			["sort", "sort()", "sort()", "Void"],
			["sortreverse", "sortreverse()", "sortreverse()", "any"],
			["sortkey", "sortkey()", "sortkey()", "any"],
			["sortkeyreverse", "sortkeyreverse()", "sortkeyreverse()", "any"],
			["removekey", "removekey(index)", "removekey(${1:index})", ""],
			["remove", "remove()", "remove(${1:value})", ""],
			["existskey", "existskey(key)", "existskey(${1:key})", "Boolean"],
			["exists", "exists()", "exists(${1:value})", "Boolean"],
			["keyof", "keyof(value)", "keyof(${1:value})", "any"],
			[
				"containsonly",
				"containsonly(value)",
				"containsonly(${1:value})",
				"Boolean",
			],
			[
				"containsoneof",
				"containsoneof(value)",
				"containsoneof(${1:value})",
				"Boolean",
			],
			["slice", "slice(start,count)", "slice(${1:start}, ${2:count}", "any"],
			["tojson", "tojson()", "tojson()", "Text"],
			["fromjson", "fromjson(value)", "fromjson(${1:value})", "Boolean"],
			["get", "get(key, defaultValue)", "get(${1:key}, ${2:value})", "any"],
		];

		const item = new CompletionItem("count", CompletionItemKind.Property);
		item.insertText = new SnippetString("count");
		item.filterText = "count";
		item.detail = "Interger";
		methods.push(item);

		methodCompletions.forEach((method) => {
			const item = new CompletionItem(method[1], CompletionItemKind.Function);
			item.insertText = new SnippetString(method[2]);
			item.filterText = method[0];
			item.detail = method[3];
			methods.push(item);
		});

		return methods;
	}

	resolveVariable(search: string, requireContext: string): CompletionItem[] {
		// eslint-disable-next-line prefer-const
		let { resolved, searchChain } = this.searchVariableType(search, requireContext);

		// spit autocomplete
		if (resolved != null) {
			const array = resolved.match(/\[(.*?)\]/g);
			const arrLen = searchChain.pop();
			resolved = resolved.replace(/\[(.*?)\]/g, "");
			const match = arrLen?.match(/\w+(?!\[\])?/g);

			if (match != null && match.length > 0) {
				if (array != null && match != null) {
					// if array accessor level is equal to array type
					if (match.length - 1 == array.length) {
						if (this.isStruct(resolved)) {
							return [
								...this.getStructElems(resolved),
								new CompletionItem("fromjson", CompletionItemKind.Method),
								new CompletionItem("tojson", CompletionItemKind.Method),
							];
						}
						const out =
							this.find(resolved) || this.getClass(resolved, requireContext);
						return out;
					} else {
						if (match.length >= 1) {
							return this.getArrayMethods();
						}
					}
				}
			}
			const out =
				this.find(resolved) || this.getClass(resolved, requireContext);
			return out ?? [];
		}
		return [];
	}

	searchVariableType(search: string, requireContext: string): any {
		let resolved = "";
		const searchChain = search.split(".");
		searchChain.pop();

		if (searchChain.length > 0) {
			let vari = "";
			if (searchChain.length == 1) {
				vari = searchChain[0].replace(/\[(.*?)\]/g, "");
				resolved =
					this.getTypeVariable(vari, requireContext) ??
					this.findTypesInContext(vari, requireContext) ??
					"";
			} else {
				vari = searchChain[0].replace(/\[(.*?)\]/g, "");
				for (let count = 0; count < searchChain.length - 1; count++) {
					vari = vari.replace(/\[(.*?)\]/g, "");
					vari =
						this.getTypeVariable(vari, requireContext) ??
						this.findTypesInContext(vari, requireContext) ??
						vari;

					const next = searchChain[count + 1].replace(/\[(.*?)\]/g, "");
					for (const member of this.api.getClassProperties(vari)) {
						if (member.name == next) {
							resolved = vari = member.type;
							break;
						}
					}
					for (const elem of this.typeParser.structures) {
						for (const member of elem.members) {
							if (member.name == next) {
								resolved = vari = member.type;
								break;
							}
						}
					}
				}
			}
		} else {
			resolved =
				this.getTypeVariable(search, requireContext) ??
				this.findTypesInContext(search, requireContext) ??
				"";
		}


		return { resolved, searchChain };
	}

	getTypeVariable(search: string, requireContext: string): string | null {
		for (const elem of this.availableVars) {
			if (search == elem.name) {
				const type = elem.type;
				return type;
			}
		}

		for (const elem of this.foreach) {
			if (search == elem.name) {
				const { resolved, arrChain } = this.searchVariableType(elem.type + ".", requireContext);
				let type =
					resolved ??
					this.findTypesInContext(elem.type, requireContext) ??
					elem.type;
				type = type.replace("[]", "");
				return type;
			}
		}

		return null;
	}

	findTypesInContext(elem: string, context: string): string | null {
		let className = context;
		const classes: any = this.api.get().classes;

		if (Object.prototype.hasOwnProperty.call(classes, context)) {
			do {
				const props = classes[className].props || {};
				for (const groupName of Object.keys(props)) {
					for (const prop of props[groupName]) {
						if (prop.name === elem) {
							return groupName;
						}
					}
				}
				className = classes[className].inherit;
			} while (className !== "");
		}
		return null;
	}

	find(context: string): CompletionItem[] | null {
		if (this.isStruct(context)) {
			return [
				...this.getStructElems(context),
				new CompletionItem("fromjson", CompletionItemKind.Method),
				new CompletionItem("tojson", CompletionItemKind.Method),
			];
		}
		const out = [
			...this.getClassProperties(context),
			...this.getClassMethods(context),
		];
		if (out.length == 0) return null;
		return out;
	}

	getVariables(): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const vari of this.availableVars) {
			const item = new CompletionItem(vari.name, CompletionItemKind.Variable);
			item.detail = vari.type;
			out.push(item);
		}

		for (const vari of this.foreach) {
			const item = new CompletionItem(vari.name, CompletionItemKind.Variable);
			item.detail = vari.type;
			out.push(item);
		}

		out.push(...this.getConsts());
		return out;
	}

	getIncludes(): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const inc of this.typeParser.includes) {
			const item = new CompletionItem(
				inc.variableName,
				CompletionItemKind.File
			);
			item.detail = inc.includeName;
			item.filterText = inc.variableName;
			item.insertText = inc.variableName;
			out.push(item);
		}
		return out;
	}

	getClass(property: string, className: string): CompletionItem[] {
		let out: CompletionItem[] = [];
		if (property == "") return [];
		if (this.api.get().primitives.includes(property)) return [];

		const classes = this.api.get().classes;
		if (Object.prototype.hasOwnProperty.call(classes, className)) {
			do {
				const groupEnum = classes[className].enums || {};
				Object.keys(groupEnum).forEach((groupName) => {
					groupEnum[groupName].forEach((enumValue: string) => {
						const item = new CompletionItem(
							groupName + "::" + enumValue,
							CompletionItemKind.Enum
						);
						item.detail = className;
						item.filterText = groupName;
						item.insertText = groupName + "::" + enumValue;
						out.push(item);
					});
				});

				const props = classes[className].props || {};
				Object.keys(props).forEach((groupName) => {
					if (groupName == property) {
						props[groupName].forEach((prop: any) => {
							const item = new CompletionItem(
								prop.name,
								CompletionItemKind.Field
							);
							item.detail =
								groupName + (prop.readonly == true ? " *readonly*" : "");
							item.insertText = prop.name;
							item.filterText = prop.name;
							const docs = new MarkdownString();
							docs.appendText(prop.documentation ?? ".");
							item.documentation = docs;
							out.push(item);
						});
					}
				});

				const groupMethods = classes[className].methods || {};
				out = out.concat(
					Object.keys(groupMethods).map((label) => {
						const params = groupMethods[label].params;
						const name = groupMethods[label].name;
						const args = [];
						const vals = [];
						let index = 0;
						for (const param of params) {
							args.push(param.argument + ":" + param.identifier);
							vals.push("${" + (index + 1) + ":" + param.argument + "}");
							index += 1;
						}

						const item = new CompletionItem(
							`${name}(${args.join(", ")})`,
							CompletionItemKind.Method
						);
						item.detail = groupMethods[label].returns;
						const docs = new MarkdownString();
						docs.appendText(groupMethods[label].documentation ?? ".");
						item.documentation = docs;

						item.filterText = name;
						item.insertText = new SnippetString(name + `(${vals.join(", ")})`);

						return item;
					})
				);
				className = classes[className].inherit;
			} while (!(className === ""));
		}
		return out;
	}

	getConsts(): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const elem of this.typeParser.consts) {
			const Item = new CompletionItem(
				elem.name,
				CompletionItemKind.Constant
			);
			Item.detail = elem.type;
			out.push(Item);
		}
		return out;
	}
	getClassProperties(className: string): CompletionItem[] {
		const out: CompletionItem[] = [];
		const classes = this.api.get().classes;

		if (Object.prototype.hasOwnProperty.call(classes, className)) {
			do {
				const props = classes[className].props || {};
				Object.keys(props).forEach((groupName) => {
					props[groupName].forEach((prop: any) => {
						const item = new CompletionItem(
							prop.name,
							CompletionItemKind.Field
						);
						item.detail =
							groupName + (prop.readonly == true ? " *readonly*" : "");
						item.insertText = prop.name;
						item.filterText = prop.name;
						const docs = new MarkdownString();
						docs.appendText(prop.documentation ?? ".");
						item.documentation = docs;
						out.push(item);
					});
				});

				className = classes[className].inherit;
			} while (!(className === ""));
		}
		return out;
	}

	getClassMethods(className: string): CompletionItem[] {
		let items: CompletionItem[] = [];
		const classes = this.api.get().classes;
		if (Object.prototype.hasOwnProperty.call(classes, className)) {
			do {
				const groupMethods = classes[className].methods || {};
				items = items.concat(
					Object.keys(groupMethods).map((label) => {
						const params = groupMethods[label].params;
						const name = groupMethods[label].name;
						const args = [];
						const vals = [];
						let index = 0;
						for (const param of params) {
							args.push(param.argument + ":" + param.identifier);
							vals.push("${" + (index + 1) + ":" + param.argument + "}");
							index += 1;
						}

						const item = new CompletionItem(
							`${name}(${args.join(", ")})`,
							CompletionItemKind.Method
						);
						item.detail = groupMethods[label].returns;
						const docs = new MarkdownString();
						docs.appendText(groupMethods[label].documentation ?? ".");
						item.documentation = docs;
						item.filterText = name;
						item.insertText = new SnippetString(name + `(${vals.join(", ")})`);

						return item;
					})
				);

				className = classes[className].inherit;
			} while (!(className == ""));
		}

		return items;
	}

	getKeywords(): CompletionItem[] {
		const arr = [
			"break",
			"case",
			"continue",
			"default",
			"do",
			"else",
			"yield",
			"return",
			"reverse",
			"in",
			"as",
			"metadata",
			"netread",
			"netwrite",
			"persistent",
			"while",
			"if",
			"switch",
			"switchtype",
			"for",
			"foreach",
			"meanwhile",
			"assert",
			"tuningstart",
			"tuningend",
			"tuningmark"
		].map((label) => new CompletionItem(label, CompletionItemKind.Keyword));
		const arr2 = [
			"dump",
			"log",
			"dumptype",
			"sleep",
			"wait",
		].map((label) => new CompletionItem(label, CompletionItemKind.Function));
		const arr3 = [
			"This",
		].map((label) => new CompletionItem(label, CompletionItemKind.Class));

		return [...arr, ...arr2, ...arr3];
	}

	getNamespaces(): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const elem of this.typeParser.includes) {
			const Item = new CompletionItem(
				elem.variableName,
				CompletionItemKind.Interface
			);
			Item.detail = elem.includeName;
			Item.insertText = elem.variableName;
			Item.filterText = elem.variableName;
			out.push(Item);
		}

		return out;
	}

	getExternals(search: string): CompletionItem[] {
		let out: CompletionItem[] = [];

		for (const extStruct of this.typeParser.structuresExternal) {
			if (extStruct.var == search) {
				out = this.getStructs(extStruct.structs);
			}
		}

		for (const extFunc of this.typeParser.functionsExternal) {
			if (extFunc.var == search) {
				out = [...out, ...this.getFunctions(extFunc.functions)];
			}
		}

		for (const extFunc of this.typeParser.constExternal) {
			if (extFunc.var == search) {
				out = [...out, ...this.getConst(extFunc.const)];
			}
		}

		return out;
	}

	getEnums(className: string, caret = "", variable = ""): CompletionItem[] {
		const out: CompletionItem[] = [];
		const count = caret.split("::").length - 1;
		const parts = variable.trim().replace(/[,;\n\r]/, "").split("::", 3);
		let filter = "";
		if (count >= 2) {
			filter = parts[1] ?? "";
		}
		if (count == 1) {
			filter = parts[0] ?? "";
		}


		const classes = this.api.get().classes;
		if (Object.prototype.hasOwnProperty.call(classes, className)) {
			do {
				const groupEnum = classes[className].enums || {};
				Object.keys(groupEnum).forEach((groupName) => {
					groupEnum[groupName].forEach((enumValue: string) => {
						if (count > 1) {
							if (groupName.startsWith(filter)) {
								const item = new CompletionItem(
									className + "::" + groupName + "::" + enumValue,
									CompletionItemKind.Enum
								);
								item.detail = className;
								item.insertText = enumValue;
								out.push(item);
							}
						} else {
							const item = new CompletionItem(
								className + "::" + groupName + "::" + enumValue,
								CompletionItemKind.Enum
							);
							item.detail = className;
							item.filterText = groupName;
							item.insertText = groupName + "::" + enumValue;
							out.push(item);
						}
					});
				});
				className = classes[className].inherit;
			} while (!(className === ""));
		}
		return out;
	}

	getNamespaceContents(search: string): CompletionItem[] {
		// resolve variable to namespace name
		let needle: string | null = null;
		for (const elem of this.typeParser.includes) {
			if (search == elem.variableName) {
				needle = elem.includeName;
			}
		}
		if (needle == null) return [];

		const namespaces: any = this.api.get().namespaces;
		const out: CompletionItem[] = [];
		for (const i in namespaces) {
			if (i == needle) {
				for (const func of namespaces[i].methods) {
					const args = [];
					const vals = [];
					let index = 0;
					for (const param of func.params) {
						args.push(param.identifier + " " + param.argument);
						vals.push("${" + (index + 1) + ":" + param.argument + "}");
						index += 1;
					}

					const item = new CompletionItem(
						`${func.name}(${args.join(", ")})`,
						CompletionItemKind.Method
					);
					item.detail = func.returns;
					item.documentation = new MarkdownString();
					item.filterText = func.name;
					item.insertText = new SnippetString(
						func.name + `(${vals.join(", ")})`
					);
					const doc = `${i}::${func.name}(${args.join(", ")}) {}`;
					item.documentation.appendCodeblock(doc, "maniascript");
					item.documentation.appendText(func.documentation ?? ".");
					out.push(item);
				}
				const groupEnum = namespaces[i].enums ?? {};
				Object.keys(groupEnum).forEach((groupName) => {
					groupEnum[groupName].forEach((enumValue: string) => {
						const item = new CompletionItem(
							groupName + "::" + enumValue,
							CompletionItemKind.Enum
						);
						out.push(item);
					});
				});

				return out;
			}
		}
		return [];
	}

	getClasses(): CompletionItem[] {
		const classes = this.api.get().classes;
		return Object.keys(classes).map(
			(label) => new CompletionItem(label, CompletionItemKind.Class)
		);
	}

	getPrimitives(): CompletionItem[] {
		return this.api
			.get()
			.primitives.map(
				(label) => new CompletionItem(label, CompletionItemKind.Value)
			);
	}

	isStruct(name: string): boolean {
		for (const struct of this.typeParser.structures) {
			if (struct.structName == name) return true;
		}
		return false;
	}

	getExtStructElems(namespace: string, name: string): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const structs of this.typeParser.structuresExternal) {
			if (structs.var == namespace) {
				for (const struct of structs.structs) {
					if (struct.structName == name) {
						for (const member of struct.members) {
							const item = new CompletionItem(
								member.name,
								CompletionItemKind.Variable
							);
							item.detail = member.type;
							out.push(item);
						}
						return out;
					}
				}
			}
		}
		return out;
	}

	getStructElems(name: string): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const struct of this.typeParser.structures) {
			if (struct.structName == name) {
				if (struct.ext) {
					const m = struct.extType?.split("::");
					if (m) {
						return this.getExtStructElems(m[0], m[1]);
					}
				} else {
					for (const member of struct.members) {
						const item = new CompletionItem(
							member.name,
							CompletionItemKind.Variable
						);
						item.detail = member.type;
						out.push(item);
					}
					return out;
				}
			}
		}
		return out;
	}

	getStructs(stucture: structureType[]): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const struct of stucture) {
			const item = new CompletionItem(
				struct.structName,
				CompletionItemKind.Struct
			);
			item.detail = "struct";
			let doc = `#Struct ${struct.structName} {` + "\n";
			for (const member of struct.members) {
				doc += `\t ${member.type} ${member.name};` + "\n";
			}
			doc += "}";
			item.documentation = new MarkdownString();
			item.documentation.appendCodeblock(doc, "maniascript");
			out.push(item);
		}
		return out;
	}

	getConst(stucture: nameType[]): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const _const of stucture) {
			const item = new CompletionItem(_const.name, CompletionItemKind.Constant);
			item.detail = _const.type;
			out.push(item);
		}
		return out;
	}

	getFunctions(data: functionType[]): CompletionItem[] {
		const out: CompletionItem[] = [];
		for (const func of data) {
			const args = [];
			const vals = [];
			let index = 0;
			for (const param of func.params) {
				args.push(param.type + " " + param.name);
				vals.push("${" + (index + 1) + ":" + param.name + "}");
				index += 1;
			}

			const item = new CompletionItem(
				`${func.name}(${args.join(", ")})`,
				CompletionItemKind.Method
			);
			item.detail = func.returnValue;
			item.documentation = new MarkdownString();
			item.documentation.appendCodeblock(func.docBlock ?? "", "maniascript");
			item.filterText = func.name;
			item.insertText = new SnippetString(func.name + `(${vals.join(", ")})`);

			out.push(item);
		}

		return out;
	}
}
