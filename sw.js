const C="meri-assistant-v5",F=["./","./index.html","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>Promise.allSettled(F.map(f=>c.add(f)))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||new URL(r.url).origin!==location.origin)return;
e.respondWith(fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(C).then(h=>h.put(r,c))}return x}).catch(()=>caches.match(r).then(m=>m||caches.match("./index.html"))))});
self.addEventListener("push",e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data?e.data.text():""}}
e.waitUntil(self.registration.showNotification(d.title||"Meri Assistant",{body:d.body||"",icon:"icon.svg",badge:"icon.svg",tag:d.tag||undefined,renotify:!!d.tag,vibrate:[120,60,120],data:{url:"./"}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();
e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){if("focus"in c)return c.focus()}return self.clients.openWindow("./")}))});
