self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(clients.claim()));
self.addEventListener("fetch",()=>{});
self.addEventListener("push",e=>{let d={title:"J.A.R.V.I.S",body:""};try{d=e.data.json()}catch(x){}e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:"icon.svg",badge:"icon.svg"}))});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.openWindow("./"))});
