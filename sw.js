/* Offline helper for My Witnessing Notes. It keeps a copy of the app so it opens with no internet.
   Your notes are NOT stored here; they stay in the browser's own storage on your device. */
var CACHE = "witnessing-app-v0.12";
var FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
/* A new version waits until the user taps "New version ready" in the app (never mid-edit), or until every window
   of the app has been closed; the next open then uses it (standard offline-helper behavior).
   Exception: when replacing a version older than 0.8, whose page has no such note, switch at once as before. */
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); }));
  }).then(function () { return caches.keys(); }).then(function (keys) {
    /* Compare number by number (0.10 is newer than 0.9; never as text). */
    var legacy = keys.some(function (k) { var m = /^witnessing-app-v(\d+)\.(\d+)$/.exec(k); return m && (+m[1] === 0 && +m[2] < 8); });
    if (legacy) return self.skipWaiting();
  }));
});
self.addEventListener("message", function (e) { if (e.data && e.data.type === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* Is this the app page itself (the folder address, or index.html)? */
function isAppPage(url) {
  var base = new URL("./", self.registration.scope).pathname;
  return url.pathname === base || url.pathname === base + "index.html";
}
function isHtml(res) { return /^text\/html\b/i.test(res.headers.get("Content-Type") || ""); }
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  /* Only the app page is kept as "index.html". Opening any other file of the site in a tab
     (for example the manifest or an icon) is kept under its own address, never as the app. */
  var app = req.mode === "navigate" && isAppPage(url);
  var key = app ? "./index.html" : req;
  /* Show the saved copy right away; quietly fetch a fresh one for next time. */
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(key, { ignoreSearch: app }).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic" && (!app || isHtml(res))) c.put(key, res.clone());
        return res;
      }).catch(function () { return hit; });
      if (hit) { e.waitUntil(fresh); return hit; }
      return fresh.then(function (res) { return res || Response.error(); });
    });
  }));
});
