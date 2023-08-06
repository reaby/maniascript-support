# version 0.2
 * Major refactoring... uses now @maniascript/parser

# version 0.1.10
 * Minor changes for color highlighter
 * Fixed function doc block parser
 
# version 0.1.9
 * Changed highlighter to not hardcoded support classes, instead it parses the classes from doc.h and dynamically highilights them
 * Added colors for consts and settings, as well as build-ins for the required context
 * Changed `(readonly)` to `*readonly*` so the colorizer doesn't think them as functions
 * Fixed autocomplete on enums
 * Added outline aka Symbols Provider

# version 0.1.8
Added notation `"""//!` to start a template string with maniascript-only content.

# version 0.1.7
* doc.h format has changed for trackmania2020, fixed parser to work with the new version.

# version 0.1.6
* fixes

# version 0.1.5
* add `#Const` and `#Setting` as variables for autocomplete
* add external library `#Const` and `#Struct` to resolvers and autocomplete

# version 0.1.4
* enhance parsers to work better with tabs
* fix function parsers so it can parse arrays and structs as function return type
* allow ctrl-click to find any variable, function, etc anywhere

# version 0.1.3
* Change autocomplete array methods to have proper return types
* Add `.count` property to array autocomplete
* Include alias `<=>` as well as `=` for `declare` clauses
* Allow `<Maniascript>` tag-support for manialinks
  * this is to support ubitn titlepack engine scripts
  * and some other tmlanguage highlite changes
* update npm dependencies to more recent versions

# version 0.1.2
* Fixes and optimizations for Manialink preview
* Auto update preview window on document change

# version 0.1.1
* Better Manialink Preview rendering...

# version 0.1.0
* Added Manialink Preview

# version 0.0.15
* Fixed typeParsing numerous cases with files of \r\n lineseparators
* Fixed parsing functions with function body defined different line than function declaration
* New snippets for manialink xml files to insert manialink body and xml-mode validation string.* Fixed extension not to crash when external library files are not found in workspace

# version 0.0.14
* Enhance typeparsers and variable resolving.
* Enhance Goto definition: you can now jump between libraries and external files with ctlr-click on external functions and structs.
* add new snippet for #RequireContext

# version 0.0.13
* Enhance: variable resolving.

# version 0.0.12
* Fixed: trackmania api parser for `Array<Type>`
* Added: hoverProvider and added alot infos of variables, functions and structs and so on.

# version 0.0.11
* Fixed: enum parser for maniaplanet api, removed trailing comma (,)
* Fixed: definition provider to work actually with manialink xml pages
* Fixed: foreach expression resolves variable type properly

Note: it resolves variable type, but doesn't resolve the level of variable array:
	```typescript
	#Struct M_struct {
		Text test
	}

	declare M_struct[text][integer] G_mytest;
	...
	main() {
		foreach (test in G_Mytest['test']) {
			test[0]._ // autocompleting don't work here, since test is considered M_struct[text][integer]... instead of M_struct[integer] what it should be.
		}
	}
	```

# version 0.0.10
* Add definition provider: you can ctrl-click things to jump definition

# version 0.0.9
* Changes renamer to ignore templatestrings as well
* new feature: xml inside maniascript templatestring with {{{ }}} will now highlite colors for maniascript instead xml string

# version 0.0.8
* Various changes in snippets in order to comply with the maniascript coding style recommendations.
* Fix structs resolver
* New snippet: dlog for debug template, adds as well todo-entry
* New feature: renaming variables, structs, consts and functions works now with f2