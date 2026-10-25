# Notatki — sesja: wdrożenie ADR 0006 (sync przy otwarciu + pull-to-refresh)

Zapis tego, co zrobione. Bez commita do czasu akceptacji.

## Co wdrożono

- **`App.tsx`**: `sync` jest teraz jednym współdzielonym działaniem
  (`useCallback`) dla startu aplikacji, pull-to-refresh u dziecka i przycisku
  „Synchronizuj” w panelu rodzica.
  - Start: po `repo.init()` i pierwszym `reload()` (czyli po pokazaniu
    biblioteki z pamięci) uruchamiany jest **jeden** przebieg
    `syncAllChannels`, bez blokowania pierwszego renderu.
  - Kolejność: najpierw drenaż linków przychodzących (`share` / `VIEW`), potem
    sync — zimny start nie ściga się z potokiem linków o te same kolekcje.
  - `syncPromiseRef` scala równoległe żądania: szybkie przeciągnięcie zaraz po
    starcie nie uruchamia drugiego pobierania tych samych kanałów. Po
    zakończeniu blokada znika i kolejne odświeżenie działa normalnie.
  - Błąd synchronizacji nie zostawia dziecka w spinnerze: `refreshing` jest
    zdejmowany w `finally`, a nieoczekiwany błąd trafia do `console.warn`.
- **`ChildHomeScreen`** (bez zmian w API): istniejące `onRefresh` w siatce
  feedu, liście kanałów i widoku kanału nadal prowadzi do `App.sync`; test
  pilnuje, że akcja dziecka faktycznie uruchamia pobranie.
- **Diagnostyka**: jednolinijkowy log `[KidsTube:sync] channels=… added=…`
  po każdym przebiegu (obok istniejącego `[KidsTube:usage]`), żeby dało się
  potwierdzić sync w logcat bez zgadywania.

## Czego świadomie nie zmieniono

- Zakładki „Do zatwierdzenia” i „Historia” u dziecka nie dostały
  pull-to-refresh: ich zawartość nie zależy od RSS (propozycje dziecka /
  historia oglądania). Odświeżanie ma sens tam, gdzie sync zmienia listę:
  feed, kanały, kanał.
- Nadal **brak sync w tle** i timera — zgodnie z ADR 0006; to backlog z bramką
  oceny.
- Pull-to-refresh nie omija bramek czasu ani decyzji rodzica — odświeża tylko
  dane, nie uruchamia odtwarzania.

## Testy / stan

- `__tests__/App.test.tsx`: nowy test „syncs channels once when the app opens”
  — seeduje kanał i ustawiony PIN, mockuje `fetch`, sprawdza **jeden** fetch
  przy starcie, a potem dwa równoległe odświeżenia z widoku dziecka: mają
  wykonać tylko **jedno** dodatkowe pobranie (scalenie przebiegów).
- `npm test` = **192** (było 191), `npx tsc --noEmit` i `npx eslint .` czysto.
- Wersja: **0.6.0 → 0.6.1**, `versionCode 20 → 21`.
- APK release zbudowany i zainstalowany w emulatorze; w logcat widać
  `[KidsTube:sync] channels=… added=…` zaraz po starcie aplikacji.
- README: wiersz „Synchronizacja” opisuje start, pull-to-refresh i scalanie
  równoległych wywołań; zaktualizowana liczba testów.
- ADR 0006: dopisane konsekwencje wdrożenia (jeden przebieg na start, brak
  blokowania cache, zakres pull-to-refresh).
