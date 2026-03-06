---
description: Prepare a release commit in core (changelog + version bumps)
---

## Process

This should all be run in `core/`

1. **Ensure we're up to date, with no outstanding changes**
   ```bash
   node ../dev/workTrees.ts fetch
   git status
   git rev-parse HEAD
   git rev-parse origin/main
   ```
   If `HEAD` is not `origin/main`, pause and ask whether to pull first.

2. **Build changelog entries from commits since last tag:**
   ```bash
   git tag --sort=-version:refname | head -1
   git log <tag>..HEAD --shortstat
   ```
   - Skip commits with no user-facing impact (tests/internal refactors only).
   - For large commits, use a subagent to classify changelog impact.

3. **Determine the next version:**
   For now, we always only bump patch, and only by 1.

4. **Update `CHANGELOG.md`:**
   - Insert `## <next version>` at the top.
   - Add subsections `Breaking changes`, `Added`, `Fixed`.
   - Add concise bullets with commit shas where helpful.
   - Include commits you're medium or high confidence in.

5. **Bump versions:**
   Determine next version number. 
   ```bash
   pnpm version "<next_version>" --no-git-tag-version
   (cd cli && pnpm version "<next_version>" --no-git-tag-version)
   (cd vscode && pnpm version "<next_version>" --no-git-tag-version)
   ```

6. **Stage changes:**
   ```bash
   git add CHANGELOG.md package.json cli/package.json vscode/package.json
   printf "[release] v<next_version>\n" > "$(git rev-parse --git-dir)/COMMIT_EDITMSG"
   ```

7. **Report back unsure commmits:**
   If there are commits you're not sure about, for each one give:
   - sha
   - the line you would have added to the changelog
   - commit message
   - 1 sentence on why you think it should or should not be included
   Err on the side of caution. It's better for us to discuss a commit whose significance you aren't sure about than to omit a breaking change from the log.
