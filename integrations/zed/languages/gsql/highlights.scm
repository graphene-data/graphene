; Tree-sitter identifies broad syntax categories; Graphene's language server remains responsible for semantics.
(comment) @comment
(string) @string
(quoted_identifier) @string
(number) @number
(keyword) @keyword
(declaration_keyword) @keyword
(as_keyword) @keyword
(builtin_type) @type
(parameter) @variable.parameter
(operator) @operator
(punctuation) @punctuation.delimiter
"." @punctuation.delimiter
[
  "("
  ")"
] @punctuation.bracket

(identifier) @variable
(function_call function: (identifier) @function)
(member_access property: (identifier) @property)

(model_declaration name: [(identifier) (member_access)] @type)

(parenthesized_expression
  (identifier) @property
  .
  (punctuation) @_colon
  (#eq? @_colon ":"))
