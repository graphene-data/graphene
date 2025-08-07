"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const semanticTokens_1 = require("./semanticTokens");
const diagnostics_1 = require("./diagnostics");
function activate(context) {
    const selector = [
        { language: 'gql', scheme: 'file' },
        { language: 'gql', scheme: 'untitled' },
        { language: 'gsql', scheme: 'file' },
        { language: 'gsql', scheme: 'untitled' }
    ];
    (0, semanticTokens_1.registerSemanticTokens)(context, selector);
    (0, diagnostics_1.activateDiagnostics)(context, selector);
}
function deactivate() {
    // no-op
}
