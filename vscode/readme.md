This is the VSCode extension and language server for Graphene.

It provides diagnostics, syntax highlighting, autocomplete and hover handling. It's designed to be a thin wrapper, most of the interesting logic is reusable and lives in /lang.

# Installing


# Developing
You can run the extension by hitting `f5` in VSCode (or a fork) to open a new editor window that is running the extension (though it won't appear in the extension sidebar).

You can see client logs in the "Debug Console" of this window. Server logs are in the "Output" tab of the newly opened window ("extension host", in vscode parlance). You might need to change the dropdown there to "Graphene".

This is a great reference for language server debugging:
https://code.visualstudio.com/api/language-extensions/language-server-extension-guide
