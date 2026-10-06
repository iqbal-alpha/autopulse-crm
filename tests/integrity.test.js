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
  assert.deepEqual([...new Set(keys)].filter((k) => !k.endsWith("_") && !(k in I18N.id)), []);
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
