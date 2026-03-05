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
   git log <tag>..HEAD --oneline --shortstat
   ```
   - Skip commits with no user-facing impact (docs/tests/internal refactors only).
   - For large commits, use a subagent to classify changelog impact.

3. **Determine the next version:**
   For now, we always only bump patch, and only by 1.

4. **Update `CHANGELOG.md`:**
   - Insert `## <next version>` at the top.
   - Add subsections `Breaking changes`, `Added`, `Fixed`.
   - Add concise bullets with commit shas where helpful.

5. **Bump versions:**
   Determine next version number. 
   ```bash
   pnpm version "<next_version>" --no-git-tag-version
   (cd cli && pnpm version "<next_version>" --no-git-tag-version)
   (cd vscode && pnpm version "<next_version>" --no-git-tag-version)
   ```

6. **Create commit and push:**
   ```bash
   git add CHANGELOG.md package.json cli/package.json vscode/package.json
   git commit -m "[release] v<next_version>"
   node ../dev/workTrees.ts push
   ```

7. **Report back:**
   - New version number.
   - Commit sha.
   - Any commits where changelog handling was unclear.
