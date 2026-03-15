# Security Policy

## Supported Versions

Only the latest release on the `main` branch receives security fixes. If you are
running an older version, please upgrade before reporting a vulnerability.

| Version         | Supported          |
|-----------------|--------------------|
| `main` (latest) | Yes                |
| Older releases  | No                 |

---

## Responsible Disclosure

We take the security of ThreatDex seriously. If you discover a vulnerability —
whether in the web application, the API, a data ingestion worker, or the
infrastructure — please report it to us privately before disclosing it publicly.

**Do not open a public GitHub Issue for security vulnerabilities.**

Public disclosure before a fix is available puts all users at risk.

---

## How to Report a Vulnerability

Send an email to:

```
security@threatdex.example.com
```

Please include the following in your report:

1. **Summary** — A brief description of the vulnerability.
2. **Affected component** — Which part of the system is affected
   (e.g. API endpoint, authentication, data ingestion worker, frontend).
3. **Severity assessment** — Your assessment of the impact and exploitability
   (Critical / High / Medium / Low), and why.
4. **Steps to reproduce** — A clear, numbered list of steps that reproduce the
   issue. Include any scripts, payloads, or configuration required.
5. **Proof of concept** — If possible, include a minimal PoC that demonstrates
   the issue. Sanitise any sensitive data before sending.
6. **Suggested remediation** — If you have a proposed fix or mitigation,
   please include it. This is optional but very helpful.
7. **Your contact details** — So we can follow up with you.

### PGP Encryption (optional)

If your report contains sensitive details, you may encrypt it using our PGP key.
Request the key by emailing `security@threatdex.example.com` with the subject line
`PGP key request`.

---

## Response Timeline

We are committed to the following timelines:

| Milestone                           | Target                    |
|-------------------------------------|---------------------------|
| Acknowledgement of receipt          | Within 2 business days    |
| Initial triage and severity rating  | Within 5 business days    |
| Status update                       | Every 7 days until fixed  |
| Fix and public disclosure           | Within 90 days of receipt |

For Critical severity issues we aim to resolve and patch within 14 days.
We will coordinate the disclosure date with you wherever possible.

If you do not receive an acknowledgement within 2 business days, please follow
up to ensure your message was not lost in spam.

---

## Scope

The following are **in scope** for this security policy:

- `apps/web` — Next.js frontend
- `apps/api` — FastAPI backend and all REST endpoints
- `workers/*` — Data ingestion workers
- `packages/*` — Shared libraries
- `infra/docker-compose.yml` and related container configuration
- GitHub Actions workflows (supply chain / secrets exposure)

The following are **out of scope**:

- Third-party services we depend on (MITRE, ETDA, AlienVault OTX, etc.)
- Social engineering attacks against contributors or maintainers
- Denial-of-service attacks against the production service
- Issues in dependency packages that are already publicly known and tracked
  upstream (please report those to the relevant upstream project)

---

## Vulnerability Handling Process

1. **Receipt** — Your report is received and a case is opened.
2. **Triage** — The security team assesses severity and reproduces the issue.
3. **Fix** — A patch is developed on a private branch.
4. **Testing** — The fix is reviewed and tested.
5. **Release** — The fix is merged and a new release is published.
6. **Disclosure** — We publish a security advisory on GitHub. Credit is given
   to the reporter unless they prefer to remain anonymous.

---

## Hall of Fame

We credit security researchers who report valid vulnerabilities in accordance
with this policy. If you would like to be recognised, let us know your preferred
name or handle when submitting your report.

---

## Safe Harbour

ThreatDex is an open-source project. We strongly support good-faith security
research. If you act in good faith, following this policy, we will:

- Not pursue legal action against you
- Work with you to understand and resolve the issue
- Credit you in the security advisory (if you wish)

We ask that you:

- Give us reasonable time to fix the issue before public disclosure
- Avoid accessing, modifying, or deleting data that does not belong to you
- Avoid actions that degrade the service for other users
- Limit your testing to accounts and environments you own or have permission to use

---

## Contact

- **Security email:** security@threatdex.example.com
- **General contact:** See the repository's GitHub Discussions

_This policy is based on responsible disclosure best practices and is reviewed annually._
