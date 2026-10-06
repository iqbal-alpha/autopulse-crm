/* ==========================================================================
   AutoPulse CRM — Login page logic (frontend-only demo)
   - Theme switcher (dark/light) with persistence
   - Bilingual UI (Indonesian / English)
   - Mock pre-auth "Live Dealer Pulse" feed (aggregated, zero PII)
   - Login form validation, demo account, lockout, HR help modal
   Add ?offline=1 to the URL to preview the graceful fallback state.
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- Constants ---------- */
  const STORAGE = {
    theme: "autopulse-theme",
    lang: "autopulse-lang",
    branch: "autopulse-branch",
    identifier: "autopulse-identifier",
  };

  const DEMO_ACCOUNT = {
    nip: "10230045",
    email: "rina.kartika@autopulse.id",
    password: "demo123",
    name: "Rina Kartika",
    role: { id: "HRD & People Ops", en: "HR & People Ops" },
  };

  const MAX_ATTEMPTS = 5;
  const LOCK_SECONDS = 30;
  const REFRESH_MS = 60000;
  const LOGIN_LATENCY_MS = 1100;
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52;
  const SALES_TARGET = 10;
  const FORCE_OFFLINE = new URLSearchParams(window.location.search).get("offline") === "1";
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DASHBOARD_URL = "dashboard.html";
  const REDIRECT_MS = 1600;

  /* ---------- Dictionary ---------- */
  const I18N = {
    id: {
      themeToggle: "Ganti tema terang/gelap",
      greetingMorning: "Selamat Pagi",
      greetingAfternoon: "Selamat Siang",
      greetingEvening: "Selamat Sore",
      greetingNight: "Selamat Malam",
      greetingSuffix: "Rekan AutoPulse",
      loginTitle: "Masuk ke AutoPulse CRM",
      loginSubtitle: "Kinerja andal, pelayanan unggul. Kelola prospek, servis, dan tim dealer Anda dalam satu tempat.",
      labelIdentifier: "NIP atau Email Perusahaan",
      phIdentifier: "contoh: 10230045 atau nama@autopulse.id",
      labelPassword: "Kata Sandi",
      phPassword: "Masukkan kata sandi",
      showPassword: "Tampilkan kata sandi",
      hidePassword: "Sembunyikan kata sandi",
      labelBranch: "Cabang Dealer",
      rememberMe: "Ingat saya",
      forgotPassword: "Lupa kata sandi?",
      signIn: "Masuk Sistem",
      orSignInWith: "atau masuk dengan",
      ssoButton: "Akun Perusahaan (SSO)",
      demoTitle: "Akun demo:",
      demoPassword: "sandi",
      demoFill: "Isi otomatis",
      needHelp: "Butuh bantuan akun?",
      contactHr: "Hubungi HRD Support",
      footerNote: "Demo frontend untuk portofolio",
      pulseTitle: "Denyut Operasional Cabang",
      attendanceTitle: "Kehadiran Staf Hari Ini",
      present: "hadir",
      roleSales: "Sales Consultant",
      roleTech: "Teknisi Bengkel",
      roleSa: "Service Advisor",
      activityTitle: "Prospek & Test Drive",
      today: "Hari ini",
      newLeads: "Prospek baru",
      testDrives: "Test drive terjadwal",
      trendVsYesterday: "{n}% vs kemarin",
      spkToday: "{n} SPK hari ini",
      sparkCaption: "Prospek masuk per jam (08:00 – sekarang)",
      leaderboardTitle: "Top Sales Bulan Ini",
      targetChip: "Target {n} SPK / bulan",
      spkUnit: "SPK",
      ofTarget: "dari target",
      hrInfo: "Info HRD",
      updatedAt: "Diperbarui {time} WIB · refresh tiap 60 detik",
      privacyNote: "Data agregat — tanpa data pribadi pelanggan",
      fallbackNote: "Statistik sementara tidak tersedia",
      fallbackTitle: "Kinerja andal, pelayanan unggul.",
      fallbackText: "Anda tetap dapat masuk seperti biasa. Data Live Dealer Pulse akan tampil kembali secara otomatis.",
      shiftMorning: "Shift Pagi Aktif",
      shiftAfternoon: "Shift Sore Aktif",
      shiftOff: "Di Luar Jam Operasional",
      close: "Tutup",
      hrModalTitle: "Bantuan Akun HRD",
      hrModalText: "Akun terkunci, lupa NIP, atau belum terdaftar? Tim People Operations siap membantu pada jam kerja (08:00 – 17:00).",
      internalExt: "Telepon internal",
      successTitle: "Login berhasil",
      successRole: "{role} · Cabang {branch}",
      successNote: "Mengalihkan Anda ke dashboard…",
      openDashboard: "Buka Dashboard",
      errExpired: "Sesi Anda telah berakhir. Silakan masuk kembali.",
      errIdRequired: "NIP atau email wajib diisi.",
      errIdFormat: "Gunakan NIP 6–12 digit atau email perusahaan yang valid.",
      errPwdRequired: "Kata sandi wajib diisi.",
      errPwdShort: "Kata sandi minimal 6 karakter.",
      errInvalid: "NIP/email atau kata sandi salah. Sisa percobaan: {n}.",
      errLocked: "Terlalu banyak percobaan gagal. Akun dikunci sementara — coba lagi dalam {n} detik atau hubungi HRD.",
      toastSso: "Login SSO tidak tersedia di mode demo.",
      toastForgot: "Tautan reset kata sandi akan dikirim ke email terdaftar (demo).",
      toastDemoFilled: "Akun demo telah diisi. Klik “Masuk Sistem”.",
      announcements: [
        "Briefing pagi seluruh tim showroom pukul 08:30 di ruang meeting lantai 2.",
        "Batas pengajuan klaim lembur bulan Oktober: Jumat, 25 Oktober 2026.",
        "Selamat kepada Andi S. — Sales Consultant terbaik kuartal III!",
        "Pelatihan product knowledge model SUV terbaru: Sabtu, 09:00 – 12:00.",
        "Ingat: lakukan absensi masuk dalam radius dealer sebelum pukul 08:15.",
      ],
    },
    en: {
      themeToggle: "Toggle light/dark theme",
      greetingMorning: "Good Morning",
      greetingAfternoon: "Good Afternoon",
      greetingEvening: "Good Evening",
      greetingNight: "Good Evening",
      greetingSuffix: "AutoPulse Team",
      loginTitle: "Sign in to AutoPulse CRM",
      loginSubtitle: "Reliable performance, outstanding service. Manage leads, service, and your dealership team in one place.",
      labelIdentifier: "Employee ID or Work Email",
      phIdentifier: "e.g. 10230045 or name@autopulse.id",
      labelPassword: "Password",
      phPassword: "Enter your password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      labelBranch: "Dealer Branch",
      rememberMe: "Remember me",
      forgotPassword: "Forgot password?",
      signIn: "Sign In",
      orSignInWith: "or continue with",
      ssoButton: "Corporate Account (SSO)",
      demoTitle: "Demo account:",
      demoPassword: "password",
      demoFill: "Autofill",
      needHelp: "Need help with your account?",
      contactHr: "Contact HR Support",
      footerNote: "Frontend demo for portfolio",
      pulseTitle: "Branch Operations Pulse",
      attendanceTitle: "Today's Staff Attendance",
      present: "present",
      roleSales: "Sales Consultants",
      roleTech: "Workshop Technicians",
      roleSa: "Service Advisors",
      activityTitle: "Leads & Test Drives",
      today: "Today",
      newLeads: "New leads",
      testDrives: "Scheduled test drives",
      trendVsYesterday: "{n}% vs yesterday",
      spkToday: "{n} vehicle orders today",
      sparkCaption: "Incoming leads per hour (08:00 – now)",
      leaderboardTitle: "Top Sales This Month",
      targetChip: "Target {n} orders / month",
      spkUnit: "orders",
      ofTarget: "of target",
      hrInfo: "HR Notice",
      updatedAt: "Updated {time} WIB · refreshes every 60s",
      privacyNote: "Aggregated data — no customer personal data",
      fallbackNote: "Statistics temporarily unavailable",
      fallbackTitle: "Reliable performance, outstanding service.",
      fallbackText: "You can still sign in as usual. Live Dealer Pulse data will reappear automatically.",
      shiftMorning: "Morning Shift Active",
      shiftAfternoon: "Afternoon Shift Active",
      shiftOff: "Outside Operating Hours",
      close: "Close",
      hrModalTitle: "HR Account Support",
      hrModalText: "Account locked, forgot your Employee ID, or not registered yet? The People Operations team is available during office hours (08:00 – 17:00).",
      internalExt: "Internal phone",
      successTitle: "Signed in successfully",
      successRole: "{role} · {branch} branch",
      successNote: "Taking you to your dashboard…",
      openDashboard: "Open Dashboard",
      errExpired: "Your session has ended. Please sign in again.",
      errIdRequired: "Employee ID or email is required.",
      errIdFormat: "Use a 6–12 digit Employee ID or a valid work email.",
      errPwdRequired: "Password is required.",
      errPwdShort: "Password must be at least 6 characters.",
      errInvalid: "Incorrect Employee ID/email or password. Attempts left: {n}.",
      errLocked: "Too many failed attempts. Account temporarily locked — try again in {n} seconds or contact HR.",
      toastSso: "SSO sign-in is not available in demo mode.",
      toastForgot: "A password reset link would be sent to your registered email (demo).",
      toastDemoFilled: "Demo account filled in. Click “Sign In”.",
      announcements: [
        "Morning briefing for all showroom staff at 08:30 in the 2nd floor meeting room.",
        "October overtime claim deadline: Friday, 25 October 2026.",
        "Congratulations to Andi S. — top Sales Consultant of Q3!",
        "New SUV product knowledge training: Saturday, 09:00 – 12:00.",
        "Reminder: clock in within the dealership radius before 08:15.",
      ],
    },
  };

  /* ---------- Mock dealer data (aggregated, zero PII) ---------- */
  const BRANCHES = {
    jkt: {
      name: "Jakarta Pusat — Gunung Sahari",
      staff: { sales: [18, 19], tech: [12, 12], sa: [6, 7] },
      leads: 32, leadsTrend: 12, testDrives: 8, spk: 3,
      hourly: [2, 4, 5, 3, 6, 4, 5, 3],
      leaders: [["Andi S.", 14], ["Maya R.", 11], ["Budi T.", 9]],
    },
    bsd: {
      name: "Tangerang — BSD City",
      staff: { sales: [15, 16], tech: [10, 11], sa: [5, 5] },
      leads: 27, leadsTrend: 8, testDrives: 6, spk: 2,
      hourly: [1, 3, 4, 4, 5, 3, 4, 3],
      leaders: [["Clara W.", 13], ["Reza P.", 12], ["Dimas A.", 10]],
    },
    bdg: {
      name: "Bandung — Soekarno Hatta",
      staff: { sales: [12, 14], tech: [9, 10], sa: [4, 4] },
      leads: 19, leadsTrend: 5, testDrives: 5, spk: 2,
      hourly: [1, 2, 3, 2, 4, 3, 2, 2],
      leaders: [["Sinta L.", 12], ["Fajar N.", 9], ["Galih P.", 8]],
    },
    sby: {
      name: "Surabaya — Ahmad Yani",
      staff: { sales: [16, 17], tech: [13, 14], sa: [6, 6] },
      leads: 29, leadsTrend: 15, testDrives: 7, spk: 4,
      hourly: [2, 3, 5, 4, 5, 4, 3, 3],
      leaders: [["Yusuf H.", 15], ["Dewi K.", 12], ["Hendra W.", 10]],
    },
    mdn: {
      name: "Medan — Gatot Subroto",
      staff: { sales: [11, 12], tech: [8, 9], sa: [4, 5] },
      leads: 16, leadsTrend: 3, testDrives: 4, spk: 1,
      hourly: [1, 2, 2, 3, 2, 2, 3, 1],
      leaders: [["Rizky M.", 11], ["Tania S.", 9], ["Bayu R.", 7]],
    },
  };

  const AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #06B6D4, #3B82F6)",
    "linear-gradient(135deg, #8B5CF6, #EC4899)",
    "linear-gradient(135deg, #10B981, #0EA5E9)",
  ];

  /* ---------- DOM refs ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    html: document.documentElement,
    metaTheme: document.querySelector('meta[name="theme-color"]'),
    themeToggle: $("#theme-toggle"),
    langButtons: $$(".lang-btn"),
    greeting: $("#greeting-text"),
    form: $("#login-form"),
    identifier: $("#nip-email"),
    password: $("#password"),
    togglePwd: $("#toggle-pwd"),
    branch: $("#branch-select"),
    remember: $("#remember-me"),
    forgot: $("#forgot-link"),
    alert: $("#form-alert"),
    alertText: $("#form-alert-text"),
    btnLogin: $("#btn-login"),
    btnSso: $("#btn-sso"),
    btnDemo: $("#btn-demo-fill"),
    hrLink: $("#hr-support-link"),
    hrModal: $("#hr-modal"),
    successModal: $("#success-modal"),
    successName: $("#success-name"),
    successRole: $("#success-role"),
    btnOpenDashboard: $("#btn-open-dashboard"),
    toast: $("#toast"),
    pulseContent: $("#pulse-content"),
    pulseFallback: $("#pulse-fallback"),
    pulseBranch: $("#pulse-branch"),
    clock: $("#dealer-clock"),
    shift: $("#shift-status"),
    attendanceValue: $("#attendance-value"),
    gaugeFill: $("#gauge-fill"),
    breakdown: $("#attendance-breakdown"),
    leadsValue: $("#leads-value"),
    leadsTrend: $("#leads-trend"),
    testDriveValue: $("#testdrive-value"),
    spkToday: $("#spk-today"),
    sparkline: $("#leads-sparkline"),
    leaderboard: $("#leaderboard-list"),
    leaderboardTarget: $("#leaderboard-target"),
    ticker: $("#ticker-track"),
    updated: $("#pulse-updated"),
  };

  /* ---------- State ---------- */
  const state = {
    lang: "id",
    attempts: 0,
    lockUntil: 0,
    lockTimer: null,
    loggingIn: false,
    errors: { identifier: null, password: null },
    alert: null, // { key, params, warning }
    pulse: null,
    pulseUpdatedAt: null,
    pulseRequest: 0,
    liveBump: {},
    refreshTimer: null,
    toastTimer: null,
    lastFocus: null,
    openModal: null,
    redirectTimer: null,
  };

  /* ---------- Helpers ---------- */
  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    },
  };

  function t(key, params) {
    const dict = I18N[state.lang] || I18N.id;
    let str = dict[key] !== undefined ? dict[key] : I18N.id[key];
    if (typeof str !== "string") return str;
    if (params) {
      Object.keys(params).forEach((p) => {
        str = str.replace(`{${p}}`, params[p]);
      });
    }
    return str;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pad = (n) => String(n).padStart(2, "0");

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /** Current time parts in dealership timezone (WIB / Asia/Jakarta). */
  function jakartaTime() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const get = (type) => Number(parts.find((p) => p.type === type).value) % 24;
    return { h: get("hour"), m: get("minute"), s: get("second") };
  }

  function formatNumber(value, decimals) {
    return value.toLocaleString(state.lang === "id" ? "id-ID" : "en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /** Smoothly count a number element from its previous value to `to`. */
  function animateNumber(node, to, { decimals = 0, suffix = "", duration = 1200, animate = true } = {}) {
    const from = Number(node.dataset.value || 0);
    node.dataset.value = String(to);
    if (!animate || REDUCED_MOTION || from === to) {
      node.textContent = formatNumber(to, decimals) + suffix;
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = formatNumber(from + (to - from) * eased, decimals) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function showToast(key) {
    el.toast.textContent = t(key);
    el.toast.classList.add("is-visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 3200);
  }

  /* ---------- Theme ---------- */
  function applyTheme(theme, persist) {
    el.html.setAttribute("data-theme", theme);
    if (el.metaTheme) el.metaTheme.setAttribute("content", theme === "light" ? "#F8FAFC" : "#0A0E17");
    if (persist) storage.set(STORAGE.theme, theme);
  }

  function toggleTheme() {
    const next = el.html.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next, true);
  }

  /* ---------- Language ---------- */
  function applyLanguage(lang, persist) {
    state.lang = I18N[lang] ? lang : "id";
    el.html.lang = state.lang;
    if (persist) storage.set(STORAGE.lang, state.lang);

    $$("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
    $$("[data-i18n-aria]").forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAria)); });

    el.langButtons.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.lang === state.lang)));

    updatePwdToggleLabel();
    updateGreeting();
    updateClock();
    renderTicker();
    renderFormMessages();
    if (state.pulse) renderPulse(state.pulse, false);
    if (state.openModal === el.successModal) renderSuccess();
  }

  function updateGreeting() {
    const hour = new Date().getHours();
    let key = "greetingNight";
    if (hour >= 4 && hour < 11) key = "greetingMorning";
    else if (hour >= 11 && hour < 15) key = "greetingAfternoon";
    else if (hour >= 15 && hour < 18) key = "greetingEvening";
    el.greeting.textContent = t(key);
  }

  /* ---------- Clock & shift ---------- */
  function updateClock() {
    const { h, m, s } = jakartaTime();
    el.clock.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    let shiftKey = "shiftOff";
    if (h >= 7 && h < 15) shiftKey = "shiftMorning";
    else if (h >= 15 && h < 21) shiftKey = "shiftAfternoon";
    el.shift.textContent = t(shiftKey);
    el.shift.classList.toggle("is-off", shiftKey === "shiftOff");
  }

  /* ---------- Live Dealer Pulse (mock pre-auth endpoint) ---------- */
  /**
   * Simulates GET /api/v1/public/dealer-pulse?branch=<code>.
   * Returns aggregated counts only — never customer PII.
   */
  function fetchDealerPulse(branchCode) {
    return new Promise((resolve, reject) => {
      const latency = 650 + Math.random() * 450;
      setTimeout(() => {
        if (FORCE_OFFLINE) {
          reject(new Error("Dealer pulse feed unavailable"));
          return;
        }
        const base = BRANCHES[branchCode] || BRANCHES.jkt;
        const bump = state.liveBump[branchCode] || 0;
        const hourly = base.hourly.slice();
        hourly[hourly.length - 1] += bump;
        resolve({ ...base, leads: base.leads + bump, hourly });
      }, latency);
    });
  }

  async function loadPulse({ showSkeleton = true } = {}) {
    const branchCode = el.branch.value;
    const requestId = ++state.pulseRequest;
    el.pulseBranch.textContent = (BRANCHES[branchCode] || BRANCHES.jkt).name;
    if (showSkeleton) {
      el.pulseContent.classList.add("is-loading");
      el.pulseContent.setAttribute("aria-busy", "true");
    }
    let data = null;
    try {
      data = await fetchDealerPulse(branchCode);
    } catch (err) {
      data = null;
    }
    if (requestId !== state.pulseRequest) return; // a newer request superseded this one

    if (data) {
      state.pulse = data;
      state.pulseUpdatedAt = jakartaTime();
      el.pulseFallback.hidden = true;
      el.pulseContent.hidden = false;
      renderPulse(data, true);
    } else {
      // Graceful degradation: the login form keeps working, stats panel shows a static hero.
      el.pulseContent.hidden = true;
      el.pulseFallback.hidden = false;
    }
    el.pulseContent.classList.remove("is-loading");
    el.pulseContent.setAttribute("aria-busy", "false");
  }

  function renderPulse(data, animate) {
    // Attendance
    const roles = [
      ["roleSales", data.staff.sales],
      ["roleTech", data.staff.tech],
      ["roleSa", data.staff.sa],
    ];
    const present = roles.reduce((sum, [, v]) => sum + v[0], 0);
    const total = roles.reduce((sum, [, v]) => sum + v[1], 0);
    const pct = Math.round((present / total) * 1000) / 10;

    animateNumber(el.attendanceValue, pct, { decimals: 1, suffix: "%", animate });
    el.gaugeFill.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE * (1 - pct / 100));

    el.breakdown.innerHTML = roles.map(([key, [on, all]]) => `
      <li class="breakdown-row">
        <div class="breakdown-top"><span>${escapeHtml(t(key))}</span><strong>${on}/${all}</strong></div>
        <div class="bar"><div class="bar-fill" data-width="${(on / all) * 100}"></div></div>
      </li>`).join("");

    // Activity
    animateNumber(el.leadsValue, data.leads, { animate });
    animateNumber(el.testDriveValue, data.testDrives, { animate });
    el.leadsTrend.textContent = `▲ ${t("trendVsYesterday", { n: data.leadsTrend })}`;
    el.spkToday.textContent = `✓ ${t("spkToday", { n: data.spk })}`;

    const maxHourly = Math.max(...data.hourly);
    el.sparkline.innerHTML = data.hourly.map((v, i) =>
      `<span class="spark-bar${i === data.hourly.length - 1 ? " is-now" : ""}" data-height="${(v / maxHourly) * 100}" title="${v}"></span>`
    ).join("");

    // Leaderboard
    el.leaderboardTarget.textContent = t("targetChip", { n: SALES_TARGET });
    el.leaderboard.innerHTML = data.leaders.map(([name, spk], i) => {
      const pctTarget = Math.round((spk / SALES_TARGET) * 100);
      const initials = name.replace(/[^A-Za-z ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2);
      const over = pctTarget >= 100;
      return `
        <li class="leader-row">
          <span class="rank rank-${i + 1}">${i + 1}</span>
          <span class="avatar" style="background:${AVATAR_GRADIENTS[i]}" aria-hidden="true">${escapeHtml(initials)}</span>
          <div class="leader-info">
            <div class="leader-name">${escapeHtml(name)}</div>
            <div class="bar leader-bar"><div class="bar-fill${over ? " is-over" : ""}" data-width="${Math.min(pctTarget, 100)}"></div></div>
          </div>
          <div class="leader-score">
            <strong>${spk} <small>${escapeHtml(t("spkUnit"))}</small></strong>
            <span class="badge-target${over ? "" : " is-under"}">${pctTarget}% ${escapeHtml(t("ofTarget"))}</span>
          </div>
        </li>`;
    }).join("");

    if (state.pulseUpdatedAt) {
      const u = state.pulseUpdatedAt;
      el.updated.textContent = t("updatedAt", { time: `${pad(u.h)}:${pad(u.m)}` });
    }

    // Grow bars after paint so CSS transitions run (instant when re-rendering on language change).
    const grow = () => {
      $$("#pulse-content .bar-fill").forEach((bar) => { bar.style.width = `${bar.dataset.width}%`; });
      $$("#leads-sparkline .spark-bar").forEach((bar) => { bar.style.height = `${Math.max(bar.dataset.height, 8)}%`; });
    };
    if (animate) requestAnimationFrame(() => requestAnimationFrame(grow));
    else {
      $$("#pulse-content .bar-fill, #leads-sparkline .spark-bar").forEach((n) => { n.style.transition = "none"; });
      grow();
      requestAnimationFrame(() => {
        $$("#pulse-content .bar-fill, #leads-sparkline .spark-bar").forEach((n) => { n.style.transition = ""; });
      });
    }
  }

  function renderTicker() {
    const items = t("announcements").map((msg) => `<span>${escapeHtml(msg)}</span>`).join("");
    // Duplicated content makes the CSS marquee loop seamlessly.
    el.ticker.innerHTML = items + items;
  }

  function scheduleRefresh() {
    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
      const code = el.branch.value;
      state.liveBump[code] = (state.liveBump[code] || 0) + Math.floor(Math.random() * 3);
      loadPulse({ showSkeleton: false });
    }, REFRESH_MS);
  }

  /* ---------- Form: validation & messages ---------- */
  const NIP_PATTERN = /^\d{6,12}$/;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validate() {
    const id = el.identifier.value.trim();
    const pwd = el.password.value;
    state.errors.identifier = !id ? "errIdRequired" : (!NIP_PATTERN.test(id) && !EMAIL_PATTERN.test(id) ? "errIdFormat" : null);
    state.errors.password = !pwd ? "errPwdRequired" : (pwd.length < 6 ? "errPwdShort" : null);
    renderFormMessages();
    return !state.errors.identifier && !state.errors.password;
  }

  function renderFormMessages() {
    [["identifier", el.identifier, "#field-identifier", "#nip-email-error"],
      ["password", el.password, "#field-password", "#password-error"]].forEach(([name, input, fieldSel, errSel]) => {
      const key = state.errors[name];
      $(fieldSel).classList.toggle("has-error", Boolean(key));
      input.setAttribute("aria-invalid", String(Boolean(key)));
      $(errSel).textContent = key ? t(key) : "";
    });

    if (state.alert) {
      el.alertText.textContent = t(state.alert.key, state.alert.params);
      el.alert.classList.toggle("is-warning", Boolean(state.alert.warning));
      el.alert.hidden = false;
    } else {
      el.alert.hidden = true;
    }
  }

  function setAlert(alert) {
    state.alert = alert;
    // Restart the shake animation for repeated errors.
    el.alert.style.animation = "none";
    void el.alert.offsetWidth;
    el.alert.style.animation = "";
    renderFormMessages();
  }

  function setLoading(isLoading) {
    state.loggingIn = isLoading;
    el.btnLogin.classList.toggle("is-loading", isLoading);
    el.btnLogin.disabled = isLoading || isLocked();
    el.btnLogin.setAttribute("aria-busy", String(isLoading));
  }

  /* ---------- Lockout ---------- */
  const isLocked = () => Date.now() < state.lockUntil;

  function startLock() {
    state.lockUntil = Date.now() + LOCK_SECONDS * 1000;
    el.btnLogin.disabled = true;
    const tick = () => {
      const remaining = Math.ceil((state.lockUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(state.lockTimer);
        state.attempts = 0;
        state.lockUntil = 0;
        el.btnLogin.disabled = false;
        setAlert(null);
        return;
      }
      state.alert = { key: "errLocked", params: { n: remaining }, warning: true };
      renderFormMessages();
    };
    setAlert({ key: "errLocked", params: { n: LOCK_SECONDS }, warning: true });
    clearInterval(state.lockTimer);
    state.lockTimer = setInterval(tick, 1000);
  }

  /* ---------- Login flow (mock authentication) ---------- */
  function credentialsMatch(identifier, password) {
    const id = identifier.trim().toLowerCase();
    return (id === DEMO_ACCOUNT.nip || id === DEMO_ACCOUNT.email) && password === DEMO_ACCOUNT.password;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.loggingIn || isLocked()) return;

    if (!validate()) {
      (state.errors.identifier ? el.identifier : el.password).focus();
      return;
    }

    setAlert(null);
    setLoading(true);
    await sleep(LOGIN_LATENCY_MS);
    const ok = credentialsMatch(el.identifier.value, el.password.value);
    setLoading(false);

    if (ok) {
      state.attempts = 0;
      if (el.remember.checked) storage.set(STORAGE.identifier, el.identifier.value.trim());
      else storage.remove(STORAGE.identifier);
      if (window.AutoPulseSession) {
        window.AutoPulseSession.save({ name: DEMO_ACCOUNT.name, role: "hrd", branch: el.branch.value });
      }
      openModal(el.successModal);
      renderSuccess();
      state.redirectTimer = setTimeout(goToDashboard, REDIRECT_MS);
      return;
    }

    state.attempts += 1;
    if (state.attempts >= MAX_ATTEMPTS) {
      startLock();
    } else {
      setAlert({ key: "errInvalid", params: { n: MAX_ATTEMPTS - state.attempts } });
      el.password.select();
    }
  }

  function renderSuccess() {
    const branchName = (BRANCHES[el.branch.value] || BRANCHES.jkt).name.split(" — ")[0];
    el.successName.textContent = DEMO_ACCOUNT.name;
    el.successRole.textContent = t("successRole", { role: DEMO_ACCOUNT.role[state.lang], branch: branchName });
  }

  /* ---------- Password visibility ---------- */
  function updatePwdToggleLabel() {
    const visible = el.password.type === "text";
    el.togglePwd.setAttribute("aria-label", t(visible ? "hidePassword" : "showPassword"));
    el.togglePwd.setAttribute("aria-pressed", String(visible));
    el.togglePwd.querySelector(".icon-eye").hidden = visible;
    el.togglePwd.querySelector(".icon-eye-off").hidden = !visible;
  }

  /* ---------- Modals ---------- */
  function focusableIn(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])'));
  }

  function openModal(modal) {
    state.lastFocus = document.activeElement;
    state.openModal = modal;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const items = focusableIn(modal);
    const preferred = items.find((n) => !n.classList.contains("modal-close")) || items[0];
    if (preferred) preferred.focus();
  }

  function closeModal() {
    const modal = state.openModal;
    if (!modal) return;
    modal.hidden = true;
    state.openModal = null;
    document.body.style.overflow = "";
    if (state.lastFocus && typeof state.lastFocus.focus === "function") state.lastFocus.focus();
  }

  function handleKeydown(event) {
    if (!state.openModal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (state.openModal === el.successModal) goToDashboard();
      else closeModal();
      return;
    }
    if (event.key === "Tab") {
      const items = focusableIn(state.openModal);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function goToDashboard() {
    clearTimeout(state.redirectTimer);
    window.location.href = DASHBOARD_URL;
  }

  /* ---------- Event wiring ---------- */
  function bindEvents() {
    el.themeToggle.addEventListener("click", toggleTheme);
    el.langButtons.forEach((btn) => btn.addEventListener("click", () => applyLanguage(btn.dataset.lang, true)));

    el.form.addEventListener("submit", handleSubmit);

    [["identifier", el.identifier], ["password", el.password]].forEach(([name, input]) => {
      input.addEventListener("input", () => {
        if (state.errors[name]) {
          state.errors[name] = null;
          renderFormMessages();
        }
      });
    });

    el.togglePwd.addEventListener("click", () => {
      el.password.type = el.password.type === "password" ? "text" : "password";
      updatePwdToggleLabel();
      el.password.focus();
    });

    el.branch.addEventListener("change", () => {
      storage.set(STORAGE.branch, el.branch.value);
      loadPulse();
    });

    el.remember.addEventListener("change", () => {
      if (!el.remember.checked) storage.remove(STORAGE.identifier);
    });

    el.btnDemo.addEventListener("click", () => {
      el.identifier.value = DEMO_ACCOUNT.nip;
      el.password.value = DEMO_ACCOUNT.password;
      state.errors.identifier = null;
      state.errors.password = null;
      renderFormMessages();
      showToast("toastDemoFilled");
      el.btnLogin.focus();
    });

    el.btnSso.addEventListener("click", () => showToast("toastSso"));
    el.forgot.addEventListener("click", () => showToast("toastForgot"));
    el.hrLink.addEventListener("click", () => openModal(el.hrModal));
    $$("[data-close-modal]").forEach((node) => node.addEventListener("click", closeModal));
    el.btnOpenDashboard.addEventListener("click", goToDashboard);
    document.addEventListener("keydown", handleKeydown);

    // Follow OS theme changes only while the user has not chosen a theme explicitly.
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
      if (!storage.get(STORAGE.theme)) applyTheme(e.matches ? "light" : "dark", false);
    });
  }

  /* ---------- Init ---------- */
  function init() {
    const savedBranch = storage.get(STORAGE.branch);
    if (savedBranch && BRANCHES[savedBranch]) el.branch.value = savedBranch;

    const savedIdentifier = storage.get(STORAGE.identifier);
    if (savedIdentifier) {
      el.identifier.value = savedIdentifier;
      el.remember.checked = true;
    }

    const savedLang = storage.get(STORAGE.lang);
    const browserLang = (navigator.language || "id").toLowerCase().startsWith("id") ? "id" : "en";
    applyLanguage(savedLang || browserLang, false);

    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      setAlert({ key: "errExpired", warning: true });
      params.delete("expired");
      const query = params.toString();
      history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
    }

    bindEvents();
    setInterval(updateClock, 1000);
    setInterval(updateGreeting, 60000);
    loadPulse();
    scheduleRefresh();
  }

  init();
})();
