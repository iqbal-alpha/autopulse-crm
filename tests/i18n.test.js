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
