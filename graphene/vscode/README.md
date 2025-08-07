# Graphene VS Code Extension

Provides language support for Graphene GQL/GSQL files in VS Code and Cursor.

- Syntax highlighting via a semantic tokens provider (placeholder implementation).
- Diagnostics stub (unbalanced braces and TODO/FIXME notes).
- Activation for `.gql` and `.gsql` files.

## Dev setup

1. Open the `graphene/vscode` folder in VS Code or Cursor.
2. Install dependencies:

```bash
npm install
```

3. Start TypeScript in watch mode (optional, the debug target runs this automatically):

```bash
npm run watch
```

4. Press F5 (or run "Run and Debug" → "Launch Extension"). This starts a new Extension Development Host window with the extension loaded.

5. Open a `.gql` or `.gsql` file to see highlighting and diagnostics. Edit the code in this workspace — with watch mode on, changes are rebuilt automatically. Use "Developer: Reload Window" in the Dev Host to pick up code changes.

### Cursor support

Cursor uses the VS Code extension host, so the same F5 flow works. After starting the debug session, a new Cursor window (Extension Development Host) opens with the extension enabled.

## Wiring the Lezer grammar

This extension currently uses a simple token scanner. To switch to the real Graphene Lezer grammar from `graphene/lang`:

- Export a parser or parse function from `graphene/lang` (built to JS). For example:

```ts
// in graphene/lang
export function parse(text: string): { tokens: Array<{ line: number; start: number; length: number; type: string }> } { /* ... */ }
```

- In `src/semanticTokens.ts`, replace the `scanTokens` generator with code that calls the exported parser and maps node/tag types to VS Code token types.

- If you publish `graphene/lang` as a package or build it locally, add a dependency in this extension's `package.json` like:

```json
"dependencies": {
  "graphene-lang": "file:../lang"
}
```

Then update imports accordingly.

## Diagnostics stub → real diagnostics

The diagnostics provider is intentionally simple. Once `/lang` exposes a diagnostics API, update `src/diagnostics.ts` to call into it and translate results into `vscode.Diagnostic` instances.

## Packaging (optional)

To package and install manually as a VSIX:

1. Install `vsce` globally: `npm i -g @vscode/vsce`
2. Build: `npm run compile`
3. Package: `vsce package`
4. In VS Code/Cursor, run "Extensions: Install from VSIX" and select the generated `.vsix`.