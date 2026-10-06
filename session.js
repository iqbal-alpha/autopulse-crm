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
