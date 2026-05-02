# Best practices
- **Leverage models** - Use modeled joins, dimensions, and measures whenever possible
- Use `check` after editing .gsql files to catch syntax errors
- Use `run path/to/page.md` after editing a page to catch runtime errors and to review the screenshot
- Use `run path/to/page.md -c "[Chart Title | Query ID]"` after editing an ECharts component to view the screenshot
- When iterating on code-fenced GSQL queries, use `run path/to/page.md -q query_name` instead of `run "[GSQL]"`
- Rely on Graphene's defaults for value formatting and chart styles before trying to override in SQL or ECharts
- Keep numbers grounded - Use the `<Value/>` component in prose instead of hard-coding numbers 
- When adding viz, think like Edward Tufte. What is _the_ most effective way to illustrate the data? 

If the user asks:
- An open-ended question => notebook
- To create a page for monitoring purposes => dashboard
- A more straightforward, tactical question => no page, answer in chat

## Notebook guide
- Use `layout: notebook` in frontmatter
- Queries should be point-in-time via absolute time filters
- Page should read like a narrative with prose interspersed with tables or visuals
- Try to use the most scientifically rigorous means possible to derive insights: think like a statistician or data scientist

## Dashboard guide
- Use `layout: dashboard` in frontmatter
- Queries generally use relative time filters eg. last 3 months. If user doesn't specify, ask.
- Avoid narratives - Don't use headers, prose, other markdown content much if at all
- Use `<Row>` to create grids to fit the maximum amount of information in the viewport
- Ask the user if they would like any inputs to dynamically filter things
