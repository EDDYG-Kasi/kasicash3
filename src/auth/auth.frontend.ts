import {
  brandLockupHtml,
  kasiDesignSystemCss,
  pageHead,
} from '../design-system/kasicash-design-system';

export function authLoginHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead(
    'KasiCash Login',
    'Sign in to the KasiCash dashboard with the existing secure session flow.',
  )}
  <style>${kasiDesignSystemCss()}${authCss()}</style>
</head>
<body>
  <div class="auth-page">
    <header class="auth-header">
      ${brandLockupHtml()}
      <a class="button-secondary" href="/auth/signup">Request setup</a>
    </header>
    <main class="auth-main">
      <section class="auth-intro" aria-labelledby="login-title">
        <p class="hero-kicker">Dashboard access</p>
        <h1 id="login-title">Sign in to open your dashboard.</h1>
        <p>
          Your dashboard is protected by a server-side session. KasiCash does not store bearer tokens in browser storage.
        </p>
        <div class="trust-strip" aria-label="Login trust notes">
          <span><span class="dot" aria-hidden="true"></span>HttpOnly session cookie</span>
          <span><span class="dot" aria-hidden="true"></span>One business per owner</span>
        </div>
        <div class="auth-ledger-preview" aria-hidden="true">
          <div><span>Business context</span><strong>Server checked</strong></div>
          <div><span>Dashboard</span><strong>Read only</strong></div>
          <div><span>Records</span><strong>Posted only</strong></div>
        </div>
      </section>
      <section class="auth-panel" aria-labelledby="form-title">
        <h2 id="form-title">Welcome back</h2>
        <p>Use the email and password created after setup.</p>
        <form id="login-form" autocomplete="on">
          <label>Email<input name="email" type="email" autocomplete="username" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required minlength="12" /></label>
          <button id="login-button" class="button-primary" type="submit">Sign in</button>
          <div class="status" id="login-status" role="status" aria-live="polite"></div>
        </form>
        <p class="auth-link">Need access? <a href="/auth/signup">Request setup</a>. The setup page prepares an email draft so we can connect the right owner to the right business.</p>
      </section>
    </main>
  </div>
  <script>
    'use strict';
    (function bindLogin() {
      const form = document.getElementById('login-form');
      const button = document.getElementById('login-button');
      const status = document.getElementById('login-status');
      if (!form || !button || !status) return;
      form.addEventListener('submit', async function onSubmit(event) {
        event.preventDefault();
        const emailInput = form.elements.namedItem('email');
        const passwordInput = form.elements.namedItem('password');
        button.setAttribute('disabled', 'disabled');
        status.className = 'status';
        status.textContent = 'Signing in...';
        try {
          await postLogin({
            email: emailInput && 'value' in emailInput ? String(emailInput.value || '') : '',
            password: passwordInput && 'value' in passwordInput ? String(passwordInput.value || '') : '',
          });
          window.location.assign('/dashboard');
        } catch (err) {
          status.className = 'status error';
          status.textContent = 'Could not sign in with those details.';
          button.removeAttribute('disabled');
        }
      });

      function postLogin(payload) {
        const body = JSON.stringify(payload);
        if (typeof fetch === 'function') {
          return fetch('/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body,
          }).then(function onResponse(response) {
            if (!response.ok) throw new Error('login_failed');
          });
        }
        return new Promise(function sendWithXhr(resolve, reject) {
          const request = new XMLHttpRequest();
          request.open('POST', '/auth/login', true);
          request.setRequestHeader('Accept', 'application/json');
          request.setRequestHeader('Content-Type', 'application/json');
          request.onload = function onLoad() {
            if (request.status >= 200 && request.status < 300) resolve();
            else reject(new Error('login_failed'));
          };
          request.onerror = function onError() {
            reject(new Error('login_failed'));
          };
          request.send(body);
        });
      }
    })();
  </script>
</body>
</html>`;
}

export function authSignupHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  ${pageHead(
    'KasiCash Setup Request',
    'Request manual KasiCash setup before using the dashboard.',
  )}
  <style>${kasiDesignSystemCss()}${authCss()}</style>
</head>
<body>
  <div class="auth-page">
    <header class="auth-header">
      ${brandLockupHtml()}
      <a class="button-secondary" href="/auth/login">Sign in</a>
    </header>
    <main class="auth-main">
      <section class="auth-intro" aria-labelledby="signup-title">
        <p class="hero-kicker">Start here</p>
        <h1 id="signup-title">Request KasiCash setup.</h1>
        <p>
          Tell us who owns the business and which WhatsApp number is used for trade. Setup stays manual so the right owner is connected to the right records.
        </p>
        <div class="trust-strip" aria-label="Setup trust notes">
          <span><span class="dot" aria-hidden="true"></span>No automatic ledger write</span>
          <span><span class="dot" aria-hidden="true"></span>Owner checked first</span>
        </div>
        <div class="auth-ledger-preview" aria-hidden="true">
          <div><span>Step one</span><strong>Owner details</strong></div>
          <div><span>Step two</span><strong>WhatsApp check</strong></div>
          <div><span>Step three</span><strong>Dashboard access</strong></div>
        </div>
      </section>
      <section class="auth-panel" aria-labelledby="form-title">
        <h2 id="form-title">Request your setup</h2>
        <p>We'll open a draft in your email app. Review it and press Send to submit your setup request. Nothing here creates a ledger entry or financial record.</p>
        <form id="signup-form">
          <label>Your name<input name="name" autocomplete="name" required /></label>
          <label>WhatsApp number<input name="whatsapp" inputmode="tel" autocomplete="tel" required placeholder="27..." /></label>
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Business name<input name="business" autocomplete="organization" required /></label>
          <button class="button-primary" type="submit">Request setup</button>
          <div class="status" id="signup-status" role="status" aria-live="polite"></div>
        </form>
        <ol class="setup-steps" aria-label="Setup steps">
          <li><span>1</span>We check the WhatsApp owner.</li>
          <li><span>2</span>We create the business dashboard account.</li>
          <li><span>3</span>You sign in and start recording.</li>
        </ol>
        <p class="fine-print">This page does not write to the ledger or create financial records. If no email draft opens, email <a href="mailto:hello@kasicash.co.za">hello@kasicash.co.za</a>.</p>
        <p class="auth-link">Already set up? <a href="/auth/login">Sign in here</a>.</p>
      </section>
    </main>
  </div>
  <script>
    'use strict';
    (function bindSignup() {
      const form = document.getElementById('signup-form');
      const status = document.getElementById('signup-status');
      if (!form || !status) return;
      form.addEventListener('submit', function onSubmit(event) {
        event.preventDefault();
        const payload = readForm(form);
        const body = [
          "Hi KasiCash, I'd like to request setup.",
          '',
          'Name: ' + payload.name,
          'WhatsApp: ' + payload.whatsapp,
          'Email: ' + payload.email,
          'Business: ' + payload.business,
        ].join('\\n');
        status.className = 'status';
        status.textContent = 'Opening an email draft. Review it and press Send to submit your setup request.';
        window.location.href =
          'mailto:hello@kasicash.co.za?subject=' +
          encodeURIComponent('KasiCash setup request') +
          '&body=' +
          encodeURIComponent(body);
      });

      function readForm(formElement) {
        return {
          name: fieldValue(formElement, 'name'),
          whatsapp: fieldValue(formElement, 'whatsapp'),
          email: fieldValue(formElement, 'email'),
          business: fieldValue(formElement, 'business'),
        };
      }

      function fieldValue(formElement, name) {
        const field = formElement.elements.namedItem(name);
        return field && 'value' in field ? String(field.value || '').trim() : '';
      }
    })();
  </script>
</body>
</html>`;
}

function authCss(): string {
  return `
    .auth-page {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      background: var(--canvas);
    }

    .auth-header {
      width: min(1120px, 100%);
      min-height: 68px;
      margin: 0 auto;
      padding: 12px var(--space-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .auth-main {
      width: min(1120px, 100%);
      margin: 0 auto;
      padding: var(--space-6) var(--space-4) var(--space-12);
      display: grid;
      gap: var(--space-8);
      align-items: stretch;
    }

    .auth-intro {
      display: grid;
      gap: var(--space-4);
      align-content: end;
      min-height: 420px;
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      color: var(--ivory);
      background: var(--black);
    }

    .auth-intro h1 {
      margin: 0;
      font-family: var(--font-display);
      font-size: clamp(38px, 11vw, 70px);
      line-height: 0.98;
      letter-spacing: 0;
      font-weight: 820;
    }

    .auth-intro p:not(.hero-kicker) {
      margin: 0;
      max-width: 680px;
      color: #d8d4c8;
      font-size: 17px;
    }

    .auth-intro .trust-strip span {
      color: #d8d4c8;
      border-color: #2c2c2c;
      background: #171717;
    }

    .auth-panel {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-5);
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .auth-panel h2 {
      margin: 0;
      font-size: 26px;
      line-height: 1.12;
      letter-spacing: 0;
    }

    .auth-panel > p,
    .status,
    .auth-link {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }

    form {
      display: grid;
      gap: var(--space-3);
    }

    label {
      display: grid;
      gap: 7px;
      color: var(--ink-soft);
      font-size: 12px;
      font-weight: 760;
    }

    input {
      width: 100%;
      min-height: 48px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      padding: 11px 12px;
      color: var(--ink);
      background: var(--canvas);
    }

    button[disabled] {
      cursor: progress;
      opacity: 0.72;
    }

    .status {
      min-height: 21px;
    }

    .status.error {
      color: var(--expense);
    }

    .auth-link a {
      color: var(--ink);
      font-weight: 760;
    }

    .setup-steps {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: none;
    }

    .setup-steps li {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
      color: var(--ink-soft);
      font-size: 14px;
      font-weight: 650;
    }

    .setup-steps span {
      width: 24px;
      height: 24px;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      color: #07150d;
      background: var(--green);
      font-size: 12px;
      font-weight: 820;
    }

    .auth-ledger-preview {
      display: grid;
      border-block: 1px solid #33332f;
      margin-top: var(--space-3);
    }

    .auth-ledger-preview div {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-4);
      padding: 13px 0;
      border-bottom: 1px solid #33332f;
      color: #d8d4c8;
      font-size: 13px;
    }

    .auth-ledger-preview div:last-child {
      border-bottom: 0;
    }

    .auth-ledger-preview span {
      color: #8f8b80;
      font-weight: 680;
    }

    .auth-ledger-preview strong {
      color: var(--ivory);
      font-weight: 760;
    }

    @media (min-width: 860px) {
      .auth-header,
      .auth-main {
        padding-inline: var(--space-8);
      }

      .auth-main {
        grid-template-columns: minmax(0, 0.95fr) minmax(360px, 0.72fr);
        padding-top: var(--space-12);
      }

      .auth-intro {
        min-height: 640px;
        padding: var(--space-8);
      }

      .auth-panel {
        padding: var(--space-8);
        align-self: center;
      }
    }

    @media (max-width: 520px) {
      .auth-page {
        background: var(--black);
      }

      .auth-header .kc-mark,
      .auth-header .kc-wordmark strong {
        color: var(--ivory);
      }

      .auth-header .kc-brand-divider {
        background: #33332f;
      }

      .auth-header .kc-wordmark small {
        color: #8f8b80;
      }

      .auth-main {
        gap: var(--space-5);
        padding-bottom: 0;
      }

      .auth-intro {
        min-height: auto;
        padding: var(--space-4) 0 var(--space-2);
        border-radius: 0;
        background: transparent;
      }

      .auth-panel {
        padding: var(--space-5) var(--space-4) var(--space-8);
        border-radius: var(--radius-md) var(--radius-md) 0 0;
        background: var(--panel);
      }

      .auth-header .kc-wordmark small {
        display: none;
      }

      .auth-header .button-secondary {
        min-height: 46px;
        padding-inline: 13px;
      }
    }
  `;
}
