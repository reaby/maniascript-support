# ManiaScript-Support

VSCode Grammar / Autocompletion support for `".Script.txt"` files.
For more information about ManiaScript, see https://doc.maniaplanet.com/maniascript and https://wiki.trackmania.io

This is rewritten for typescript and enhanced which bases on [MattMcFarland/vscode-maniascript](https://github.com/MattMcFarland/vscode-maniascript).

## Setup Maniascript API

You need to extract `doc.h` from Trackmania to get the latest ManiaScript API completions working with the extension.

1. Create a new folder: use `c:\tmdev` for example to hold the documentation, but it can be anywhere.
2. Make a new shortcut for the game executable (you find it in your uplay folder) and give it some fancy name (like "trackmania - gendocs") set the starting parameters to following:
```
trackmania.exe /generatescriptdoc=c:\tmdev\doc.h
```

3. Run your shortcut. if successfull, you get a window saying: press anykey to continue.
4. Double check `doc.h` is generated at `c:\tmdev\`

## Configuration

Next thing is to configure the extension.
1. Easiest way to get settings is to `Ctrl + P` and start typing `> settings`, other way around is from File->Preferences->Settings->Extensions->ManiaScript.
2. Add following lines to the settings.json:

```json
 "maniascript.apidocPath": "C:\\tmdev\\doc.h",
 "maniascript.useManiaplanetApi": false,
```

you can match the color decorators to your theme by adding:

```json
"workbench.colorCustomizations": {
        "maniascript.constColor": "#4FC1FF",
        "maniascript.structColor": "#4ec9b0"
}
```

3. All done!

## Features

### Manialink preview
You can use context menu at xml files to preview the manialink, and as well use the command: `Ctrl + P` -> `> Maniascript: Preview Manialink`

### Code snipplets
List of prefixes what you can expand with tab-key, most of them are quite obvious:

```
#Include
#Setting
#Const
#Command
#Struct
declare
for
foreach
switch
if
elif
while
```

| Snippet     |                           Description                            |
| :---------- | :--------------------------------------------------------------  |
| `main`      |         generate main function with documentation block          |
| `fnc`       |      generate function declaration with documentation block      |
| `decontrol` |        to fast declare CMlcontrol with Page.GetFirstChild        |
| `new`       |                 generate new instance of struct                  |
| `PageGet`   | generate (Page.GetFirstChild("controltext") as CMlControl) block |
| `ve2`       |              generate vec2 notation `<float,float>`              |
| `ve3`       |          enerate vec3 notation `<float, float, float>`           |
| `in3`       |              generate int3 notation `<int,int,int>`              |

### Auto complete using context
You can set the autocomplete namespace root using two ways:
1. Either having Requirecontext at 1st line (which can be a comment too)
```
#RequireContext CMlScriptIngame
```
2. or having custom context comment block:
```
/** @context CMlScriptIngame */
```

### Template Strings
I added background color for template strings, so it's easier to spot where templates starts and ends.
TemplateStrings `"""stringcontent {{{variable}}}"""` are working as normal. Scripts in a templatestring xml will autocomplete as well. Just be sure to have `<script><!--` at same line, the regex parser can't figureout if the comment block is next line..sorry for this inconvienience.

#### Annotations in template strings from 0.2.1
You can now force annotate the language used in template strings.
Single line template string will try to detect xml opening tag, if so the templatestring is cast to use XML language. For multiline templatestrings use annotations:

| Language    | Annotation                                                       |
| :---------- | :--------------------------------------------------------------  |
| XML | `"""//xml` |
| Manialink XML |  `"""//manialink` | 
| ManiaScript | `"""//maniascript` or `"""//ms` or `"""//!` |

### External libraries
Just add folder to workspace to get libraries load relatively from those directories.
so if you have
```
#Include "Mylib/external.Script.Txt" as MyLib
```
be sure that MyLib is folder inside workspace library.

AutoCompleting from structure aliasses works as well, example:
```
#Struct externalLib::myStruct as structAlias
```

## Manialinks

Manialink autocomplete and validation
I recently have opened as well a github repository for holding and updating the manialink xsd.
You can find it here https://github.com/reaby/manialink-xsd
and I'm accepting pull requests, in case you think something is missing :)

Just install XML extension by RedHat for vscode and use this template:

```xml
<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<?xml-model href="https://raw.githubusercontent.com/reaby/manialink-xsd/main/manialink_v3.xsd" ?>
<manialink version="3">
    <-- your manialink content here -->
</manialink>
```

## Twig and Jinja2 Templating Support
You need just following support extension to activate: Better Jinja
Just change the template language at jinja-html, you get instant support for maniascript and jinja2!
Twig and jinja2 syntaxes are so close to same, so you can use jinja2-html for twig templates as well :)

## Contributing
you can find the most recent version of the plugin at https://github.com/reaby/maniascript-support
colorizer, currently at patch#4 branch:
https://github.com/reaby/ManiaScript.tmLanguage

## License

[MIT](./LICENSE)
