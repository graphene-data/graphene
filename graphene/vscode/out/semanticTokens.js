"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSemanticTokens = registerSemanticTokens;
const vscode = __importStar(require("vscode"));
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
];
const tokenTypeToIndex = Object.fromEntries(tokenTypes.map((t, i) => [t, i]));
const legend = new vscode.SemanticTokensLegend(tokenTypes, []);
// TODO: Replace with real Lezer-based parsing from ../lang once available
function* scanTokens(document) {
    const keyword = /\b(type|schema|query|mutation|subscription|scalar|enum|interface|union|input|directive|fragment|on|implements|extend)\b/g;
    const boolean = /\b(true|false|null)\b/g;
    const number = /(?<![A-Za-z_])-?\b\d+(?:\.\d+)?\b/g;
    const string = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g;
    const comment = /#.*/g;
    const operator = /[!:=@|&(){}[\],.]/g;
    for (let line = 0; line < document.lineCount; line++) {
        const text = document.lineAt(line).text;
        comment.lastIndex = 0;
        for (let m; (m = comment.exec(text));) {
            yield { line, start: m.index, length: m[0].length, type: 'comment' };
        }
        string.lastIndex = 0;
        for (let m; (m = string.exec(text));) {
            yield { line, start: m.index, length: m[0].length, type: 'string' };
        }
        number.lastIndex = 0;
        for (let m; (m = number.exec(text));) {
            yield { line, start: m.index, length: m[0].length, type: 'number' };
        }
        keyword.lastIndex = 0;
        for (let m; (m = keyword.exec(text));) {
            yield { line, start: m.index, length: m[0].length, type: 'keyword' };
        }
        boolean.lastIndex = 0;
        for (let m; (m = boolean.exec(text));) {
            yield { line, start: m.index, length: m[0].length, type: 'boolean' };
        }
        operator.lastIndex = 0;
        for (let m; (m = operator.exec(text));) {
            yield { line, start: m.index, length: m[0].length, type: 'operator' };
        }
    }
}
class GrapheneSemanticTokensProvider {
    async provideDocumentSemanticTokens(document) {
        const builder = new vscode.SemanticTokensBuilder(legend);
        for (const tok of scanTokens(document)) {
            builder.push(tok.line, tok.start, tok.length, tokenTypeToIndex[tok.type], 0);
        }
        return builder.build();
    }
}
function registerSemanticTokens(context, selector) {
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(selector, new GrapheneSemanticTokensProvider(), legend));
}
