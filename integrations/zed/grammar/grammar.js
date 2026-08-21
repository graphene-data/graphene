// This is a permissive parser for editor highlighting, not Graphene's source of truth for syntax.
// It recognizes lexical categories and nested calls while the Lezer parser and language server handle validation.
/* oxlint-disable no-undef, typescript/no-require-imports */

const {keywords, types, operators, punctuation} = require('./tokens')

// Put longer alternatives first; Tree-sitter's longest-token matching prevents keyword prefixes from splitting identifiers.
function words(values) {
  let alternatives = [...values].sort((a, b) => b.length - a.length).map(value => value.replaceAll(' ', '\\s+'))
  return new RegExp(alternatives.join('|'), 'i')
}

module.exports = grammar({
  name: 'gsql',

  extras: $ => [/\s/, $.comment],

  rules: {
    source_file: $ => repeat($._item),

    _item: $ => choice(
      $.model_declaration,
      $.function_call,
      $.parenthesized_expression,
      $.member_access,
      $.keyword,
      $.builtin_type,
      $.string,
      $.quoted_identifier,
      $.number,
      $.parameter,
      $.operator,
      $.punctuation,
      $.identifier,
    ),

    model_declaration: $ => prec(4, seq(field('kind', $.declaration_keyword), field('name', choice($.member_access, $.identifier)), optional(field('as', $.as_keyword)), field('body', $.parenthesized_expression))),
    function_call: $ => prec(3, seq(field('function', $.identifier), '(', repeat($._item), ')')),
    parenthesized_expression: $ => seq('(', repeat($._item), ')'),
    member_access: $ => prec(2, seq(field('object', $.identifier), repeat1(seq('.', field('property', $.identifier))))),

    declaration_keyword: _ => token(/table|extend/i),
    as_keyword: _ => token(/as/i),
    keyword: _ => token(words(keywords)),
    builtin_type: _ => token(words(types)),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_$]*/,

    string: _ => token(choice(
      /'([^']|'')*'?/,
      /`([^`]|``)*`?/,
    )),
    quoted_identifier: _ => token(/"([^"]|"")*"?/),
    number: _ => token(/(0x[0-9a-fA-F]+|([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?)/),
    parameter: _ => token(choice(/:[A-Za-z_][A-Za-z0-9_]*/, /@[_A-Za-z][_A-Za-z0-9]*/, /\$[_A-Za-z0-9]+/, '?')),
    operator: _ => token(choice(...operators)),
    punctuation: _ => token(choice(...punctuation)),

    comment: _ => token(choice(
      seq('--', /[^\n]*/),
      seq('#', /[^\n]*/),
      seq('/*', repeat(choice(/[^*]/, /\*[^/]/)), optional('*/')),
    )),
  },
})
