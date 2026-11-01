/* THE SYSTEM — service worker
   Precaches the app shell for offline use. Same-origin requests are
   network-first (fresh when online, cached when offline); cross-origin
   assets (fonts) are cache-first. Bump CACHE to force an update. */
const CACHE = "the-system-v11";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest", "./icon.svg",
  "./js/config.js", "./js/helpers.js", "./js/state.js", "./js/stats.js",
  "./js/quests.js", "./js/body.js", "./js/ui.js", "./js/settings.js",
  "./js/timer.js", "./js/partner.js", "./js/sync.js", "./js/supabase-config.js", "./js/main.js",
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  if(url.origin === location.origin){
    // network-first: always try fresh, fall back to cache when offline
    e.respondWith(
      fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return res;
      }).catch(()=> caches.match(req).then(c=> c || caches.match("./index.html")))
    );
  } else {
    // cross-origin (e.g. Google Fonts): cache-first
    e.respondWith(
      caches.match(req).then(c=> c || fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(ca=>ca.put(req, copy));
        return res;
      }).catch(()=> c))
    );
  }
});
