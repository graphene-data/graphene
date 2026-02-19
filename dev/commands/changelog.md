---
description: Update core changelog for the next release
---
Audit changelog entries for all commits since the last release. All of this should be run in the core/ folder.

## Process
1. **Make sure we're up to date:**
   ```bash
   node ../dev/workTrees.ts fetch
   git rev-parse HEAD
   git rev-parse origin/main
   ```
   If not, pause and ask the user if they want to pull.

1. **Find the last release tag:**
   ```bash
   git tag --sort=-version:refname | head -1
   ```

2. **List all commits since that tag:**
   ```bash
   git log <tag>..HEAD --oneline --shortstat
   ```

3. **Review commits:**
   - Skip changes that should have no user-facing impact, including changes that only affect docs, tests, or internal refactors.
   - For large commits, use a subagent to do this review and decide what entry (if any) should be added to the changelog.

4. **Update changelog:**
   - Insert `## <next version number>` at the top of the file
   - Add subsections for `Breaking changes`, `Added`, `Fixed`

5. **Report:**
   - List commits where you couldn't determine how to process it
