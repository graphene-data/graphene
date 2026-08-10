# Modeling Graphene SQL

Conventions and patterns for writing production-quality `.gsql` semantic models. Make sure you've read `references/graphene-sql.md` before proceeding.

## Critical resources

If not provided up front, ask the user for access to the following:
- Any/all relevant repos: dbt, dataform, LookML, backend app logic, telemetry, etc. 
- Example SQL. You can also check to see if you have access to the database's query history.
- Materials about the company or topic area: website, product documentation, etc.

These will **significantly** improve your understanding of the data, and thus the documentation and fidelity you can add to the Graphene project.

## Creating new .gsql files

- Generate a new plain `.gsql` file: `graphene schema {DB.SCHEMA.TABLE} > {snake_case_table_name}.gsql`
- If no .gsql folder structure exists, consider dropping them into `tables/`, `semantics/`, or matching the db schema namespaces.

## Joins

- If no join documentation is provided, test viable candidates with `graphene run <query>`. Check for fan-outs.
- Model joins from boths sides (ie. add the join to each respective `table` statement)
- Graphene does not yet support complex join predicates (anything that's not a=b). If needed, create a dimension as a synthetic join key.
- Watch for polymorphism, role-playing dimensions, etc.

## Dimensions and measures

- D.R.Y. up dimension and measure code as much as possible by composing them.
- For categorical columns and booleans, **watch out for nulls**. If nulls exist, consider hiding the column with `#hide` and creating a safe dimension in its place that replaces the nulls with a sensible sentinel eg. FALSE, 'Other'. This is to prevent footguns such as `status <> 'processing'` that implicitly filter nulls.
- It's wise to test with actual Graphene SQL queries instead of relying strictly on `graphene check`.

## Code comments

- Code comments should be viewed as the product, not a journal. They are a key vehicle for context engineering. What would an analyst agent need to know? What is unnecessary?
- Code comments will get attached to objects as description metadata if they are inlined or written directly above the object. Separate comments from objects with a blank line if you do not intend to attach them.
- Add table and grain descriptions above every `table` statement. Make note of any data quality issues.
- Do not add a description to a field if it is already obvious from the name. For example, skip `is_debooked_opportunity BOOLEAN -- Whether the opportunity has been debooked`.
- Use example values for categorical columns: `graphene run "from TABLE select distinct col limit 10"`.

## Metadata

Add Graphene SQL metadata annotations where applicable eg. `#ratio`, `#pct`, `#timeGrain=day`, etc.
- Use only annotations that Graphene recognizes (see `references/graphene-sql.md`)

## Example file

```sql
-- One-sentence description of what this table contains.
-- Each row is one <entity> (<primary_or_unique_key_col(s)>).
table DATABASE.SCHEMA.TABLE_NAME (

  /* Sub-section headers as needed, to group up fields if there are many columns */

  column_name TYPE -- A description and a #annotation

  -- OR, descriptions/metadata for a field can be on the lines above it
  -- as long as there is NOT an empty line separating
  column_name2 TYPE

  /* Join relationships */

  join { one | many } [ database.schema. ]table [ as alias ] on key = table_or_alias_name.key

  /* Dimensions */

  dim_name: expression #annotationWithoutDescription

  /* Measures */

  measure_name: aggregate_expression
)

/* Example queries */ -- Only if correct query usage patterns are not obvious

-- Description of query
select ...
;
```
