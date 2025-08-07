import * as vscode from 'vscode';

const tokenTypes = [
  'keyword',
  'string',
  'number',
  'type',
  'function',
  'variable',
  'property',
  'operator',
  'comment',
  'boolean',
  'enumMember'
] as const;

type TokenType = typeof tokenTypes[number];

const tokenTypeToIndex: Record<TokenType, number> = Object.fromEntries(
  tokenTypes.map((t, i) => [t, i])
) as Record<TokenType, number>;

const legend = new vscode.SemanticTokensLegend(tokenTypes as unknown as string[], []);

// TODO: Replace with real Lezer-based parsing from ../lang once available
function* scanTokens(document: vscode.TextDocument): Generator<{ line: number; start: number; length: number; type: TokenType }> {
  const keyword = /\b(type|schema|query|mutation|subscription|scalar|enum|interface|union|input|directive|fragment|on|implements|extend)\b/g;
  const boolean = /\b(true|false|null)\b/g;
  const number = /(?<![A-Za-z_])-?\b\d+(?:\.\d+)?\b/g;
  const string = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
  const comment = /#.*/g;
  const operator = /[!:=@|&(){}[\],.]/g;

  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;

    comment.lastIndex = 0;
    for (let m; (m = comment.exec(text)); ) {
      yield { line, start: m.index, length: m[0].length, type: 'comment' };
    }

    string.lastIndex = 0;
    for (let m; (m = string.exec(text)); ) {
      yield { line, start: m.index, length: m[0].length, type: 'string' };
    }

    number.lastIndex = 0;
    for (let m; (m = number.exec(text)); ) {
      yield { line, start: m.index, length: m[0].length, type: 'number' };
    }

    keyword.lastIndex = 0;
    for (let m; (m = keyword.exec(text)); ) {
      yield { line, start: m.index, length: m[0].length, type: 'keyword' };
    }

    boolean.lastIndex = 0;
    for (let m; (m = boolean.exec(text)); ) {
      yield { line, start: m.index, length: m[0].length, type: 'boolean' };
    }

    operator.lastIndex = 0;
    for (let m; (m = operator.exec(text)); ) {
      yield { line, start: m.index, length: m[0].length, type: 'operator' };
    }
  }
}

class GrapheneSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens(document: vscode.TextDocument): Promise<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(legend);

    for (const tok of scanTokens(document)) {
      builder.push(tok.line, tok.start, tok.length, tokenTypeToIndex[tok.type], 0);
    }

    return builder.build();
  }
}

export function registerSemanticTokens(context: vscode.ExtensionContext, selector: vscode.DocumentSelector) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(selector, new GrapheneSemanticTokensProvider(), legend)
  );
}