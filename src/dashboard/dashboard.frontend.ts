import { DashboardOverviewDto } from './dashboard.dto';

export function dashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>KasiCash Dashboard</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17201d;
      --muted: #63706a;
      --line: #d9e1dc;
      --surface: #f6f8f5;
      --panel: #ffffff;
      --accent: #0f766e;
      --accent-soft: #d9f3ee;
      --warn: #b45309;
      --danger: #b91c1c;
      --cash: #0f766e;
      --expense: #9f1239;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--surface);
    }
    .shell {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      background: var(--panel);
      border-bottom: 1px solid var(--line);
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .brand h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .brand span,
    .meta {
      color: var(--muted);
      font-size: 13px;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: 0;
      min-height: 0;
    }
    .rail {
      padding: 18px;
      border-right: 1px solid var(--line);
      background: #eef3ef;
    }
    .rail nav {
      display: grid;
      gap: 8px;
    }
    .rail a {
      color: var(--ink);
      text-decoration: none;
      padding: 10px 12px;
      border-radius: 6px;
    }
    .rail a:hover { background: var(--accent-soft); }
    main {
      padding: 22px;
      display: grid;
      gap: 18px;
      align-content: start;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 14px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      min-width: 0;
    }
    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }
    .span-6 { grid-column: span 6; }
    .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }
    h2 {
      margin: 0 0 12px;
      font-size: 15px;
      letter-spacing: 0;
    }
    .metric {
      font-size: 25px;
      font-weight: 750;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .subtle {
      color: var(--muted);
      font-size: 13px;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .table th,
    .table td {
      padding: 9px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    .table th {
      color: var(--muted);
      font-weight: 650;
      font-size: 12px;
    }
    .amount { text-align: right; white-space: nowrap; }
    .bars {
      display: grid;
      gap: 9px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 10px;
      align-items: center;
      font-size: 12px;
    }
    .bar-track {
      position: relative;
      height: 18px;
      background: #edf2ef;
      border-radius: 5px;
      overflow: hidden;
    }
    .bar {
      position: absolute;
      inset: 0 auto 0 0;
      width: var(--bar-width);
      background: var(--cash);
    }
    .bar.expense {
      top: 9px;
      height: 9px;
      background: var(--expense);
    }
    .bar.revenue {
      bottom: 9px;
      height: 9px;
      background: var(--cash);
    }
    .anomaly {
      border-left: 4px solid var(--warn);
      padding: 10px 12px;
      background: #fff8ec;
      border-radius: 6px;
      display: grid;
      gap: 5px;
    }
    .stack {
      display: grid;
      gap: 10px;
    }
    .error {
      color: var(--danger);
      background: #fff1f2;
      border: 1px solid #fecdd3;
      padding: 12px;
      border-radius: 8px;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .rail { border-right: 0; border-bottom: 1px solid var(--line); }
      .rail nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .span-3, .span-4, .span-6, .span-8 { grid-column: span 12; }
      main { padding: 14px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <h1>KasiCash</h1>
        <span>Trader dashboard</span>
      </div>
      <div class="meta" id="dashboard-meta"></div>
    </header>
    <div class="layout">
      <aside class="rail">
        <nav aria-label="Dashboard sections">
          <a href="#overview">Overview</a>
          <a href="#series">Series</a>
          <a href="#spend">Spend</a>
          <a href="#anomalies">Alerts</a>
        </nav>
      </aside>
      <main id="dashboard-root" aria-live="polite"></main>
    </div>
  </div>
  <script src="/dashboard/assets/app.js"></script>
</body>
</html>`;
}

export function dashboardClientScript(): string {
  return `'use strict';
${escapeHtml.toString()}
${safeMoney.toString()}
${barPercent.toString()}
${renderBars.toString()}
${renderDashboardMarkup.toString()}
(async function loadDashboard() {
  const root = document.getElementById('dashboard-root');
  const meta = document.getElementById('dashboard-meta');
  try {
    const response = await fetch('/dashboard/api/overview', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Dashboard unavailable');
    }
    const data = await response.json();
    if (meta) {
      meta.textContent = data.tenant.currency + ' · ' + data.tenant.timezone;
    }
    if (root) {
      root.innerHTML = renderDashboardMarkup(data);
    }
  } catch (err) {
    if (root) {
      root.innerHTML = '<div class="error">Dashboard unavailable.</div>';
    }
  }
})();`;
}

export function renderDashboardMarkup(data: DashboardOverviewDto): string {
  const cashAccounts = data.cashPosition.accounts
    .filter((account) => account.isCash)
    .map(
      (account) =>
        `<tr><td>${escapeHtml(account.code)}</td><td>${escapeHtml(
          account.name,
        )}</td><td class="amount">${safeMoney(account.balance)}</td></tr>`,
    )
    .join('');
  const spendRows = data.analytics.spendByAccount.accounts
    .map(
      (account) =>
        `<tr><td>${escapeHtml(account.accountCode)}</td><td>${escapeHtml(
          account.accountName,
        )}</td><td class="amount">${safeMoney(account.expense)}</td></tr>`,
    )
    .join('');
  const statementRows = data.accountStatement
    ? data.accountStatement.lines
        .map(
          (line) =>
            `<tr><td>${escapeHtml(line.occurredAt.slice(0, 10))}</td><td>${escapeHtml(
              line.description,
            )}</td><td class="amount">${safeMoney(
              line.delta,
            )}</td><td class="amount">${safeMoney(line.runningBalance)}</td></tr>`,
        )
        .join('')
    : '';
  const anomalies = data.anomalies.items.length
    ? data.anomalies.items
        .map((item) => {
          const figures = item.figures
            .map(
              (figure) =>
                `<span>${escapeHtml(figure.label)}: ${safeMoney(
                  figure.value,
                )}</span>`,
            )
            .join(' · ');
          return `<div class="anomaly"><strong>${escapeHtml(
            item.title,
          )}</strong><span>${escapeHtml(
            item.summary,
          )}</span><span class="subtle">${figures}</span></div>`;
        })
        .join('')
    : '<div class="subtle">No current alerts.</div>';

  return `<div class="grid" id="overview">
  <section class="span-3"><h2>Cash Position</h2><div class="metric">${safeMoney(
    data.cashPosition.netCash,
  )}</div><div class="subtle">${escapeHtml(data.period.from)} to ${escapeHtml(
    data.period.to,
  )}</div></section>
  <section class="span-3"><h2>Revenue</h2><div class="metric">${safeMoney(
    data.incomeStatement.revenue,
  )}</div><div class="subtle">Income statement</div></section>
  <section class="span-3"><h2>Expenses</h2><div class="metric">${safeMoney(
    data.incomeStatement.expenses,
  )}</div><div class="subtle">Income statement</div></section>
  <section class="span-3"><h2>Net Income</h2><div class="metric">${safeMoney(
    data.incomeStatement.netIncome,
  )}</div><div class="subtle">${escapeHtml(data.tenant.currency)}</div></section>
  <section class="span-6"><h2>Cash Accounts</h2><table class="table"><thead><tr><th>Code</th><th>Name</th><th class="amount">Balance</th></tr></thead><tbody>${cashAccounts}</tbody></table></section>
  <section class="span-6" id="series"><h2>Cash Balance Series</h2>${renderBars(
    data.analytics.chartScales.cashBalance,
    'cash',
  )}</section>
  <section class="span-6"><h2>Income vs Expenses</h2>${renderBars(
    data.analytics.chartScales.incomeVsExpenses,
    'income',
  )}</section>
  <section class="span-6" id="spend"><h2>Spend by Account</h2><table class="table"><thead><tr><th>Code</th><th>Account</th><th class="amount">Expense</th></tr></thead><tbody>${spendRows}</tbody></table></section>
  <section class="span-8"><h2>Account Statement</h2><table class="table"><thead><tr><th>Date</th><th>Description</th><th class="amount">Delta</th><th class="amount">Running</th></tr></thead><tbody>${statementRows}</tbody></table></section>
  <section class="span-4" id="anomalies"><h2>Alerts</h2><div class="stack">${anomalies}</div></section>
</div>`;
}

function renderBars(
  points: Array<{
    label: string;
    valuePermille: number;
    secondaryValuePermille?: number;
  }>,
  mode: 'cash' | 'income',
): string {
  if (!points.length) return '<div class="subtle">No series data.</div>';
  return `<div class="bars">${points
    .slice(-12)
    .map((point) => {
      if (mode === 'income') {
        return `<div class="bar-row"><span>${escapeHtml(
          point.label,
        )}</span><div class="bar-track"><div class="bar revenue" style="--bar-width:${barPercent(
          point.valuePermille,
        )}%"></div><div class="bar expense" style="--bar-width:${barPercent(
          point.secondaryValuePermille ?? 0,
        )}%"></div></div></div>`;
      }
      return `<div class="bar-row"><span>${escapeHtml(
        point.label,
      )}</span><div class="bar-track"><div class="bar" style="--bar-width:${barPercent(
        point.valuePermille,
      )}%"></div></div></div>`;
    })
    .join('')}</div>`;
}

function barPercent(valuePermille: number): string {
  const bounded = Math.max(0, Math.min(1000, valuePermille));
  return (bounded / 10).toFixed(1);
}

function safeMoney(value: { formatted: string }): string {
  return escapeHtml(value.formatted);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
