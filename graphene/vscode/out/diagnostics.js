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
exports.activateDiagnostics = activateDiagnostics;
const vscode = __importStar(require("vscode"));
function collectDiagnosticsStub(text) {
    const diagnostics = [];
    // Very naive: warn on FIXME/TODO and on unbalanced braces
    for (const match of text.matchAll(/\b(FIXME|TODO)\b/g)) {
        diagnostics.push({ message: `Note: ${match[1]}`, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, severity: vscode.DiagnosticSeverity.Information });
    }
    const stack = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{' || ch === '(' || ch === '[')
            stack.push({ ch, index: i });
        else if (ch === '}' || ch === ')' || ch === ']') {
            if (!stack.length) {
                diagnostics.push({ message: `Unmatched closing '${ch}'`, start: i, end: i + 1, severity: vscode.DiagnosticSeverity.Error });
            }
            else {
                const open = stack.pop();
                const pairs = { '{': '}', '(': ')', '[': ']' };
                if (pairs[open.ch] !== ch) {
                    diagnostics.push({ message: `Mismatched '${open.ch}' ... '${ch}'`, start: open.index, end: i + 1, severity: vscode.DiagnosticSeverity.Error });
                }
            }
        }
    }
    for (const leftover of stack) {
        diagnostics.push({ message: `Unclosed '${leftover.ch}'`, start: leftover.index, end: leftover.index + 1, severity: vscode.DiagnosticSeverity.Error });
    }
    return diagnostics;
}
function activateDiagnostics(context, selector) {
    const collection = vscode.languages.createDiagnosticCollection('graphene');
    context.subscriptions.push(collection);
    const refresh = (document) => {
        if (!vscode.languages.match(selector, document))
            return;
        const diags = [];
        const text = document.getText();
        for (const d of collectDiagnosticsStub(text)) {
            const start = document.positionAt(d.start);
            const end = document.positionAt(d.end);
            const range = new vscode.Range(start, end);
            diags.push(new vscode.Diagnostic(range, d.message, d.severity));
        }
        collection.set(document.uri, diags);
    };
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(refresh), vscode.workspace.onDidChangeTextDocument(e => refresh(e.document)), vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri)));
    // Initialize already-open documents
    vscode.workspace.textDocuments.forEach(refresh);
}
