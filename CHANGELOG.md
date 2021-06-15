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