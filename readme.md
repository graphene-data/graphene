

# Publishing Graphene
From `core/cli` run `npm pack` (not pnpm). This will make a tgz of the package.
Test it out by creating a simple graphene project, with this dependency: `file:/path/to/core/cli/graphenedata-cli-0.0.1.tgz`
`npm install` in that test project. You can repeat this step every time you `pack`.
Test it out! I like to ensure that check, run, and serve all work.

When you're happy with the results, bump the version in `cli/package.json`, then run `npm publish --access public`.
