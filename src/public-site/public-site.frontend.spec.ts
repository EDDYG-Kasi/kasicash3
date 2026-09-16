import {
  aboutPageHtml,
  contactPageHtml,
  cookiePolicyHtml,
  feesLimitsPageHtml,
  helpPageHtml,
  pricingPageHtml,
  privacyPolicyHtml,
  publicSiteHtml,
  securityTrustPageHtml,
  termsPageHtml,
} from './public-site.frontend';

describe('public KasiCash website renderer', () => {
  it('renders the shared premium brand system and one clear public CTA', () => {
    const html = publicSiteHtml();

    expect(html).toContain('KasiCash');
    expect(html).toContain('Simple to run. Easy to grow.');
    expect(html).toContain('--green: #00c853');
    expect(html).toContain('--black: #0e0e0e');
    expect(html).toContain('--ivory: #f7f6f1');
    expect(html).toContain('--font-sans');
    expect(html).toContain('kc-brand');
    expect(html).toContain('href="/auth/signup"');
    expect(html).toContain('Request setup');
    expect(html).toContain('Dashboard login');
    expect(html).toContain('aria-label="Mobile navigation"');
    expect(html).toContain('href="/about">About</a>');
    expect(html).not.toContain('Start sign up');
    expect(html).not.toContain('>Sign up</a>');
  });

  it('uses composed product sections instead of a generic floating-card homepage', () => {
    const html = publicSiteHtml();

    expect(html).toContain('home-hero');
    expect(html).toContain('device-scene');
    expect(html).toContain('phone-frame');
    expect(html).toContain('home-proof');
    expect(html).toContain('process-list');
    expect(html).toContain('screen-strip');
    expect(html).not.toContain('class="feature-card"');
    expect(html).not.toContain('class="info-card"');
  });

  it('keeps the public page separate from internal phase and dashboard debug language', () => {
    const html = publicSiteHtml();

    expect(html).not.toContain('P4');
    expect(html).not.toContain('P6');
    expect(html).not.toContain('P7');
    expect(html).not.toContain('Bucket');
    expect(html).not.toContain('Delta');
    expect(html).not.toContain('Running');
    expect(html).not.toContain('Read-only trader dashboard');
  });

  it('states trust boundaries without inventing financial figures', () => {
    const html = publicSiteHtml();

    expect(html).toContain('No lender promises');
    expect(html).toContain('No silent ledger writes');
    expect(html).toContain('do not invent business figures');
    expect(html).toContain('Your business stays separate');
    expect(html).toContain('Clear privacy boundaries');
    expect(html).not.toMatch(/R\s+\d/);
    expect(html).not.toContain('ZAR');
  });

  it('includes mobile-first and accessible page structure', () => {
    const html = publicSiteHtml();

    expect(html).toContain('name="viewport"');
    expect(html).toContain('aria-label="Main navigation"');
    expect(html).toContain('aria-label="Mobile navigation"');
    expect(html).toContain('aria-labelledby="hero-title"');
    expect(html).toContain('@media (max-width: 520px)');
    expect(html).toContain('min-height: 46px');
  });

  it('renders public trust and legal pages without production legal overclaiming', () => {
    expect(pricingPageHtml()).toContain('Commercial terms must be confirmed');
    expect(feesLimitsPageHtml()).toContain('does not hold trader funds');
    expect(securityTrustPageHtml()).toContain('Not a certification claim');
    expect(privacyPolicyHtml()).toContain('Legal review required');
    expect(termsPageHtml()).toContain('not final production terms');
    expect(cookiePolicyHtml()).toContain(
      'Marketing and analytics cookies are not part of this build',
    );
    expect(cookiePolicyHtml()).toContain('<h1>Cookies</h1>');
    expect(cookiePolicyHtml()).not.toContain('boring but important job');
  });

  it('gives the static legal and about pages a fuller trader-facing voice', () => {
    expect(privacyPolicyHtml()).toContain('The promise in normal words');
    expect(privacyPolicyHtml()).toContain(
      'collect what is needed to run the service',
    );
    expect(privacyPolicyHtml()).toContain('POPIA');

    expect(termsPageHtml()).toContain('Terms of service');
    expect(termsPageHtml()).toContain('The deal in plain words');
    expect(termsPageHtml()).toContain('What KasiCash is not');

    expect(cookiePolicyHtml()).toContain('The short version');
    expect(cookiePolicyHtml()).toContain(
      'server-set session cookie for signed-in dashboard access',
    );

    expect(aboutPageHtml()).toContain('Built around the counter');
    expect(aboutPageHtml()).toContain('Records that mean something');
    expect(aboutPageHtml()).toContain('do not invent, do not leak');
    expect(aboutPageHtml()).not.toContain('without becoming accountants');
    expect(aboutPageHtml()).not.toContain('business by feel');
    expect(publicSiteHtml()).not.toMatch(/R\s+\d/);
  });

  it('uses setup-request wording instead of sign-up-page copy on public pages', () => {
    const pages = [pricingPageHtml(), helpPageHtml(), contactPageHtml()];
    for (const html of pages) {
      expect(html).toContain('setup request page');
      expect(html).not.toContain('sign-up page');
    }
  });

  it('renders legal-style pages with a table of contents reading layout', () => {
    const html = privacyPolicyHtml();

    expect(html).toContain('class="legal-layout"');
    expect(html).toContain('class="legal-toc"');
    expect(html).toContain('On this page');
    expect(html).toContain('href="#section-1-the-promise-in-normal-words"');
    expect(html).toContain('class="legal-content"');
    expect(html).toContain('<h2>The promise in normal words</h2>');
  });
});
