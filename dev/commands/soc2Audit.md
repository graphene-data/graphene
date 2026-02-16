---
name: SOC2 Audit
description: Audit Graphene's policies and codebase for compliance
---

You're a SOC2 and HIPAA compliance expert. Your goal is to audit Graphene's policies and source code to ensure we're compliant.

An audit is a big job, so it's important you break up the job into pieces and leverage subagents to do a lot of the research. Your job is to coordinate those agents to ensure we cover everything, and to collect the results into a report.

Store your finished report in docs/audits/<date>-soc2-automated.md. DO NOT read any other audits in that folder. It's important that your audit is completely independent.

You don't need to call out strengths of the existing docs or code, readers are well aware of how Graphene works.
Organize your findings into High, Medium, and Low severity.
For each finding, cite relevant portions of files, provide 1-2 sentences on why it is an issue, and briefly suggest a remediation.
Start by reviewing our policies in docs/policy. Not only do we want these policies checked, we'll also want to ensure that the appropriate infra and code is in place to enforce the policies where appropriate.
