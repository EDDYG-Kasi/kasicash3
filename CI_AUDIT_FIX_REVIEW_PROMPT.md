# KasiCash CI Audit Fix Review Prompt

You are a senior backend/security engineer doing a focused delta review of a KasiCash CI remediation.

Context: GitHub Actions failed on `npm audit --audit-level=moderate` before build/tests ran. The remediation is intended to be dependency-only: update vulnerable transitive packages, keep the application behaviour unchanged, preserve the immutable ledger/auth/reporting/dashboard invariants, and get CI back to the real Postgres/Testcontainers gate.

Review scope:

1. Receipt-check the archive and confirm the relevant changed files are present:
   - `package.json`
   - `package-lock.json`
   - `CHANGELOG.md`
   - `CI_AUDIT_FIX_REVIEW_PROMPT.md`
2. Verify the remediation is dependency-only:
   - Direct Nest packages are aligned on compatible Nest 11 patch versions.
   - `multer` is overridden to a patched version without upgrading the app to Nest 12.
   - No ledger, ingestion, auth, reports, analytics, anomaly, dashboard, or public-site application logic was changed for this audit fix.
3. Verify security outcome:
   - `npm audit --audit-level=moderate` reports zero vulnerabilities.
   - The fix does not suppress or remove the audit gate.
   - No secrets, credentials, or environment values were introduced.
4. Verify behaviour/invariants did not regress:
   - `npm run build`
   - `npm run lint`
   - `npm run verify:text`
   - `npm test -- --runInBand`
   - `npm run test:integration` in an environment with Docker/Testcontainers or the repository GitHub Actions runner.
5. Hunt specifically for:
   - Nest package version skew.
   - Unsafe broad major upgrades.
   - Audit bypasses in `.github/workflows/ci.yml`.
   - Any app-code behaviour changes hidden inside the audit fix.
   - Any new write path, tenant-isolation regression, money-format regression, or secret leakage.

Known local result before handoff:

- `npm audit --audit-level=moderate`: passed, zero vulnerabilities.
- `npm run build`: passed.
- `npm run lint`: passed.
- `npm run verify:text`: passed.
- `npm test -- --runInBand`: passed, 32 suites / 228 tests.
- `npm run test:integration`: locally blocked because this Windows environment could not find a Docker/Testcontainers runtime; GitHub Actions is expected to provide the real Postgres service/runtime.

Deliverable: concise findings-first review with severity, exact file references, whether the CI audit failure is properly remediated, and a verdict pending or based on green GitHub Actions.
