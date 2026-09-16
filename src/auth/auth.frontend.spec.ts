import { authLoginHtml, authSignupHtml } from './auth.frontend';

describe('auth login front end', () => {
  it('renders a dashboard login page that uses the existing cookie session flow', () => {
    const html = authLoginHtml();

    expect(html).toContain('Simple to run. Easy to grow.');
    expect(html).toContain('Sign in to open your dashboard.');
    expect(html).toContain('Request setup');
    expect(html).toContain('background: var(--canvas)');
    expect(html).not.toContain('linear-gradient(90deg');
    expect(html).toContain('#00c853');
    expect(html).toContain('#0e0e0e');
    expect(html).toContain('#f7f6f1');
    expect(html).toContain("fetch('/auth/login'");
    expect(html).toContain('XMLHttpRequest');
    expect(html).toContain("credentials: 'same-origin'");
    expect(html).toContain("window.location.assign('/dashboard')");
  });

  it('does not store bearer tokens in browser storage', () => {
    const html = authLoginHtml();

    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('sessionStorage');
    expect(html).not.toContain('document.cookie');
  });

  it('renders a setup request page before the existing login flow', () => {
    const html = authSignupHtml();

    expect(html).toContain('<title>KasiCash Setup Request</title>');
    expect(html).toContain('Request KasiCash setup.');
    expect(html).toContain('Request your setup');
    expect(html).toContain("We'll open a draft in your email app");
    expect(html).toContain('Review it and press Send');
    expect(html).toContain("Hi KasiCash, I'd like to request setup.");
    expect(html).toContain('href="/auth/login"');
    expect(html).toContain('mailto:hello@kasicash.co.za');
    expect(html).toContain('KasiCash setup request');
    expect(html).toContain('This page does not write to the ledger');
    expect(html).not.toContain('KasiCash Sign Up');
    expect(html).not.toContain('I want to sign up');
    expect(html).not.toContain("fetch('/auth/login'");
    expect(html).not.toContain('POST');
  });
});
