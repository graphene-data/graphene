# Graphene SQL for Zed

This extension adds syntax highlighting and editor configuration for `.gsql` files. Its Tree-sitter grammar is intentionally permissive: it identifies syntax while Graphene's language server remains the source of truth for validation.

## Development

Generate and test the parser with the Tree-sitter CLI:

```sh
cd integrations/zed/grammar
tree-sitter generate
tree-sitter test
```

Install `integrations/zed` through Zed's **Install Dev Extension** action. Zed clones grammars from Git, so the manifest's grammar revision must refer to a commit containing `integrations/zed/grammar`; pin `rev` to that commit before publishing.
