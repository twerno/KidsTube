# ADR 0006 — Synchronizacja RSS: przy otwarciu i na żądanie

> Wdrożone — szczegóły: `docs/notes/ADR-0006-wdrozenie.md`.

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

- Sync przy starcie jest **jeden na uruchomienie aplikacji** i nie blokuje
  pokazania biblioteki z pamięci: najpierw widok z cache, potem pobranie,
  potem cicha aktualizacja listy.
- Pull-to-refresh w widoku dziecka (siatka filmów, lista kanałów, kanał)
  uruchamia ten sam mechanizm co sync z panelu rodzica. Równoległe żądania
  (np. świeżo otwarta aplikacja i natychmiastowe przeciągnięcie) są scalane
  w jeden przebieg — nie ma podwójnego pobierania tego samego kanału.
- Nowe filmy `auto_approve` trafiają do dziecka po zakończeniu synchronizacji
  (przy starcie lub po odświeżeniu), a nie w tle w trakcie bezczynności.
- Świeżość danych zależy od tego, czy użytkownik otworzy lub odświeży
  aplikację; nie ma gwarancji harmonogramu. Wymaganie jest świadomie miękkie:
  „świeżo przy codziennym użytkowaniu”, nie „dokładnie 2×/dzień”.
