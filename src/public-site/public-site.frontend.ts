import {
  legalPageShell,
  siteShell,
} from '../design-system/kasicash-design-system';

export function publicSiteHtml(): string {
  return siteShell({
    title: 'KasiCash | Simple to run. Easy to grow.',
    description:
      'KasiCash helps informal South African traders keep simple WhatsApp-first business records and see their own confirmed numbers clearly.',
    activePath: '/',
    body: `<main class="site-main">
      <section class="home-hero" aria-labelledby="hero-title">
        <div class="home-hero-visual" aria-hidden="true">
          <div class="device-scene">
            <div class="ledger-sheet">
              <h2>Today in KasiCash</h2>
              <div class="ledger-row"><span>WhatsApp message</span><span class="ledger-status">Received</span></div>
              <div class="ledger-row"><span>Owner confirmation</span><span class="ledger-status">Required</span></div>
              <div class="ledger-row"><span>Business record</span><span class="ledger-status">Posted</span></div>
              <div class="ledger-row"><span>Dashboard view</span><span class="ledger-status">Ready</span></div>
            </div>
            <div class="phone-frame">
              <div class="phone-status"><span>9:41</span><span></span></div>
              <div class="phone-screen">
                <div class="phone-kc">K<span>c</span></div>
                <div class="phone-headline">Your business. In control.</div>
                <div class="phone-message">Sold airtime. Paid stock. Cash left to check.</div>
                <div class="phone-record">
                  <div class="record-line"><span>Status</span><strong>Confirm first</strong></div>
                  <div class="record-line"><span>Record</span><strong>Posted only</strong></div>
                  <div class="record-line"><span>View</span><strong>Read only</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="home-hero-inner">
          <div class="home-hero-copy">
            <p class="hero-kicker">Built for informal South African traders</p>
            <h1 class="hero-title" id="hero-title">KasiCash</h1>
            <p class="hero-copy">
              WhatsApp-first business records for traders who need to know what came in, what went out, and what is left without changing how they already trade.
            </p>
            <div class="hero-actions">
              <a class="button-primary" href="/auth/signup">Request setup</a>
              <a class="button-ghost" href="/auth/login">Dashboard login</a>
            </div>
          </div>
        </div>
      </section>

      <section class="home-proof" aria-label="KasiCash trust signals">
        <div class="home-proof-inner">
          <p class="proof-statement">Records should feel as familiar as a message and as careful as a ledger.</p>
          <div class="proof-row">
            <span>Trader-owned records</span>
            <span>Posted entries only</span>
            <span>No lender promises</span>
          </div>
        </div>
      </section>

      <section class="home-band" aria-labelledby="run-title">
        <div class="home-inner home-split">
          <div class="home-copy-stack">
            <p class="section-kicker">Daily flow</p>
            <h2 id="run-title">Message it. Confirm it. Understand it.</h2>
            <p class="page-copy">
              KasiCash follows the rhythm of a trading day: quick capture while business is moving, a clear confirmation step, and a dashboard that reads back confirmed records only.
            </p>
          </div>
          <ol class="process-list">
            <li>
              <span>01</span>
              <div>
                <strong>Record from WhatsApp</strong>
                <p>Use normal trader language at the counter, in the taxi, at the stall, or after closing.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Confirm before posting</strong>
                <p>KasiCash asks before anything becomes a financial record. No silent ledger writes.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Read the business clearly</strong>
                <p>The dashboard turns confirmed records into plain sales, costs, cash, and things to check.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="home-product" aria-labelledby="product-title">
        <div class="home-product-inner">
          <div class="home-copy-stack">
            <p class="section-kicker">Product shape</p>
            <h2 id="product-title">A quiet finance dashboard behind a simple WhatsApp habit.</h2>
            <p class="page-copy">
              The product is intentionally restrained: WhatsApp for capture, server-side checks for safety, and read-only screens for understanding.
            </p>
            <div class="button-row">
              <a class="button-primary" href="/auth/signup">Request setup</a>
              <a class="button-secondary" href="/pricing">See pricing notes</a>
            </div>
          </div>
          <div class="screen-strip" aria-label="KasiCash product preview without financial figures">
            <div class="screen-strip-row"><strong>Sales confirmed</strong><span class="status-ok">Posted</span></div>
            <div class="screen-strip-row"><strong>Costs confirmed</strong><span class="status-ok">Checked</span></div>
            <div class="screen-strip-row"><strong>Cash view ready</strong><span>Read only</span></div>
            <div class="screen-strip-row"><strong>Things to check</strong><span>Plain language</span></div>
          </div>
        </div>
      </section>

      <section class="home-trust" aria-labelledby="trust-title">
        <div class="home-trust-inner">
          <div class="home-copy-stack">
            <p class="section-kicker">Trust boundaries</p>
            <h2 id="trust-title">Your own records, not a decision about you.</h2>
            <p class="page-copy">
              KasiCash is not a bank, insurer, government system, credit score, or guarantee. It is a record system designed to keep the trader in control.
            </p>
          </div>
          <ul class="trust-list">
            <li>
              <strong>Read-only dashboard</strong>
              <p>The website and dashboard do not create ledger entries, do not invent business figures, and do not bypass the WhatsApp confirmation flow.</p>
            </li>
            <li>
              <strong>Your business stays separate</strong>
              <p>The signed-in dashboard is connected to one business on the server. The browser cannot choose another trader business to open.</p>
            </li>
            <li>
              <strong>Clear privacy boundaries</strong>
              <p>KasiCash is designed to keep secrets out of code, private details out of operational telemetry, and launch wording under review before production.</p>
            </li>
          </ul>
        </div>
      </section>

      <section class="home-cta" aria-labelledby="cta-title">
        <div class="home-cta-inner home-copy-stack">
          <p class="section-kicker">Start carefully</p>
          <h2 id="cta-title">Connect the right owner to the right records.</h2>
          <p class="page-copy">
            Setup is manual in this build so the business, WhatsApp number, and dashboard owner are checked before private records appear.
          </p>
          <div class="button-row">
            <a class="button-primary" href="/auth/signup">Request setup</a>
            <a class="button-ghost" href="/help">Read the FAQ</a>
          </div>
        </div>
      </section>
    </main>`,
  });
}

export function pricingPageHtml(): string {
  return legalPageShell({
    title: 'Pricing',
    eyebrow: 'Commercial status',
    description:
      'KasiCash pricing is intentionally not hard-coded in this build. Commercial terms must be confirmed before public launch.',
    activePath: '/pricing',
    updatedLabel: 'Draft for product and legal review',
    sections: [
      {
        title: 'Current build',
        body: [
          'No public paid plan is live in this codebase. The setup request page asks for manual setup and does not create a billing account.',
          'The dashboard is a read-only view of a trader business once an authenticated account exists.',
        ],
      },
      {
        title: 'WhatsApp costs',
        body: [
          'Development can use Meta sandbox/test-number flows. Production WhatsApp messaging may carry provider charges that must be checked against the current provider rate card before launch.',
          'KasiCash should show any future customer-facing plan price, billing interval, included usage, and overage rule in plain language before collecting payment.',
        ],
      },
      {
        title: 'Before launch',
        body: [
          'Pricing, refunds, cancellation, tax wording, and billing-support routes require commercial and legal review.',
        ],
      },
    ],
  });
}

export function feesLimitsPageHtml(): string {
  return legalPageShell({
    title: 'Fees and limits',
    eyebrow: 'Plain limits',
    description:
      'This build is a record system. It does not hold trader funds, move money, or provide credit decisions.',
    activePath: '/fees-limits',
    updatedLabel: 'Draft for product and legal review',
    sections: [
      {
        title: 'No wallet in this build',
        body: [
          'There are no deposits, withdrawals, transfers, card payments, cash-outs, or KasiCash-held balances in the current product.',
          'Dashboard cash figures are records from the ledger read services, not money held by KasiCash.',
        ],
      },
      {
        title: 'Operational limits',
        body: [
          'Dashboard report periods are bounded server-side to keep reads predictable and protect the service.',
          'Public endpoints use rate limiting and request-size controls where applicable. Exact production limits should be published after operational testing.',
        ],
      },
      {
        title: 'Provider costs',
        body: [
          'WhatsApp provider costs, message templates, and service-window rules are external platform matters and must be verified before production use.',
        ],
      },
    ],
  });
}

export function securityTrustPageHtml(): string {
  return legalPageShell({
    title: 'Security centre',
    eyebrow: 'Trust and containment',
    description:
      'KasiCash is built around server-side tenant isolation, immutable records, confirmed posting, and careful telemetry.',
    activePath: '/security',
    updatedLabel: 'Technical summary. Not a certification claim.',
    sections: [
      {
        title: 'Account access',
        body: [
          'Dashboard sessions use server-issued credentials and HttpOnly SameSite cookies. The browser dashboard does not store bearer tokens in local storage or session storage.',
          'Each signed-in principal is tied to one business context on the server. The client cannot choose another business to read.',
        ],
      },
      {
        title: 'Financial records',
        body: [
          'The ledger remains append-only and immutable. The dashboard and website are read-only views; they do not post transactions.',
          'AI-assisted parsing can propose, but posting still requires the existing human confirmation flow.',
        ],
      },
      {
        title: 'WhatsApp and operations',
        body: [
          'Inbound WhatsApp webhooks are checked using HMAC over raw request bytes, with replay and rate-limit hardening in the security layer.',
          'Telemetry is designed to avoid secrets, credentials, private message bodies, and financial amounts.',
        ],
      },
      {
        title: 'Still deferred',
        body: [
          'MFA, role-based access control, external audit logging, formal penetration testing, and independent legal/security certification remain future work.',
        ],
      },
    ],
  });
}

export function privacyPolicyHtml(): string {
  return legalPageShell({
    title: 'Privacy policy',
    eyebrow: 'Legal review required',
    description:
      'A plain-English draft of how KasiCash should treat trader information. It must be reviewed by qualified counsel before production launch.',
    activePath: '/legal/privacy',
    updatedLabel: 'Draft for product, POPIA, and legal review',
    sections: [
      {
        title: 'The promise in normal words',
        body: [
          'KasiCash is built for traders who already carry enough in their heads. The privacy posture should be simple: collect what is needed to run the service, protect it carefully, and explain what is happening without hiding behind small print.',
          'This page is intentionally written like a product promise, not final legal advice. The final production policy still needs POPIA, retention, subprocessors, transfer, and data-subject-rights review.',
        ],
      },
      {
        title: 'Information KasiCash may use',
        body: [
          'KasiCash may need account details such as name, email address, sign-in credentials, business name, business contact details, and the WhatsApp number connected to the trader account.',
          'It may use WhatsApp message metadata, inbound message identifiers, delivery or failure status, support messages, and confirmed transaction records so the product can route, recover, and display the right business records.',
          'Financial figures shown in the dashboard come from the trader business records stored in the system. The public website does not display private financial figures.',
        ],
      },
      {
        title: 'How the information is used',
        body: [
          'Information is used to authenticate the dashboard owner, connect that owner to the correct business, process confirmed records, show read-only reports, answer support requests, detect operational problems, and protect the service from abuse.',
          'KasiCash should use trusted server-side context to decide which business data a person may see. The browser should not be allowed to choose another trader business by changing a link or request value.',
          'The dashboard is a view of the trader records. It does not turn private records into a lender, insurer, government, tax, or credit decision.',
        ],
      },
      {
        title: 'What should stay out of telemetry',
        body: [
          'Operational logs and metrics should stay bounded and sanitized. They should avoid secrets, passwords, access tokens, full phone numbers, private WhatsApp message bodies, and money values.',
          'When the system needs to record that something happened, it should prefer safe identifiers, statuses, timestamps, and short error codes over private content.',
        ],
      },
      {
        title: 'Service providers and sharing',
        body: [
          'KasiCash may rely on infrastructure, hosting, database, messaging, email, monitoring, and support providers to run the service. Those providers should only receive what they need for their role.',
          'KasiCash should not sell trader financial records. Any future integration that shares data with a lender, insurer, accountant, tax tool, or marketplace would need clear consent, product design, and legal review before launch.',
        ],
      },
      {
        title: 'Retention, correction, and deletion',
        body: [
          'Because KasiCash is a record system, some information may need to be retained to keep business records consistent, investigate abuse, support recovery, or satisfy legal obligations.',
          'A trader should have a clear way to ask for access, correction, export, deletion, or account closure where the law allows it. The final response times and exceptions must be confirmed before production.',
        ],
      },
      {
        title: 'Before launch',
        body: [
          'Retention, deletion, data-subject rights, subprocessors, cross-border transfer wording, and POPIA-specific wording must be completed before launch.',
          'This draft should be converted into a final privacy policy by qualified counsel, then checked again against the actual production infrastructure and support process.',
        ],
      },
    ],
  });
}

export function termsPageHtml(): string {
  return legalPageShell({
    title: 'Terms of service',
    eyebrow: 'Legal review required',
    description:
      'Plain-language draft terms for a record-keeping service. These are not final production terms.',
    activePath: '/legal/terms',
    updatedLabel: 'Draft for legal and commercial review',
    sections: [
      {
        title: 'The deal in plain words',
        body: [
          'KasiCash is meant to help a trader capture business activity, confirm it, and read it back in a way that makes sense on a busy day. The product should make records easier to trust, not make promises it cannot keep.',
          'These terms are still a draft. They explain the intended product boundary so reviewers can turn it into final production terms.',
        ],
      },
      {
        title: 'What KasiCash is',
        body: [
          'KasiCash is intended to help traders keep business records and view those records. It is not a bank, lender, insurer, tax authority, or government decision system.',
          'The dashboard and public website are read-only. Posting transactions stays inside the existing confirm-then-post flow, and the trader remains responsible for checking records and correcting mistakes through approved flows.',
        ],
      },
      {
        title: 'What KasiCash is not',
        body: [
          'Reports and dashboard views reflect confirmed records available to the system. They should not be presented as credit approval, insurance approval, tax advice, or legal advice.',
          'KasiCash does not hold deposits, move money, cash out funds, underwrite risk, approve loans, or guarantee that a business will grow.',
          'Any future money movement, lending, insurance, tax filing, or marketplace feature would need separate design, compliance, testing, and terms before it could be offered.',
        ],
      },
      {
        title: 'Using WhatsApp records',
        body: [
          'A trader may send normal business messages through the supported WhatsApp flow. KasiCash can propose a structured record, but the system should not silently write financial entries without the required confirmation.',
          'If a message is unclear, incomplete, duplicated, or outside the supported flow, KasiCash should fail safe and ask for correction rather than inventing a financial fact.',
        ],
      },
      {
        title: 'Availability and support',
        body: [
          'KasiCash should be designed for reliability, but no online service is perfect. The final terms need clear support routes, expected response times, maintenance wording, and what happens when a provider such as WhatsApp or a hosting platform is unavailable.',
          'Best-effort outbound replies are notifications, not the financial source of truth. A failed reply should not undo a processed message or corrupt records.',
        ],
      },
      {
        title: 'Owner responsibilities',
        body: [
          'The account owner should keep sign-in details safe, use the product honestly, check records regularly, and report suspected unauthorized access quickly.',
          'KasiCash should give the owner understandable views, but the owner remains responsible for business decisions, tax obligations, and professional advice where needed.',
        ],
      },
      {
        title: 'Before launch',
        body: [
          'Acceptance, billing, support, liability, acceptable-use, suspension, dispute, jurisdiction, consumer-protection, privacy, and cancellation wording require legal review.',
          'The final terms should match the exact production product, not a future idea of the product.',
        ],
      },
    ],
  });
}

export function cookiePolicyHtml(): string {
  return legalPageShell({
    title: 'Cookies',
    eyebrow: 'Essential only in this build',
    description:
      'The current dashboard authentication flow uses an essential HttpOnly session cookie. Marketing and analytics cookies are not part of this build.',
    activePath: '/legal/cookies',
    updatedLabel: 'Draft for legal review',
    sections: [
      {
        title: 'The short version',
        body: [
          'In this build, cookies are used for one quiet security job: keeping a signed-in dashboard session secure. KasiCash is not adding advertising trackers or behaviour-profiling cookies here.',
          'If the product later adds analytics, ads, experiments, or embedded third-party tools, this page and the consent experience must be updated first.',
        ],
      },
      {
        title: 'Essential session cookie',
        body: [
          'KasiCash uses a server-set session cookie for signed-in dashboard access. It is marked HttpOnly so browser scripts cannot read it.',
          'Because it is essential for account security and dashboard access, it cannot be turned off inside the product without ending the signed-in session.',
          'The dashboard should not store bearer tokens in browser local storage or session storage.',
        ],
      },
      {
        title: 'What is not used here',
        body: [
          'This build does not add advertising cookies, third-party analytics cookies, or behavioural tracking preferences.',
          'It also does not need public-page cookies to show the homepage, pricing notes, help pages, or legal pages.',
        ],
      },
      {
        title: 'How a trader can manage cookies',
        body: [
          'A trader can clear cookies in the browser to end a local session. After that, the dashboard should ask for sign-in again.',
          'Blocking essential cookies may prevent the dashboard from working because the server cannot safely recognize the signed-in account.',
        ],
      },
      {
        title: 'Before launch',
        body: [
          'The final policy should list cookie names, purposes, duration, SameSite and security settings, and any third-party cookie providers actually used in production.',
          'If non-essential cookies are introduced later, KasiCash needs a clear consent choice that is easy to understand on a phone.',
        ],
      },
    ],
  });
}

export function helpPageHtml(): string {
  return legalPageShell({
    title: 'Help and FAQ',
    eyebrow: 'Support',
    description:
      'Quick answers for traders and operators using the current KasiCash build.',
    activePath: '/help',
    sections: [
      {
        title: 'How do I start?',
        body: [
          'Use the setup request page to request setup. In this build, setup is manual so the right owner is connected to the right business.',
        ],
      },
      {
        title: 'Why does the dashboard ask me to sign in?',
        body: [
          'Business data is protected by authenticated server-side tenant checks. The dashboard will only show the signed-in owner their own business records.',
        ],
      },
      {
        title: 'Can the dashboard change my records?',
        body: [
          'No. The dashboard is read-only. Posting transactions stays inside the existing WhatsApp confirmation flow.',
        ],
      },
      {
        title: 'Why do cash and profit differ?',
        body: [
          'Profit covers the selected dates. Cash can differ when money was already there, moved into stock, paid to the owner, or came from a loan.',
        ],
      },
    ],
  });
}

export function contactPageHtml(): string {
  return legalPageShell({
    title: 'Contact',
    eyebrow: 'Support routes',
    description:
      'Use the right support route so account, security, and setup requests are handled carefully.',
    activePath: '/contact',
    sections: [
      {
        title: 'Setup',
        body: [
          'For a new trader account, use the setup request page so the request includes owner, WhatsApp, email, and business details.',
        ],
      },
      {
        title: 'General support',
        body: [
          'Email hello@kasicash.co.za for product questions, setup help, account access, or operational support. This mailbox address must be confirmed before public launch.',
        ],
      },
      {
        title: 'Security concerns',
        body: [
          'Report suspected unauthorized access or data exposure immediately. Production security-response contacts and response times must be finalized before launch.',
        ],
      },
    ],
  });
}

export function aboutPageHtml(): string {
  return legalPageShell({
    title: 'About KasiCash',
    eyebrow: 'Why it exists',
    description:
      'KasiCash is built for small South African traders who run through WhatsApp, move fast, and deserve records they can trust.',
    activePath: '/about',
    sections: [
      {
        title: 'Built around the counter',
        body: [
          'KasiCash starts from a simple respect: a trader is already running a real business before any software arrives. The counter, cooler box, salon chair, delivery bag, table, stall, or back room is where the work happens.',
          'Traders already make fast decisions with the information in front of them. KasiCash helps turn that daily rhythm into records that can be checked later, without forcing an accounting workflow into the middle of a sale.',
        ],
      },
      {
        title: 'Why WhatsApp first',
        body: [
          'WhatsApp is already where orders, reminders, suppliers, customers, and family logistics meet. A useful record system should fit that habit instead of asking the trader to disappear into a spreadsheet after a long day.',
          'The goal is not to change how the trader speaks or sells. The goal is to help them record what happened in normal language, confirm it, and see the business clearly.',
        ],
      },
      {
        title: 'Records that mean something',
        body: [
          'KasiCash should feel calm, plain, and respectful. Big words do not make a number more true. Every figure should be traceable back to confirmed records, and every screen should help the owner decide what to check next.',
          'The dashboard should answer ordinary trader questions: what came in, what went out, what is left, what changed, and what deserves attention.',
        ],
      },
      {
        title: 'Engineering belief',
        body: [
          'Financial behaviour must be conservative: immutable records, confirmed posting, read-only reports, tenant isolation, and no fabricated numbers.',
          'That means the product can look polished without becoming loose. A beautiful dashboard still has to respect the ledger, the tenant boundary, and the rule that AI can propose but does not silently post.',
        ],
      },
      {
        title: 'What success looks like',
        body: [
          'Success is a trader opening the phone and understanding the day without panic. It is seeing sales and costs in plain words, spotting a mistake early, and having records ready when support, finance, family, or a professional adviser asks a sensible question.',
          'KasiCash is not here to judge the trader. It is here to make the trader more in control of their own records.',
        ],
      },
      {
        title: 'Still to earn',
        body: [
          'Trust is earned in production, not claimed on a webpage. Formal legal review, accessibility testing, security review, support operations, and real-world pilot feedback still matter before a public launch.',
          'The brand promise is simple to run, easy to grow. The engineering promise is quieter: do not invent, do not leak, do not cross tenants, and do not write financial records without the approved flow.',
        ],
      },
    ],
  });
}

export function accessibilityPageHtml(): string {
  return legalPageShell({
    title: 'Accessibility',
    eyebrow: 'Usability commitment',
    description:
      'KasiCash should be usable on phones, readable in plain language, and navigable with keyboard and assistive technology.',
    activePath: '/accessibility',
    updatedLabel: 'Draft accessibility statement',
    sections: [
      {
        title: 'Current design choices',
        body: [
          'Pages use semantic headings, labelled navigation, visible focus states, large touch targets, and high-contrast text treatment.',
          'Charts include text values so financial meaning is not communicated by colour alone.',
        ],
      },
      {
        title: 'Still required',
        body: [
          'A formal accessibility audit, screen-reader pass, colour-contrast report, and mobile device testing should be completed before public launch.',
        ],
      },
    ],
  });
}
