# GitHub Pages 404

Daca domeniul GitHub Pages al repository-ului afiseaza mesajul `404 File not found`, cauza probabila este ca Pages incearca sa serveasca repository-ul ca site static, dar aplicatia reala este o aplicatie Next.js cu server runtime.

## Ce s-a adaugat in repository

- `index.html` la radacina, ca fallback static pentru GitHub Pages cand sursa Pages este branch-ul curent.
- `404.html` la radacina, ca pagina statica explicativa pentru rute necunoscute pe GitHub Pages.

Aceste fisiere nu inlocuiesc aplicatia Next.js si nu ruleaza flow-urile reale de autentificare, API, procesare materiale sau plati.

## Fix recomandat pentru site-ul live

1. Publica aplicatia pe Vercel sau pe o alta platforma care ruleaza Next.js cu Node.js runtime.
2. Seteaza variabilele de mediu conform `docs/deployment-readiness.md`.
3. In GitHub, dezactiveaza Pages pentru repository sau seteaza domeniul public sa indice catre deploy-ul Next.js, nu catre Pages.
4. Dupa deploy, verifica URL-ul live si rutele principale: `/`, `/auth/login`, `/materii`, `/testele-mele`.

## De ce GitHub Pages nu este suficient

GitHub Pages serveste fisiere statice. Aplicatia din acest repository foloseste rute server-side si API routes, deci are nevoie de un runtime Next.js, nu doar de HTML static.
