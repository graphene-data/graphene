# Automated SOC2 + HIPAA Audit Report

Date: 2026-02-16
Auditor: OpenCode automated audit process (policy + source + IaC review)
Scope: `docs/policy`, `cloud`, `core`, `.github`

## Executive Summary

Graphene has a strong policy baseline for SOC 2 and HIPAA, including access control, incident response, data classification, vendor risk, and breach/privacy policy coverage. The most significant risk is not missing policy documents, but control enforceability and implementation detail gaps between policy and code.

High-priority technical risks were identified in cloud auth/session hardening, production route exposure, authorization granularity, and encryption fallback behavior. Additional medium/high gaps exist in infrastructure segmentation and SDLC security automation. These issues are remediable with targeted engineering and policy normalization work.

Overall readiness assessment:

- SOC 2 design readiness: Medium (policies present, enforcement and consistency gaps)
- HIPAA design readiness: Medium (privacy/security coverage present, several required implementation details partial)
- Technical implementation readiness: Medium-Low (several high-severity code/IaC issues)

## Methodology

This audit used a multi-agent review process with independent passes for:

1. SOC 2 policy coverage and consistency
2. HIPAA Security + Breach Notification policy coverage
3. Cloud application security controls (`cloud/server`, `cloud/lambda`)
4. Terraform control posture (`cloud/terraform`)
5. Core product handling of sensitive data (`core`)
6. SDLC controls in CI/CD (`.github`)

Evidence was collected from repository artifacts only. Runtime settings, GitHub branch protection settings, cloud account-level controls, and operational evidence were marked as unverified where not provable from source.

## Strengths Observed

### Policy Program Strengths

- Broad policy set exists for SOC 2/HIPAA domains under `docs/policy`.
- Access lifecycle, least privilege, MFA, and periodic access review are documented in `docs/policy/Access Control and Termination Policy.md`.
- Logging and monitoring expectations (including retention language) are present in `docs/policy/Information Security Policy.md:108`.
- BC/DR governance, backups, and recovery testing intent are documented in `docs/policy/Business Continuity and Disaster Recovery.md`.
- HIPAA privacy and breach governance are explicitly covered in:
  - `docs/policy/HIPAA Internal Privacy Policy.md`
  - `docs/policy/Breach Notification Policy.md`
  - `docs/policy/PHI De-identification Policy and Procedure.md`

### Infrastructure Strengths

- SNS topics are encrypted with KMS (no unencrypted SNS exceptions identified):
  - `cloud/terraform/modules/graphene-stack/lambda.tf:96`
  - `cloud/terraform/modules/graphene-stack/ecs.tf:207`
  - `cloud/terraform/modules/graphene-stack/aurora.tf:140`
- KMS key rotation is enabled:
  - `cloud/terraform/modules/graphene-stack/security.tf:332`
  - `cloud/terraform/modules/graphene-stack/secrets.tf:9`

## Key Findings

### Critical / High

1. Session cookie HttpOnly is disabled in Stytch Terraform config.
   - Evidence:
     - `cloud/terraform/modules/graphene-stack/stytch.tf:75`
     - `cloud/terraform/modules/graphene-stack/stytch.tf:138`
   - Risk: Token theft risk via XSS; weak HIPAA/SOC2 session hardening posture.
   - Why this is an issue: HttpOnly is a baseline control that prevents JavaScript from reading session cookies after an XSS event. Without it, a single frontend injection can become full account/session compromise and broader data access.

2. Unauthenticated test/agent endpoints are mounted in server routes.
   - Evidence:
     - `cloud/server/server.ts:34`
     - `cloud/server/server.ts:35`
     - `cloud/server/agent/testEndpoint.ts:7`
   - Risk: Abuse/exposure path in production if not gated by environment/auth.
   - Why this is an issue: Test paths often bypass normal authorization assumptions and can expose internal behavior, rendering, or tool execution to untrusted callers. In regulated environments, any undocumented unauthenticated route is typically treated as a high-risk control failure.

3. Authorization is coarse (organization-level), with little/no role enforcement for query actions.
   - Evidence:
     - `cloud/server/query.ts:18`
     - `cloud/server/query.ts:52`
     - `cloud/schema.ts:16`
   - Risk: Excessive access to sensitive datasets within an org.
   - Why this is an issue: SOC2 and HIPAA both expect least privilege in practice, not just authentication at org scope. If all authenticated users can execute broad queries, insider misuse and accidental overexposure become much more likely.

4. Secret encryption can fall back from KMS to env-derived key path in production conditions.
   - Evidence:
     - `cloud/server/secrets.ts:14`
     - `cloud/server/secrets.ts:15`
   - Risk: Inconsistent cryptographic controls; potential key management non-compliance.
   - Why this is an issue: Compliance reviews look for deterministic, enforceable key management boundaries for production secrets. A runtime fallback undermines assurance because effective protection depends on deployment quirks rather than policy-driven controls.

5. Network segmentation uses default VPC/subnets for key workloads.
   - Evidence:
     - `cloud/terraform/modules/graphene-stack/vpc.tf:2`
     - `cloud/terraform/modules/graphene-stack/ecs.tf:34`
     - `cloud/terraform/modules/graphene-stack/aurora.tf:6`
   - Risk: Increased blast radius and weaker isolation for regulated workloads.
   - Why this is an issue: Dedicated network tiers are a standard defense-in-depth boundary for sensitive systems and databases. Using default shared networking increases lateral movement risk and makes isolation controls harder to demonstrate to auditors.

6. Core client caching and tooling can persist sensitive data artifacts.
   - Evidence:
     - `core/ui/internal/clientCache.ts:42`
     - `core/cli/serve2.ts:142`
     - `core/cli/check.ts:127`
   - Risk: PHI retention in browser cache and local tmp screenshots.
   - Why this is an issue: Cached query payloads and screenshots can outlive the user session and bypass normal access controls once written to disk/browser storage. That creates uncontrolled PHI copies, which directly increases breach and retention risk.

### Medium

1. Policy contradictions reduce audit defensibility (timing/cadence/channel conflicts).
   - Access revocation conflict:
     - `docs/policy/Access Control and Termination Policy.md:40`
     - `docs/policy/Information Security Policy.md:56`
   - Vulnerability scan cadence conflict:
     - `docs/policy/Risk Assessment and Treatment Policy.md:73`
     - `docs/policy/Information Security Policy.md:92`
   - Incident reporting channel mismatch:
     - `docs/policy/Incident Response Policy.md:17`
     - `docs/policy/Information Security Policy.md:127`
   - Why this is an issue: Contradictory policy instructions create execution ambiguity during incidents and access events, when consistency matters most. Auditors treat unresolved conflicts as a sign that controls may not operate reliably.

2. Policy language is frequently non-mandatory ("should"/"may") in critical controls.
   - Evidence examples:
     - `docs/policy/Network Security Policy.md:13`
     - `docs/policy/Business Continuity and Disaster Recovery.md:23`
     - `docs/policy/Information Security Policy.md:46`
   - Why this is an issue: Non-mandatory wording weakens enforceability because teams can claim compliance while skipping implementation. For SOC2/HIPAA audits, mandatory controls must be clearly stated so testing criteria are objective.

3. HIPAA breach/privacy policy details have implementation quality gaps.
   - Missing/broken HHS notification reference:
     - `docs/policy/Breach Notification Policy.md:46`
   - Substitute notice language appears incorrect/incomplete:
     - `docs/policy/Breach Notification Policy.md:42`
   - Privacy Rule workflow detail is thin for individual rights operationalization:
     - `docs/policy/HIPAA Internal Privacy Policy.md:29`
   - Why this is an issue: HIPAA requires precise operational handling for breach notice and privacy rights, not only high-level intent. Missing or incorrect details can cause statutory timeline misses or incomplete notifications.

4. DB transport encryption enforcement is not explicit in IaC/app config.
   - Evidence:
     - `cloud/terraform/modules/graphene-stack/aurora.tf:67` (at rest)
     - `cloud/server/db.ts:35`
   - Risk: TLS-in-transit posture not provable from repo controls.
   - Why this is an issue: If TLS is not explicitly required, encrypted transport may vary by environment and connection string defaults. That weakens confidentiality guarantees for ePHI and makes control evidence difficult to defend.

5. IAM policies include broad `Resource = "*"` grants in several roles.
   - Evidence:
     - `cloud/terraform/modules/graphene-stack/iam.tf:69`
     - `cloud/terraform/modules/graphene-stack/iam.tf:81`
     - `cloud/terraform/modules/graphene-stack/iam.tf:229`
   - Why this is an issue: Wildcard resource scopes increase the impact of credential misuse and make least-privilege attestations hard to support. Auditors usually expect narrowed permissions tied to explicit resources and functions.

6. SDLC security automation is incomplete in repository workflows.
   - CI triggers on `push` (not PR) in `.github/workflows/ci.yml:3`
   - No repo-evidenced SAST/SCA/secret scanning workflows found under `.github/workflows`
   - GitHub Actions not pinned to immutable SHAs (e.g., `.github/workflows/ci.yml:15`)
   - Why this is an issue: Without consistent pre-merge and security scanning gates, vulnerabilities and leaked secrets can reach production undetected. Unpinned actions also introduce supply-chain uncertainty in the CI control path.

### Low

- Security headers hardening not explicit in server middleware (`cloud/server/server.ts:14`).
  - Why this is an issue: Missing explicit header controls (for example HSTS/CSP/frame protections) leaves preventable browser attack paths open and can weaken baseline security posture.
- Audit log data model fields exist but operational population is unclear (`cloud/schema.ts:38`).
  - Why this is an issue: Controls that exist only in schema but are not consistently populated reduce forensic value and undermine evidence quality during incident reconstruction.
- Log retention may be shorter than policy expectation in some services:
  - `cloud/terraform/modules/graphene-stack/lambda.tf:56`
  - `cloud/terraform/modules/graphene-stack/ecs.tf:112`
  - Why this is an issue: If retention is shorter than policy or investigation windows, relevant evidence can age out before detection or legal hold, weakening incident response and audit support.

## SOC2 + HIPAA Control Impact (High-Level)

- SOC 2 CC6 / CC7 (logical access and system operations): impacted by route exposure, RBAC gaps, and policy inconsistency.
- SOC 2 CC8 / change management: impacted by SDLC gate/scanning deficiencies.
- SOC 2 confidentiality criteria: impacted by caching/screenshot artifacts and weakly enforced policy language.
- HIPAA Security Rule technical safeguards: impacted by session cookie hardening, access granularity, and encryption transport evidence gaps.
- HIPAA administrative safeguards: policy ownership/cadence contradictions and partial implementation detail reduce audit readiness.
- HIPAA Breach Notification: policy contains placeholder/error-level quality issues requiring correction.

## Prioritized Remediation Plan

### 0-30 Days (Immediate)

1. Enable HttpOnly cookies in Stytch config and validate secure attributes.
2. Remove or strictly gate test/agent endpoints from production runtime.
3. Enforce KMS-only encryption path in production (`cloud/server/secrets.ts`).
4. Normalize critical policy language to mandatory terms and resolve known contradictions.
5. Correct HIPAA breach policy placeholder and substitute-notice text.

### 31-60 Days

1. Implement role-based authorization checks for query/repo-sensitive operations.
2. Introduce dedicated VPC segmentation strategy (private subnets for DB/app tiers).
3. Enforce DB TLS requirements in code/IaC with explicit, testable settings.
4. Add PR-triggered CI validation and baseline security scanning workflows.
5. Reduce/disable sensitive client cache and screenshot artifact persistence defaults.

### 61-90 Days

1. Tighten IAM policies to least-privilege resource scoping.
2. Add CloudTrail/VPC flow log controls (if managed externally, codify references/evidence).
3. Build SOC2/HIPAA control-to-evidence matrix with named owners and review cadence.
4. Formalize HIPAA Privacy Rule operations for individual rights handling workflows.

## Audit Readiness Evidence Needed (Not Verifiable from Repo)

The following controls could not be fully confirmed from source alone and should be assembled for formal audit:

- GitHub branch protection and required review settings.
- Cloud account-level CloudTrail configuration and retention.
- Security scanning tooling run records and remediation SLAs.
- Incident response tabletop evidence and postmortems.
- Access review records and offboarding evidence.
- BAA templates, executed BAAs, and vendor due diligence records.
- Backup restore test evidence and RTO/RPO acceptance documentation.

## Conclusion

Graphene is reasonably close to compliance-ready from a policy existence perspective, but currently has several high-priority implementation and policy quality gaps that would likely generate SOC2/HIPAA audit findings if unaddressed. The remediation plan above is designed to close the most material risks first while improving evidence quality for formal audits.
