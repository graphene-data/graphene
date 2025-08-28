# Working with Graphene projects

Graphene projects look like Evidence projects except they use a special SQL language (called GSQL) and the Graphene CLI instead of the Evidence CLI. To learn about GSQL, read lang/lang.md.

Before generating any code for these projects, you MUST always:
1. Consult the Evidence documentation before generating code.
2. Test your GSQL syntax with `npm run cli compile "<GSQL query>"`. If you were expecting a SQL feature that didn't exist, write it down in examples/missing_features.md.
3. Run your GSQL queries with `npm run cli run "<GSQL query>"` to make sure that the results are reasonable and expected.
4. Test the Evidence markdown code by running `npm run cli serve`.