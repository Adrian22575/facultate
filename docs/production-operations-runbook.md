# Runbook productie Nota 5+

## Scop

Procedura minima pentru incidente, rollback si recuperare. Nu se salveaza chei, tokenuri sau valori de mediu in acest document.

## Inainte de lansare

- confirma ca proiectul Supabase are backup-uri zilnice active sau PITR, conform planului ales;
- confirma in `Database > Backups` cel mai recent punct recuperabil;
- pastreaza separat un export logic periodic al schemei si datelor critice;
- trateaza Storage separat: backup-ul bazei contine metadatele fisierelor, nu continutul obiectelor;
- confirma ca ultimul deployment Vercel stabil poate fi promovat din nou;
- noteaza persoana care decide oprirea procesarilor si persoana care comunica incidentul.
- configureaza un monitor extern pentru `GET /api/health`; raspunsul normal este `200 {"status":"ok"}`, iar `503` indica indisponibilitatea configurarii sau a bazei.
- dupa fiecare deploy ruleaza `npm run production:smoke`; pentru Preview foloseste `npm run production:smoke -- --base-url URL_PREVIEW`.
- confirma ca workerul `/api/cron/learning-jobs` ruleaza la fiecare minut si avanseaza pe rand procesarile de materiale, importurile si seturile de invatare.

## Incident aplicatie

1. Verifica `/api/health`, Vercel Runtime Logs si Supabase Logs fara a publica date personale.
2. Daca regresia vine din cod, promoveaza ultimul deployment Vercel stabil.
3. Daca procesarea externa produce erori sau cost necontrolat, dezactiveaza temporar intrarea in flow ori elimina variabila privata doar dupa evaluarea impactului.
4. Verifica login, dashboard, o materie existenta si o plata deja confirmata.
5. Nu relansa joburi in masa pana cand idempotenta si soldurile utilizatorilor au fost verificate.

## Incident baza de date

1. Opreste temporar operatiile care scriu date daca exista risc de corupere continua.
2. Stabileste ultimul moment corect si estimeaza pierderea de date acceptabila.
3. Foloseste backup-ul zilnic sau PITR din Supabase Dashboard. Restaurarea produce indisponibilitate temporara.
4. Dupa restaurare, verifica migrarile, politicile RLS, functiile cu `service_role` si webhook-urile Stripe.
5. Reconciliaza platile Stripe din intervalul afectat inainte de a redeschide checkout-ul.
6. Verifica separat obiectele din bucketul privat; restaurarea bazei nu readuce fisiere Storage sterse.

## Incident Storage

1. Nu sterge obiecte pentru a repara doar metadatele.
2. Compara `ai_source_documents.storage_path` cu obiectele existente din bucketul privat.
3. Izoleaza inregistrarile fara obiect si obiectele fara proprietar pentru review administrativ.
4. Restaureaza continutul din copia externa, daca exista, apoi reconciliaza metadatele.

## Dupa incident

- documenteaza intervalul, impactul, cauza si actiunile efectuate;
- identifica utilizatorii si platile afectate fara a exporta date inutile;
- anunta utilizatorii daca incidentul le-a afectat datele, accesul sau platile;
- adauga testul ori monitorizarea care ar fi detectat problema mai devreme;
- roteste cheile numai cand exista suspiciune de expunere si actualizeaza toate mediile coordonat;
- executa cel putin trimestrial un exercitiu de restaurare intr-un proiect separat, nu direct peste Productie.

Referinta oficiala: https://supabase.com/docs/guides/platform/backups
