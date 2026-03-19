# Publishing Graphene

To publish, have your agent run the `/publish` command. This will create a diff that updates the changelog and bumps the version. If it looks good, push it to a PR.

When the PR is merged, a tag and release are automatically created.

## Test out new package manually before deloying

Not required, but can be helpful if you've make big structural changes.

1. From `core/cli` run `npm pack` (not pnpm). This will make a tgz of the package.
1. Test it out by creating a simple graphene project, with this dependency: `file:/path/to/core/cli/graphenedata-cli-0.0.1.tgz`
1. `npm install` in that test project. You can repeat this step every time you `pack`.
1. Test it out! I like to ensure that check, run, and serve all work.

When you're happy with the results, bump the version in `cli/package.json`, then run `npm publish --access public`.
