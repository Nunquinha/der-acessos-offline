const CACHE = 'der-campo-shell-v5';
const ASSETS = ['./', './index.html', './style.css', './app.js', './core.js', './storage.js', './config.js', './manifest.webmanifest', './der.jpg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // Evita montar uma atualização com HTML e módulos antigos do cache HTTP.
    for(const asset of ASSETS){
      const canonical=new URL(asset,self.registration.scope);
      const fresh=new URL(canonical);fresh.searchParams.set('build',CACHE);
      const response=await fetch(fresh,{cache:'reload'});
      if(!response.ok)throw Error('Arquivo offline indisponível: '+asset);
      await cache.put(canonical,response);
    }
  })());
  // A nova versão aguarda o fechamento das abas para não interromper um cadastro.
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('der-campo-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(self.registration.scope.replace(url.origin,''))) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match(new URL('./index.html', self.registration.scope)).then(cached => cached || fetch(event.request)));
    return;
  }
  // Nunca armazena respostas de cadastro, credenciais ou dados de outros operadores.
  const known = ASSETS.some(path => new URL(path, self.registration.scope).href === url.href);
  if (known) event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
