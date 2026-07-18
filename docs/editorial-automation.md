# Articole despre educație

## Programare

Articolele folosesc cronul existent `/api/cron/dictionary`, programat în Vercel la `0 8 * * *` (UTC). În fiecare duminică, gardul din aplicație pornește și fluxul editorial; în celelalte zile răspunsul este `not_editorial_day`. Astfel rămânem în limita de două cron jobs a planului Hobby, fără un al treilea job care ar bloca deploy-ul.

La ora 08:00 UTC, rularea este la 10:00 în Europe/Bucharest iarna (EET) și 11:00 vara (EEST). Cheia unică a săptămânii (`week_start`) împiedică publicarea dublă în cazul unor retry-uri sau apeluri concurente.

## Configurare

- `OPENAI_API_KEY` este necesară pentru cercetare, redactare și verificare.
- `OPENAI_EDITORIAL_MODEL=gpt-5.6` este modelul implicit; nu există fallback automat. Din Admin poți alege un model disponibil pentru fluxul editorial. Dacă modelul configurat eșuează, articolul nu se publică.
- `CRON_SECRET` (minimum 24 caractere) autorizează apelurile Vercel.
- `SUPABASE_SERVICE_ROLE_KEY` salvează rulările și conținutul.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` și `TELEGRAM_NOTIFICATIONS_ENABLED` activează notificările administrative. Nu se folosește `TELEGRAM_CHAT_ID` separat.

## Flux și publicare

1. Cercetare cu Responses API și `web_search` pentru săptămâna editorială.
2. Deduplificare URL, filtrare de actualitate și scor de relevanță, importanță, actualitate, credibilitate și utilitate.
3. Plan și redactare numai din pachetul validat.
4. Fact-check independent, validare a identificatorilor de sursă și verificare HTTP a linkurilor.
5. Publicare numai peste pragul 85/100, fără afirmații neacoperite sau probleme critice.

Orice eșec creează o rulare respinsă/eșuată, nu un articol public. Notificarea Telegram indică titlul, perioada, scorul și pagina pentru publicări; pentru eșec transmite motivul sigur de diagnostic.

După publicarea articolului, distribuirea pe profilul personal LinkedIn este tratată separat. Detaliile de conectare, aprobare și publicare sunt în `docs/linkedin-editorial-distribution.md`.

## Test manual

În `/admin?admin_tab=editorial`, „Testează cercetarea” creează doar o ciornă. Revizuiește conținutul și sursele, rulează „Verifică faptele”, apoi „Publică” numai dacă starea este `passed` și scorul este cel puțin 85. Articolul poate fi retras fără ștergerea istoricului.
