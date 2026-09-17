const CACHE='tufi-practice-v2';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.delete('tufi-practice-v1'),self.clients.claim()])));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);if(url.origin!==self.location.origin||e.request.method!=='GET'||url.searchParams.has('download'))return;
 if(url.pathname!=='/api/practice'&&url.pathname!=='/offline.html')return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(e.request);if(!response.ok||response.redirected)throw new Error('Unavailable');const html=await response.clone().text();if(!html.includes('data-tufi-practice="v2"'))throw new Error('Unexpected content');await cache.put('/api/practice',response.clone());return response}catch{const saved=await cache.match('/api/practice');return saved||new Response('Treino ainda não preparado. Conecte-se uma vez e abra o treino, ou use a cópia HTML baixada.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}})());
});
