# KasiCash CI Audit Fix Round 2 Review Prompt

You are a senior backend/security engineer performing a focused delta review of the KasiCash CI audit remediation and its archive-packaging follow-up.

## Context

Round 1 accepted the dependency remediation pending green GitHub Actions. It found one low-severity packaging issue: Windows-created source archives exported `.gitattributes` and `.gitignore` with CRLF endings, so `npm run verify:text` failed after extracting the supplied ZIP even though the Git blobs and working tree were LF.

Round 2 adds explicit `eol=lf` rules for `.gitattributes`, `.gitignore`, `.dockerignore`, and `Dockerfile`. It does not change application code or the dependency remediation.

## Receipt Check

Confirm the archive contains:

- `.gitattributes`
- `.gitignore`
- `.dockerignore`
- `Dockerfile`
- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- `CHANGELOG.md`
- `CI_AUDIT_FIX_REVIEW_PROMPT.md`
- `CI_AUDIT_FIX_ROUND2_REVIEW_PROMPT.md`

## Review Tasks

1. Extract the supplied full-project ZIP into a clean directory.
2. Confirm `.gitattributes`, `.gitignore`, `.dockerignore`, and `Dockerfile` contain LF line endings, with no CRLF bytes.
3. Run `npm run verify:text` against the extracted archive and report the exact result.
4. Confirm the round-two semantic delta is limited to `.gitattributes`, `CHANGELOG.md`, and this review prompt.
5. Reconfirm the original audit remediation remains intact:
   - Direct Nest packages resolve compatibly on Nest 11.
   - `multer` resolves to `2.4.0` through the targeted npm override.
   - `npm audit --audit-level=moderate` remains a hard CI gate.
   - No audit suppression, `continue-on-error`, or severity downgrade was added.
6. Confirm no application source, ledger behaviour, tenant isolation, authentication, money handling, reports, analytics, anomalies, WhatsApp ingestion, or dashboard behaviour changed.
7. In a capable environment, run:
   - `npm ci`
   - `npm audit --audit-level=moderate`
   - `npm run build`
   - `npm run lint`
   - `npm run verify:text`
   - `npm test -- --runInBand`
   - `npm run test:integration`

## Known Local Results Before Handoff

- Audit: zero vulnerabilities.
- Build: passed.
- Lint: passed.
- Text hygiene: passed in the repository.
- Unit tests: 32 suites and 228 tests passed.
- Integration tests: locally blocked by unavailable Docker/Testcontainers runtime; GitHub Actions remains the authoritative real-PostgreSQL gate.

## Deliverable

Provide findings first, ordered by severity. State whether the extracted archive is now reproducible and text-clean, whether the dependency remediation remains correct, whether any application behaviour changed, and whether final acceptance remains pending or is supported by a green GitHub Actions run.
