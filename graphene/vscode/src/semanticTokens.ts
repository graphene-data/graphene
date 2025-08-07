import * as vscode from 'vscode';
import type {TreeCursor} from '@lezer/common';

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

const KEYWORDS = new Set<string>([
  'select','from','where','group','by','order','limit','join','on','as','having','asc','desc',
  'true','false','null','not','like','in','is','and','or','case','when','then','else','end',
  'create','table','exists','offset','inner','left','right','full','cross','integer','int','bigint','smallint','tinyint','real','double','precision','float','decimal','numeric','boolean','bool','date','time','timestamp','varchar','char','text','blob'
]);

function classify(nodeName: string): TokenType | undefined {
  if (KEYWORDS.has(nodeName)) return 'keyword';
  switch (nodeName) {
    case 'Identifier': return 'variable';
    case 'Number': return 'number';
    case 'String': return 'string';
    case 'FunctionCall': return 'function';
    case 'DataType': return 'type';
    case 'Comment': return 'comment';
    default: return undefined;
  }
}

function pushToken(builder: vscode.SemanticTokensBuilder, document: vscode.TextDocument, from: number, to: number, type: TokenType) {
  const start = document.positionAt(from);
  builder.push(start.line, start.character, to - from, tokenTypeToIndex[type], 0);
}

function walkTree(builder: vscode.SemanticTokensBuilder, document: vscode.TextDocument, cursor: TreeCursor, text: string) {
  do {
    const type = classify(cursor.node.type.name);
    if (type) pushToken(builder, document, cursor.from, cursor.to, type);
    if (cursor.firstChild()) {
      walkTree(builder, document, cursor, text);
      cursor.parent();
    }
  } while (cursor.nextSibling());
}

async function tryParse(text: string): Promise<{ cursor: TreeCursor } | null> {
  try {
    // Dynamic import to avoid hard dependency when developing extension standalone
    const mod: any = await import('@graphene/lang/parser.js');
    const tree = mod.parser.parse(text);
    return { cursor: tree.cursor() };
  } catch (_) {
    return null;
  }
}

class GrapheneSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens(document: vscode.TextDocument): Promise<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(legend);
    const text = document.getText();

    const parsed = await tryParse(text);
    if (parsed) {
      walkTree(builder, document, parsed.cursor, text);
    } else {
      // Fallback minimal highlighting when parser isn't available
      for (let line = 0; line < document.lineCount; line++) {
        const t = document.lineAt(line).text;
        const comment = /--.*/g;
        for (let m; (m = comment.exec(t)); ) {
          builder.push(line, m.index, m[0].length, tokenTypeToIndex['comment'], 0);
        }
        const string = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
        for (let m; (m = string.exec(t)); ) {
          builder.push(line, m.index, m[0].length, tokenTypeToIndex['string'], 0);
        }
      }
    }

    return builder.build();
  }
}

export function registerSemanticTokens(context: vscode.ExtensionContext, selector: vscode.DocumentSelector) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(selector, new GrapheneSemanticTokensProvider(), legend)
  );
}