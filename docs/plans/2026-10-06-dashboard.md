# AutoPulse CRM — Dashboard (HRD + Branch Manager) Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Add a post-login Overview dashboard (`dashboard.html`) with HRD and Branch Manager views, switchable branch/role, dual theme, bilingual UI, and hand-built SVG charts, connected to the existing login through a demo session.

**Architecture:** Three small UMD modules (`session.js`, `dashboard-data.js`, `dashboard-i18n.js`) hold all logic that can be unit-tested in Node. `dashboard.js` is a browser-only IIFE that wires DOM, renders SVG charts and handles interactions. `dashboard.css` adds dashboard layout on top of the existing `styles.css` tokens, scoped under `body.page-dashboard`. Login (`app.js`, `index.html`) gets a minimal change: save session → redirect.

**Tech Stack:** HTML5, Vanilla CSS (custom properties, grid), Vanilla JS ES2020, inline SVG, Node 24 built-in test runner (`node --test`, no dependencies).

**Design source:** [2026-10-06-dashboard-design.md](./2026-10-06-dashboard-design.md)

**Environment notes:**
- `git` is NOT installed → "Commit" steps are replaced by "Checkpoint: update `docs/plans/task.md`".
- `grep_search` tool is unreliable in this workspace → use `Select-String` in PowerShell.
- Run all commands from the project root `c:\Users\ASUS\Documents\Antigravity\coba2`.

---

## Conventions (apply to all tasks)

- **Branch keys:** `jkt`, `bsd`, `bdg`, `sby`, `mdn` (must match `app.js` `BRANCHES`).
- **Role keys:** `hrd`, `bm`.
- **Storage:** theme `autopulse-theme`, lang `autopulse-lang` (localStorage, shared with login); session `autopulse-session` (sessionStorage).
- **Dynamic i18n key prefixes** (enforced by tests in Task 8):
  `kpi_<kpiId>`, `kpiHint_<kpiId>`, `div_<division>`, `status_<status>`, `leave_<leaveType>`, `stall_<stallStatus>`, `job_<job>`, `series_<seriesId>`, `nav_<navId>`.
- Every interactive element has a unique `id` or a `data-*` hook used by JS.

---

### Task 1: Test harness + `session.js`

**Files:**
- Create: `tests/session.test.js`
- Create: `session.js`

**Step 1: Write the failing test** — `tests/session.test.js`

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Session = require("../session.js");

function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    raw: map,
  };
}
const NOW = 1790000000000;
const DEMO = { name: "Rina Kartika", role: "hrd", branch: "jkt" };

test("save then read returns the same session", () => {
  const store = memoryStore();
  const saved = Session.save(DEMO, store, NOW);
  assert.deepEqual(saved, { ...DEMO, loginAt: NOW });
  assert.deepEqual(Session.read(store, NOW + 1000), saved);
});

test("read returns null when nothing is stored", () => {
  assert.equal(Session.read(memoryStore(), NOW), null);
});

test("read returns null for malformed JSON", () => {
  const store = memoryStore();
  store.setItem(Session.KEY, "{not json");
  assert.equal(Session.read(store, NOW), null);
});

test("read rejects an unknown role", () => {
  const store = memoryStore();
  store.setItem(Session.KEY, JSON.stringify({ ...DEMO, role: "admin", loginAt: NOW }));
  assert.equal(Session.read(store, NOW), null);
});

test("read rejects sessions older than MAX_AGE_MS", () => {
  const store = memoryStore();
  Session.save(DEMO, store, NOW);
  assert.equal(Session.read(store, NOW + Session.MAX_AGE_MS + 1), null);
});

test("save throws for invalid input", () => {
  assert.throws(() => Session.save({ ...DEMO, role: "x" }, memoryStore(), NOW));
  assert.throws(() => Session.save({ ...DEMO, name: "" }, memoryStore(), NOW));
});

test("update patches role/branch and keeps loginAt", () => {
  const store = memoryStore();
  Session.save(DEMO, store, NOW);
  const next = Session.update({ role: "bm", branch: "sby", name: "Hacker" }, store, NOW + 5);
  assert.deepEqual(next, { ...DEMO, role: "bm", branch: "sby", loginAt: NOW });
  assert.deepEqual(Session.read(store, NOW + 10), next);
});

test("update returns null without a session and ignores invalid patches", () => {
  const store = memoryStore();
  assert.equal(Session.update({ role: "bm" }, store, NOW), null);
  Session.save(DEMO, store, NOW);
  assert.deepEqual(Session.update({ role: "admin" }, store, NOW), { ...DEMO, loginAt: NOW });
});

test("clear removes the session", () => {
  const store = memoryStore();
  Session.save(DEMO, store, NOW);
  Session.clear(store);
  assert.equal(Session.read(store, NOW), null);
});

test("a throwing store never throws to the caller", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(Session.read(broken, NOW), null);
  assert.doesNotThrow(() => Session.save(DEMO, broken, NOW));
  assert.doesNotThrow(() => Session.clear(broken));
});
```

**Step 2: Run test to verify it fails**

Run: `node --test "tests/*.test.js"`
Expected: FAIL — `Cannot find module '../session.js'`.

**Step 3: Write minimal implementation** — `session.js`

```js
/* AutoPulse CRM — demo session (sessionStorage). UMD: browser global `AutoPulseSession` + CommonJS. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AutoPulseSession = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const KEY = "autopulse-session";
  const ROLES = ["hrd", "bm"];
  const MAX_AGE_MS = 12 * 60 * 60 * 1000;

  function defaultStore() {
    try { return window.sessionStorage; } catch (e) { return null; }
  }

  function isValid(s, now) {
    return Boolean(s) &&
      typeof s.name === "string" && s.name.length > 0 &&
      ROLES.includes(s.role) &&
      typeof s.branch === "string" && s.branch.length > 0 &&
      typeof s.loginAt === "number" &&
      now - s.loginAt >= 0 && now - s.loginAt < MAX_AGE_MS;
  }

  function write(session, store) {
    try { if (store) store.setItem(KEY, JSON.stringify(session)); } catch (e) { /* storage blocked */ }
  }

  function save(data, store = defaultStore(), now = Date.now()) {
    const session = { name: data.name, role: data.role, branch: data.branch, loginAt: now };
    if (!isValid(session, now)) throw new Error("Invalid session data");
    write(session, store);
    return session;
  }

  function read(store = defaultStore(), now = Date.now()) {
    let raw = null;
    try { raw = store ? store.getItem(KEY) : null; } catch (e) { return null; }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return isValid(parsed, now) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function update(patch, store = defaultStore(), now = Date.now()) {
    const current = read(store, now);
    if (!current) return null;
    const next = { ...current };
    if (patch && ROLES.includes(patch.role)) next.role = patch.role;
    if (patch && typeof patch.branch === "string" && patch.branch) next.branch = patch.branch;
    write(next, store);
    return next;
  }

  function clear(store = defaultStore()) {
    try { if (store) store.removeItem(KEY); } catch (e) { /* storage blocked */ }
  }

  return { KEY, ROLES, MAX_AGE_MS, save, read, update, clear };
});
```

**Step 4: Run test to verify it passes**

Run: `node --test "tests/*.test.js"`
Expected: PASS — 10 tests, 0 failures.

**Step 5: Checkpoint** — mark Task 1 complete in `docs/plans/task.md`.

---

### Task 2: Seeded mock data `dashboard-data.js`

**Files:**
- Create: `tests/dashboard-data.test.js`
- Create: `dashboard-data.js`

**Data contract** (returned by `getDashboardData(role, branch)`):

```
common: { role, branch, branchName, headcount }
kpis: [{ id, value, format: "percent"|"count"|"currencyM"|"rating", decimals, goodWhenUp, trend, spark[7] }]  // spark[6] === value

HRD
  kpis ids: attendance, onLeave, techUtil, commission
  chart:  { type: "line", labels: [-29..0] (day offsets), series: [{ id: "sales"|"tech"|"sa", values[30] (0..100) }] }
  side:   { type: "donut", segments: [{ id: "present"|"late"|"leave"|"sick", value }] }   // sum === headcount
  table:  { type: "staff", rows: [{ id, name, division, status, checkIn|null, kpi (0..100) }] }
  feed:   { type: "leave", items: [{ id, name, division, leaveType: "annual"|"sick"|"permit", startOffset (1..10), days (1..3) }] } // 4 items

BM
  kpis ids: unitsSold, serviceToday, conversion, csat
  chart:  { type: "bar", labels: [-7..0] (week offsets), series: [{ id: "actual", values[8] }, { id: "target", values[8] }] }
  side:   { type: "gauge", value, target }                       // value === unitsSold
  table:  { type: "leaderboard", rows: [{ id, name, spk, target, activeLeads }] }  // sorted desc by spk
  feed:   { type: "stall", items: [{ id, stall, plate, job: "service10k"|"brake"|"ac"|"tire"|"oil", status: "working"|"waiting"|"overdue", minutes }] } // 3..6 items
```

**Step 1: Write the failing test** — `tests/dashboard-data.test.js`

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Data = require("../dashboard-data.js");

const HEADCOUNT = { jkt: 38, bsd: 32, bdg: 28, sby: 37, mdn: 26 };
const LEADERS = { jkt: ["Andi S.", "Maya R.", "Budi T."], mdn: ["Rizky M.", "Tania S.", "Bayu R."] };
const round1 = (v) => Math.round(v * 10) / 10;

test("exports branch and role keys", () => {
  assert.deepEqual(Data.BRANCH_KEYS, ["jkt", "bsd", "bdg", "sby", "mdn"]);
  assert.deepEqual(Data.ROLES, ["hrd", "bm"]);
});

test("is deterministic for the same role and branch", () => {
  assert.deepEqual(Data.getDashboardData("hrd", "jkt"), Data.getDashboardData("hrd", "jkt"));
  assert.deepEqual(Data.getDashboardData("bm", "sby"), Data.getDashboardData("bm", "sby"));
});

test("different branches produce different data", () => {
  assert.notDeepEqual(Data.getDashboardData("hrd", "jkt"), Data.getDashboardData("hrd", "bsd"));
});

test("unknown role/branch falls back to hrd/jkt", () => {
  assert.deepEqual(Data.getDashboardData("nope", "zzz"), Data.getDashboardData("hrd", "jkt"));
});

test("every KPI has a 7-point spark ending at its value and a numeric trend", () => {
  for (const role of Data.ROLES) {
    for (const branch of Data.BRANCH_KEYS) {
      const { kpis } = Data.getDashboardData(role, branch);
      assert.equal(kpis.length, 4);
      for (const k of kpis) {
        assert.equal(k.spark.length, 7, `${role}/${branch}/${k.id}`);
        assert.equal(k.spark[6], k.value);
        assert.equal(typeof k.trend, "number");
        assert.ok(["percent", "count", "currencyM", "rating"].includes(k.format));
      }
    }
  }
});

test("HRD view is internally consistent", () => {
  for (const branch of Data.BRANCH_KEYS) {
    const d = Data.getDashboardData("hrd", branch);
    assert.deepEqual(d.kpis.map((k) => k.id), ["attendance", "onLeave", "techUtil", "commission"]);
    assert.equal(d.headcount, HEADCOUNT[branch]);
    assert.equal(d.table.type, "staff");
    assert.equal(d.table.rows.length, HEADCOUNT[branch]);
    assert.equal(new Set(d.table.rows.map((r) => r.id)).size, d.table.rows.length, "unique row ids");

    const seg = Object.fromEntries(d.side.segments.map((s) => [s.id, s.value]));
    assert.deepEqual(Object.keys(seg), ["present", "late", "leave", "sick"]);
    assert.equal(seg.present + seg.late + seg.leave + seg.sick, HEADCOUNT[branch]);
    for (const status of Object.keys(seg)) {
      assert.equal(d.table.rows.filter((r) => r.status === status).length, seg[status]);
    }

    const kpi = Object.fromEntries(d.kpis.map((k) => [k.id, k.value]));
    assert.equal(kpi.attendance, round1(((seg.present + seg.late) / HEADCOUNT[branch]) * 100));
    assert.equal(kpi.onLeave, seg.leave + seg.sick);

    assert.equal(d.chart.type, "line");
    assert.equal(d.chart.labels.length, 30);
    assert.deepEqual(d.chart.series.map((s) => s.id), ["sales", "tech", "sa"]);
    for (const s of d.chart.series) {
      assert.equal(s.values.length, 30);
      assert.ok(s.values.every((v) => v >= 0 && v <= 100));
    }

    for (const r of d.table.rows) {
      assert.ok(["sales", "tech", "sa"].includes(r.division));
      assert.ok(r.kpi >= 0 && r.kpi <= 100);
      if (r.status === "leave" || r.status === "sick") assert.equal(r.checkIn, null);
      else assert.match(r.checkIn, /^\d{2}:\d{2}$/);
    }

    assert.equal(d.feed.type, "leave");
    assert.equal(d.feed.items.length, 4);
    for (const item of d.feed.items) {
      assert.ok(["annual", "sick", "permit"].includes(item.leaveType));
      assert.ok(item.days >= 1 && item.days <= 3);
      assert.ok(item.startOffset >= 1 && item.startOffset <= 10);
    }
  }
});

test("BM view is internally consistent", () => {
  for (const branch of Data.BRANCH_KEYS) {
    const d = Data.getDashboardData("bm", branch);
    assert.deepEqual(d.kpis.map((k) => k.id), ["unitsSold", "serviceToday", "conversion", "csat"]);
    const kpi = Object.fromEntries(d.kpis.map((k) => [k.id, k.value]));

    assert.equal(d.table.type, "leaderboard");
    const spks = d.table.rows.map((r) => r.spk);
    assert.deepEqual(spks, [...spks].sort((a, b) => b - a), "sorted by SPK desc");
    assert.equal(spks.reduce((a, b) => a + b, 0), kpi.unitsSold);

    assert.equal(d.side.type, "gauge");
    assert.equal(d.side.value, kpi.unitsSold);
    assert.ok(d.side.target > 0);

    assert.ok(kpi.conversion > 0 && kpi.conversion <= 100);
    assert.ok(kpi.csat >= 1 && kpi.csat <= 5);

    assert.equal(d.chart.type, "bar");
    assert.equal(d.chart.labels.length, 8);
    assert.deepEqual(d.chart.series.map((s) => s.id), ["actual", "target"]);

    assert.equal(d.feed.type, "stall");
    assert.ok(d.feed.items.length >= 3 && d.feed.items.length <= 6);
    for (const item of d.feed.items) {
      assert.ok(["working", "waiting", "overdue"].includes(item.status));
      assert.ok(["service10k", "brake", "ac", "tire", "oil"].includes(item.job));
    }
  }
});

test("BM leaderboard top 3 matches the login page leaders", () => {
  for (const branch of Object.keys(LEADERS)) {
    const top = Data.getDashboardData("bm", branch).table.rows.slice(0, 3).map((r) => r.name);
    assert.deepEqual(top, LEADERS[branch]);
  }
});

test("HRD commission equals BM units sold x 1.5 (juta rupiah)", () => {
  for (const branch of Data.BRANCH_KEYS) {
    const hrd = Data.getDashboardData("hrd", branch).kpis.find((k) => k.id === "commission").value;
    const units = Data.getDashboardData("bm", branch).kpis.find((k) => k.id === "unitsSold").value;
    assert.equal(hrd, round1(units * 1.5));
  }
});
```

**Step 2: Run test to verify it fails**

Run: `node --test "tests/*.test.js"`
Expected: FAIL — `Cannot find module '../dashboard-data.js'` (session tests still pass).

**Step 3: Write minimal implementation** — `dashboard-data.js`

```js
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
```

**Step 4: Run test to verify it passes**

Run: `node --test "tests/*.test.js"`
Expected: PASS — all session + data tests green.

**Step 5: Checkpoint** — mark Task 2 complete in `docs/plans/task.md`.

---

### Task 3: Dashboard dictionary `dashboard-i18n.js`

**Files:**
- Create: `dashboard-i18n.js`
- Test: covered by `tests/integrity.test.js` (Task 8) + parity check below

**Step 1: Write the failing test** — append to a new file `tests/i18n.test.js`

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const I18N = require("../dashboard-i18n.js");
const Data = require("../dashboard-data.js");

test("ID and EN have identical keys", () => {
  assert.deepEqual(Object.keys(I18N.en).sort(), Object.keys(I18N.id).sort());
});

test("no empty strings", () => {
  for (const lang of ["id", "en"]) {
    for (const [k, v] of Object.entries(I18N[lang])) assert.ok(typeof v === "string" && v.length > 0, `${lang}.${k}`);
  }
});

test("every dynamic key derived from data exists", () => {
  const needed = new Set();
  for (const role of Data.ROLES) {
    const d = Data.getDashboardData(role, "jkt");
    d.kpis.forEach((k) => { needed.add(`kpi_${k.id}`); needed.add(`kpiHint_${k.id}`); });
    d.chart.series.forEach((s) => needed.add(`series_${s.id}`));
    if (d.side.type === "donut") d.side.segments.forEach((s) => needed.add(`status_${s.id}`));
    if (d.feed.type === "stall") ["working", "waiting", "overdue"].forEach((s) => needed.add(`stall_${s}`));
  }
  Data.DIVISIONS.forEach((v) => needed.add(`div_${v}`));
  ["annual", "sick", "permit"].forEach((v) => needed.add(`leave_${v}`));
  ["service10k", "brake", "ac", "tire", "oil"].forEach((v) => needed.add(`job_${v}`));
  ["overview", "attendance", "commission", "team", "leads", "reports"].forEach((v) => needed.add(`nav_${v}`));
  for (const key of needed) assert.ok(key in I18N.id, `missing key: ${key}`);
});
```

**Step 2: Run** `node --test "tests/*.test.js"` → Expected: FAIL — `Cannot find module '../dashboard-i18n.js'`.

**Step 3: Implement** `dashboard-i18n.js` with the same UMD wrapper (global `AutoPulseDashI18n`), exporting `{ id: {...}, en: {...} }`. Required key groups (ID / EN):

| Group | Keys |
| :--- | :--- |
| Shell | `skipToContent`, `brandSub`, `menuOpen`, `menuClose`, `navLabel`, `comingSoon`, `toastComingSoon` (`"{name} segera hadir."`), `themeToggle`, `notifications`, `userMenu`, `logout`, `logoutToast` |
| Topbar | `pageTitle`, `welcome` (`"{greeting}, {name}"`), `greetingMorning/Afternoon/Evening/Night`, `labelBranch`, `labelRole`, `role_hrd`, `role_bm`, `todayLabel` |
| Nav | `nav_overview`, `nav_attendance`, `nav_commission`, `nav_team`, `nav_leads`, `nav_reports` |
| KPIs | `kpi_*` and `kpiHint_*` for all 8 KPI ids; `vsYesterday`, `unitMillion` (`"jt"` / `"M"`), `ratingOutOf` (`"/5"`) |
| Charts | `chartAttendanceTitle`, `chartSalesTitle`, `range7`, `range30`, `series_sales/tech/sa/actual/target`, `chartSummaryLine`, `chartSummaryBar`, `weekLabel` (`"Mg {n}"` / `"Wk {n}"`), `thisWeek` |
| Side | `sideDonutTitle`, `sideGaugeTitle`, `status_present/late/leave/sick`, `totalStaff`, `ofTarget`, `unitsOf` (`"{v} dari {t} unit"`) |
| Table | `tableStaffTitle`, `tableLeaderTitle`, `searchPlaceholder`, `filterDivision`, `allDivisions`, `div_sales/tech/sa`, `colName`, `colDivision`, `colCheckIn`, `colStatus`, `colKpi`, `colRank`, `colSpk`, `colTarget`, `colLeads`, `tableEmpty`, `tableCount` (`"{n} dari {t} staf"`) , `sortBy` |
| Feed | `feedLeaveTitle`, `feedStallTitle`, `leave_annual/sick/permit`, `leaveMeta` (`"{type} · {days} hari · mulai {date}"`), `approve`, `reject`, `approvedToast`, `rejectedToast`, `feedEmpty`, `stall_working/waiting/overdue`, `stallMeta`, `job_service10k/brake/ac/tire/oil`, `stallLabel` (`"Stall {n}"`) |
| States | `loading`, `errorTitle`, `errorText`, `retry`, `updatedAt` (`"Diperbarui {time} WIB"`), `demoNote` |

**Step 4: Run** `node --test "tests/*.test.js"` → Expected: PASS.

**Step 5: Checkpoint** — update `docs/plans/task.md`.

---

### Task 4: Login integration (`index.html`, `app.js`)

**Files:**
- Modify: `index.html:299-306`
- Modify: `app.js` (I18N id ~L96-105, I18N en ~L174-183, constants ~L28-35, `state` ~L291, `handleSubmit` ~L671-677, `handleKeydown` ~L732, `backToLogin` ~L751-757, `bindEvents` ~L804, `init` ~L814-833, `el` ~L269)

**Step 1: `index.html`**
- Line 299: keep `data-i18n="successNote"` (text changes via dictionary).
- Line 300: replace button with
  `<button type="button" id="btn-open-dashboard" class="btn btn-primary"><span class="btn-label" data-i18n="openDashboard">Buka Dashboard</span></button>`
- Before `<script src="app.js">` add `<script src="session.js"></script>`.

**Step 2: `app.js` edits**
1. I18N `id`: `successNote: "Mengalihkan Anda ke dashboard…"`, replace `backToLogin` with `openDashboard: "Buka Dashboard"`, add `errExpired: "Sesi Anda telah berakhir. Silakan masuk kembali."`.
2. I18N `en`: `successNote: "Taking you to your dashboard…"`, `openDashboard: "Open Dashboard"`, `errExpired: "Your session has ended. Please sign in again."`.
3. Constants: `const DASHBOARD_URL = "dashboard.html";` and `const REDIRECT_MS = 1600;`.
4. `el.btnBack` → `btnOpenDashboard: $("#btn-open-dashboard")`; `state.redirectTimer: null`.
5. Replace `backToLogin()` with:
   ```js
   function goToDashboard() {
     clearTimeout(state.redirectTimer);
     window.location.href = DASHBOARD_URL;
   }
   ```
6. In `handleSubmit` success branch, before `openModal(el.successModal)`:
   ```js
   if (window.AutoPulseSession) {
     window.AutoPulseSession.save({ name: DEMO_ACCOUNT.name, role: "hrd", branch: el.branch.value });
   }
   ```
   and after `renderSuccess();`: `state.redirectTimer = setTimeout(goToDashboard, REDIRECT_MS);`
7. `handleKeydown`: Escape on success modal → `goToDashboard()`.
8. `bindEvents`: `el.btnOpenDashboard.addEventListener("click", goToDashboard);`
9. `init`, after `applyLanguage(...)`:
   ```js
   const params = new URLSearchParams(window.location.search);
   if (params.get("expired") === "1") {
     setAlert({ key: "errExpired", warning: true });
     params.delete("expired");
     const query = params.toString();
     history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
   }
   ```

**Step 3: Verify**

Run: `node --check app.js; node --test "tests/*.test.js"`
Expected: no syntax error; tests still pass.
Run: `Select-String -Path app.js,index.html -Pattern 'btnBack|btn-back|backToLogin'`
Expected: no output.

**Step 4: Checkpoint** — update `docs/plans/task.md`.

---

### Task 5: `dashboard.html` shell

**Files:**
- Create: `dashboard.html`

**Head (in this order):** charset, viewport, `<title>Dashboard — AutoPulse CRM</title>`, meta description, `theme-color`, `<meta name="robots" content="noindex">`, the same pre-paint theme/lang inline script as `index.html:10-22`, `<script src="session.js"></script>`, inline guard:
```html
<script>
  if (!window.AutoPulseSession || !AutoPulseSession.read()) location.replace("index.html?expired=1");
</script>
```
then Google Fonts (same URL as `index.html:25`), `styles.css`, `dashboard.css`.

**Body:** `<body class="page-dashboard">`, scripts at end: `dashboard-data.js`, `dashboard-i18n.js`, `dashboard.js`.

**Required IDs (contract for `dashboard.js` and the integrity test):**

| Region | IDs / hooks |
| :--- | :--- |
| Skip link | `#skip-link` → `href="#main-content"` |
| Sidebar | `<aside id="sidebar">`, `#sidebar-close`, `<nav id="side-nav">` with `<button class="nav-item" data-nav="overview|attendance|commission|team|leads|reports">` (overview `aria-current="page"`, others contain `<span class="soon-badge" data-i18n="comingSoon">`), `#sidebar-backdrop`, sidebar footer `#sidebar-branch` |
| Topbar | `<header class="dash-topbar">`, `#menu-toggle`, `<h1 id="page-title">`, `#welcome-text`, `#today-text`, `<select id="branch-select">` (5 options, values = branch keys), `<select id="role-select">` (`hrd`, `bm`), `.lang-toggle` with `#lang-id`/`#lang-en` (`.lang-btn`, same markup as `index.html:41-44`), `#theme-toggle` (same SVG markup as `index.html:45-48`), `#notif-btn` + `#notif-count`, `#user-menu-btn` (`aria-haspopup="menu"`, `aria-expanded`), `#user-avatar`, `#user-menu` (`role="menu"`, hidden) containing `#user-name`, `#user-role`, `#logout-btn` (`role="menuitem"`) |
| Main | `<main id="main-content" tabindex="-1">` |
| KPI row | `<section id="kpi-grid" aria-label=…>` (cards rendered by JS) |
| Chart card | `#chart-card`, `<h2 id="chart-title">`, `#range-group` with `.range-btn[data-range="7"]`, `.range-btn[data-range="30"]`, `#chart-legend`, `#chart-body`, `#chart-tooltip` (`role="status"`), `#chart-sr` (`.sr-only` table holder) |
| Side card | `#side-card`, `<h2 id="side-title">`, `#side-body`, `#side-legend` |
| Table card | `#table-card`, `<h2 id="table-title">`, `#table-search` (`type="search"`), `#division-filter` (select: all/sales/tech/sa), `#data-table` (with `<thead id="table-head">` and `<tbody id="table-body">`), `#table-empty`, `#table-count` |
| Feed card | `#feed-card`, `<h2 id="feed-title">`, `#feed-count`, `<ul id="feed-list">`, `#feed-empty` |
| Footer | `#last-updated`, `data-i18n="demoNote"` |
| Toasts | `<div id="toast-region" class="toast-region" aria-live="polite" aria-atomic="false">` |

All static text uses `data-i18n`, `data-i18n-aria`, or `data-i18n-placeholder` with keys from Task 3.

**Verify:** open file in editor; integrity test in Task 8 will enforce IDs/keys.

**Checkpoint** — update `docs/plans/task.md`.

---

### Task 6: `dashboard.css`

**Files:**
- Create: `dashboard.css`

**Scope everything under `.page-dashboard`. Reuse tokens from `styles.css` (`--bg-*`, `--text-*`, `--accent-*`, `--success/warning/danger`, `--radius-*`, `--shadow-*`, `--skeleton*`, `--ease-out`, `--theme-transition`). New tokens on `.page-dashboard`:** `--sidebar-w: 264px`, `--dash-topbar-h: 72px`, `--series-1: var(--accent-primary)`, `--series-2: var(--accent-secondary)`, `--series-3: #8B5CF6`, `--late: var(--warning)`.

**Sections:**
1. **Shell:** `.dash-shell { display: grid; grid-template-columns: var(--sidebar-w) minmax(0,1fr); min-height: 100vh; }`; ambient glow reuse `.bg-glow`.
2. **Sidebar:** sticky full height, glass background (`--bg-card` + `backdrop-filter: blur(16px)`), brand on top, `.nav-item` rows (icon + label + `.soon-badge` pill), active item with cyan left bar + `--accent-soft` background, hover `--bg-hover`.
3. **Topbar:** sticky, blurred, `display:flex`, title/welcome block left; controls right (`select.dash-select` styled like inputs with chevron, notif button with red count dot, avatar button with initials gradient). `#user-menu` dropdown card with `pop-in` animation.
4. **Grid:** `.dash-grid { display:grid; gap:20px; grid-template-columns: repeat(12, minmax(0,1fr)); }` — KPI cards span 3, chart 8, side 4, table 8, feed 4.
5. **Cards:** `.dash-card` glass card (border, radius-lg, shadow-card, padding 20-24px, `rise-in` animation staggered with `--i`). Card header flex with title + tools.
6. **KPI card:** icon chip (accent-soft), label, big value (Outfit 2rem), `.trend.is-good` (success) / `.is-bad` (danger) with ▲▼, sparkline SVG bottom.
7. **Charts:** `.chart-svg` width 100%; `.grid-line` stroke `--border-color`; `.axis-label` fill `--text-muted` 11px; `.line-path` stroke-width 2.5, `stroke-dasharray`/`draw` animation; `.area-path` gradient; `.bar-actual` rounded `rx`, `.target-line` dashed; `.hit` transparent rects with focus ring; `.chart-tooltip` floating card positioned via CSS vars `--x/--y`; `.legend-btn[aria-pressed="false"]` faded.
8. **Donut & gauge:** `.donut-seg` stroke transition; center label; legend rows with colored dots.
9. **Table:** sticky header, row hover, `th button` sort indicators via `[aria-sort]`, `.badge.status-present|late|leave|sick`, `.kpi-bar` track/fill, `.avatar-sm` initials.
10. **Feed:** list items with avatar, meta, `.btn-sm` approve (success) / reject (outline danger); `.is-leaving` collapse animation; stall chips by status.
11. **States:** `.skeleton-block` shimmer (reuse `shimmer` keyframes); `.card-error` centered icon + text + `.retry-btn`; `.empty-state`.
12. **Toasts:** `.toast-region` fixed bottom-right stack; `.dash-toast` with icon, `is-visible` slide-in, `.is-success`/`.is-info`.
13. **Responsive:**
    - `≤1279px`: chart/side/table/feed each span 12 (side & feed become 6+6 row).
    - `≤1023px`: sidebar becomes off-canvas (`transform: translateX(-100%)`, `.is-open` slides in, `#sidebar-backdrop` visible), `#menu-toggle` visible, KPI span 6.
    - `≤760px`: table → card list (`thead` sr-only, `td::before { content: attr(data-label) }`), topbar wraps selects below title.
    - `≤480px`: KPI span 12.
    - `prefers-reduced-motion`: already handled globally in `styles.css`.

**Verify:** visual check happens in Task 9.

**Checkpoint** — update `docs/plans/task.md`.

---

### Task 7: `dashboard.js` (browser IIFE)

**Files:**
- Create: `dashboard.js`

**Module outline (implement in this order, one function group at a time):**

1. **Bootstrap:** `const Session = window.AutoPulseSession, Data = window.AutoPulseData, I18N = window.AutoPulseDashI18n;` read session; if missing → `location.replace("index.html?expired=1")` and return.
2. **Constants & state:** `REDUCED_MOTION`, `LATENCY_MS = 400`, `state = { lang, role, branch, range: 30, data, loadToken: 0, forceOffline: ?offline=1, sort: { key: null, dir: "desc" }, query: "", division: "all", hiddenSeries: new Set(), processed: {} /* branch -> Set(leaveId) */, lastFocus }`.
3. **Helpers:** `$`, `$$`, `storage` (localStorage try/catch), `t(key, params)` (falls back to `id`), `escapeHtml`, `formatNumber(value, decimals)` (id-ID / en-US), `formatKpi(kpi)` (percent → `94,8%`; currencyM → `Rp 102,0 jt` / `IDR 102.0M`; rating → `4,6/5`; count), `initials(name)`, `animateNumber(node, to, opts)` (same algorithm as `app.js:362-377`), `formatDayOffset(offset)` via `Intl.DateTimeFormat(lang, { day: "numeric", month: "short" })`.
4. **Theme & language:** `applyTheme(theme, persist)` / `toggleTheme()` identical behaviour to `app.js:387-396`; `applyLanguage(lang, persist)` updates `[data-i18n]`, `[data-i18n-aria]`, `[data-i18n-placeholder]`, lang buttons `aria-pressed`, welcome/today text, then re-renders current data without animation.
5. **Shell interactions:**
   - Sidebar: `openSidebar()/closeSidebar()` toggling `.is-open`, backdrop, `aria-expanded` on `#menu-toggle`, Esc closes, focus moves to first nav item / back to toggle.
   - Nav items other than overview → `showToast(t("toastComingSoon", { name: t("nav_x") }), "info")`.
   - User menu: toggle `#user-menu`, `aria-expanded`, Arrow/Esc keyboard, click-outside closes.
   - Logout: `Session.clear(); showToast(t("logoutToast")); setTimeout(() => location.replace("index.html"), 600)`.
   - Branch/role selects: update state, `Session.update({ role, branch })`, reset `sort/query/division/hiddenSeries`, toggle `#range-group` and `#division-filter` visibility (HRD only), call `load()`.
   - Range buttons: set `state.range`, `aria-pressed`, re-render chart only.
6. **Data loading:** `async function load()` → token guard; render skeletons in all 4 cards + KPI grid; `await sleep(LATENCY_MS)`; if `state.forceOffline` → `renderError()` on every card; else `state.data = Data.getDashboardData(role, branch)` → `renderAll(true)`; update `#last-updated` with WIB time. Retry buttons (delegated on `main`, `.retry-btn`) set `state.forceOffline = false` and call `load()`.
7. **Renderers:**
   - `renderKpis(animate)`: 4 cards, icon per KPI id (inline SVG map), label `kpi_<id>`, hint `kpiHint_<id>`, value via `animateNumber` (raw numeric, then suffix/prefix from `formatKpi`), trend chip: `good = goodWhenUp ? trend >= 0 : trend <= 0`, sparkline polyline 100×32.
   - `renderLineChart()` (HRD): viewBox `0 0 640 260`, padding `{t:16,r:16,b:28,l:36}`, y-domain `[floor(min/5)*5, 100]`, 4 grid lines + labels, x labels every 5th (or every point for range 7), per visible series: area (first visible only, gradient `--series-n`) + path; one `.hit` rect per x index (`tabindex="0"`, `aria-label` with date + values) → `showChartTooltip(index, rect)`; legend buttons toggle `state.hiddenSeries`; `#chart-sr` gets a visually-hidden table; `#chart-body` `role="img"` + `aria-label` from `chartSummaryLine`.
   - `renderBarChart()` (BM): same frame; bar per week (`.bar-actual`, `rx=6`), dashed `.target-line` polyline; labels `weekLabel` / `thisWeek` for offset 0; tooltip + sr table.
   - `renderDonut()` (HRD): r=52, circumference via `2*Math.PI*r`, segments with cumulative `stroke-dashoffset`, colors present=success, late=warning, leave=accent-secondary, sick=danger; center total + `totalStaff`; legend with counts and %.
   - `renderGauge()` (BM): semicircle arc (`stroke-dasharray` half circumference), pct = value/target, color success ≥100%, accent ≥75%, warning below; center `pct%` + `unitsOf`.
   - `renderTable()`: HRD columns name/division/checkIn/status/kpi; BM columns rank/name/spk/target%/leads. Filters (`query` case-insensitive on name, `division`), sort by clicked `th button[data-sort]` (toggles dir, sets `aria-sort`), `td[data-label]` for mobile, empty state toggling, `#table-count`.
   - `renderFeed()`: HRD leave items (skip ids in `state.processed[branch]`), buttons `data-action="approve|reject" data-id`; on click add `.is-leaving`, after `animationend`/320ms remove, add id to processed, toast success/info, update `#feed-count` and `#notif-count`. BM stall items with status chip + meta (`stallMeta`). Empty state when none.
   - `renderAll(animate)`: titles per role (`chartAttendanceTitle`/`chartSalesTitle`, `sideDonutTitle`/`sideGaugeTitle`, `tableStaffTitle`/`tableLeaderTitle`, `feedLeaveTitle`/`feedStallTitle`), then all renderers, `#sidebar-branch` = `branchName`, `#user-role` = `role_<role>`.
8. **Toasts:** `showToast(message, kind = "success")` creates `.dash-toast` in `#toast-region`, auto-removes after 3200 ms (max 3 stacked).
9. **Global keyboard:** Esc closes user menu → sidebar → tooltip (in that order).
10. **Init:** apply saved lang (`autopulse-lang` or browser), set selects from session (`branch`, `role`), user name/avatar, `bindEvents()`, `load()`, `setInterval(updateWelcome, 60000)`.

**Verify:**

Run: `node --check dashboard.js; node --check dashboard-data.js; node --check dashboard-i18n.js; node --check session.js`
Expected: no output, exit 0.

**Checkpoint** — update `docs/plans/task.md`.

---

### Task 8: Static integrity test

**Files:**
- Create: `tests/integrity.test.js`

**Step 1: Write the test**

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I18N = require("../dashboard-i18n.js");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const htmlIds = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const jsIds = (js) => [...js.matchAll(/\$\("#([\w-]+)"\)|getElementById\("([\w-]+)"\)/g)].map((m) => m[1] || m[2]);

for (const [htmlFile, jsFile] of [["dashboard.html", "dashboard.js"], ["index.html", "app.js"]]) {
  test(`${htmlFile}: ids are unique`, () => {
    const ids = htmlIds(read(htmlFile));
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, []);
  });

  test(`${jsFile}: every #id it queries exists in ${htmlFile}`, () => {
    const ids = new Set(htmlIds(read(htmlFile)));
    const missing = jsIds(read(jsFile)).filter((id) => !ids.has(id));
    assert.deepEqual(missing, []);
  });
}

test("dashboard.html: every data-i18n key exists", () => {
  const html = read("dashboard.html");
  const keys = [...html.matchAll(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 20, "expected many i18n hooks");
  assert.deepEqual(keys.filter((k) => !(k in I18N.id)), []);
});

test("dashboard.js: every literal t(\"key\") exists", () => {
  const keys = [...read("dashboard.js").matchAll(/\bt\("([\w]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)].filter((k) => !(k in I18N.id)), []);
});

test("dashboard.html loads scripts in the right order", () => {
  const html = read("dashboard.html");
  const order = ["session.js", "dashboard-data.js", "dashboard-i18n.js", "dashboard.js"].map((f) => html.indexOf(`src="${f}"`));
  assert.ok(order.every((i) => i > -1), "all scripts present");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("index.html loads session.js before app.js", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('src="session.js"') > -1);
  assert.ok(html.indexOf('src="session.js"') < html.indexOf('src="app.js"'));
});
```

**Step 2: Run** `node --test "tests/*.test.js"`
Expected: PASS for all suites. If any fail, fix the HTML/JS (not the test) and re-run.

**Step 3: Checkpoint** — update `docs/plans/task.md` with test count.

---

### Task 9: Browser verification

**Files:** none (verification only).

**Step 1:** Start a static server: `npx -y http-server -p 5500 -c-1 .` (daemon). Confirm `http://127.0.0.1:5500/dashboard.html` returns 200.

**Step 2:** Use `browser_subagent` (dedicated browser step) to run this script and capture screenshots:
1. Open `/dashboard.html` directly → expect redirect to `/index.html` with the "Sesi berakhir" alert.
2. Click "Isi otomatis" → "Masuk Sistem" → success dialog → auto-redirect to dashboard.
3. Dashboard HRD/Jakarta renders: 4 KPI cards, line chart, donut, staff table, 4 leave requests.
4. Toggle range 7/30, toggle a legend series, hover a chart point (tooltip).
5. Search "a" in table, filter "Teknisi", sort by KPI.
6. Approve one leave → toast + count decreases.
7. Switch role to Branch Manager → bar chart, gauge, leaderboard (top = Andi S.), stall feed.
8. Switch branch to Medan → numbers change; leaderboard top = Rizky M.
9. Switch to EN and Light theme → all text English, light palette; reload → preferences + branch/role persist.
10. Resize to 375 px → sidebar hidden, ☰ opens drawer, table becomes cards; 768 px and 1440 px screenshots.
11. Open `/dashboard.html?offline=1` → error states + Retry → data loads.
12. Logout → back to login; open `/dashboard.html` again → redirected.

**Step 3:** If the browser tool fails, report it and fall back to HTTP 200 checks + `node --test "tests/*.test.js"` evidence, and ask the user to verify manually.

**Step 4: Checkpoint** — update `docs/plans/task.md` with evidence and screenshots.
