/* ==========================================================================
   AutoPulse CRM — Dashboard Logic
   - Session guard & authentication state
   - Dual theme & bilingual switcher
   - Deterministic mock data presentation (HRD & Branch Manager views)
   - Hand-crafted SVG charts (Line, Bar, Donut, Gauge)
   - Staff directory filtering, search, sorting & interactive leave approvals
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- Dependencies & Bootstrap ---------- */
  const Session = window.AutoPulseSession;
  const Data = window.AutoPulseData;
  const I18N = window.AutoPulseDashI18n;

  if (!Session || !Data || !I18N) {
    console.error("AutoPulse: Missing dependencies");
    return;
  }

  // Guard: if no active session, redirect to login
  const activeSession = Session.read();
  if (!activeSession) {
    window.location.replace("index.html?expired=1");
    return;
  }

  /* ---------- Constants & State ---------- */
  const STORAGE = {
    theme: "autopulse-theme",
    lang: "autopulse-lang",
  };

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LATENCY_MS = 380;

  const state = {
    user: activeSession.name,
    role: activeSession.role || "hrd",
    branch: activeSession.branch || "jkt",
    lang: "id",
    range: 30, // 7 or 30 days for HRD chart
    data: null,
    loadToken: 0,
    forceOffline: new URLSearchParams(window.location.search).get("offline") === "1",
    sort: { key: null, dir: "desc" },
    query: "",
    division: "all",
    activeTab: "overview",
    attQuery: "",
    attStatus: "all",
    teamQuery: "",
    teamDivision: "all",
    leadsQuery: "",
    hiddenSeries: new Set(),
    processed: {}, // { [branch]: Set(leaveId) }
    lastFocus: null,
    menuOpen: false,
    sidebarOpen: false,
  };

  /* ---------- DOM Selectors ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    html: document.documentElement,
    metaTheme: document.querySelector('meta[name="theme-color"]'),
    sidebar: $("#sidebar"),
    sidebarClose: $("#sidebar-close"),
    sidebarBackdrop: $("#sidebar-backdrop"),
    sidebarBranch: $("#sidebar-branch"),
    menuToggle: $("#menu-toggle"),
    navButtons: $$("#side-nav .nav-item"),
    pageTitle: $("#page-title"),
    welcomeText: $("#welcome-text"),
    todayText: $("#today-text"),
    branchSelect: $("#branch-select"),
    roleSelect: $("#role-select"),
    langButtons: $$(".lang-btn"),
    themeToggle: $("#theme-toggle"),
    notifBtn: $("#notif-btn"),
    notifCount: $("#notif-count"),
    userMenuBtn: $("#user-menu-btn"),
    userMenu: $("#user-menu"),
    userAvatar: $("#user-avatar"),
    userName: $("#user-name"),
    userRole: $("#user-role"),
    logoutBtn: $("#logout-btn"),
    kpiGrid: $("#kpi-grid"),
    chartCard: $("#chart-card"),
    chartTitle: $("#chart-title"),
    rangeGroup: $("#range-group"),
    rangeButtons: $$(".range-btn"),
    chartLegend: $("#chart-legend"),
    chartBody: $("#chart-body"),
    chartTooltip: $("#chart-tooltip"),
    chartSr: $("#chart-sr"),
    sideCard: $("#side-card"),
    sideTitle: $("#side-title"),
    sideBody: $("#side-body"),
    sideLegend: $("#side-legend"),
    tableCard: $("#table-card"),
    tableTitle: $("#table-title"),
    tableSearch: $("#table-search"),
    divisionFilter: $("#division-filter"),
    dataTable: $("#data-table"),
    tableHead: $("#table-head"),
    tableBody: $("#table-body"),
    tableCount: $("#table-count"),
    tableEmpty: $("#table-empty"),
    feedCard: $("#feed-card"),
    feedTitle: $("#feed-title"),
    feedCount: $("#feed-count"),
    feedList: $("#feed-list"),
    feedEmpty: $("#feed-empty"),
    lastUpdated: $("#last-updated"),
    toastRegion: $("#toast-region"),

    // Sub-view Containers
    viewOverview: $("#view-overview"),
    viewAttendance: $("#view-attendance"),
    viewCommission: $("#view-commission"),
    viewTeam: $("#view-team"),
    viewLeads: $("#view-leads"),
    viewReports: $("#view-reports"),

    // Sub-view 1: Attendance
    attSummaryGrid: $("#att-summary-grid"),
    attSearch: $("#att-search"),
    attStatusFilter: $("#att-status-filter"),
    btnExportAtt: $("#btn-export-att"),
    attTableHead: $("#att-table-head"),
    attTableBody: $("#att-table-body"),
    attCount: $("#att-count"),
    attEmpty: $("#att-empty"),

    // Sub-view 2: Commission
    commSummaryGrid: $("#comm-summary-grid"),
    commRuleBox: $("#comm-rule-box"),
    btnSubmitPayroll: $("#btn-submit-payroll"),
    commTableHead: $("#comm-table-head"),
    commTableBody: $("#comm-table-body"),
    commCount: $("#comm-count"),

    // Sub-view 3: Team Directory
    teamSearch: $("#team-search"),
    teamDivisionFilter: $("#team-division-filter"),
    teamGrid: $("#team-grid"),
    teamEmpty: $("#team-empty"),

    // Sub-view 4: Leads Pipeline
    leadsFunnelGrid: $("#leads-funnel-grid"),
    leadsSearch: $("#leads-search"),
    btnAddLead: $("#btn-add-lead"),
    leadsTableHead: $("#leads-table-head"),
    leadsTableBody: $("#leads-table-body"),
    leadsCount: $("#leads-count"),
    leadsEmpty: $("#leads-empty"),

    // Sub-view 5: Branch Reports
    btnDownloadPdf: $("#btn-download-pdf"),
    btnDownloadExcel: $("#btn-download-excel"),
    repKpiGrid: $("#rep-kpi-grid"),
    repSummaryCard: $("#rep-summary-card"),
    repStatSpk: $("#rep-stat-spk"),
    repStatService: $("#rep-stat-service"),
    repStatCsat: $("#rep-stat-csat"),
    repStatParts: $("#rep-stat-parts"),
    repStatSop: $("#rep-stat-sop"),
    repHighlightsList: $("#rep-highlights-list"),
  };

  /* ---------- Helpers ---------- */
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };

  function t(key, params) {
    const dict = I18N[state.lang] || I18N.id;
    let str = dict[key] !== undefined ? dict[key] : (I18N.id[key] !== undefined ? I18N.id[key] : key);
    if (typeof str !== "string") return str;
    if (params) {
      Object.keys(params).forEach((p) => {
        str = str.replace(new RegExp(`\\{${p}\\}`, "g"), params[p]);
      });
    }
    return str;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pad2 = (n) => String(n).padStart(2, "0");

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function initials(name) {
    if (!name) return "AP";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatNumber(value, decimals = 0) {
    return Number(value).toLocaleString(state.lang === "id" ? "id-ID" : "en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatKpi(kpi) {
    const d = kpi.decimals || 0;
    switch (kpi.format) {
      case "percent":
        return formatNumber(kpi.value, d) + "%";
      case "currencyM":
        return state.lang === "id"
          ? `Rp ${formatNumber(kpi.value, d)} jt`
          : `IDR ${formatNumber(kpi.value, d)}M`;
      case "rating":
        return `${formatNumber(kpi.value, d)}/5`;
      case "count":
      default:
        return formatNumber(kpi.value, 0);
    }
  }

  function animateNumber(node, to, { decimals = 0, prefix = "", suffix = "", duration = 900 } = {}) {
    const from = Number(node.dataset.raw || 0);
    node.dataset.raw = String(to);
    if (REDUCED_MOTION || from === to) {
      node.textContent = prefix + formatNumber(to, decimals) + suffix;
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const cur = from + (to - from) * eased;
      node.textContent = prefix + formatNumber(cur, decimals) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function formatDayOffset(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return new Intl.DateTimeFormat(state.lang === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
    }).format(d);
  }

  function showToast(message, kind = "success") {
    const toast = document.createElement("div");
    toast.className = `dash-toast is-${kind}`;
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${kind === "success" ? '<path d="M20 6L9 17l-5-5"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
      </svg>
      <span>${escapeHtml(message)}</span>
    `;
    el.toastRegion.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 320);
    }, 3200);
  }

  /* ---------- Theme Management ---------- */
  function applyTheme(theme, persist = true) {
    el.html.setAttribute("data-theme", theme);
    if (el.metaTheme) el.metaTheme.setAttribute("content", theme === "light" ? "#F8FAFC" : "#0A0E17");
    if (persist) storage.set(STORAGE.theme, theme);
    if (state.data) renderAll(false);
  }

  function toggleTheme() {
    const next = el.html.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next, true);
  }

  /* ---------- Language & Dictionary ---------- */
  function applyLanguage(lang, persist = true) {
    state.lang = I18N[lang] ? lang : "id";
    el.html.lang = state.lang;
    if (persist) storage.set(STORAGE.lang, state.lang);

    $$("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
    $$("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAria)); });

    el.langButtons.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.lang === state.lang)));

    updateWelcome();
    switchTab(state.activeTab);
    if (state.data) renderAll(false);
  }

  function updateWelcome() {
    const hour = new Date().getHours();
    let greetKey = "greetingNight";
    if (hour >= 4 && hour < 11) greetKey = "greetingMorning";
    else if (hour >= 11 && hour < 15) greetKey = "greetingAfternoon";
    else if (hour >= 15 && hour < 18) greetKey = "greetingEvening";

    const greeting = t(greetKey);
    el.welcomeText.textContent = t("welcome", { greeting, name: state.user });
    el.todayText.textContent = t("todayLabel");
  }

  /* ---------- KPI Icon Mapping ---------- */
  const KPI_ICONS = {
    attendance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    onLeave: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    techUtil: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    commission: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    unitsSold: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    serviceToday: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
    conversion: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    csat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  };

  /* ---------- Render Functions ---------- */

  // 1. Render KPI Row
  function renderKpis(animate = true) {
    if (!state.data || !state.data.kpis) return;
    el.kpiGrid.innerHTML = "";

    state.data.kpis.forEach((k, idx) => {
      const card = document.createElement("article");
      card.className = "kpi-card";
      card.style.animationDelay = `${idx * 0.08}s`;

      const isGood = k.goodWhenUp ? k.trend >= 0 : k.trend <= 0;
      const trendClass = isGood ? "is-good" : "is-bad";
      const trendArrow = k.trend > 0 ? "▲ +" : (k.trend < 0 ? "▼ " : "");
      const trendText = `${trendArrow}${formatNumber(Math.abs(k.trend), k.decimals)} ${t("vsYesterday")}`;

      // Generate sparkline SVG
      const sparkMin = Math.min(...k.spark);
      const sparkMax = Math.max(...k.spark);
      const range = (sparkMax - sparkMin) || 1;
      const pts = k.spark.map((v, i) => {
        const x = (i / 6) * 100;
        const y = 24 - ((v - sparkMin) / range) * 20;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");

      card.innerHTML = `
        <div class="kpi-head">
          <div class="kpi-icon-chip" aria-hidden="true">${KPI_ICONS[k.id] || ""}</div>
          <div class="kpi-meta">
            <h3 class="kpi-label">${t("kpi_" + k.id)}</h3>
            <span class="kpi-hint">${t("kpiHint_" + k.id)}</span>
          </div>
        </div>
        <div class="kpi-body">
          <div class="kpi-value" id="kpi-val-${k.id}">0</div>
          <span class="kpi-trend ${trendClass}">${trendText}</span>
        </div>
        <svg class="kpi-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${pts}"></polyline>
        </svg>
      `;

      el.kpiGrid.appendChild(card);

      const valNode = $(`#kpi-val-${k.id}`);
      if (k.format === "currencyM") {
        const prefix = state.lang === "id" ? "Rp " : "IDR ";
        const suffix = state.lang === "id" ? " jt" : "M";
        animateNumber(valNode, k.value, { decimals: k.decimals, prefix, suffix, animate });
      } else if (k.format === "percent") {
        animateNumber(valNode, k.value, { decimals: k.decimals, suffix: "%", animate });
      } else if (k.format === "rating") {
        animateNumber(valNode, k.value, { decimals: k.decimals, suffix: "/5", animate });
      } else {
        animateNumber(valNode, k.value, { decimals: 0, animate });
      }
    });
  }

  // 2. Render Main Chart (Line for HRD, Bar for BM)
  function renderMainChart() {
    if (!state.data || !state.data.chart) return;
    const { chart } = state.data;

    // Toggle range selector: only applicable for HRD line chart
    el.rangeGroup.hidden = state.role !== "hrd";

    if (chart.type === "line") {
      renderLineChart(chart);
    } else {
      renderBarChart(chart);
    }
  }

  function renderLineChart(chart) {
    const is7 = state.range === 7;
    const labels = is7 ? chart.labels.slice(-7) : chart.labels;
    const series = chart.series.map((s) => ({
      id: s.id,
      values: is7 ? s.values.slice(-7) : s.values,
    }));

    // Setup legend
    el.chartLegend.innerHTML = "";
    series.forEach((s, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "legend-btn";
      const isVisible = !state.hiddenSeries.has(s.id);
      btn.setAttribute("aria-pressed", String(isVisible));
      const color = idx === 0 ? "var(--series-1)" : idx === 1 ? "var(--series-2)" : "var(--series-3)";
      btn.innerHTML = `<span class="legend-dot" style="background:${color}"></span>${t("series_" + s.id)}`;
      btn.addEventListener("click", () => {
        if (state.hiddenSeries.has(s.id)) state.hiddenSeries.delete(s.id);
        else state.hiddenSeries.add(s.id);
        renderLineChart(chart);
      });
      el.chartLegend.appendChild(btn);
    });

    const W = 640;
    const H = 250;
    const p = { t: 20, r: 20, b: 34, l: 40 };
    const innerW = W - p.l - p.r;
    const innerH = H - p.t - p.b;

    const visibleSeries = series.filter((s) => !state.hiddenSeries.has(s.id));
    const allVals = visibleSeries.flatMap((s) => s.values);
    const minVal = allVals.length ? Math.floor(Math.min(...allVals) / 5) * 5 : 70;
    const maxVal = 100;
    const valRange = (maxVal - minVal) || 1;

    // Grid lines & Y ticks (4 levels)
    let gridSvg = "";
    for (let i = 0; i <= 3; i++) {
      const yVal = minVal + (valRange * i) / 3;
      const y = p.t + innerH - (innerH * i) / 3;
      gridSvg += `<line class="grid-line" x1="${p.l}" y1="${y}" x2="${W - p.r}" y2="${y}"/>`;
      gridSvg += `<text class="axis-label" x="${p.l - 8}" y="${y + 4}" text-anchor="end">${Math.round(yVal)}%</text>`;
    }

    // X axis ticks & labels
    const stepX = innerW / (labels.length - 1);
    labels.forEach((offset, idx) => {
      const showLabel = is7 || idx % 5 === 0 || idx === labels.length - 1;
      if (showLabel) {
        const x = p.l + idx * stepX;
        gridSvg += `<text class="axis-label" x="${x}" y="${H - 10}" text-anchor="middle">${formatDayOffset(offset)}</text>`;
      }
    });

    // Render Series Lines & Gradient Area
    let seriesSvg = `
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
    `;

    visibleSeries.forEach((s) => {
      const pts = s.values.map((v, i) => {
        const x = p.l + i * stepX;
        const y = p.t + innerH - ((v - minVal) / valRange) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });

      const seriesIdx = series.findIndex((orig) => orig.id === s.id);
      const color = seriesIdx === 0 ? "var(--series-1)" : seriesIdx === 1 ? "var(--series-2)" : "var(--series-3)";

      // Area under the first active series
      if (s === visibleSeries[0]) {
        const firstPt = pts[0].split(",");
        const lastPt = pts[pts.length - 1].split(",");
        const areaPath = `M ${firstPt[0]},${H - p.b} L ${pts.join(" L ")} L ${lastPt[0]},${H - p.b} Z`;
        seriesSvg += `<path d="${areaPath}" fill="url(#areaGrad)"/>`;
      }

      seriesSvg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    });

    // Invisible hit targets for interactive tooltips
    let hitSvg = "";
    labels.forEach((offset, i) => {
      const x = p.l + i * stepX - stepX / 2;
      const w = stepX;
      hitSvg += `<rect class="chart-hit" x="${Math.max(x, p.l)}" y="${p.t}" width="${w}" height="${innerH}" fill="transparent" data-idx="${i}" style="cursor:crosshair;"/>`;
    });

    el.chartBody.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${gridSvg}
        ${seriesSvg}
        ${hitSvg}
      </svg>
    `;

    el.chartBody.setAttribute("aria-label", t("chartSummaryLine"));

    // Tooltip event listeners
    const hits = el.chartBody.querySelectorAll(".chart-hit");
    hits.forEach((rect) => {
      rect.addEventListener("mouseenter", (e) => {
        const idx = Number(rect.dataset.idx);
        const dayLabel = formatDayOffset(labels[idx]);
        let tipHtml = `<strong>${dayLabel}</strong><br/>`;
        visibleSeries.forEach((s) => {
          tipHtml += `${t("series_" + s.id)}: <strong>${formatNumber(s.values[idx], 1)}%</strong><br/>`;
        });
        el.chartTooltip.innerHTML = tipHtml;
        el.chartTooltip.hidden = false;

        const rectBox = rect.getBoundingClientRect();
        const containerBox = el.chartBody.getBoundingClientRect();
        el.chartTooltip.style.left = `${rectBox.left - containerBox.left + rectBox.width / 2}px`;
        el.chartTooltip.style.top = `${rectBox.top - containerBox.top + 20}px`;
      });
      rect.addEventListener("mouseleave", () => {
        el.chartTooltip.hidden = true;
      });
    });
  }

  function renderBarChart(chart) {
    // Setup legend
    el.chartLegend.innerHTML = "";
    chart.series.forEach((s, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "legend-btn";
      const color = idx === 0 ? "var(--series-1)" : "var(--series-2)";
      btn.innerHTML = `<span class="legend-dot" style="background:${color}"></span>${t("series_" + s.id)}`;
      el.chartLegend.appendChild(btn);
    });

    const W = 640;
    const H = 250;
    const p = { t: 20, r: 20, b: 34, l: 36 };
    const innerW = W - p.l - p.r;
    const innerH = H - p.t - p.b;

    const actuals = chart.series.find((s) => s.id === "actual").values;
    const targets = chart.series.find((s) => s.id === "target").values;
    const maxVal = Math.max(...actuals, ...targets, 10);
    const ceilMax = Math.ceil(maxVal / 10) * 10;

    // Grid lines & Y ticks
    let gridSvg = "";
    for (let i = 0; i <= 3; i++) {
      const yVal = (ceilMax * i) / 3;
      const y = p.t + innerH - (innerH * i) / 3;
      gridSvg += `<line class="grid-line" x1="${p.l}" y1="${y}" x2="${W - p.r}" y2="${y}"/>`;
      gridSvg += `<text class="axis-label" x="${p.l - 8}" y="${y + 4}" text-anchor="end">${Math.round(yVal)}</text>`;
    }

    const n = actuals.length;
    const colW = innerW / n;
    const barW = Math.min(colW * 0.55, 34);

    let barsSvg = "";
    let targetPts = [];

    actuals.forEach((val, i) => {
      const x = p.l + i * colW + (colW - barW) / 2;
      const barH = (val / ceilMax) * innerH;
      const y = p.t + innerH - barH;

      const targetVal = targets[i];
      const targetY = p.t + innerH - (targetVal / ceilMax) * innerH;
      targetPts.push(`${(p.l + i * colW + colW / 2).toFixed(1)},${targetY.toFixed(1)}`);

      barsSvg += `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="5" fill="var(--series-1)" class="chart-bar" data-idx="${i}"/>
      `;

      // Label below bar
      const labelText = i === n - 1 ? t("thisWeek") : t("weekLabel", { n: i + 1 });
      gridSvg += `<text class="axis-label" x="${(p.l + i * colW + colW / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle">${labelText}</text>`;
    });

    const targetLineSvg = `<polyline points="${targetPts.join(" ")}" fill="none" stroke="var(--series-2)" stroke-width="2.5" stroke-dasharray="6 4"/>`;

    el.chartBody.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${gridSvg}
        ${barsSvg}
        ${targetLineSvg}
      </svg>
    `;

    el.chartBody.setAttribute("aria-label", t("chartSummaryBar"));

    // Tooltip event listeners
    const bars = el.chartBody.querySelectorAll(".chart-bar");
    bars.forEach((bar) => {
      bar.addEventListener("mouseenter", () => {
        const idx = Number(bar.dataset.idx);
        const wk = idx === n - 1 ? t("thisWeek") : t("weekLabel", { n: idx + 1 });
        el.chartTooltip.innerHTML = `<strong>${wk}</strong><br/>${t("series_actual")}: <strong>${actuals[idx]} SPK</strong><br/>${t("series_target")}: ${targets[idx]} SPK`;
        el.chartTooltip.hidden = false;

        const box = bar.getBoundingClientRect();
        const container = el.chartBody.getBoundingClientRect();
        el.chartTooltip.style.left = `${box.left - container.left + box.width / 2}px`;
        el.chartTooltip.style.top = `${box.top - container.top - 10}px`;
      });
      bar.addEventListener("mouseleave", () => {
        el.chartTooltip.hidden = true;
      });
    });
  }

  // 3. Render Side Card (Donut for HRD, Semicircle Gauge for BM)
  function renderSideCard() {
    if (!state.data || !state.data.side) return;
    const { side } = state.data;

    if (side.type === "donut") {
      renderDonut(side);
    } else {
      renderGauge(side);
    }
  }

  function renderDonut(side) {
    const total = side.segments.reduce((sum, s) => sum + s.value, 0) || 1;
    const r = 50;
    const C = 2 * Math.PI * r;

    const colors = {
      present: "var(--success)",
      late: "var(--warning)",
      leave: "var(--accent-secondary)",
      sick: "var(--danger)",
    };

    let accumulatedPct = 0;
    let segSvg = "";

    side.segments.forEach((s) => {
      const pct = s.value / total;
      const strokeLen = pct * C;
      const strokeOffset = C - accumulatedPct * C;
      accumulatedPct += pct;

      segSvg += `
        <circle cx="75" cy="75" r="${r}" fill="none" stroke="${colors[s.id] || 'var(--accent-primary)'}" stroke-width="18"
          stroke-dasharray="${strokeLen} ${C}" stroke-dashoffset="${strokeOffset}"
          stroke-linecap="butt" transform="rotate(-90 75 75)"/>
      `;
    });

    el.sideBody.innerHTML = `
      <svg class="donut-svg" viewBox="0 0 150 150" aria-hidden="true">
        <circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--gauge-track)" stroke-width="18"/>
        ${segSvg}
        <text x="75" y="70" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text-primary)" font-family="var(--font-display)">${total}</text>
        <text x="75" y="88" text-anchor="middle" font-size="11" fill="var(--text-muted)" font-family="var(--font-body)">${t("totalStaff")}</text>
      </svg>
    `;

    // Legend
    el.sideLegend.innerHTML = "";
    side.segments.forEach((s) => {
      const pct = Math.round((s.value / total) * 100);
      const row = document.createElement("div");
      row.className = "side-legend-row";
      row.innerHTML = `
        <div class="side-legend-left">
          <span class="legend-dot" style="background:${colors[s.id]};"></span>
          <span>${t("status_" + s.id)}</span>
        </div>
        <span class="side-legend-value">${s.value} (${pct}%)</span>
      `;
      el.sideLegend.appendChild(row);
    });
  }

  function renderGauge(side) {
    const { value, target } = side;
    const pct = Math.round((value / target) * 100);
    const r = 52;
    const C = Math.PI * r; // half circle circumference
    const clampedPct = Math.min(Math.max(pct, 0), 100);
    const strokeLen = (clampedPct / 100) * C;

    const strokeColor = pct >= 100 ? "var(--success)" : (pct >= 80 ? "var(--accent-primary)" : "var(--warning)");

    el.sideBody.innerHTML = `
      <svg class="gauge-svg" viewBox="0 0 150 95" aria-hidden="true">
        <!-- Track semicircle -->
        <path d="M 23 80 A 52 52 0 0 1 127 80" fill="none" stroke="var(--gauge-track)" stroke-width="16" stroke-linecap="round"/>
        <!-- Value arc -->
        <path d="M 23 80 A 52 52 0 0 1 127 80" fill="none" stroke="${strokeColor}" stroke-width="16"
          stroke-dasharray="${strokeLen} ${C}" stroke-linecap="round"/>
        <text x="75" y="65" text-anchor="middle" font-size="24" font-weight="700" fill="var(--text-primary)" font-family="var(--font-display)">${pct}%</text>
        <text x="75" y="82" text-anchor="middle" font-size="11" fill="var(--text-muted)">${t("ofTarget")}</text>
      </svg>
    `;

    el.sideLegend.innerHTML = `
      <div class="side-legend-row" style="justify-content:center; gap: 8px;">
        <span style="font-weight:600; color:var(--text-primary); font-size:0.95rem;">
          ${t("unitsOf", { v: value, t: target })}
        </span>
      </div>
    `;
  }

  // 4. Render Table (Staff Attendance for HRD, Leaderboard for BM)
  function renderTable() {
    if (!state.data || !state.data.table) return;
    const { table } = state.data;

    // Toggle division filter visibility (only relevant for HRD staff table)
    el.divisionFilter.hidden = state.role !== "hrd";

    if (table.type === "staff") {
      renderStaffTable(table.rows);
    } else {
      renderLeaderboardTable(table.rows);
    }
  }

  function renderStaffTable(rows) {
    // Columns: Name, Division, CheckIn, Status, KPI
    el.tableHead.innerHTML = `
      <tr>
        <th><button type="button" data-sort="name">${t("colName")} <span class="sort-icon">↕</span></button></th>
        <th>${t("colDivision")}</th>
        <th>${t("colCheckIn")}</th>
        <th>${t("colStatus")}</th>
        <th><button type="button" data-sort="kpi">${t("colKpi")} <span class="sort-icon">↕</span></button></th>
      </tr>
    `;

    // Filter
    let filtered = rows.filter((r) => {
      const matchQuery = !state.query || r.name.toLowerCase().includes(state.query.toLowerCase());
      const matchDiv = state.division === "all" || r.division === state.division;
      return matchQuery && matchDiv;
    });

    // Sort
    if (state.sort.key === "name") {
      filtered.sort((a, b) => state.sort.dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (state.sort.key === "kpi") {
      filtered.sort((a, b) => state.sort.dir === "asc" ? a.kpi - b.kpi : b.kpi - a.kpi);
    }

    el.tableBody.innerHTML = "";
    if (filtered.length === 0) {
      el.tableEmpty.hidden = false;
    } else {
      el.tableEmpty.hidden = true;
      filtered.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <div class="staff-cell">
              <span class="avatar-sm" aria-hidden="true">${initials(r.name)}</span>
              <span>${escapeHtml(r.name)}</span>
            </div>
          </td>
          <td>${t("div_" + r.division)}</td>
          <td>${r.checkIn || "—"}</td>
          <td><span class="badge status-${r.status}">${t("status_" + r.status)}</span></td>
          <td>
            <div class="kpi-score-wrap">
              <div class="kpi-track"><div class="kpi-fill" style="width:${r.kpi}%;"></div></div>
              <span style="font-weight:600; font-size:0.84rem;">${r.kpi}</span>
            </div>
          </td>
        `;
        el.tableBody.appendChild(tr);
      });
    }

    el.tableCount.textContent = t("tableCount", { n: filtered.length, t: rows.length });
    bindTableSortButtons();
  }

  function renderLeaderboardTable(rows) {
    el.tableHead.innerHTML = `
      <tr>
        <th>${t("colRank")}</th>
        <th><button type="button" data-sort="name">${t("colName")} <span class="sort-icon">↕</span></button></th>
        <th><button type="button" data-sort="spk">${t("colSpk")} <span class="sort-icon">↕</span></button></th>
        <th>${t("colTarget")}</th>
        <th>${t("colLeads")}</th>
      </tr>
    `;

    let filtered = rows.filter((r) => {
      return !state.query || r.name.toLowerCase().includes(state.query.toLowerCase());
    });

    if (state.sort.key === "name") {
      filtered.sort((a, b) => state.sort.dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (state.sort.key === "spk") {
      filtered.sort((a, b) => state.sort.dir === "asc" ? a.spk - b.spk : b.spk - a.spk);
    }

    el.tableBody.innerHTML = "";
    if (filtered.length === 0) {
      el.tableEmpty.hidden = false;
    } else {
      el.tableEmpty.hidden = true;
      filtered.forEach((r, idx) => {
        const pct = Math.round((r.spk / r.target) * 100);
        const rankMedal = idx === 0 ? "🥇" : (idx === 1 ? "🥈" : (idx === 2 ? "🥉" : `#${idx + 1}`));
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${rankMedal}</strong></td>
          <td>
            <div class="staff-cell">
              <span class="avatar-sm" aria-hidden="true">${initials(r.name)}</span>
              <span>${escapeHtml(r.name)}</span>
            </div>
          </td>
          <td><strong style="color:var(--accent-primary); font-size:0.95rem;">${r.spk} SPK</strong></td>
          <td>${r.target} SPK (${pct}%)</td>
          <td>${r.activeLeads}</td>
        `;
        el.tableBody.appendChild(tr);
      });
    }

    el.tableCount.textContent = t("tableCount", { n: filtered.length, t: rows.length });
    bindTableSortButtons();
  }

  function bindTableSortButtons() {
    $$("#table-head button[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (state.sort.key === key) {
          state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        } else {
          state.sort.key = key;
          state.sort.dir = "desc";
        }
        renderTable();
      });
    });
  }

  // 5. Render Feed (Leave Requests for HRD, Stall Queue for BM)
  function renderFeed() {
    if (!state.data || !state.data.feed) return;
    const { feed } = state.data;

    el.feedList.innerHTML = "";

    if (feed.type === "leave") {
      const processedSet = state.processed[state.branch] || new Set();
      const activeItems = feed.items.filter((item) => !processedSet.has(item.id));

      el.feedCount.textContent = String(activeItems.length);
      el.notifCount.textContent = String(activeItems.length);
      el.feedCount.hidden = activeItems.length === 0;

      if (activeItems.length === 0) {
        el.feedEmpty.hidden = false;
        return;
      }
      el.feedEmpty.hidden = true;

      activeItems.forEach((item) => {
        const li = document.createElement("li");
        li.className = "feed-item";
        li.id = item.id;
        li.innerHTML = `
          <div class="feed-item-top">
            <div class="feed-person">
              <span class="avatar-sm" aria-hidden="true">${initials(item.name)}</span>
              <span>${escapeHtml(item.name)}</span>
            </div>
            <span class="badge status-leave">${t("leave_" + item.leaveType)}</span>
          </div>
          <div class="feed-meta">
            ${t("leaveMeta", {
              type: t("leave_" + item.leaveType),
              days: item.days,
              date: formatDayOffset(item.startOffset),
            })}
          </div>
          <div class="feed-actions">
            <button type="button" class="btn-feed-reject" data-action="reject" data-id="${item.id}">${t("reject")}</button>
            <button type="button" class="btn-feed-approve" data-action="approve" data-id="${item.id}">${t("approve")}</button>
          </div>
        `;
        el.feedList.appendChild(li);
      });

      // Actions event delegation
      el.feedList.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const action = btn.dataset.action;
          const item = activeItems.find((it) => it.id === id);
          if (!item) return;

          const itemNode = $(`#${id}`);
          if (itemNode) itemNode.classList.add("is-leaving");

          setTimeout(() => {
            if (!state.processed[state.branch]) state.processed[state.branch] = new Set();
            state.processed[state.branch].add(id);

            const msg = action === "approve"
              ? t("approvedToast", { name: item.name })
              : t("rejectedToast", { name: item.name });
            showToast(msg, action === "approve" ? "success" : "info");
            renderFeed();
          }, 300);
        });
      });
    } else {
      // BM Workshop stalls
      el.feedCount.textContent = String(feed.items.length);
      el.notifCount.textContent = String(feed.items.length);
      el.feedCount.hidden = false;
      el.feedEmpty.hidden = true;

      feed.items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "stall-item";
        li.innerHTML = `
          <div class="stall-left">
            <span class="stall-badge">${t("stallLabel", { n: item.stall })}</span>
            <div>
              <div class="stall-plate">${escapeHtml(item.plate)}</div>
              <div class="stall-job">${t("stallMeta", { job: t("job_" + item.job), min: item.minutes })}</div>
            </div>
          </div>
          <span class="badge status-${item.status === 'working' ? 'present' : (item.status === 'waiting' ? 'late' : 'sick')}">
            ${t("stall_" + item.status)}
          </span>
        `;
        el.feedList.appendChild(li);
      });
    }
  }

  function formatRupiah(num) {
    return "Rp " + Number(num).toLocaleString("id-ID");
  }

  // 6. Sub-view Renderers
  function renderAttendanceView() {
    if (!state.data || !state.data.attendanceDetail) return;
    const staff = state.data.attendanceDetail;

    const presentCount = staff.filter((s) => s.status === "present").length;
    const lateCount = staff.filter((s) => s.status === "late").length;
    const leaveCount = staff.filter((s) => s.status === "leave" || s.status === "sick").length;
    const pct = Math.round((presentCount / staff.length) * 100);

    el.attSummaryGrid.innerHTML = `
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("totalStaff")}</span>
          <span class="kpi-icon">${KPI_ICONS.attendance}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${staff.length}</span></div>
        <span class="kpi-hint">${t("kpiHint_attendance")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("status_present")}</span>
          <span class="kpi-icon" style="color:var(--success);">${KPI_ICONS.attendance}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${presentCount}</span><span class="kpi-trend is-good">${pct}%</span></div>
        <span class="kpi-hint">${t("kpi_attendance")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("status_late")}</span>
          <span class="kpi-icon" style="color:var(--warning);">${KPI_ICONS.attendance}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${lateCount}</span></div>
        <span class="kpi-hint">${t("status_late")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("kpi_onLeave")}</span>
          <span class="kpi-icon" style="color:var(--danger);">${KPI_ICONS.onLeave}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${leaveCount}</span></div>
        <span class="kpi-hint">${t("kpiHint_onLeave")}</span>
      </article>
    `;

    const q = (state.attQuery || "").toLowerCase();
    const st = state.attStatus || "all";
    const filtered = staff.filter((s) => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.nip.includes(q) || s.roleTitle.toLowerCase().includes(q);
      const matchSt = st === "all" || s.status === st;
      return matchQ && matchSt;
    });

    el.attTableHead.innerHTML = `
      <tr>
        <th>${t("att_col_nip")}</th>
        <th>${t("att_col_name")}</th>
        <th>${t("att_col_role")}</th>
        <th>${t("att_col_shift")}</th>
        <th>${t("att_col_in")}</th>
        <th>${t("att_col_out")}</th>
        <th>${t("att_col_status")}</th>
        <th>${t("att_col_note")}</th>
      </tr>
    `;

    el.attTableBody.innerHTML = filtered.map((row) => `
      <tr>
        <td><code>${escapeHtml(row.nip)}</code></td>
        <td><strong>${escapeHtml(row.name)}</strong></td>
        <td><span class="tag-role">${escapeHtml(row.roleTitle)}</span></td>
        <td>${t(row.shift)}</td>
        <td><strong>${row.checkIn}</strong></td>
        <td>${row.checkOut}</td>
        <td><span class="badge status-${row.status}">${t("status_" + row.status)}</span></td>
        <td style="color:var(--text-muted); font-size:0.84rem;">${escapeHtml(row.note)}</td>
      </tr>
    `).join("");

    el.attCount.textContent = t("tableCount", { n: filtered.length, t: staff.length });
    el.attEmpty.hidden = filtered.length > 0;
  }

  function renderCommissionView() {
    if (!state.data || !state.data.commissionList) return;
    const comms = state.data.commissionList;

    const totalPool = comms.reduce((sum, c) => sum + c.total, 0);
    const totalSpk = comms.reduce((sum, c) => sum + c.spk, 0);
    const avgPct = Math.round(comms.reduce((sum, c) => sum + c.pct, 0) / comms.length);
    const readyCount = comms.filter((c) => c.status === "payroll_ready").length;

    el.commSummaryGrid.innerHTML = `
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("comm_card_summary")}</span>
          <span class="kpi-icon">${KPI_ICONS.commission}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${formatRupiah(totalPool)}</span></div>
        <span class="kpi-hint">${t("kpiHint_commission")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("kpi_unitsSold")}</span>
          <span class="kpi-icon">${KPI_ICONS.unitsSold}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${totalSpk} SPK</span></div>
        <span class="kpi-hint">${t("kpiHint_unitsSold")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("comm_col_pct")}</span>
          <span class="kpi-icon">${KPI_ICONS.conversion}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${avgPct}%</span></div>
        <span class="kpi-hint">${t("ofTarget")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("payroll_ready")}</span>
          <span class="kpi-icon" style="color:var(--success);">${KPI_ICONS.attendance}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${readyCount} / ${comms.length}</span></div>
        <span class="kpi-hint">${t("comm_col_status")}</span>
      </article>
    `;

    el.commTableHead.innerHTML = `
      <tr>
        <th>${t("comm_col_name")}</th>
        <th>${t("comm_col_target")}</th>
        <th>${t("comm_col_spk")}</th>
        <th>${t("comm_col_pct")}</th>
        <th>${t("comm_col_base")}</th>
        <th>${t("comm_col_bonus")}</th>
        <th>${t("comm_col_total")}</th>
        <th>${t("comm_col_status")}</th>
      </tr>
    `;

    el.commTableBody.innerHTML = comms.map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.name)}</strong></td>
        <td>${row.target} SPK</td>
        <td><strong>${row.spk} SPK</strong></td>
        <td><span class="team-kpi-badge ${row.pct >= 100 ? 'high' : 'mid'}">${row.pct}%</span></td>
        <td>${formatRupiah(row.base)}</td>
        <td>${row.bonus > 0 ? formatRupiah(row.bonus) : "—"}</td>
        <td><strong style="color:var(--accent-primary);">${formatRupiah(row.total)}</strong></td>
        <td><span class="badge-pill badge-${row.status.replace('_', '-')}">${t(row.status)}</span></td>
      </tr>
    `).join("");

    el.commCount.textContent = t("tableCount", { n: comms.length, t: comms.length });
  }

  function renderTeamView() {
    if (!state.data || !state.data.teamDirectory) return;
    const staff = state.data.teamDirectory;

    const q = (state.teamQuery || "").toLowerCase();
    const div = state.teamDivision || "all";
    const filtered = staff.filter((s) => {
      const matchQ = !q || s.name.toLowerCase().includes(q) || s.nip.includes(q) || s.roleTitle.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchDiv = div === "all" || s.division === div;
      return matchQ && matchDiv;
    });

    el.teamGrid.innerHTML = filtered.map((m) => `
      <article class="team-card">
        <div class="team-card-head">
          <div class="team-avatar-wrap">
            <div class="team-avatar">${initials(m.name)}</div>
            <span class="team-status-dot status-${m.status}" title="${t('status_' + m.status)}"></span>
          </div>
          <div class="team-info">
            <h3 class="team-name">${escapeHtml(m.name)}</h3>
            <p class="team-role">${escapeHtml(m.roleTitle)}</p>
          </div>
        </div>
        <div class="team-details">
          <div class="team-detail-row">
            <span>${t("team_col_division")}</span>
            <strong>${t("div_" + m.division)}</strong>
          </div>
          <div class="team-detail-row">
            <span>${t("team_col_email")}</span>
            <span>${escapeHtml(m.email)}</span>
          </div>
          <div class="team-detail-row">
            <span>${t("team_col_ext")}</span>
            <span>Ext. ${escapeHtml(m.ext)}</span>
          </div>
          <div class="team-detail-row">
            <span>${t("team_col_kpi")}</span>
            <span class="team-kpi-badge ${m.kpi >= 85 ? 'high' : 'mid'}">${m.kpi}/100</span>
          </div>
        </div>
        <div class="team-card-actions">
          <button type="button" class="btn btn-outline btn-compact team-contact-btn" data-name="${escapeHtml(m.name)}" data-ext="${escapeHtml(m.ext)}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>${t("team_card_contact")}</span>
          </button>
        </div>
      </article>
    `).join("");

    el.teamEmpty.hidden = filtered.length > 0;

    el.teamGrid.querySelectorAll(".team-contact-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        showToast(t("team_toast_contact", { name: btn.dataset.name, ext: btn.dataset.ext }), "info");
      });
    });
  }

  function renderLeadsView() {
    if (!state.data || !state.data.leadsList) return;
    const leads = state.data.leadsList;

    const stages = ["stage_inquiry", "stage_contacted", "stage_testdrive", "stage_negotiation", "stage_delivered"];
    el.leadsFunnelGrid.innerHTML = stages.map((stg) => {
      const count = leads.filter((l) => l.stage === stg).length;
      return `
        <div class="funnel-card">
          <span class="funnel-count">${count}</span>
          <span class="funnel-label">${t(stg)}</span>
        </div>
      `;
    }).join("");

    const q = (state.leadsQuery || "").toLowerCase();
    const filtered = leads.filter((l) => {
      return !q || l.customer.toLowerCase().includes(q) || l.model.toLowerCase().includes(q) || l.consultant.toLowerCase().includes(q);
    });

    el.leadsTableHead.innerHTML = `
      <tr>
        <th>${t("leads_col_cust")}</th>
        <th>${t("leads_col_model")}</th>
        <th>${t("leads_col_stage")}</th>
        <th>${t("leads_col_consultant")}</th>
        <th>${t("leads_col_date")}</th>
        <th>${t("leads_col_phone")}</th>
      </tr>
    `;

    el.leadsTableBody.innerHTML = filtered.map((l) => `
      <tr>
        <td><strong>${escapeHtml(l.customer)}</strong></td>
        <td>${escapeHtml(l.model)}</td>
        <td><span class="stage-pill ${l.stage}">${t(l.stage)}</span></td>
        <td>${escapeHtml(l.consultant)}</td>
        <td>${escapeHtml(l.date)}</td>
        <td><code>${escapeHtml(l.phone)}</code></td>
      </tr>
    `).join("");

    el.leadsCount.textContent = t("tableCount", { n: filtered.length, t: leads.length });
    el.leadsEmpty.hidden = filtered.length > 0;
  }

  function renderReportsView() {
    if (!state.data || !state.data.branchReport) return;
    const rep = state.data.branchReport;

    el.repKpiGrid.innerHTML = `
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("rep_sales_score")}</span>
          <span class="kpi-icon">${KPI_ICONS.unitsSold}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${rep.spkActual} / ${rep.spkTarget}</span><span class="kpi-trend is-good">${rep.spkPct}%</span></div>
        <span class="kpi-hint">${t("ofTarget")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("rep_service_score")}</span>
          <span class="kpi-icon">${KPI_ICONS.serviceToday}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${rep.serviceActual} unit/hari</span></div>
        <span class="kpi-hint">${t("kpiHint_serviceToday")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("rep_csat_score")}</span>
          <span class="kpi-icon" style="color:#FBBF24;">${KPI_ICONS.csat}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${rep.csat} / 5.0</span><span class="kpi-trend is-good">★ Tinggi</span></div>
        <span class="kpi-hint">${t("kpiHint_csat")}</span>
      </article>
      <article class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-title">${t("rep_parts_score")}</span>
          <span class="kpi-icon">${KPI_ICONS.techUtil}</span>
        </div>
        <div class="kpi-val-row"><span class="kpi-val">${rep.partsTurnover}%</span></div>
        <span class="kpi-hint">${t("rep_parts_score")}</span>
      </article>
    `;

    el.repStatSpk.textContent = `${rep.spkActual} SPK (${rep.spkPct}% ${t("ofTarget")})`;
    el.repStatService.textContent = `${rep.serviceActual} unit/hari`;
    el.repStatCsat.textContent = `${rep.csat} / 5.0 ★`;
    el.repStatParts.textContent = `${rep.partsTurnover}%`;
    el.repStatSop.textContent = `${rep.sopCompliance}%`;

    el.repHighlightsList.innerHTML = rep.highlights.map((h) => `
      <li class="highlight-item">
        <svg class="highlight-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${escapeHtml(h)}</span>
      </li>
    `).join("");
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    el.navButtons.forEach((b) => {
      const match = b.dataset.nav === tabId;
      b.classList.toggle("is-active", match);
      if (match) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    const panels = {
      overview: el.viewOverview,
      attendance: el.viewAttendance,
      commission: el.viewCommission,
      team: el.viewTeam,
      leads: el.viewLeads,
      reports: el.viewReports,
    };

    Object.entries(panels).forEach(([k, p]) => {
      if (p) p.hidden = k !== tabId;
    });

    const titles = {
      overview: t("pageTitle"),
      attendance: t("title_attendance"),
      commission: t("title_commission"),
      team: t("title_team"),
      leads: t("title_leads"),
      reports: t("title_reports"),
    };
    el.pageTitle.textContent = titles[tabId] || t("pageTitle");

    if (state.data) {
      if (tabId === "attendance") renderAttendanceView();
      else if (tabId === "commission") renderCommissionView();
      else if (tabId === "team") renderTeamView();
      else if (tabId === "leads") renderLeadsView();
      else if (tabId === "reports") renderReportsView();
    }
  }

  // 7. Master Render All Cards
  function renderAll(animate = true) {
    if (!state.data) return;

    // Update Titles
    if (state.role === "hrd") {
      el.chartTitle.textContent = t("chartAttendanceTitle");
      el.sideTitle.textContent = t("sideDonutTitle");
      el.tableTitle.textContent = t("tableStaffTitle");
      el.feedTitle.textContent = t("feedLeaveTitle");
    } else {
      el.chartTitle.textContent = t("chartSalesTitle");
      el.sideTitle.textContent = t("sideGaugeTitle");
      el.tableTitle.textContent = t("tableLeaderTitle");
      el.feedTitle.textContent = t("feedStallTitle");
    }

    el.sidebarBranch.textContent = state.data.branchName || "Cabang Utama";
    el.userRole.textContent = t("role_" + state.role);

    renderKpis(animate);
    renderMainChart();
    renderSideCard();
    renderTable();
    renderFeed();

    // Render active sub-view
    if (state.activeTab === "attendance") renderAttendanceView();
    else if (state.activeTab === "commission") renderCommissionView();
    else if (state.activeTab === "team") renderTeamView();
    else if (state.activeTab === "leads") renderLeadsView();
    else if (state.activeTab === "reports") renderReportsView();
  }

  /* ---------- Data Loading Flow ---------- */
  async function loadData() {
    const token = ++state.loadToken;

    // Show skeletons
    el.kpiGrid.innerHTML = `
      <div class="kpi-card"><div class="skeleton-shimmer" style="height:90px;"></div></div>
      <div class="kpi-card"><div class="skeleton-shimmer" style="height:90px;"></div></div>
      <div class="kpi-card"><div class="skeleton-shimmer" style="height:90px;"></div></div>
      <div class="kpi-card"><div class="skeleton-shimmer" style="height:90px;"></div></div>
    `;
    el.chartBody.innerHTML = `<div class="skeleton-shimmer" style="height:250px;"></div>`;
    el.sideBody.innerHTML = `<div class="skeleton-shimmer" style="height:200px;"></div>`;
    el.tableBody.innerHTML = `<tr><td colspan="5"><div class="skeleton-shimmer" style="height:120px;"></div></td></tr>`;
    el.feedList.innerHTML = `<li class="skeleton-shimmer" style="height:80px; margin-bottom:8px;"></li>`;

    await sleep(LATENCY_MS);
    if (token !== state.loadToken) return;

    if (state.forceOffline) {
      renderOfflineError();
      return;
    }

    state.data = Data.getDashboardData(state.role, state.branch);
    renderAll(true);

    const now = new Date();
    const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    el.lastUpdated.textContent = t("updatedAt", { time: timeStr });
  }

  function renderOfflineError() {
    const errorHtml = `
      <div class="empty-box" style="padding:48px 16px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" style="margin-bottom:12px;">
          <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
        <h3 style="margin:0 0 6px; font-size:1.1rem; color:var(--text-primary);">${t("errorTitle")}</h3>
        <p style="margin:0 0 16px; font-size:0.86rem; color:var(--text-muted);">${t("errorText")}</p>
        <button type="button" class="btn btn-primary retry-btn" style="padding:6px 18px; font-size:0.85rem;">
          <span class="btn-label">${t("retry")}</span>
        </button>
      </div>
    `;
    el.chartBody.innerHTML = errorHtml;
    el.sideBody.innerHTML = errorHtml;
    el.tableBody.innerHTML = `<tr><td colspan="5">${errorHtml}</td></tr>`;
    el.feedList.innerHTML = `<li>${errorHtml}</li>`;
    el.kpiGrid.innerHTML = "";
  }

  /* ---------- Event Wiring ---------- */
  function bindEvents() {
    // Theme toggle
    el.themeToggle.addEventListener("click", toggleTheme);

    // Language buttons
    el.langButtons.forEach((btn) => {
      btn.addEventListener("click", () => applyLanguage(btn.dataset.lang, true));
    });

    // Mobile sidebar
    el.menuToggle.addEventListener("click", () => {
      el.sidebar.classList.add("is-open");
      el.sidebarBackdrop.classList.add("is-open");
      el.sidebarClose.focus();
    });

    const closeSidebar = () => {
      el.sidebar.classList.remove("is-open");
      el.sidebarBackdrop.classList.remove("is-open");
    };

    el.sidebarClose.addEventListener("click", closeSidebar);
    el.sidebarBackdrop.addEventListener("click", closeSidebar);

    // Sidebar navigation items
    el.navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const navId = btn.dataset.nav;
        switchTab(navId);
        closeSidebar();
      });
    });

    // Subview 1: Attendance filters & actions
    if (el.attSearch) {
      el.attSearch.addEventListener("input", () => {
        state.attQuery = el.attSearch.value.trim();
        renderAttendanceView();
      });
    }
    if (el.attStatusFilter) {
      el.attStatusFilter.addEventListener("change", () => {
        state.attStatus = el.attStatusFilter.value;
        renderAttendanceView();
      });
    }
    if (el.btnExportAtt) {
      el.btnExportAtt.addEventListener("click", () => {
        showToast(t("att_toast_export"), "success");
      });
    }

    // Subview 2: Commission actions
    if (el.btnSubmitPayroll) {
      el.btnSubmitPayroll.addEventListener("click", () => {
        showToast(t("comm_toast_payroll"), "success");
      });
    }

    // Subview 3: Team Directory filters
    if (el.teamSearch) {
      el.teamSearch.addEventListener("input", () => {
        state.teamQuery = el.teamSearch.value.trim();
        renderTeamView();
      });
    }
    if (el.teamDivisionFilter) {
      el.teamDivisionFilter.addEventListener("change", () => {
        state.teamDivision = el.teamDivisionFilter.value;
        renderTeamView();
      });
    }

    // Subview 4: Leads Pipeline filters & actions
    if (el.leadsSearch) {
      el.leadsSearch.addEventListener("input", () => {
        state.leadsQuery = el.leadsSearch.value.trim();
        renderLeadsView();
      });
    }
    if (el.btnAddLead) {
      el.btnAddLead.addEventListener("click", () => {
        showToast(t("leads_toast_add"), "info");
      });
    }

    // Subview 5: Branch Reports actions
    if (el.btnDownloadPdf) {
      el.btnDownloadPdf.addEventListener("click", () => {
        const branchName = (state.data && state.data.branchName) || "Dealer";
        showToast(t("rep_toast_pdf", { branch: branchName }), "success");
      });
    }
    if (el.btnDownloadExcel) {
      el.btnDownloadExcel.addEventListener("click", () => {
        const branchName = (state.data && state.data.branchName) || "Dealer";
        showToast(t("rep_toast_excel", { branch: branchName }), "success");
      });
    }

    // User menu dropdown
    el.userMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !el.userMenu.hidden;
      el.userMenu.hidden = isOpen;
      el.userMenuBtn.setAttribute("aria-expanded", String(!isOpen));
    });

    document.addEventListener("click", (e) => {
      if (!el.userMenu.hidden && !el.userMenu.contains(e.target) && !el.userMenuBtn.contains(e.target)) {
        el.userMenu.hidden = true;
        el.userMenuBtn.setAttribute("aria-expanded", "false");
      }
    });

    // Logout
    el.logoutBtn.addEventListener("click", () => {
      Session.clear();
      showToast(t("logoutToast"), "info");
      setTimeout(() => {
        window.location.replace("index.html");
      }, 700);
    });

    // Branch and role selection
    el.branchSelect.addEventListener("change", () => {
      state.branch = el.branchSelect.value;
      Session.update({ branch: state.branch });
      loadData();
    });

    el.roleSelect.addEventListener("change", () => {
      state.role = el.roleSelect.value;
      Session.update({ role: state.role });
      state.sort = { key: null, dir: "desc" };
      state.query = "";
      el.tableSearch.value = "";
      state.hiddenSeries.clear();
      loadData();
    });

    // Range buttons for line chart (7 / 30 days)
    el.rangeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        el.rangeButtons.forEach((b) => {
          b.classList.remove("is-active");
          b.removeAttribute("aria-pressed");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        state.range = Number(btn.dataset.range);
        renderMainChart();
      });
    });

    // Table search & filter
    el.tableSearch.addEventListener("input", () => {
      state.query = el.tableSearch.value.trim();
      renderTable();
    });

    el.divisionFilter.addEventListener("change", () => {
      state.division = el.divisionFilter.value;
      renderTable();
    });

    // Offline retry delegation
    document.addEventListener("click", (e) => {
      const retryBtn = e.target.closest(".retry-btn");
      if (retryBtn) {
        state.forceOffline = false;
        loadData();
      }
    });

    // Keyboard support
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!el.userMenu.hidden) {
          el.userMenu.hidden = true;
          el.userMenuBtn.setAttribute("aria-expanded", "false");
          el.userMenuBtn.focus();
        } else if (el.sidebar.classList.contains("is-open")) {
          closeSidebar();
          el.menuToggle.focus();
        }
      }
    });
  }

  /* ---------- Initialization ---------- */
  function init() {
    // Sync state with session & inputs
    el.userName.textContent = state.user;
    el.userAvatar.textContent = initials(state.user);
    el.branchSelect.value = state.branch;
    el.roleSelect.value = state.role;

    // Theme initialization
    const savedTheme = storage.get(STORAGE.theme) || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    applyTheme(savedTheme, false);

    // Language initialization
    const savedLang = storage.get(STORAGE.lang) || ((navigator.language || "id").toLowerCase().startsWith("id") ? "id" : "en");
    applyLanguage(savedLang, false);

    bindEvents();
    loadData();
    setInterval(updateWelcome, 60000);
  }

  init();
})();
