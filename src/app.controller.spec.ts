import { AppController } from './app.controller';

describe('AppController', () => {
  const controller = new AppController();

  it('serves the public KasiCash website at the root path', () => {
    const html = controller.root();

    expect(html).toContain(
      '<title>KasiCash | Simple to run. Easy to grow.</title>',
    );
    expect(html).toContain('Request setup');
    expect(html).toContain('href="/auth/signup"');
    expect(html).toContain('--green: #00c853');
    expect(html).toContain('href="/legal/privacy"');
    expect(html).toContain('href="/fees-limits"');
    expect(html).not.toContain('P4');
    expect(html).not.toContain('Read-only trader dashboard');
  });

  it('serves public trust, support, and legal pages separately from the API root', () => {
    expect(controller.pricing()).toContain('<h1>Pricing</h1>');
    expect(controller.feesLimits()).toContain('<h1>Fees and limits</h1>');
    expect(controller.security()).toContain('<h1>Security centre</h1>');
    expect(controller.help()).toContain('<h1>Help and FAQ</h1>');
    expect(controller.contact()).toContain('<h1>Contact</h1>');
    expect(controller.about()).toContain('<h1>About KasiCash</h1>');
    expect(controller.accessibility()).toContain('<h1>Accessibility</h1>');
    expect(controller.privacy()).toContain('<h1>Privacy policy</h1>');
    expect(controller.terms()).toContain('<h1>Terms of service</h1>');
    expect(controller.cookies()).toContain('<h1>Cookies</h1>');
  });

  it('keeps the machine-readable API root available separately', () => {
    expect(controller.apiRoot()).toEqual({
      ok: true,
      service: 'kasicash-api',
    });
  });
});
