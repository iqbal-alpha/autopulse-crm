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
