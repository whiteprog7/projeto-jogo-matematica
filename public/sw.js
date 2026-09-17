const CACHE='tufi-practice-v1';const files=['/offline.html','/offline.js','/offline-content.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(files)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(url.origin!==self.location.origin||e.request.method!=='GET')return;if(files.includes(url.pathname)){e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));return}if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/offline.html')))});
