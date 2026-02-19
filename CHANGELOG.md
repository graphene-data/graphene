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
