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

test("all 5 subviews have deterministic, valid datasets", () => {
  for (const branch of Data.BRANCH_KEYS) {
    for (const role of Data.ROLES) {
      const d = Data.getDashboardData(role, branch);

      // 1. Attendance detail
      assert.ok(Array.isArray(d.attendanceDetail));
      assert.equal(d.attendanceDetail.length, HEADCOUNT[branch]);
      for (const row of d.attendanceDetail) {
        assert.match(row.nip, /^1023\d{2}$/);
        assert.ok(row.name.length > 2);
        assert.ok(row.roleTitle.length > 3);
        assert.ok(["shift_morning", "shift_afternoon"].includes(row.shift));
        assert.ok(["present", "late", "leave", "sick"].includes(row.status));
        assert.ok(row.email.endsWith("@autopulse.id"));
        assert.match(row.ext, /^10\d{2}$/);
      }

      // 2. Commission list
      assert.ok(Array.isArray(d.commissionList));
      assert.ok(d.commissionList.length > 0);
      for (const comm of d.commissionList) {
        assert.ok(comm.target > 0);
        assert.ok(comm.spk >= 0);
        assert.ok(comm.base >= 0);
        assert.ok(comm.total >= comm.base);
        assert.ok(["payroll_ready", "payroll_review"].includes(comm.status));
      }

      // 3. Team directory
      assert.ok(Array.isArray(d.teamDirectory));
      assert.equal(d.teamDirectory.length, HEADCOUNT[branch]);

      // 4. Leads pipeline
      assert.ok(Array.isArray(d.leadsList));
      assert.equal(d.leadsList.length, 12);
      for (const lead of d.leadsList) {
        assert.ok(lead.customer.length > 3);
        assert.ok(lead.model.startsWith("AutoPulse"));
        assert.ok(["stage_inquiry", "stage_contacted", "stage_testdrive", "stage_negotiation", "stage_delivered"].includes(lead.stage));
        assert.match(lead.phone, /^\+62 812-\d{4}-\d{3,4}$/);
      }

      // 5. Branch report
      assert.ok(d.branchReport);
      assert.equal(d.branchReport.period, "Oktober 2026");
      assert.ok(d.branchReport.spkActual > 0);
      assert.ok(d.branchReport.spkTarget > 0);
      assert.ok(d.branchReport.csat >= 4.0 && d.branchReport.csat <= 5.0);
      assert.ok(d.branchReport.partsTurnover >= 90);
      assert.ok(d.branchReport.sopCompliance >= 95);
      assert.ok(d.branchReport.highlights.length >= 3);
    }
  }
});

