# Repo structure
* /lang - language server that can parse our custom sql, generate diagnostics, and transform to dialect-specific SQL.
* /cli - wrapper for transforming or executing queries. Can also run a "dev mode" server that locally hosts your reports.
* /vscode - an extension that provides syntax highlighting and diagnostics on queries.
* /examples - a series of example datasets

# Examples Projects
`/examples` contains different datasets and Graphene projects. For each, you'l want to run `npm run setup` to download the dataset. Then you can use:

`npm run cli compile "<some graphene>"` to compile to sql
`npm run cli run "<some graphene>"` to execute that query against the db
`npm run cli serve` to start up the evidence server for that project


# Debugging tips
From `vscode`, use `pnpm run install-cursor` (or `-vscode`) to package up the current vscode extension and install it in your editor. This requires you've installed the cli command for your editor.

To test out packaged graphene, `cd cli && pnpm pack`. In a new folder, you can `npm install <path-to-pack.tgz>`.

# Publishing
`node --env-file=../../publish.env ./scripts/publish.ts patch`

# Malloy fork
We maintain a fork of Malloy (specifically the `malloy` package) to better integrate it into Graphene.
To deploy it, from `malloy/packages/malloy`, bump the version in package.json, then `npm publish --access public --tag stable`
After deploying, you'll want to bump the version that Graphene points to.
