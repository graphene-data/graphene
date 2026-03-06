## 0.0.15

### Breaking changes

- Renamed `check` to `run`, and have it print out data in addition to capturing a screenshot (`32f6e97`).
- Moved docs file from `docs/graphene.md` to `skills/graphene/SKILL.md` (`e04c1d6`).

### Added

- Added window function support (`f1c8367`).
- Added `||` string concatenation operator support in gsql (`55fc01a`).
- Added referencing columns in interval expressions (`ef7e6aa`).

- Added support for additional Snowflake timestamp types (`cc8c39d`).

### Fixed

- Fixed snowflake schema listing in the CLI (`d18d6e4`).
- Fixed SQL compilation stripping parenthetical expressions (`c509742`).
- Fixed date/time function typing to accept both timestamps and dates (`a129adc`).
- Fixed Snowflake case-handling edge cases (`8fde193`).
- Fixed gsql error diagnostics to use relative file paths (`d1ba2bf`, `ade2bb0`).
- Fixed language server crash on IDE open when no workspace is present (`0e175ee`).
- Fixed a remark/rehype pipeline bug for self-closing tags (`81e3c78`).
- Fixed tidy transformations dropping inferred type information (`0bd7cd1`).
- Improved UI consistency and behavior across dropdowns, inputs, accordions, and chart labeling (`3277eaa`, `3928f25`, `a0eb906`, `e6187cb`, `cba0d99`, `ea1d314`, `f3446dd`, `b361f23`, `b60b4ae`).

## 0.0.14

### Breaking changes

- Removed symmetric aggregate behavior; aggregate queries across join paths may produce different results (`c25725e`).
- Removed `primary_key` model property support (`254e61d`).
- Renamed config `namespace` to `defaultNamespace`; `defaultNamespace` now only applies to unqualified tables (`7fdadfd`).

### Added

- Added CTE support in Graphene SQL (`9177357`).
- Added ad-hoc joins support (`2461779`).
- Added subquery support in both `FROM` and `WHERE` clauses (`17680d0`).
- Added `BETWEEN` support (`cd8cee2`).
- Added broad built-in function coverage for BigQuery, Snowflake, and DuckDB (`a20da38`).
- Added support for `envFile` in CLI config (`b89f538`, `dcec964`).

### Fixed

- Improved compile/query error rendering and handling in CLI/UI (`81ab0b4`, `80c050e`).
- Fixed keyword parsing for uppercase SQL keywords (`a832259`).
- Fixed aggregate/type-checking correctness across generic, variadic, and CASE expression paths (`559d647`, `d2e1378`, `233aa56`, `b28833a`, `3ce5dab`).
