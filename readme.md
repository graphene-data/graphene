# Repo structure
* /lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
* /cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
* /vscode - an extension that provides syntax highlighting and diagnostics on queries.
* /examples - a series of example datasets

# Agents
The main agents we use are Claude Code and Cursor. Use `npm run agent-setup` to set up various symlinks and configs.

If you want to use background agents, make sure your snapshot uses node 24 (cursor's default is 22).

# Examples Projects
`/examples` contains different datasets and Graphene projects. For each, you'l want to run `npm run setup` to download the dataset. Then you can use:

`npm run cli compile "<some graphene>"` to compile to sql
`npm run cli run "<some graphene>"` to execute that query against the db
`npm run cli serve` to start up the evidence server for that project


# Debugging tips
From `vscode`, use `npm run install-cursor` (or `-vscode`) to package up the current vscode extension and install it in your editor. This requires you've installed the cli command for your editor.

From `examples/flights/.evidence/template` run `cp ~/co/graphene/cli/vite.config.js . && node --inspect ../../node_modules/vite/bin/vite.js dev --port 3000` to debug the server that turns graphene queries in evidence into actual sql and executes them.
