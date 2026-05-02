# Modeling GSQL

Conventions and patterns for writing production-quality `.gsql` semantic models. For GSQL syntax reference, see `references/gsql.md`.

## Quick start: New table workflow

1. Generate a `.gsql` file from the base schema: `npx graphene schema {DB.SCHEMA.TABLE} > tables/{snake_case_table_name}.gsql`
2. Add table and grain descriptions at the top of the file. If given a dbt project, look up the table's definition, lineage, and related metadata so that you have the full picture.
3. Add join relationships.

- If no join documentation is provided, make an educated guess from PK/FK names.
- Use `npx graphene run <query>` to confirm the join works as expected: keys match, row counts are sane, and there is no fan-out.

4. Add dimensions and measures only if a semantic model to migrate from has been provided.

- Do not invent dimensions or measures. Only codify known query patterns.
- Compile-verify: `npx graphene compile "from TABLE select dimension1, dimension2, measure1, measure2"`

5. Add descriptions via comments.

- Only add a comment when the column name is not self-explanatory. For example, skip `is_debooked_opportunity BOOLEAN -- Whether the opportunity has been debooked`.
- Use example values for categorical columns: `npx graphene run "from TABLE select distinct col limit 10"`.
- Add synonyms only if provided. Do not guess them.
- Descriptions can be inlined or placed as a block comment on the line above.

6. Add GSQL metadata annotations where applicable eg. `#ratio`, `#pct`, `#timeGrain=day`, etc. 

## File structure

Every `.gsql` file follows this section order:

```sql
-- One-sentence description of what this table contains.
-- Each row is one <entity> (<primary_or_unique_key_col(s)>).
table DATABASE.SCHEMA.TABLE_NAME (

  /* Sub-section headers as needed, to group up fields if there are many columns */

  column_name TYPE -- Description/metadata if necessary

  -- OR, descriptions/metadata for a field/dimension/measure can be on the lines above it
  -- as long as there is NOT an empty line separating
  column_name2 TYPE

  /* Join relationships */

  join { one | many } [ database.schema. ]table [ as alias ] on key = table_or_alias_name.key

  /* Dimensions */

  dim_name: expression -- Description/metadata if necessary

  /* Measures */

  measure_name: aggregate_expression -- Description/metadata if necessary
)

/* Example queries */ -- Only if correct query usage patterns are not obvious

-- Description of query
select ...
;
```

Section headers use `/* Header */` style. Section headers need a full newline following them or GSQL will assume the header is a comment decorator for the object on the line below it.

## Compile-verify workflow

Always verify after changes. A parse error in any `.gsql` file prevents all tables from loading. If you see "Unknown table" errors everywhere, check for syntax errors in recently modified files.

You can syntax check the whole project with `npx graphene check`.

