# ADR 0006 — Synchronizacja RSS: tylko przy otwarciu aplikacji

Synchronizacja kanałów (RSS `feeds/videos.xml` + oEmbed) odbywa się
**wyłącznie przy otwarciu aplikacji** (oraz ręcznie: „Odśwież" u dziecka
i sync z panelu rodzica — oba to jawne akcje użytkownika). Zasilają ją
decyzje ADR 0001: kanały `auto_approve` dostarczają nowe filmy od razu
po syncu; kanały `manual` nie zasilają niczego automatycznie.

Timer okresowy w tle i prawdziwy proces tła (Android Background Processing)
są **odroczone do backlogu** — z jawną bramką oceny: czy przy codziennym
użytkowaniu (`auto_approve` + otwieranie apki) filmy dochodzą „na bieżąco".
Dopiero gdyby okazało się, że nie — wracamy do tematu jako osobny projekt
(te same natywne mechanizmy co planowane „audio w tle").

## Rozważone opcje

- **Timer co ~12 h przy żywej aplikacji** — odroczony: Android może uśpić tło,
  nie daje gwarancji; złożoność na teraz nieopłacalna.
- **Full background processing** — odroczony: natywny kod, duży koszt,
  przynosi wartość tylko przy potwierdzonym zapotrzebowaniu.

## Konsekwencje

- Nowe filmy `auto_approve` pojawiają się u dziecka po restarcie aplikacji,
  nie w trakcie sesji.
- Wymaganie jest świadomie miękkie: „świeżo przy codziennym użytkowaniu",
  nie „dokładnie 2×/dzień".