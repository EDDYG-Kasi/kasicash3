You are a senior product designer and fintech UX reviewer. Review the KasiCash public website/auth/dashboard redesign visually and critically.

Context:

- KasiCash is a WhatsApp-first financial-record system for informal South African traders.
- The target design language is premium Apple-native fintech: calm, precise, native-feeling, restrained, trustworthy, and financially credible.
- The brand sheet uses `Kc | KasiCash`, vivid green `#00C853`, black `#0E0E0E`, warm ivory `#F7F6F1`, and Poppins/system typography.
- The site must not feel like a generic SaaS template, debug page, or vibe-coded card grid.
- Public pages are static. Dashboard views are read-only and must not invent numbers or mutate financial data.

Files to inspect:

- Screenshot folder if provided.
- Static HTML snapshots if provided.
- `src/design-system/kasicash-design-system.ts`
- `src/public-site/public-site.frontend.ts`
- `src/auth/auth.frontend.ts`
- `src/dashboard/dashboard.frontend.ts`
- `PREMIUM_APP_REDESIGN_DESIGN.md`
- `PUBLIC_PAGES_PERSONALITY_REVIEW_PROMPT.md`

This is a remediation pass after a prior visual review. Please verify these
specific fixes before looking for new issues:

1. Desktop login/signup no longer use a viewport-relative black/ivory gradient
   that can create white-on-ivory copy. The dark intro is now an actual auth
   layout panel.
2. Mobile homepage keeps a simplified product/device scene instead of hiding all
   product identity.
3. Mobile header includes usable navigation instead of forcing visitors into the
   footer.
4. Dashboard money movements use a mobile row layout instead of squeezing the
   desktop table.
5. Dashboard containers are reduced: KPI content is a continuous summary surface
   and detail sections rely more on separators than repeated cards.
6. Small green text uses contrast-correct brand green: darker `#006F38` on
   light/ivory surfaces and vivid `#00C853` on black surfaces.
7. Signup/login copy says `Request setup` and makes the email-app handoff clear.
8. Public/legal copy avoids the previously flagged phrases: `Privacy by design`,
   `boring but important job`, `without becoming accountants`, and `business by
   feel`.

Review the visual result first:

1. Does the homepage feel like a real premium fintech product website, not a generic floating-card SaaS page?
2. Does the hero have a strong first impression, clear brand signal, and one obvious action?
3. Are the product/device scene, proof band, timeline flow, product status strip, and trust list cohesive rather than decorative filler?
4. Do Privacy, Terms of service, Cookies, and About feel polished, structured, and content-rich, with readable line length and useful table-of-contents navigation?
5. Do signup/login feel like trusted financial flows rather than generic HTML forms?
6. Is the design mobile-first, with no squeezed desktop layout, clipped text, tiny touch targets, or horizontal overflow?
7. Are colours semantic and restrained: brand green for brand/action, red only for errors/negative states, neutral surfaces for financial legibility?
8. Is the typography consistent, Apple-like, and credible?
9. Is there still too much card/bubble UI, shadow, decoration, or repeated rounded rectangles?
10. Does the copy sound human and trader-respectful without making unsupported legal, financial, lender, insurer, government, or guarantee claims?

Then review implementation boundaries:

1. Confirm this redesign is presentation-only.
2. Confirm no new ledger write path, no dashboard write action, and no mutation of financial services.
3. Confirm public pages do not show fake money figures.
4. Confirm dashboard money formatting still happens at the view boundary and no client-side money math was added.
5. Confirm tenant isolation/auth wiring was not weakened.

Return:

- receipt check;
- visual/design findings ordered by severity;
- implementation/invariant findings ordered by severity;
- specific page-by-page notes;
- mobile notes;
- legal/trust-copy notes;
- whether the result now satisfies the original Apple-native fintech brief;
- rating out of 10;
- verdict pending green CI, formal legal review, and accessibility/device testing.
