# Security Advisories

Published and draft advisories for this project. Full details, CVSS vectors and patched
versions live on the [GitHub Security Advisories](../../security/advisories) page.

| ID | Date | Severity | Summary | Affected | Fixed in | Status |
| --- | --- | --- | --- | --- | --- | --- |
| — | 2026-11-24 | Medium | Course pack integrity check trusts the first download (TOFU) | `<= 3` | `4` | Fixed — ready to publish |

## Reporting

Do **not** open a public issue. Use
[private vulnerability reporting](../../security/advisories/new) or email
security@example.com — see [SECURITY.md](SECURITY.md) for scope and response times.

---

## Advisory 1 — Course pack integrity check trusts the first download (TOFU)

**Status:** fixed in `4`. Publish the GitHub draft once this file is on `main`, then replace
the `—` in the table above with the assigned `GHSA-…` identifier.

| Field | Value |
| --- | --- |
| Ecosystem | Other |
| Package | `labdeck` |
| Affected versions | `<= 3` |
| Patched versions | `4` |
| Severity | Medium — `CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N` (≈ 4.2) |
| CWE | CWE-494: Download of Code Without Integrity Check |

### Summary

Course packs were verified against a SHA-256 hash pinned on first download. A pack tampered
with before the first load was pinned as trusted and passed every later integrity check,
allowing injected markup to reach the page.

### Details

`assets/security.js` implemented `verifyPack()` as trust-on-first-use:

```js
if (!pins[courseId]) { pins[courseId] = hash; return { status: 'pinned' }; }
