---
name: code-review
description: Use when reviewing code to ensure it lives up to our standards.
---

After we have a feature built or a bug fixed, it's important to ask some key questions about the code.

# Does it match our styling?
Read core/AGENTS.md for our styling preferences. The goal is to have code where we can easily skim to understand the big picture of how it works. That means it's vertically compact, helpfully commented, and avoids unnecessary boilerplate.

# Could it be simpler?
Often once we have something working it turns out we could simplify the solution to make the code easier to understand.

# Does it have tests?
Most new features or bug fixes should have a test. Tests that have a UI should take a screenshot. Could the tests be simplified or combined to make the test more legible, without being confusing?

# Lastly, do you see any logic, UX, or security issues in the change?
Always helpful to have a second opinion if something about the change seems sus.
