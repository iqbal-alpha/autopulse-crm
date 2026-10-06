/* AutoPulse CRM — deterministic mock data for the dashboard (zero real PII).
   UMD: browser global `AutoPulseData` + CommonJS for Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AutoPulseData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BRANCH_KEYS = ["jkt", "bsd", "bdg", "sby", "mdn"];
  const ROLES = ["hrd", "bm"];
  const DIVISIONS = ["sales", "tech", "sa"];
  const SALES_TARGET = 10;
  const COMMISSION_PER_SPK_M = 1.5;

  // Mirrors app.js BRANCHES (headcount = second number of each staff pair; same top-3 leaders).
  const BRANCH_PROFILE = {
    jkt: { name: "Jakarta Pusat — Gunung Sahari", plate: "B", scale: 1.0, headcount: { sales: 19, tech: 12, sa: 7 }, leaders: [["Andi S.", 14], ["Maya R.", 11], ["Budi T.", 9]] },
    bsd: { name: "Tangerang — BSD City", plate: "B", scale: 0.88, headcount: { sales: 16, tech: 11, sa: 5 }, leaders: [["Clara W.", 13], ["Reza P.", 12], ["Dimas A.", 10]] },
    bdg: { name: "Bandung — Soekarno Hatta", plate: "D", scale: 0.72, headcount: { sales: 14, tech: 10, sa: 4 }, leaders: [["Sinta L.", 12], ["Fajar N.", 9], ["Galih P.", 8]] },
    sby: { name: "Surabaya — Ahmad Yani", plate: "L", scale: 0.95, headcount: { sales: 17, tech: 14, sa: 6 }, leaders: [["Yusuf H.", 15], ["Dewi K.", 12], ["Hendra W.", 10]] },
    mdn: { name: "Medan — Gatot Subroto", plate: "BK", scale: 0.64, headcount: { sales: 12, tech: 9, sa: 5 }, leaders: [["Rizky M.", 11], ["Tania S.", 9], ["Bayu R.", 7]] },
  };

  const FIRST_NAMES = ["Agus", "Bella", "Citra", "Dani", "Eka", "Fitri", "Gilang", "Hana", "Irfan", "Joko", "Kartika", "Lukman", "Mega", "Nanda", "Oki", "Putri", "Rangga", "Salsa", "Teguh", "Umar", "Vina", "Wahyu", "Yogi", "Zahra"];
  const LAST_INITIALS = "ABDFGHKLMNPRSTW".split("");
  const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ".split("");
  const JOBS = ["service10k", "brake", "ac", "tire", "oil"];

  /* ---------- Seeded RNG ---------- */
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createRng(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const round = (v, d = 0) => { const f = 10 ** d; return Math.round(v * f) / f; };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const between = (rng, min, max) => min + rng() * (max - min);
  const intBetween = (rng, min, max) => Math.floor(between(rng, min, max + 1));
  const pick = (rng, list) => list[Math.floor(rng() * list.length)];
  const pad2 = (n) => String(n).padStart(2, "0");
  const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  /** Random walk of `length` points ending exactly at `end`. */
  function walkTo(rng, length, end, spread, min, max, decimals) {
    const out = new Array(length);
    out[length - 1] = end;
    for (let i = length - 2; i >= 0; i -= 1) {
      out[i] = round(clamp(out[i + 1] + between(rng, -spread, spread), min, max), decimals);
    }
    return out;
  }

  function kpi(rng, id, value, format, decimals, goodWhenUp, spread, min, max) {
    const spark = walkTo(rng, 7, value, spread, min, max, decimals);
    return { id, value, format, decimals, goodWhenUp, trend: round(value - spark[5], decimals), spark };
  }

  /* ---------- Shared building blocks ---------- */
  function buildStaff(branch, rng) {
    const profile = BRANCH_PROFILE[branch];
    const rows = [];
    let n = 0;
    DIVISIONS.forEach((division) => {
      for (let i = 0; i < profile.headcount[division]; i += 1) {
        n += 1;
        const leader = division === "sales" ? profile.leaders[i] : null;
        const name = leader ? leader[0] : `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_INITIALS)}.`;
        const roll = rng();
        const status = leader ? "present" : roll < 0.8 ? "present" : roll < 0.89 ? "late" : roll < 0.96 ? "leave" : "sick";
        let checkIn = null;
        if (status === "present") checkIn = `07:${pad2(intBetween(rng, 30, 59))}`;
        if (status === "late") checkIn = `08:${pad2(intBetween(rng, 16, 45))}`;
        const score = leader ? intBetween(rng, 90, 98) : intBetween(rng, 62, 95);
        rows.push({ id: `${branch}-${pad2(n)}`, name, division, status, checkIn, kpi: score });
      }
    });
    return rows;
  }

  function buildSales(branch, rng, staff) {
    const profile = BRANCH_PROFILE[branch];
    const maxOthers = Math.min(8, profile.leaders[2][1] - 1);
    return staff
      .filter((r) => r.division === "sales")
      .map((r, i) => ({
        id: r.id,
        name: r.name,
        spk: profile.leaders[i] ? profile.leaders[i][1] : intBetween(rng, 2, maxOthers),
        target: SALES_TARGET,
        activeLeads: intBetween(rng, 4, 16),
      }))
      .sort((a, b) => b.spk - a.spk);
  }

  /* ---------- Role views ---------- */
  function buildHrd(branch, rng, staff, sales) {
    const count = (s) => staff.filter((r) => r.status === s).length;
    const seg = { present: count("present"), late: count("late"), leave: count("leave"), sick: count("sick") };
    const total = staff.length;
    const attendance = round(((seg.present + seg.late) / total) * 100, 1);
    const units = sales.reduce((sum, r) => sum + r.spk, 0);

    const kpis = [
      kpi(rng, "attendance", attendance, "percent", 1, true, 2.2, 75, 100),
      kpi(rng, "onLeave", seg.leave + seg.sick, "count", 0, false, 1.4, 0, total),
      kpi(rng, "techUtil", round(between(rng, 78, 93), 1), "percent", 1, true, 2.5, 60, 100),
      kpi(rng, "commission", round(units * COMMISSION_PER_SPK_M, 1), "currencyM", 1, true, 6, 0, 1000),
    ];

    const series = DIVISIONS.map((id) => ({
      id,
      values: walkTo(rng, 30, round(between(rng, 88, 97), 1), 2.6, 78, 100, 1),
    }));

    const candidates = staff.filter((r) => r.status === "present" || r.status === "late");
    const feed = range(1, 4).map((i) => {
      const person = candidates[Math.floor(rng() * candidates.length)];
      return {
        id: `leave-${branch}-${i}`,
        name: person.name,
        division: person.division,
        leaveType: pick(rng, ["annual", "sick", "permit"]),
        startOffset: intBetween(rng, 1, 10),
        days: intBetween(rng, 1, 3),
      };
    });

    return {
      kpis,
      chart: { type: "line", labels: range(-29, 0), series },
      side: { type: "donut", segments: Object.keys(seg).map((id) => ({ id, value: seg[id] })) },
      table: { type: "staff", rows: staff },
      feed: { type: "leave", items: feed },
    };
  }

  function buildBm(branch, rng, staff, sales) {
    const profile = BRANCH_PROFILE[branch];
    const units = sales.reduce((sum, r) => sum + r.spk, 0);
    const target = sales.length * SALES_TARGET;
    const leads = Math.round(units / between(rng, 0.17, 0.25));

    const kpis = [
      kpi(rng, "unitsSold", units, "count", 0, true, 4, 0, 1000),
      kpi(rng, "serviceToday", Math.round(profile.scale * between(rng, 34, 44)), "count", 0, true, 4, 0, 200),
      kpi(rng, "conversion", round((units / leads) * 100, 1), "percent", 1, true, 1.6, 1, 100),
      kpi(rng, "csat", round(between(rng, 4.4, 4.8), 1), "rating", 1, true, 0.1, 3.5, 5),
    ];

    const weeklyTarget = Math.round(target / 4);
    const chartSeries = [
      { id: "actual", values: range(1, 8).map(() => Math.round(weeklyTarget * between(rng, 0.7, 1.25))) },
      { id: "target", values: range(1, 8).map(() => weeklyTarget) },
    ];

    const stallCount = clamp(Math.floor(profile.headcount.tech / 2), 3, 6);
    const feed = range(1, stallCount).map((i) => {
      const roll = rng();
      const status = roll < 0.5 ? "working" : roll < 0.8 ? "waiting" : "overdue";
      return {
        id: `stall-${branch}-${i}`,
        stall: i,
        plate: `${profile.plate} ${intBetween(rng, 1000, 9999)} ${pick(rng, LETTERS)}${pick(rng, LETTERS)}`,
        job: pick(rng, JOBS),
        status,
        minutes: status === "working" ? intBetween(rng, 10, 90) : status === "waiting" ? intBetween(rng, 5, 40) : intBetween(rng, 5, 35),
      };
    });

    return {
      kpis,
      chart: { type: "bar", labels: range(-7, 0), series: chartSeries },
      side: { type: "gauge", value: units, target },
      table: { type: "leaderboard", rows: sales },
      feed: { type: "stall", items: feed },
    };
  }

  function getDashboardData(role, branch) {
    const r = ROLES.includes(role) ? role : "hrd";
    const b = BRANCH_PROFILE[branch] ? branch : "jkt";
    const rng = createRng(hashString(`autopulse:${b}`));
    const staff = buildStaff(b, rng);
    const sales = buildSales(b, rng, staff);
    // Role-specific RNG stream so both roles share identical staff/sales data.
    const roleRng = createRng(hashString(`autopulse:${b}:${r}`));
    const base = { role: r, branch: b, branchName: BRANCH_PROFILE[b].name, headcount: staff.length };
    return Object.assign(base, r === "hrd" ? buildHrd(b, roleRng, staff, sales) : buildBm(b, roleRng, staff, sales));
  }

  return { BRANCH_KEYS, ROLES, DIVISIONS, BRANCH_PROFILE, getDashboardData, createRng, hashString };
});
