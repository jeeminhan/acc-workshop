// window.storage shim.
// In a Claude artifact the host provides window.storage. Outside that env we
// fake it with localStorage-backed get/set + a BroadcastChannel so multiple
// tabs/frames on the same origin stay in sync (good enough for single-machine
// demos and most of the same-device UX). For real cross-device sync between
// phones and a projector you'd swap this for a real backend.
export function installStorageShim() {
  if (typeof window === "undefined" || window.storage) return;
  const PREFIX = "acc-demo:";
  const ch =
    "BroadcastChannel" in window ? new BroadcastChannel("acc-demo") : null;
  const subs = new Set();

  if (ch) {
    ch.onmessage = (e) => {
      const { key } = e.data || {};
      if (!key) return;
      subs.forEach((fn) => {
        try {
          fn(key);
        } catch {}
      });
    };
  }

  // Cross-tab sync via storage events too — covers browsers without BroadcastChannel.
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const key = e.key.slice(PREFIX.length);
    subs.forEach((fn) => {
      try {
        fn(key);
      } catch {}
    });
  });

  window.storage = {
    async get(key) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    },
    async set(key, value) {
      try {
        if (value == null) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, JSON.stringify(value));
        ch && ch.postMessage({ key });
        return true;
      } catch {
        return false;
      }
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
