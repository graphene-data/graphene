# RULES

**When formulating GSQL queries:**
- First check all available stored expressions to see if there are any you can use. DO NOT redefine important business definitions like `profit` if they've already been modeled!
- Run your GSQL queries in the CLI first, _before_ you write them to a file. This way you can reason about the results to make sure they make sense.

**When writing to a .gsql file:**
- ALWAYS check your code with `npm run graphene check`.

**When writing to a Graphene .md file:**
- ALWAYS check your code with `npm run graphene check [mdPath]`. Run the command with full permissions because the screenshot may not work in a sandbox.
- If `check` is successful, it will save a screenshot. Look at the screenshot and critique what you see: 
  - Are all the data values and axes labels formatted in a way that is easy to read?
  - Does the shape of the visualized data require an adjustment to scale, axis min/max, axis split, etc.?
  - Are metrics colored consistently across visualizations?
  - Are any visualizations missing data altogether? 
  - Is that visualization type really the best way to illustrate the data?
  - Are any visualizations redundant? Can you say the same thing with less?
