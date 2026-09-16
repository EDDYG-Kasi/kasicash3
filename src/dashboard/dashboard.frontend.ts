import type { DashboardOverviewDto } from './dashboard.dto';
import {
  brandLockupHtml,
  kasiDashboardCss,
  kasiDesignSystemCss,
} from '../design-system/kasicash-design-system';

type MoneyLike = { formatted?: string | null } | null | undefined;
type ScaleLike = {
  label: string;
  valuePercent: string;
  secondaryValuePercent?: string;
};

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
      --green: #00c853;
      --black: #0e0e0e;
      --ivory: #f7f6f1;
      --ink: #0e0e0e;
      --muted: #6f716d;
      --soft: #efeee8;
      --surface: #f7f6f1;
      --panel: #ffffff;
      --line: #dfddd4;
      --cash: #008f3c;
      --cash-soft: #e5f8ed;
      --income: #00a846;
      --income-soft: #e5f8ed;
      --expense: #a92335;
      --expense-soft: #fff0f2;
      --alert: #8a6100;
      --alert-soft: #fff7e8;
      --focus: #00c853;
      --danger: #a92335;
      --shadow: 0 14px 34px rgba(14, 14, 14, 0.08);
      font-family: Poppins, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      color: var(--ink);
      background: var(--surface);
    }
    button,
    input,
    select {
      font: inherit;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    a:focus-visible {
      outline: 3px solid rgba(21, 87, 176, 0.28);
      outline-offset: 3px;
    }
    .shell {
      min-height: 100vh;
      background:
        linear-gradient(180deg, #f7f6f1 0, #efeee8 330px),
        var(--surface);
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 14px 18px;
      background: rgba(247, 246, 241, 0.94);
      border-bottom: 2px solid var(--black);
      position: sticky;
      top: 0;
      z-index: 5;
      backdrop-filter: blur(10px);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .mark {
      display: inline-flex;
      align-items: baseline;
      color: var(--black);
      font-size: 26px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -1px;
    }
    .mark-c {
      color: var(--green);
      margin-left: 1px;
    }
    .brand-divider {
      width: 1px;
      height: 32px;
      background: #d6d3c9;
      flex: 0 0 auto;
    }
    .brand h1 {
      margin: 0;
      font-size: 19px;
      line-height: 1;
      letter-spacing: 0;
      font-weight: 800;
    }
    .brand small,
    .meta {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .meta {
      text-align: right;
    }
    main {
      width: min(1180px, 100%);
      margin: 0 auto;
      padding: 18px 14px 34px;
      display: grid;
      gap: 14px;
    }
    .hero {
      display: grid;
      gap: 14px;
      padding: 18px;
      border: 1px solid #cfe2d9;
      border-radius: 8px;
      background: var(--black);
      color: #ffffff;
      box-shadow: var(--shadow);
    }
    .kicker {
      margin: 0;
      color: var(--green);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .hero h2 {
      margin: 0;
      max-width: 820px;
      font-size: clamp(28px, 7vw, 52px);
      line-height: 1.03;
      letter-spacing: 0;
    }
    .hero-copy {
      margin: 0;
      max-width: 760px;
      color: #d7d4ca;
      font-size: 15px;
      line-height: 1.55;
    }
    .jump-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }
    .jump-links a {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 7px 10px;
      border: 1px solid #2c2c2c;
      border-radius: 8px;
      color: #ffffff;
      background: #161616;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
    }
    .filters {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid #242424;
      border-radius: 8px;
      background: #171717;
    }
    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .field span {
      color: #c7c3b8;
      font-size: 13px;
      font-weight: 750;
    }
    .field input,
    .field select {
      width: 100%;
      min-height: 44px;
      padding: 9px 10px;
      border: 1px solid #363636;
      border-radius: 8px;
      color: #ffffff;
      background: #0e0e0e;
    }
    .button {
      min-height: 46px;
      border: 0;
      border-radius: 8px;
      padding: 0 16px;
      color: #ffffff;
      background: var(--green);
      cursor: pointer;
      font-weight: 800;
    }
    .button:hover {
      background: #00b74c;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    section,
    .card {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    section {
      padding: 16px;
    }
    .card {
      padding: 14px;
    }
    .section-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    h3 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .caption,
    .subtle {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .amount {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .money {
      font-size: clamp(24px, 8vw, 36px);
      line-height: 1.1;
      font-weight: 850;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }
    .money.cash,
    .money.profit {
      color: var(--cash);
    }
    .money.income {
      color: var(--income);
    }
    .money.expense {
      color: var(--expense);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .kpi {
      display: grid;
      gap: 9px;
    }
    .kpi h3 {
      font-size: 14px;
      color: var(--muted);
      font-weight: 800;
    }
    .count {
      display: flex;
      align-items: baseline;
      gap: 9px;
    }
    .count strong {
      font-size: clamp(28px, 8vw, 40px);
      line-height: 1;
    }
    .reconcile {
      display: grid;
      gap: 11px;
      background: #ffffff;
    }
    .equation {
      display: grid;
      gap: 8px;
      color: var(--ink);
      font-size: 18px;
      font-weight: 850;
    }
    .equation span {
      display: inline-block;
    }
    .equation .minus,
    .equation .equals {
      color: var(--muted);
    }
    .cash-note {
      padding: 12px;
      border-radius: 8px;
      color: #123c2f;
      background: var(--cash-soft);
      line-height: 1.5;
    }
    .panel-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .chart {
      display: grid;
      gap: 10px;
    }
    .chart-row {
      display: grid;
      grid-template-columns: minmax(64px, 0.8fr) minmax(88px, 1fr);
      gap: 8px;
      align-items: center;
    }
    .chart-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
    }
    .chart-value {
      text-align: right;
      font-size: 12px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .track {
      grid-column: 1 / -1;
      min-height: 12px;
      border-radius: 999px;
      background: #e8efeb;
      overflow: hidden;
    }
    .bar {
      display: block;
      width: var(--bar-width);
      min-width: 3px;
      height: 12px;
      border-radius: 999px;
      background: var(--cash);
    }
    .bar.income { background: var(--income); }
    .bar.expense { background: var(--expense); }
    .pair {
      display: grid;
      gap: 6px;
    }
    .pair-line {
      display: grid;
      grid-template-columns: 58px 1fr auto;
      gap: 8px;
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
      gap: 12px;
      margin-top: 10px;
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
      background: var(--cash);
    }
    .swatch.income { background: var(--income); }
    .swatch.expense { background: var(--expense); }
    .single-reading,
    .empty,
    .error,
    .loading {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      color: var(--muted);
      background: #fbfdfc;
      line-height: 1.5;
    }
    .single-reading strong,
    .empty strong {
      display: block;
      margin-bottom: 3px;
      color: var(--ink);
    }
    .error {
      color: var(--danger);
      background: var(--expense-soft);
      border-color: #f0b4bd;
    }
    .loading {
      color: var(--ink);
      background:
        linear-gradient(90deg, #efeee8, #ffffff, #efeee8);
      background-size: 220% 100%;
      animation: shimmer 1.35s ease-in-out infinite;
    }
    .state-grid {
      display: grid;
      gap: 12px;
    }
    .state-line {
      height: 74px;
    }
    @keyframes shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }
    .table-wrap {
      overflow-x: auto;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .table th,
    .table td {
      padding: 11px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    .table th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 850;
    }
    .table .amount {
      text-align: right;
    }
    .spend-list {
      display: grid;
      gap: 10px;
    }
    .spend-item {
      display: grid;
      gap: 6px;
    }
    .spend-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      font-weight: 800;
    }
    .anomaly {
      display: grid;
      gap: 6px;
      padding: 12px;
      border-left: 4px solid var(--alert);
      border-radius: 8px;
      background: var(--alert-soft);
    }
    .anomaly strong {
      font-size: 14px;
    }
    .source-note {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    @media (min-width: 680px) {
      main {
        padding: 24px 20px 40px;
        gap: 16px;
      }
      .hero {
        padding: 24px;
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
      .equation {
        grid-template-columns: auto auto auto auto auto;
        align-items: center;
      }
      .chart-row {
        grid-template-columns: 72px minmax(0, 1fr) 112px;
      }
      .track {
        grid-column: auto;
      }
      .chart-value {
        text-align: right;
      }
    }
    @media (min-width: 980px) {
      .topbar {
        padding: 16px 26px;
      }
      .filters {
        grid-template-columns: 1fr 1fr 1fr 1.4fr 1fr auto;
      }
      .filters .button {
        grid-column: auto;
      }
      .kpi-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
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
      .brand h1 {
        font-size: 21px;
      }
    }
    ${kasiDesignSystemCss()}
    ${kasiDashboardCss()}
  </style>
</head>
<body>
  <div class="dashboard-shell">
    <header class="dashboard-topbar">
      <div class="dashboard-topbar-inner">
        ${brandLockupHtml()}
        <div class="dashboard-meta" id="dashboard-meta">Loading your records...</div>
      </div>
    </header>
    <main id="dashboard-root" aria-live="polite">
      <section class="state-grid" aria-label="Loading dashboard">
        <div class="loading state-line">Loading your latest money picture...</div>
        <div class="loading state-line">Loading sales, costs, and cash...</div>
        <div class="loading state-line">Loading charts and money movements...</div>
      </section>
    </main>
  </div>
  <script src="/dashboard/assets/app.js"></script>
</body>
</html>`;
}

export function dashboardClientScript(): string {
  return `'use strict';
${escapeHtml.toString()}
${safeText.toString()}
${safeMoney.toString()}
${moneyFromFormatted.toString()}
${groupThousands.toString()}
${safePercent.toString()}
${isZeroMoney.toString()}
${isNegativeMoney.toString()}
${absoluteMoney.toString()}
${formatLocalDate.toString()}
${formatRange.toString()}
${formatGranularity.toString()}
${requestJson.toString()}
${buildInsight.toString()}
${renderQuickRanges.toString()}
${rangeHref.toString()}
${shiftLocalDate.toString()}
${renderFilterControls.toString()}
${renderKpiCard.toString()}
${renderReconciliation.toString()}
${renderCashAccounts.toString()}
${renderCashTrend.toString()}
${renderIncomeExpenseTrend.toString()}
${renderSpendChart.toString()}
${renderSpendRows.toString()}
${renderStatementRows.toString()}
${renderStatementCards.toString()}
${renderAnomalies.toString()}
${pickCashPoints.toString()}
${pickIncomePoints.toString()}
${scaleAt.toString()}
${renderDashboardMarkup.toString()}
(function bootDashboard() {
  const root = document.getElementById('dashboard-root');
  const meta = document.getElementById('dashboard-meta');

  function updateMeta(data) {
    if (!meta || !data) return;
    meta.textContent = formatRange(data.period.from, data.period.to) + ' in ' + data.tenant.timezone;
  }

  function renderLoading() {
    if (root) {
      root.innerHTML =
        '<section class="state-grid" aria-label="Loading dashboard">' +
        '<div class="loading state-line">Loading your latest money picture...</div>' +
        '<div class="loading state-line">Loading sales, costs, and cash...</div>' +
        '<div class="loading state-line">Loading charts and money movements...</div>' +
        '</section>';
    }
  }

  function renderError() {
    if (root) {
      root.innerHTML =
        '<section class="error" role="alert"><strong>We could not load your dashboard.</strong><br />Please check the connection and try again. Your records were not changed.</section>';
    }
    if (meta) {
      meta.textContent = 'Dashboard unavailable';
    }
  }

  function bindControls(data) {
    const form = document.getElementById('dashboard-filters');
    if (form) {
      form.addEventListener('submit', function onSubmit(event) {
        event.preventDefault();
        loadDashboard(new URLSearchParams(new FormData(form)), true);
      });
    }
    updateMeta(data);
  }

  async function loadDashboard(params, replaceUrl) {
    renderLoading();
    const query = params && String(params).length ? '?' + String(params) : '';
    try {
      const data = await requestJson('/dashboard/api/overview' + query);
      if (root) {
        root.innerHTML = renderDashboardMarkup(data);
      }
      if (replaceUrl) {
        history.replaceState(null, '', window.location.pathname + query);
      }
      bindControls(data);
    } catch (err) {
      renderError();
    }
  }

  loadDashboard(new URLSearchParams(window.location.search), false);
})();`;
}

export function renderDashboardMarkup(data: DashboardOverviewDto): string {
  const kpis = data.kpis ?? {
    transactionCount: data.accountStatement?.total ?? 0,
    transactionCountLabel: 'money movements',
  };
  const newBusiness =
    data.cashPosition.accounts.length === 0 &&
    data.analytics.cashBalance.points.length === 0 &&
    data.analytics.incomeVsExpenses.points.length === 0 &&
    data.analytics.spendByAccount.accounts.length === 0 &&
    (data.accountStatement?.lines.length ?? 0) === 0;

  return `<section class="hero" id="overview">
  <p class="kicker">${safeText(formatRange(data.period.from, data.period.to))}</p>
  <h2>${buildInsight(data)}</h2>
  <p class="hero-copy">These are your posted records only. The dashboard shows what has been confirmed in your ledger, so it is useful for checking your own business, not a promise from a bank, insurer, or government office.</p>
  <nav class="jump-links" aria-label="Dashboard sections">
    <a href="#money-picture">Money picture</a>
    <a href="#trends">Trends</a>
    <a href="#spending">Spending</a>
    <a href="#movements">Money movements</a>
    <a href="#checks">Things to check</a>
  </nav>
  ${renderFilterControls(data)}
</section>
${newBusiness ? '<section class="empty"><strong>No posted activity yet.</strong>Keep recording sales and costs in WhatsApp and this page will fill in.</section>' : ''}
<div class="kpi-grid" id="money-picture">
  ${renderKpiCard('Cash in hand', safeMoney(data.cashPosition.netCash), 'Money available in cash accounts now.', 'cash')}
  ${renderKpiCard('Sales', safeMoney(data.incomeStatement.revenue), 'Money recorded coming in for this period.', 'income')}
  ${renderKpiCard('Costs', safeMoney(data.incomeStatement.expenses), 'Money recorded going out for this period.', 'expense')}
  ${renderKpiCard('Profit', safeMoney(data.incomeStatement.netIncome), 'Sales minus costs for this period.', 'profit')}
  <article class="card kpi">
    <h3>Money movements</h3>
    <div class="count"><strong>${safeText(kpis.transactionCount)}</strong><span class="caption">${safeText(kpis.transactionCountLabel)}</span></div>
  </article>
</div>
${renderReconciliation(data)}
<div class="panel-grid" id="trends">
  <section class="span-7">
    <div class="section-head"><h3>Cash trend</h3><span class="caption">${safeText(formatGranularity(data.period.granularity))}</span></div>
    ${renderCashTrend(data)}
  </section>
  <section class="span-5">
    <div class="section-head"><h3>Sales and costs</h3><span class="caption">${safeText(formatGranularity(data.period.granularity))}</span></div>
    ${renderIncomeExpenseTrend(data)}
  </section>
  <section class="span-5" id="spending">
    <div class="section-head"><h3>Where money went</h3><span class="caption">${safeMoney(data.analytics.spendByAccount.totalExpenses)} total costs</span></div>
    ${renderSpendChart(data)}
  </section>
  <section class="span-7">
    <div class="section-head"><h3>Cost details</h3><span class="caption">By account</span></div>
    <div class="table-wrap">
      <table class="table"><thead><tr><th>Account</th><th class="amount">Cost</th></tr></thead><tbody>${renderSpendRows(data)}</tbody></table>
    </div>
  </section>
  <section class="span-12">
    <div class="section-head"><h3>Cash accounts</h3><span class="caption">As at ${safeText(formatLocalDate(data.period.asOfLocalDate))}</span></div>
    <div class="table-wrap">
      <table class="table"><thead><tr><th>Account</th><th class="amount">Cash now</th></tr></thead><tbody>${renderCashAccounts(data)}</tbody></table>
    </div>
  </section>
  <section class="span-8" id="movements">
    <div class="section-head"><h3>Money movements</h3><span class="caption">${data.accountStatement ? safeText(data.accountStatement.accountName) : 'Choose an account'}</span></div>
    <div class="statement-desktop table-wrap">
      <table class="table"><thead><tr><th>Date</th><th>What happened</th><th class="amount">In or out</th><th class="amount">Cash after</th></tr></thead><tbody>${renderStatementRows(data)}</tbody></table>
    </div>
    <div class="statement-mobile" aria-label="Money movements for small screens">${renderStatementCards(data)}</div>
  </section>
  <section class="span-4" id="checks">
    <div class="section-head"><h3>Things to check</h3><span class="caption">Current alerts</span></div>
    ${renderAnomalies(data)}
  </section>
</div>
<p class="source-note">Figures shown here come from the existing cash position, income statement, account statement, analytics, and alert read services. The page does not post transactions or change financial records.</p>`;
}

function buildInsight(data: DashboardOverviewDto): string {
  const revenue = safeMoney(data.incomeStatement.revenue);
  const net = safeMoney(data.incomeStatement.netIncome);
  if (isNegativeMoney(data.incomeStatement.netIncome)) {
    return `You sold ${revenue} this period, but costs were higher by ${absoluteMoney(data.incomeStatement.netIncome)}.`;
  }
  if (isZeroMoney(data.incomeStatement.netIncome)) {
    return `You sold ${revenue} this period and broke even after costs.`;
  }
  return `You sold ${revenue} this period and kept ${net} after costs.`;
}

function renderQuickRanges(data: DashboardOverviewDto): string {
  const to = data.period.to;
  const presets = [
    {
      label: '1W',
      title: 'Last 7 days',
      from: shiftLocalDate(to, -6),
      granularity: 'day',
    },
    {
      label: '1M',
      title: 'Last 30 days',
      from: shiftLocalDate(to, -29),
      granularity: 'day',
    },
    {
      label: '3M',
      title: 'Last 90 days',
      from: shiftLocalDate(to, -89),
      granularity: 'week',
    },
    {
      label: '1Y',
      title: 'Last 12 months',
      from: shiftLocalDate(to, -364),
      granularity: 'month',
    },
  ];

  return presets
    .map((preset) => {
      const current =
        data.period.from === preset.from &&
        data.period.to === to &&
        data.period.granularity === preset.granularity;
      return `<a class="range-pill" href="${rangeHref(
        data,
        preset.from,
        to,
        preset.granularity,
      )}"${current ? ' aria-current="true"' : ''}><span>${safeText(
        preset.label,
      )}</span><span class="sr-only">${safeText(preset.title)}</span></a>`;
    })
    .join('');
}

function rangeHref(
  data: DashboardOverviewDto,
  from: string,
  to: string,
  granularity: string,
): string {
  const params = new URLSearchParams();
  params.set('from', from);
  params.set('to', to);
  params.set('granularity', granularity);
  params.set('asOfLocalDate', to);
  if (data.period.accountId) {
    params.set('accountId', data.period.accountId);
  }
  params.set('limit', String(data.period.limit));
  params.set('offset', String(data.period.offset));
  return `/dashboard?${params.toString()}`;
}

function shiftLocalDate(localDate: string, days: number): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!parts) return localDate;
  const date = new Date(
    Date.UTC(
      parseInt(parts[1], 10),
      parseInt(parts[2], 10) - 1,
      parseInt(parts[3], 10) + days,
    ),
  );
  return date.toISOString().slice(0, 10);
}

function renderFilterControls(data: DashboardOverviewDto): string {
  const selectedAccountId = data.period.accountId ?? '';
  const accounts = data.cashPosition.accounts.length
    ? data.cashPosition.accounts
        .map((account) => {
          const selected =
            account.accountId === selectedAccountId ? ' selected' : '';
          return `<option value="${safeText(account.accountId)}"${selected}>${safeText(
            `${account.code} ${account.name}`,
          )}</option>`;
        })
        .join('')
    : '<option value="">No accounts yet</option>';
  const granularityOption = (value: string, label: string) =>
    `<option value="${safeText(value)}"${
      data.period.granularity === value ? ' selected' : ''
    }>${safeText(label)}</option>`;

  return `<form class="filters" id="dashboard-filters" aria-label="Choose what the dashboard shows">
  <div class="range-row" aria-label="Quick date ranges">${renderQuickRanges(
    data,
  )}</div>
  <label class="field"><span>From date</span><input type="date" name="from" value="${safeText(
    data.period.from,
  )}" /></label>
  <label class="field"><span>To date</span><input type="date" name="to" value="${safeText(
    data.period.to,
  )}" /></label>
  <label class="field"><span>Show by</span><select name="granularity">${granularityOption(
    'day',
    'Day',
  )}${granularityOption('week', 'Week')}${granularityOption(
    'month',
    'Month',
  )}</select></label>
  <label class="field"><span>Cash account</span><select name="accountId">${accounts}</select></label>
  <label class="field"><span>Cash as at</span><input type="date" name="asOfLocalDate" value="${safeText(
    data.period.asOfLocalDate,
  )}" /></label>
  <input type="hidden" name="limit" value="${safeText(data.period.limit)}" />
  <input type="hidden" name="offset" value="${safeText(data.period.offset)}" />
  <button class="button" type="submit">Update view</button>
</form>`;
}

function renderKpiCard(
  title: string,
  value: string,
  detail: string,
  tone: 'cash' | 'income' | 'expense' | 'profit',
): string {
  return `<article class="card kpi"><h3>${safeText(title)}</h3><div class="money ${safeText(
    tone,
  )}">${value}</div><div class="caption">${safeText(detail)}</div></article>`;
}

function renderReconciliation(data: DashboardOverviewDto): string {
  return `<section class="reconcile" aria-label="How the numbers connect">
  <div class="section-head"><h3>How the money connects</h3><span class="caption">Posted records</span></div>
  <div class="equation">
    <span>Sales ${safeMoney(data.incomeStatement.revenue)}</span>
    <span class="minus">minus</span>
    <span>Costs ${safeMoney(data.incomeStatement.expenses)}</span>
    <span class="equals">equals</span>
    <span>Profit ${safeMoney(data.incomeStatement.netIncome)}</span>
  </div>
  <div class="cash-note">Cash in hand is ${safeMoney(
    data.cashPosition.netCash,
  )} as at ${safeText(
    formatLocalDate(data.period.asOfLocalDate),
  )}. Profit is only for the dates selected above; cash can be different when money was already there, moved into stock, paid to the owner, or came from a loan.</div>
</section>`;
}

function renderCashAccounts(data: DashboardOverviewDto): string {
  const rows = data.cashPosition.accounts
    .filter((account) => account.isCash)
    .map(
      (account) =>
        `<tr><td>${safeText(account.code)} ${safeText(
          account.name,
        )}</td><td class="amount">${safeMoney(account.balance)}</td></tr>`,
    )
    .join('');
  return (
    rows ||
    '<tr><td colspan="2"><div class="empty"><strong>No cash accounts yet.</strong>Keep recording and your cash balances will show here.</div></td></tr>'
  );
}

function renderCashTrend(data: DashboardOverviewDto): string {
  const points = pickCashPoints(data);
  if (!points.length) {
    return '<div class="empty"><strong>No cash movement in these dates.</strong>Keep recording sales and costs and this chart will fill in.</div>';
  }
  if (points.length === 1) {
    const point = points[0];
    return `<div class="single-reading"><strong>${safeMoney(
      point.point.cashBalance,
    )}</strong>Cash balance on ${safeText(
      formatLocalDate(point.point.bucketStartLocal ?? point.point.label),
    )}.</div>`;
  }
  return `<div class="chart" role="list" aria-label="Cash balance by date">${points
    .map(
      ({ point, scale }) =>
        `<div class="chart-row" role="listitem">
          <span class="chart-label">${safeText(
            formatLocalDate(point.bucketStartLocal ?? point.label),
          )}</span>
          <span class="track" aria-hidden="true"><span class="bar" style="--bar-width:${safePercent(
            scale?.valuePercent,
          )}%"></span></span>
          <span class="chart-value">${safeMoney(point.cashBalance)}</span>
        </div>`,
    )
    .join('')}</div>`;
}

function renderIncomeExpenseTrend(data: DashboardOverviewDto): string {
  const points = pickIncomePoints(data);
  if (!points.length) {
    return '<div class="empty"><strong>No sales or costs in these dates.</strong>Keep recording and this comparison will fill in.</div>';
  }
  if (points.length === 1) {
    const point = points[0];
    return `<div class="single-reading"><strong>${safeText(
      formatLocalDate(point.point.bucketStartLocal ?? point.point.label),
    )}</strong>Sales ${safeMoney(point.point.revenue)} and costs ${safeMoney(
      point.point.expenses,
    )}.</div>`;
  }
  return `<div class="chart" role="list" aria-label="Sales and costs by date">${points
    .map(
      ({ point, scale }) =>
        `<div class="pair" role="listitem">
          <div class="chart-label">${safeText(
            formatLocalDate(point.bucketStartLocal ?? point.label),
          )}</div>
          <div class="pair-line"><span>Sales</span><span class="track" aria-hidden="true"><span class="bar income" style="--bar-width:${safePercent(
            scale?.valuePercent,
          )}%"></span></span><span class="amount">${safeMoney(
            point.revenue,
          )}</span></div>
          <div class="pair-line"><span>Costs</span><span class="track" aria-hidden="true"><span class="bar expense" style="--bar-width:${safePercent(
            scale?.secondaryValuePercent,
          )}%"></span></span><span class="amount">${safeMoney(
            point.expenses,
          )}</span></div>
        </div>`,
    )
    .join(
      '',
    )}</div><div class="legend"><span class="key"><span class="swatch income"></span>Sales</span><span class="key"><span class="swatch expense"></span>Costs</span></div>`;
}

function renderSpendChart(data: DashboardOverviewDto): string {
  const accounts = data.analytics.spendByAccount.accounts;
  if (!accounts.length) {
    return '<div class="empty"><strong>No costs in this period.</strong>When you record stock, rent, airtime, or other costs, they will appear here.</div>';
  }
  if (accounts.length === 1) {
    const account = accounts[0];
    return `<div class="single-reading"><strong>${safeMoney(
      account.expense,
    )}</strong>${safeText(account.accountName)} is the only recorded cost account in this period.</div>`;
  }
  return `<div class="spend-list" role="list" aria-label="Cost breakdown by account">${accounts
    .slice(0, 8)
    .map((account, index) => {
      const scale = data.analytics.chartScales.spendByAccount[index];
      return `<div class="spend-item" role="listitem">
        <div class="spend-top"><span>${safeText(
          account.accountName,
        )}</span><span class="amount">${safeMoney(account.expense)}</span></div>
        <span class="track" aria-hidden="true"><span class="bar expense" style="--bar-width:${safePercent(
          scale?.valuePercent,
        )}%"></span></span>
      </div>`;
    })
    .join('')}</div>`;
}

function renderSpendRows(data: DashboardOverviewDto): string {
  const rows = data.analytics.spendByAccount.accounts
    .map(
      (account) =>
        `<tr><td>${safeText(account.accountCode)} ${safeText(
          account.accountName,
        )}</td><td class="amount">${safeMoney(account.expense)}</td></tr>`,
    )
    .join('');
  return (
    rows ||
    '<tr><td colspan="2"><div class="empty"><strong>No costs recorded.</strong>Keep recording and this will fill in.</div></td></tr>'
  );
}

function renderStatementRows(data: DashboardOverviewDto): string {
  if (!data.accountStatement) {
    return '<tr><td colspan="4"><div class="empty"><strong>No account selected.</strong>Choose a cash account to see its money movements.</div></td></tr>';
  }
  const rows = data.accountStatement.lines
    .map(
      (line) =>
        `<tr><td>${safeText(
          formatLocalDate(line.occurredAt.slice(0, 10)),
        )}</td><td>${safeText(line.description)}</td><td class="amount">${safeMoney(
          line.delta,
        )}</td><td class="amount">${safeMoney(line.runningBalance)}</td></tr>`,
    )
    .join('');
  return (
    rows ||
    '<tr><td colspan="4"><div class="empty"><strong>No money movements for this account.</strong>Try a wider date range or keep recording.</div></td></tr>'
  );
}

function renderStatementCards(data: DashboardOverviewDto): string {
  if (!data.accountStatement) {
    return '<div class="empty"><strong>No account selected.</strong>Choose a cash account to see its money movements.</div>';
  }
  const rows = data.accountStatement.lines
    .map(
      (line) =>
        `<article class="statement-row">
          <div class="statement-row-main">
            <strong>${safeText(line.description)}</strong>
            <span class="caption">${safeText(
              formatLocalDate(line.occurredAt.slice(0, 10)),
            )}</span>
          </div>
          <div class="statement-row-money">
            <strong>${safeMoney(line.delta)}</strong>
            <span>Cash after ${safeMoney(line.runningBalance)}</span>
          </div>
        </article>`,
    )
    .join('');
  return (
    rows ||
    '<div class="empty"><strong>No money movements for this account.</strong>Try a wider date range or keep recording.</div>'
  );
}

function renderAnomalies(data: DashboardOverviewDto): string {
  if (!data.anomalies.items.length) {
    return '<div class="empty"><strong>No unusual activity to check right now.</strong>Keep recording and KasiCash will flag simple things worth reviewing.</div>';
  }
  return `<div class="chart">${data.anomalies.items
    .map((item) => {
      const figures = item.figures
        .map(
          (figure) =>
            `<span>${safeText(figure.label)}: ${safeMoney(figure.value)}</span>`,
        )
        .join(' | ');
      return `<div class="anomaly"><strong>${safeText(
        item.title,
      )}</strong><span>${safeText(item.summary)}</span><span class="caption">${figures}</span></div>`;
    })
    .join('')}</div>`;
}

function pickCashPoints(data: DashboardOverviewDto) {
  const points = data.analytics.cashBalance.points.map((point, index) => ({
    point,
    scale: scaleAt(data.analytics.chartScales.cashBalance, index),
  }));
  if (!points.length) return [];
  const active = points.filter(({ point }) => !isZeroMoney(point.cashDelta));
  const last = points[points.length - 1];
  const selected = active.length ? active.slice(-9) : [];
  if (
    last &&
    !selected.some(({ point }) => point.label === last.point.label) &&
    !isZeroMoney(last.point.cashBalance)
  ) {
    selected.push(last);
  }
  return selected.length ? selected : points.slice(-1);
}

function pickIncomePoints(data: DashboardOverviewDto) {
  return data.analytics.incomeVsExpenses.points
    .map((point, index) => ({
      point,
      scale: scaleAt(data.analytics.chartScales.incomeVsExpenses, index),
    }))
    .filter(
      ({ point }) =>
        !isZeroMoney(point.revenue) || !isZeroMoney(point.expenses),
    )
    .slice(-10);
}

function scaleAt(scales: ScaleLike[], index: number): ScaleLike | undefined {
  return scales[index];
}

function safeMoney(value?: MoneyLike): string {
  return moneyFromFormatted(value?.formatted);
}

function moneyFromFormatted(raw?: string | null): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  const match = /^(?:(-)?ZAR\s+|ZAR\s+(-)?)([0-9]+)(?:\.([0-9]+))?$/.exec(
    trimmed,
  );
  if (!match) return escapeHtml(trimmed);
  const sign = match[1] || match[2] ? '-' : '';
  const whole = groupThousands(match[3] ?? '0');
  const cents = (match[4] ?? '00').padEnd(2, '0').slice(0, 2);
  return `${sign}R ${whole}.${cents}`;
}

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function safePercent(value?: string): string {
  const raw = typeof value === 'string' ? value : '0.0';
  if (/^(100\.0|[0-9]{1,2}\.[0-9])$/.test(raw)) return raw;
  if (/^100$/.test(raw)) return '100.0';
  if (/^[0-9]{1,2}$/.test(raw)) return `${raw}.0`;
  return '0.0';
}

function isZeroMoney(value?: MoneyLike): boolean {
  const raw = typeof value?.formatted === 'string' ? value.formatted : '';
  return /^-?[A-Z]{3}\s+0+(?:\.0+)?$/.test(raw.trim());
}

function isNegativeMoney(value?: MoneyLike): boolean {
  const raw =
    typeof value?.formatted === 'string' ? value.formatted.trim() : '';
  return raw.startsWith('-');
}

function absoluteMoney(value?: MoneyLike): string {
  const raw =
    typeof value?.formatted === 'string' ? value.formatted.trim() : '';
  return moneyFromFormatted(raw.startsWith('-') ? raw.slice(1) : raw);
}

function formatLocalDate(value: string): string {
  const localDate = value.slice(0, 10);
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!parts) return value;
  const months: Record<string, string> = {
    '01': 'Jan',
    '02': 'Feb',
    '03': 'Mar',
    '04': 'Apr',
    '05': 'May',
    '06': 'Jun',
    '07': 'Jul',
    '08': 'Aug',
    '09': 'Sep',
    '10': 'Oct',
    '11': 'Nov',
    '12': 'Dec',
  };
  const day = parts[3].replace(/^0/, '');
  return `${day} ${months[parts[2]] ?? parts[2]}`;
}

function formatRange(from: string, to: string): string {
  return `${formatLocalDate(from)} to ${formatLocalDate(to)}`;
}

function formatGranularity(value: string): string {
  if (value === 'week') return 'Weekly';
  if (value === 'month') return 'Monthly';
  return 'Daily';
}

function requestJson(url: string): Promise<DashboardOverviewDto> {
  if (typeof fetch === 'function') {
    return fetch(url, {
      headers: { Accept: 'application/json' },
    }).then((response) => {
      if (!response.ok) {
        throw new Error('Dashboard unavailable');
      }
      return response.json() as Promise<DashboardOverviewDto>;
    });
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.setRequestHeader('Accept', 'application/json');
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error('Dashboard unavailable'));
        return;
      }
      try {
        resolve(JSON.parse(request.responseText) as DashboardOverviewDto);
      } catch {
        reject(new Error('Dashboard unavailable'));
      }
    };
    request.onerror = () => reject(new Error('Dashboard unavailable'));
    request.send();
  });
}

function safeText(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return escapeHtml(String(value));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
