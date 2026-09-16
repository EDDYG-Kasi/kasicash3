import {
  brandLockupHtml,
  kasiDesignSystemCss,
  legalPageShell,
  siteFooter,
  siteHeader,
} from './kasicash-design-system';

describe('KasiCash design system', () => {
  it('defines the shared brand, type, spacing, and state tokens', () => {
    const css = kasiDesignSystemCss();

    expect(css).toContain('--green: #00c853');
    expect(css).toContain('--green-strong: #006f38');
    expect(css).toContain('--green-on-dark: #00c853');
    expect(css).toContain('--black: #0e0e0e');
    expect(css).toContain('--ivory: #f7f6f1');
    expect(css).toContain('--font-sans');
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('min-height: 46px');
    expect(css).toContain('.mobile-nav');
    expect(css).toMatch(/\.mobile-nav\s*{\s*display: flex;/);
    expect(css).toContain('@media (min-width: 980px)');
    expect(css).toMatch(
      /@media \(min-width: 980px\)[\s\S]*\.mobile-nav\s*{\s*display: none;/,
    );
    expect(css).toContain('.auth-intro .hero-kicker');
    expect(css).toContain('color: var(--green-on-dark)');
  });

  it('renders a visible mobile navigation with secondary routes', () => {
    const html = siteHeader('/about');

    expect(html).toContain('aria-label="Mobile navigation"');
    expect(html).toContain('href="/about" aria-current="page">About</a>');
    expect(html).toContain('href="/auth/login">Dashboard login</a>');
    expect(html).toContain('Request setup');
    expect(html).not.toContain('Start sign up');
    expect(html).not.toContain('>Sign up</a>');
  });

  it('renders the brand lockup consistently across pages', () => {
    const html = brandLockupHtml();

    expect(html).toContain('kc-mark-c');
    expect(html).toContain('KasiCash');
    expect(html).toContain('Simple to run. Easy to grow.');
  });

  it('keeps legal footer links and review caveats visible', () => {
    const html = siteFooter();

    expect(html).toContain('/legal/privacy');
    expect(html).toContain('/legal/terms');
    expect(html).toContain('/legal/cookies');
    expect(html).toContain('Cookies');
    expect(html).toContain(
      'Legal, commercial, and regulatory wording must be reviewed',
    );
  });

  it('escapes legal page content before rendering', () => {
    const html = legalPageShell({
      title: 'Safety',
      eyebrow: 'Draft',
      description: 'Draft page',
      sections: [
        { title: 'Section', body: ['Use <script>bad()</script> safely.'] },
      ],
    });

    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(html).not.toContain('<script>bad()</script>');
  });

  it('renders legal pages as documents with section anchors and contents', () => {
    const html = legalPageShell({
      title: 'Safety',
      eyebrow: 'Draft',
      description: 'Draft page',
      sections: [
        { title: 'First section', body: ['Useful text.'] },
        { title: 'Second section', body: ['More useful text.'] },
      ],
    });

    expect(html).toContain('On this page');
    expect(html).toContain('href="#section-1-first-section"');
    expect(html).toContain('id="section-2-second-section"');
    expect(html).toContain('<h2>First section</h2>');
  });
});
