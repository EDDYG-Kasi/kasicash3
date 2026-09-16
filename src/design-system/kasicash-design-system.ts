export interface SiteShellOptions {
  title: string;
  description: string;
  activePath?: string;
  body: string;
}

export interface LegalPageOptions {
  title: string;
  eyebrow: string;
  description: string;
  activePath?: string;
  updatedLabel?: string;
  sections: Array<{
    title: string;
    body: string[];
  }>;
}

const siteNavItems = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/fees-limits', label: 'Fees and limits' },
  { href: '/security', label: 'Security' },
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Help' },
];

const mobileNavItems = [
  ...siteNavItems,
  { href: '/auth/login', label: 'Dashboard login' },
];

const footerGroups = [
  {
    title: 'Product',
    links: [
      { href: '/', label: 'Home' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/fees-limits', label: 'Fees and limits' },
      { href: '/help', label: 'Help and FAQ' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { href: '/security', label: 'Security centre' },
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Terms of service' },
      { href: '/legal/cookies', label: 'Cookies' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/accessibility', label: 'Accessibility' },
      { href: '/auth/login', label: 'Dashboard login' },
    ],
  },
];

export function pageHead(title: string, description: string): string {
  return `<meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeAttribute(title)}</title>
  <meta name="description" content="${escapeAttribute(description)}" />`;
}

export function kasiDesignSystemCss(): string {
  return `
    :root {
      color-scheme: light dark;
      --green: #00c853;
      --green-strong: #006f38;
      --green-on-dark: #00c853;
      --green-soft: #e8f8ee;
      --black: #0e0e0e;
      --ivory: #f7f6f1;
      --canvas: #fbfaf6;
      --panel: #ffffff;
      --panel-muted: #f1efe7;
      --ink: #0e0e0e;
      --ink-soft: #34342f;
      --muted: #686960;
      --line: #dfdbcf;
      --line-strong: #c7c2b5;
      --income: #007a3d;
      --income-soft: #e7f6ee;
      --expense: #a12a3a;
      --expense-soft: #fff0f2;
      --warning: #8a6100;
      --warning-soft: #fff7e2;
      --focus: #00c853;
      --shadow-soft: 0 1px 0 rgba(14, 14, 14, 0.08);
      --radius-xs: 8px;
      --radius-sm: 12px;
      --radius-md: 18px;
      --radius-lg: 28px;
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-8: 32px;
      --space-10: 40px;
      --space-12: 48px;
      --space-16: 64px;
      --font-sans: "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, Poppins, "Segoe UI", sans-serif;
      --font-display: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, Poppins, "Segoe UI", sans-serif;
      font-family: var(--font-sans);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --canvas: #0e0e0e;
        --panel: #171717;
        --panel-muted: #20201d;
        --ink: #f7f6f1;
        --ink-soft: #e6e2d7;
        --muted: #aba79b;
        --line: #2d2c28;
        --line-strong: #45433d;
        --green-soft: #0c2919;
        --income-soft: #0c2919;
        --expense-soft: #301016;
        --warning-soft: #30250f;
        --shadow-soft: none;
      }
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      background: var(--canvas);
    }

    body {
      margin: 0;
      color: var(--ink);
      background: var(--canvas);
      font-family: var(--font-sans);
      font-size: 16px;
      line-height: 1.5;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    a {
      color: inherit;
    }

    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible {
      outline: 3px solid rgba(0, 200, 83, 0.34);
      outline-offset: 3px;
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    h1,
    h2,
    h3,
    p {
      margin-top: 0;
    }

    .kc-page {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      background: var(--canvas);
    }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 20;
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--canvas) 92%, transparent);
      backdrop-filter: blur(18px);
    }

    .site-header-inner,
    .site-footer-inner,
    .site-main,
    .legal-main {
      width: min(1180px, 100%);
      margin: 0 auto;
      padding-inline: var(--space-4);
    }

    .site-header-inner {
      min-height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .kc-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      color: inherit;
      text-decoration: none;
    }

    .kc-mark {
      display: inline-flex;
      align-items: baseline;
      color: var(--ink);
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 900;
      line-height: 0.95;
      letter-spacing: 0;
    }

    .kc-mark-c {
      color: var(--green);
      margin-left: 1px;
    }

    .kc-brand-divider {
      width: 1px;
      height: 28px;
      flex: 0 0 auto;
      background: var(--line-strong);
    }

    .kc-wordmark {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .kc-wordmark strong {
      color: var(--ink);
      font-size: 17px;
      line-height: 1;
      font-weight: 780;
      letter-spacing: 0;
    }

    .kc-wordmark small {
      color: var(--muted);
      font-size: 10px;
      line-height: 1;
      font-weight: 720;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .site-nav,
    .mobile-nav {
      display: none;
      align-items: center;
      gap: 2px;
    }

    .site-nav a,
    .mobile-nav a,
    .footer-links a,
    .subnav a {
      text-decoration: none;
    }

    .site-nav a {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0 12px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 650;
    }

    .mobile-nav {
      display: flex;
      min-width: 0;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      padding: 0 var(--space-4) var(--space-2);
      scrollbar-width: none;
    }

    .mobile-nav::-webkit-scrollbar {
      display: none;
    }

    .mobile-nav a {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 0 14px;
      color: var(--muted);
      background: var(--panel-muted);
      font-size: 14px;
      font-weight: 700;
    }

    .site-nav a:hover,
    .site-nav a[aria-current="page"],
    .mobile-nav a:hover,
    .mobile-nav a[aria-current="page"],
    .subnav a:hover,
    .subnav a[aria-current="page"] {
      color: var(--ink);
      background: var(--panel-muted);
    }

    .button-primary,
    .button-secondary,
    .button-ghost {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 999px;
      padding: 0 18px;
      font-size: 15px;
      font-weight: 760;
      text-decoration: none;
      cursor: pointer;
      transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    }

    .button-primary {
      border: 1px solid var(--green);
      color: #07150d;
      background: var(--green);
    }

    .button-primary:hover {
      background: #13d967;
      border-color: #13d967;
    }

    .button-secondary {
      border: 1px solid var(--line);
      color: var(--ink);
      background: var(--panel);
    }

    .button-secondary:hover,
    .button-ghost:hover {
      background: var(--panel-muted);
    }

    .button-ghost {
      border: 1px solid transparent;
      color: var(--muted);
      background: transparent;
    }

    .site-main {
      width: 100%;
      max-width: none;
      padding: 0;
      display: block;
    }

    .home-hero,
    .home-band,
    .home-proof,
    .home-product,
    .home-trust,
    .home-cta {
      border-bottom: 1px solid var(--line);
    }

    .home-hero {
      position: relative;
      overflow: hidden;
      color: var(--black);
      background: var(--ivory);
    }

    .home-hero .hero-title {
      color: var(--black);
    }

    .home-hero .hero-copy {
      color: #34342f;
    }

    .home-hero .button-secondary {
      color: var(--black);
      background: #ffffff;
    }

    .home-hero .button-ghost {
      color: #34342f;
    }

    .home-hero::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      height: 1px;
      background: var(--line-strong);
    }

    .home-inner,
    .home-hero-inner,
    .home-proof-inner,
    .home-product-inner,
    .home-trust-inner,
    .home-cta-inner {
      width: min(1180px, 100%);
      margin: 0 auto;
      padding-inline: var(--space-4);
    }

    .home-hero-inner {
      position: relative;
      display: grid;
      align-content: end;
      gap: var(--space-8);
      padding-top: var(--space-6);
      padding-bottom: var(--space-10);
      z-index: 1;
    }

    .home-hero-copy {
      max-width: 760px;
      display: grid;
      gap: var(--space-5);
    }

    .home-hero-copy .hero-title {
      max-width: 740px;
    }

    .home-hero-copy .hero-copy {
      max-width: 640px;
    }

    .home-hero-visual {
      position: relative;
      width: min(360px, calc(100% - 32px));
      min-width: 0;
      display: block;
      margin: var(--space-5) auto 0;
      pointer-events: none;
    }

    .device-scene {
      position: relative;
      min-height: 350px;
    }

    .phone-frame {
      position: absolute;
      right: 0;
      top: 0;
      width: min(230px, 70vw);
      min-height: 350px;
      border: 10px solid var(--black);
      border-radius: 34px;
      background: #ffffff;
      overflow: hidden;
      box-shadow: 0 18px 44px rgba(14, 14, 14, 0.14);
    }

    .phone-status {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 18px 7px;
      color: var(--black);
      font-size: 11px;
      font-weight: 760;
    }

    .phone-status span:last-child {
      width: 52px;
      height: 15px;
      border-radius: 999px;
      background: var(--black);
    }

    .phone-screen {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-3);
    }

    .phone-kc {
      display: inline-flex;
      align-items: baseline;
      gap: 1px;
      color: var(--black);
      font-size: 23px;
      font-weight: 900;
      line-height: 1;
    }

    .phone-kc span {
      color: var(--green);
    }

    .phone-headline {
      color: var(--black);
      font-size: 22px;
      line-height: 1.05;
      font-weight: 820;
      letter-spacing: 0;
    }

    .phone-message,
    .phone-record {
      border: 1px solid #e5e0d4;
      border-radius: 18px;
      padding: 12px;
      color: #34342f;
      background: #fbfaf6;
      font-size: 13px;
      line-height: 1.35;
    }

    .phone-message {
      border-bottom-right-radius: 6px;
    }

    .phone-record {
      display: grid;
      gap: 8px;
    }

    .record-line {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e0d4;
    }

    .record-line:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .record-line span:first-child {
      color: #686960;
    }

    .ledger-sheet {
      position: absolute;
      left: 0;
      bottom: 0;
      width: min(258px, 74vw);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: var(--space-4);
      background: color-mix(in srgb, var(--panel) 94%, transparent);
      box-shadow: 0 12px 34px rgba(14, 14, 14, 0.08);
    }

    .ledger-sheet h2 {
      margin: 0 0 var(--space-4);
      color: var(--black);
      font-size: 15px;
      letter-spacing: 0;
    }

    .ledger-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-3);
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
      color: var(--ink-soft);
      font-size: 13px;
      font-weight: 680;
    }

    .ledger-row:last-child {
      border-bottom: 0;
    }

    .ledger-status {
      color: var(--green-strong);
    }

    .home-proof {
      background: var(--black);
      color: var(--ivory);
    }

    .home-proof-inner {
      display: grid;
      gap: var(--space-5);
      padding-top: var(--space-6);
      padding-bottom: var(--space-6);
    }

    .proof-statement {
      margin: 0;
      max-width: 780px;
      color: var(--ivory);
      font-size: clamp(22px, 6vw, 40px);
      line-height: 1.08;
      font-weight: 800;
      letter-spacing: 0;
    }

    .proof-row {
      display: grid;
      gap: var(--space-3);
      color: #c7c2b5;
      font-size: 14px;
      font-weight: 650;
    }

    .home-band,
    .home-product,
    .home-trust,
    .home-cta {
      background: var(--canvas);
    }

    .home-inner,
    .home-product-inner,
    .home-trust-inner,
    .home-cta-inner {
      padding-top: var(--space-12);
      padding-bottom: var(--space-12);
    }

    .home-split,
    .home-product-inner,
    .home-trust-inner {
      display: grid;
      gap: var(--space-8);
      align-items: start;
    }

    .home-copy-stack {
      display: grid;
      gap: var(--space-4);
    }

    .home-copy-stack h2,
    .home-cta h2 {
      max-width: 760px;
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(32px, 8vw, 64px);
      line-height: 0.98;
      font-weight: 820;
      letter-spacing: 0;
    }

    .process-list,
    .trust-list,
    .policy-list {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .process-list {
      border-top: 1px solid var(--line);
    }

    .process-list li {
      display: grid;
      grid-template-columns: 54px 1fr;
      gap: var(--space-4);
      padding: var(--space-5) 0;
      border-bottom: 1px solid var(--line);
    }

    .process-list span {
      color: var(--green-strong);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
    }

    .process-list strong,
    .trust-list strong,
    .policy-list strong {
      display: block;
      margin-bottom: 4px;
      color: var(--ink);
      font-size: 17px;
      line-height: 1.25;
    }

    .process-list p,
    .trust-list p,
    .policy-list p {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
    }

    .product-ledger {
      border-block: 1px solid var(--line);
      background: var(--panel);
    }

    .product-ledger-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-4);
      padding: var(--space-4) 0;
      border-bottom: 1px solid var(--line);
      align-items: center;
    }

    .product-ledger-row:last-child {
      border-bottom: 0;
    }

    .product-ledger-row span:first-child {
      color: var(--ink);
      font-weight: 760;
    }

    .product-ledger-row span:last-child {
      color: var(--muted);
      font-size: 13px;
      font-weight: 720;
    }

    .screen-strip {
      display: grid;
      gap: 0;
      border-block: 1px solid var(--line);
      background: var(--panel);
    }

    .screen-strip-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-4);
      min-height: 58px;
      align-items: center;
      padding: 0 var(--space-4);
      border-bottom: 1px solid var(--line);
    }

    .screen-strip-row:last-child {
      border-bottom: 0;
    }

    .screen-strip-row strong {
      color: var(--ink);
      font-size: 15px;
    }

    .screen-strip-row span {
      color: var(--muted);
      font-size: 13px;
      font-weight: 690;
    }

    .screen-strip-row .status-ok {
      color: var(--green-strong);
    }

    .trust-list {
      border-top: 1px solid var(--line);
    }

    .trust-list li {
      display: grid;
      gap: 4px;
      padding: var(--space-4) 0;
      border-bottom: 1px solid var(--line);
    }

    .home-cta {
      background: var(--black);
      color: var(--ivory);
    }

    .home-cta h2 {
      color: var(--ivory);
    }

    .home-cta .page-copy {
      color: #d8d4c8;
    }

    .home-cta .section-kicker,
    .auth-intro .hero-kicker {
      color: var(--green-on-dark);
    }

    .home-cta .button-ghost {
      color: #d8d4c8;
      border-color: #33332f;
    }

    .hero-panel {
      display: grid;
      gap: var(--space-6);
      padding: var(--space-6);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--panel);
      box-shadow: var(--shadow-soft);
    }

    .hero-kicker,
    .section-kicker {
      margin: 0;
      color: var(--green-strong);
      font-size: 12px;
      line-height: 1.2;
      font-weight: 780;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }

    .hero-title {
      max-width: 860px;
      margin-bottom: 0;
      font-family: var(--font-display);
      font-size: clamp(46px, 13vw, 92px);
      line-height: 0.96;
      letter-spacing: 0;
      font-weight: 830;
    }

    .hero-copy,
    .page-copy {
      max-width: 720px;
      margin-bottom: 0;
      color: var(--ink-soft);
      font-size: clamp(18px, 4.5vw, 23px);
      line-height: 1.35;
      font-weight: 520;
    }

    .hero-actions,
    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
    }

    .trust-strip {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding-top: var(--space-1);
    }

    .trust-strip span,
    .status-pill {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--muted);
      background: var(--canvas);
      font-size: 13px;
      font-weight: 650;
    }

    .dot {
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: var(--green);
    }

    .feature-grid,
    .two-column,
    .three-column,
    .legal-grid {
      display: grid;
      gap: var(--space-4);
    }

    .feature-card,
    .info-card,
    .legal-card {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--panel);
    }

    .feature-card,
    .info-card {
      padding: var(--space-5);
    }

    .feature-card h3,
    .info-card h3,
    .legal-card h3 {
      margin-bottom: var(--space-2);
      color: var(--ink);
      font-size: 19px;
      line-height: 1.2;
      font-weight: 760;
      letter-spacing: 0;
    }

    .feature-card p,
    .info-card p,
    .legal-card p,
    .legal-card li {
      margin-bottom: 0;
      color: var(--muted);
      font-size: 15px;
    }

    .feature-index {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-4);
      border-radius: 999px;
      color: #07150d;
      background: var(--green);
      font-weight: 820;
    }

    .section-block {
      display: grid;
      gap: var(--space-5);
    }

    .section-heading {
      display: grid;
      gap: var(--space-3);
    }

    .section-heading h2 {
      max-width: 780px;
      margin-bottom: 0;
      font-family: var(--font-display);
      font-size: clamp(32px, 8vw, 58px);
      line-height: 1;
      letter-spacing: 0;
      font-weight: 800;
    }

    .product-preview {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--black);
      border-radius: var(--radius-lg);
      color: var(--ivory);
      background: var(--black);
    }

    .preview-screen {
      display: grid;
      gap: var(--space-3);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      color: var(--ink);
      background: var(--ivory);
    }

    .preview-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-3);
      align-items: center;
      min-height: 42px;
      border-bottom: 1px solid #ded9ce;
      font-size: 14px;
      font-weight: 680;
    }

    .preview-row:last-child {
      border-bottom: 0;
    }

    .preview-chip {
      border-radius: 999px;
      padding: 5px 9px;
      color: #07150d;
      background: var(--green);
      font-size: 12px;
      font-weight: 760;
    }

    .subnav {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .subnav a {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0 12px;
      color: var(--muted);
      background: var(--panel-muted);
      font-size: 14px;
      font-weight: 680;
    }

    .legal-main {
      padding-top: var(--space-10);
      padding-bottom: var(--space-16);
      display: grid;
      gap: var(--space-10);
    }

    .legal-hero {
      display: grid;
      gap: var(--space-3);
      padding-bottom: var(--space-6);
      border-bottom: 1px solid var(--line);
    }

    .legal-hero h1 {
      max-width: 850px;
      margin-bottom: 0;
      font-family: var(--font-display);
      font-size: clamp(40px, 11vw, 72px);
      line-height: 0.98;
      letter-spacing: 0;
      font-weight: 820;
    }

    .legal-meta {
      color: var(--muted);
      font-size: 14px;
      font-weight: 650;
    }

    .legal-card {
      padding: var(--space-5);
    }

    .legal-layout {
      display: grid;
      gap: var(--space-8);
    }

    .legal-toc {
      border-block: 1px solid var(--line);
      padding-block: var(--space-4);
    }

    .legal-toc strong {
      display: block;
      margin-bottom: var(--space-3);
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .legal-toc a {
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 9px 0;
      color: var(--muted);
      border-top: 1px solid var(--line);
      text-decoration: none;
      font-size: 14px;
      font-weight: 680;
    }

    .legal-toc a:hover {
      color: var(--ink);
    }

    .legal-content {
      max-width: 760px;
      display: grid;
      gap: var(--space-8);
    }

    .legal-section {
      display: grid;
      gap: var(--space-3);
      scroll-margin-top: 92px;
      padding-bottom: var(--space-8);
      border-bottom: 1px solid var(--line);
    }

    .legal-section h2 {
      margin: 0;
      color: var(--ink);
      font-size: clamp(24px, 6vw, 36px);
      line-height: 1.08;
      letter-spacing: 0;
      font-weight: 800;
    }

    .legal-section p {
      margin: 0;
      color: var(--ink-soft);
      font-size: 16px;
      line-height: 1.68;
    }

    .legal-card ul {
      display: grid;
      gap: var(--space-2);
      margin: var(--space-3) 0 0;
      padding-left: 20px;
    }

    .site-footer {
      border-top: 1px solid var(--line);
      background: var(--panel);
    }

    .site-footer-inner {
      display: grid;
      gap: var(--space-8);
      padding-top: var(--space-8);
      padding-bottom: var(--space-8);
    }

    .footer-grid {
      display: grid;
      gap: var(--space-6);
    }

    .footer-group {
      display: grid;
      gap: var(--space-3);
    }

    .footer-group strong {
      font-size: 13px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .footer-links {
      display: grid;
      gap: 0;
    }

    .footer-links a {
      min-height: 44px;
      display: flex;
      align-items: center;
      color: var(--muted);
      font-size: 14px;
      font-weight: 620;
    }

    .footer-links a:hover {
      color: var(--ink);
    }

    .fine-print {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (min-width: 720px) {
        .site-header-inner,
        .site-footer-inner,
        .legal-main {
          padding-inline: var(--space-8);
        }

          .hero-panel {
            padding: var(--space-8);
          }

          .home-inner,
          .home-hero-inner,
          .home-proof-inner,
          .home-product-inner,
          .home-trust-inner,
          .home-cta-inner {
            padding-inline: var(--space-8);
          }

          .home-hero-visual {
            position: absolute;
            right: max(16px, calc((100vw - 1180px) / 2));
            top: clamp(86px, 12vh, 140px);
            width: min(48vw, 520px);
            min-width: 320px;
            display: block;
            margin: 0;
          }

          .home-hero,
          .home-hero-inner {
            min-height: calc(100svh - 68px);
          }

          .home-hero-inner {
            padding-top: var(--space-12);
          }

          .device-scene {
            min-height: 540px;
          }

          .phone-frame {
            right: 38px;
            width: 248px;
            min-height: 500px;
            border-width: 12px;
            border-radius: 42px;
            box-shadow: 0 24px 70px rgba(14, 14, 14, 0.16);
          }

          .phone-screen {
            gap: var(--space-4);
            padding: var(--space-4);
          }

          .phone-headline {
            font-size: 26px;
          }

          .ledger-sheet {
            bottom: 26px;
            width: 330px;
            border-radius: 26px;
            padding: var(--space-5);
            box-shadow: 0 18px 54px rgba(14, 14, 14, 0.1);
          }

          .home-hero-copy {
            max-width: 610px;
          }

          .proof-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .home-split,
          .home-product-inner,
          .home-trust-inner {
            grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
          }

          .legal-layout {
            grid-template-columns: 260px minmax(0, 1fr);
            align-items: start;
          }

          .legal-toc {
            position: sticky;
            top: 96px;
          }

      .two-column {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .three-column,
      .feature-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

          .legal-grid {
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      }

      .footer-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (min-width: 980px) {
      .site-nav {
        display: flex;
      }

      .mobile-nav {
        display: none;
      }
    }

    @media (max-width: 520px) {
      .site-header-inner {
        min-height: 62px;
      }

      .kc-wordmark small {
        display: none;
      }

      .site-header .button-primary {
        min-height: 46px;
        padding-inline: 14px;
      }

          .hero-title {
            font-size: clamp(42px, 17vw, 64px);
          }

          .home-hero {
            min-height: auto;
          }

          .home-hero-inner {
            min-height: auto;
          }
        }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 1ms !important;
        scroll-behavior: auto !important;
        transition-duration: 1ms !important;
      }
    }
  `;
}

export function kasiDashboardCss(): string {
  return `
    body {
      background: var(--canvas);
    }

    .dashboard-shell {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .dashboard-topbar {
      position: sticky;
      top: 0;
      z-index: 30;
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--canvas) 94%, transparent);
      backdrop-filter: blur(18px);
    }

    .dashboard-topbar-inner {
      width: min(1240px, 100%);
      min-height: 68px;
      margin: 0 auto;
      padding: 12px var(--space-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .dashboard-meta {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
      text-align: right;
      font-weight: 620;
    }

    main {
      width: min(1240px, 100%);
      margin: 0 auto;
      padding: var(--space-4) var(--space-4) var(--space-10);
      display: grid;
      gap: var(--space-4);
    }

    .hero {
      display: grid;
      gap: var(--space-5);
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
      background: var(--panel);
      box-shadow: var(--shadow-soft);
    }

    .kicker {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      font-weight: 680;
      letter-spacing: 0;
      text-transform: none;
    }

    .hero h2 {
      max-width: 920px;
      margin: 0;
      color: var(--ink);
      font-family: var(--font-display);
      font-size: clamp(30px, 8vw, 58px);
      line-height: 1.02;
      letter-spacing: 0;
      font-weight: 820;
    }

    .hero-copy {
      max-width: 820px;
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.55;
    }

    .jump-links,
    .range-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .jump-links a,
    .range-pill {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0 12px;
      color: var(--muted);
      background: var(--canvas);
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
    }

    .jump-links a:hover,
    .range-pill:hover,
    .range-pill[aria-current="true"] {
      color: var(--ink);
      border-color: var(--line-strong);
      background: var(--panel-muted);
    }

    .filters {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: var(--canvas);
    }

    .range-row {
      grid-column: 1 / -1;
    }

    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .field span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
    }

    .field input,
    .field select {
      width: 100%;
      min-height: 46px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      padding: 10px 12px;
      color: var(--ink);
      background: var(--panel);
    }

    .button {
      min-height: 48px;
      border: 1px solid var(--green);
      border-radius: 999px;
      padding: 0 18px;
      color: #07150d;
      background: var(--green);
      cursor: pointer;
      font-weight: 780;
    }

    .button:hover {
      border-color: #13d967;
      background: #13d967;
    }

    .kpi-grid,
    .panel-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-3);
    }

    .kpi-grid {
      gap: 0;
      border-block: 1px solid var(--line);
      background: var(--panel);
    }

    .panel-grid {
      gap: var(--space-8);
    }

    section,
    .card {
      min-width: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    section {
      padding: var(--space-5) 0;
      border-top: 1px solid var(--line);
    }

    .card {
      padding: var(--space-4) 0;
    }

    .hero {
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: var(--space-5);
      background: var(--panel);
    }

    .kpi-grid .card {
      padding: var(--space-4);
      border-bottom: 1px solid var(--line);
    }

    .kpi-grid .card:last-child {
      border-bottom: 0;
    }

    .section-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    h3 {
      margin: 0;
      color: var(--ink);
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
      font-weight: 760;
    }

    .caption,
    .subtle,
    .source-note {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }

    .amount,
    .money,
    .count strong {
      font-variant-numeric: tabular-nums;
    }

    .amount {
      white-space: nowrap;
    }

    .money {
      color: var(--ink);
      font-size: clamp(24px, 7vw, 36px);
      line-height: 1.1;
      font-weight: 820;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .money.cash,
    .money.profit,
    .money.income {
      color: var(--income);
    }

    .money.expense {
      color: var(--expense);
    }

    .kpi {
      display: grid;
      gap: var(--space-2);
    }

    .kpi h3 {
      color: var(--muted);
      font-size: 13px;
    }

    .count {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .count strong {
      font-size: clamp(28px, 8vw, 40px);
      line-height: 1;
    }

    .reconcile {
      display: grid;
      gap: var(--space-3);
      padding-block: var(--space-6);
      border-block: 1px solid var(--line);
      border-top: 0;
      background: transparent;
    }

    .equation {
      display: grid;
      gap: var(--space-2);
      color: var(--ink);
      font-size: clamp(17px, 4.6vw, 24px);
      font-weight: 780;
      line-height: 1.25;
    }

    .equation .minus,
    .equation .equals {
      color: var(--muted);
      font-weight: 650;
    }

    .cash-note {
      padding: 0 0 0 var(--space-4);
      border-left: 3px solid var(--income);
      color: var(--ink-soft);
      background: transparent;
      line-height: 1.5;
    }

    .chart,
    .spend-list,
    .state-grid {
      display: grid;
      gap: var(--space-3);
    }

    .chart-row {
      display: grid;
      grid-template-columns: minmax(74px, 0.8fr) minmax(0, 1fr);
      gap: var(--space-2);
      align-items: center;
    }

    .chart-label,
    .chart-value {
      font-size: 12px;
      font-weight: 720;
    }

    .chart-label {
      color: var(--muted);
    }

    .chart-value {
      text-align: right;
    }

    .track {
      grid-column: 1 / -1;
      min-height: 12px;
      border-radius: 999px;
      background: var(--panel-muted);
      overflow: hidden;
    }

    .bar {
      display: block;
      width: var(--bar-width);
      min-width: 3px;
      height: 12px;
      border-radius: 999px;
      background: var(--income);
    }

    .bar.expense {
      background: var(--expense);
    }

    .pair {
      display: grid;
      gap: var(--space-2);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--line);
    }

    .pair:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .pair-line {
      display: grid;
      grid-template-columns: 58px 1fr auto;
      gap: var(--space-2);
      align-items: center;
      font-size: 12px;
    }

    .pair-line .track {
      grid-column: auto;
      min-height: 10px;
    }

    .pair-line .bar {
      height: 10px;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-top: var(--space-3);
      color: var(--muted);
      font-size: 12px;
    }

    .key {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .swatch {
      width: 12px;
      height: 12px;
      border-radius: 4px;
      background: var(--income);
    }

    .swatch.expense {
      background: var(--expense);
    }

    .single-reading,
    .empty,
    .error,
    .loading {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      padding: var(--space-4);
      color: var(--muted);
      background: var(--canvas);
      line-height: 1.5;
    }

    .single-reading strong,
    .empty strong,
    .error strong {
      display: block;
      margin-bottom: 4px;
      color: var(--ink);
    }

    .error {
      color: var(--expense);
      background: var(--expense-soft);
      border-color: color-mix(in srgb, var(--expense) 28%, var(--line));
    }

    .loading {
      position: relative;
      overflow: hidden;
      min-height: 74px;
      color: transparent;
    }

    .loading::after {
      content: "";
      position: absolute;
      inset: 14px;
      border-radius: var(--radius-sm);
      background: var(--panel-muted);
      animation: pulse 1.25s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.56; }
      50% { opacity: 1; }
    }

    .table-wrap {
      overflow-x: auto;
    }

    .statement-desktop {
      display: none;
    }

    .statement-mobile {
      display: grid;
      gap: var(--space-3);
    }

    .statement-row {
      display: grid;
      gap: var(--space-2);
      padding-block: var(--space-3);
      border-bottom: 1px solid var(--line);
    }

    .statement-row:last-child {
      border-bottom: 0;
    }

    .statement-row-main,
    .statement-row-money {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .statement-row-main strong {
      min-width: 0;
      color: var(--ink);
      font-size: 15px;
      line-height: 1.28;
    }

    .statement-row-money strong {
      color: var(--ink);
      font-size: 18px;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }

    .statement-row-money span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 720;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .table th,
    .table td {
      padding: 12px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    .table th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
    }

    .table .amount {
      text-align: right;
    }

    .spend-item {
      display: grid;
      gap: var(--space-2);
    }

    .spend-top {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      font-size: 13px;
      font-weight: 760;
    }

    .anomaly {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-4);
      border: 1px solid color-mix(in srgb, var(--warning) 24%, var(--line));
      border-radius: var(--radius-sm);
      background: var(--warning-soft);
    }

    .anomaly strong {
      font-size: 14px;
    }

    .source-note {
      margin: 0;
      padding-inline: var(--space-1);
    }

    @media (min-width: 680px) {
      main {
        padding: var(--space-6) var(--space-6) var(--space-12);
        gap: var(--space-5);
      }

      .dashboard-topbar-inner {
        padding-inline: var(--space-6);
      }

      .hero {
        padding: var(--space-6);
      }

      .filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: end;
      }

      .filters .button {
        grid-column: span 2;
      }

      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .kpi-grid .card {
        border-right: 1px solid var(--line);
      }

      .kpi-grid .card:nth-child(2n) {
        border-right: 0;
      }

      .equation {
        grid-template-columns: auto auto auto auto auto;
        align-items: center;
      }

      .chart-row {
        grid-template-columns: 82px minmax(0, 1fr) 118px;
      }

      .track {
        grid-column: auto;
      }

      .statement-desktop {
        display: block;
      }

      .statement-mobile {
        display: none;
      }
    }

    @media (min-width: 1040px) {
      .filters {
        grid-template-columns: auto auto 1fr 1fr 1fr auto;
      }

      .filters .button {
        grid-column: auto;
      }

      .kpi-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }

      .kpi-grid .card {
        border-bottom: 0;
      }

      .kpi-grid .card:nth-child(2n) {
        border-right: 1px solid var(--line);
      }

      .kpi-grid .card:last-child {
        border-right: 0;
      }

      .panel-grid {
        grid-template-columns: repeat(12, minmax(0, 1fr));
      }

      .span-4 { grid-column: span 4; }
      .span-5 { grid-column: span 5; }
      .span-6 { grid-column: span 6; }
      .span-7 { grid-column: span 7; }
      .span-8 { grid-column: span 8; }
      .span-12 { grid-column: span 12; }
    }

    @media (max-width: 520px) {
      .dashboard-meta {
        max-width: 150px;
      }
    }
  `;
}

export function brandLockupHtml(options: { href?: string } = {}): string {
  const href = options.href ?? '/';
  return `<a class="kc-brand" href="${escapeAttribute(href)}" aria-label="KasiCash home">
    <span class="kc-mark" aria-hidden="true">K<span class="kc-mark-c">c</span></span>
    <span class="kc-brand-divider" aria-hidden="true"></span>
    <span class="kc-wordmark">
      <strong>KasiCash</strong>
      <small>Simple to run. Easy to grow.</small>
    </span>
  </a>`;
}

export function siteShell(options: SiteShellOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead(options.title, options.description)}
  <style>${kasiDesignSystemCss()}</style>
</head>
<body>
  <div class="kc-page">
    ${siteHeader(options.activePath)}
    ${options.body}
    ${siteFooter()}
  </div>
</body>
</html>`;
}

export function legalPageShell(options: LegalPageOptions): string {
  const sectionModels = options.sections.map((section, index) => ({
    ...section,
    id: `section-${index + 1}-${toSectionId(section.title)}`,
  }));
  const sections = sectionModels
    .map(
      (
        section,
      ) => `<article class="legal-section" id="${escapeAttribute(section.id)}">
        <h2>${escapeHtml(section.title)}</h2>
        ${section.body
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
          .join('')}
      </article>`,
    )
    .join('');
  const toc = sectionModels
    .map(
      (section) =>
        `<a href="#${escapeAttribute(section.id)}">${escapeHtml(section.title)}</a>`,
    )
    .join('');

  return siteShell({
    title: `${options.title} | KasiCash`,
    description: options.description,
    activePath: options.activePath,
    body: `<main class="legal-main">
      <section class="legal-hero">
        <p class="hero-kicker">${escapeHtml(options.eyebrow)}</p>
        <h1>${escapeHtml(options.title)}</h1>
        <p class="page-copy">${escapeHtml(options.description)}</p>
        ${
          options.updatedLabel
            ? `<p class="legal-meta">${escapeHtml(options.updatedLabel)}</p>`
            : ''
        }
      </section>
      <div class="legal-layout">
        <nav class="legal-toc" aria-label="${escapeAttribute(options.title)} sections">
          <strong>On this page</strong>
          ${toc}
        </nav>
        <div class="legal-content">${sections}</div>
      </div>
    </main>`,
  });
}

export function siteHeader(activePath = '/'): string {
  const links = siteNavItems
    .map((item) => navLinkHtml(item.href, item.label, activePath))
    .join('');
  const mobileLinks = mobileNavItems
    .map((item) => navLinkHtml(item.href, item.label, activePath))
    .join('');

  return `<header class="site-header">
    <div class="site-header-inner">
      ${brandLockupHtml()}
      <nav class="site-nav" aria-label="Main navigation">${links}</nav>
      <a class="button-primary" href="/auth/signup">Request setup</a>
    </div>
    <nav class="mobile-nav" aria-label="Mobile navigation">${mobileLinks}</nav>
  </header>`;
}

function navLinkHtml(href: string, label: string, activePath: string): string {
  const current = href === activePath ? ' aria-current="page"' : '';
  return `<a href="${href}"${current}>${label}</a>`;
}

export function siteFooter(): string {
  const groups = footerGroups
    .map(
      (group) => `<div class="footer-group">
        <strong>${group.title}</strong>
        <nav class="footer-links" aria-label="${group.title} links">
          ${group.links
            .map((link) => `<a href="${link.href}">${link.label}</a>`)
            .join('')}
        </nav>
      </div>`,
    )
    .join('');

  return `<footer class="site-footer">
    <div class="site-footer-inner">
      ${brandLockupHtml()}
      <div class="footer-grid">${groups}</div>
      <p class="fine-print">KasiCash shows the trader's own confirmed records. It is not a bank decision, insurer decision, government decision, or guarantee. Legal, commercial, and regulatory wording must be reviewed before production launch.</p>
    </div>
  </footer>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function toSectionId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
