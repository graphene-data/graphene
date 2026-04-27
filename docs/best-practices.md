# Best practices
- Start simple - Get basic query working, then add complexity
- Use check often - Catches syntax and analysis errors early
- Iterate dashboard queries in-file - When tuning a code-fenced query in a markdown dashboard, edit the `.md` file and run `graphene run [mdFile] -q [queryName]` instead of inline CLI GSQL to avoid drift between experimentation and what gets committed
- Leverage models - Use modeled joins, dimensions, and measures rather than raw SQL
- Don't format in SQL - Rely on `fmt` instead. Do not multiply percentages by 100.
- Use the `<Value/>` component to avoid hard-coding data in prose. It renders inline and can be styled like prose, e.g.

```md
### Top 3 Most Active Airplane Models
1. **<Value data=top_airplane_models column=manufacturer_model row=0 />** ...
```
