# Notatki — sesja: ADR 10 (zapis decyzji) + wdrożenie ADR 0003 (licznik i błędy)

Zapis tego, co zrobione. Bez commita do czasu akceptacji.

## ADR 10 — zapisane jako decyzja, bez implementacji

Zamiast wdrażać „drugi krok" z ADR 0001, spisaliśmy go jako **ADR 0010**
(`docs/adr/0010-panel-decyzji-historia-i-zbiorcze-akcje.md`): widok historii
decyzji (grupa Historia), dialog zmiany (last-wins) i akcje zbiorcze
(cofnięcie autoakceptacji, usunięcie kanału) z potwierdzeniem i liczbą filmów.
Wiersz w tabeli decyzji README dodany. Implementacja — osobna sesja.

## ADR 0003 — co wdrożono (kod)

- **`domain/watchTime.ts`** *(nowy, czysty)*: akumulator `WatchClock`
  (`beginWatch` / `advanceWatch` / `unreportedSeconds`). Liczy **faktyczny czas
  odtwarzania** (stan `playing`), a pauza/buforowanie/błąd nie zużywają limitu;
  przy pauzie znacznik czasu jest odświeżany, żeby przerwy nie zaliczono po
  wznowieniu. Ignoruje cofnięcie zegara i nigdy nie zwraca ujemnych sekund.
- **`ui/PlayerScreen.tsx`**:
  - raportuje **przyrosty** sekund do `App` (`onPlayedSeconds`); liczy tylko
    gdy `!audioOnly && playing && !buffering`;
  - **ekran błędu**: `EmbedPlayer.onError` → overlay „Nie udało się odtworzyć
    materiału" z „Spróbuj ponownie" / „Wróć do listy"; retry remountuje WebView
    (`playNonce`) i **wznawia od pozycji przerwy** (best-effort przez `seekTo`
    w `onReady`); przy drugiej porażce podpowiedź „Sprawdź połączenie z
    internetem". Bez automatycznych ponowień (ADR 0003).
  - etykieta końca „Jeszcze raz" → **„Zagraj ponownie"**.
- **`ui/EmbedPlayer.tsx`**: nowy prop `onError` podpięty do `onError`
  i `onHttpError` WebView (wcześniej tylko `console.log`).
- **`App.tsx`**: usunięty efekt liczący czas otwarcia trasy playera;
  zamiast niego `recordPlayedSeconds` → `repo.addUsageSeconds(dateKey(now))`.

## Testy / stan

- `__tests__/watchTime.test.ts` *(nowy, 6 testów)*; `npm test` = **105**
  (było 99), `npx tsc --noEmit`, `npx eslint .` czysto.
- Wersja: **0.4.6 → 0.4.9**; `versionCode 4`, `versionName "0.4.9"`.
- APK release zbudowany i zainstalowany w emulatorze (Android 16); start bez crasha.

## Podgląd licznika (weryfikacja)

- **`ui/parent/ScheduleTab.tsx`**: karta **„Wykorzystanie dzisiaj”** — minuty,
  ile pozostało z limitu (albo „Limit wyłączony”) + przycisk **„Wyzeruj
  dzisiejszy licznik”**. `App` ładuje `getUsage` w `reload()` i odświeża po
  wyjściu z playera oraz przy odblokowaniu panelu.
- Repo: `resetUsage(dateKey)` (interface + memory + AsyncStorage).

## Poprawka: cap kroku licznika (zdiagnozowane)

Objaw: panel pokazał nagle ~26 min. Przyczyna: licznik credytował **cały czas
od ostatniej obserwacji**, więc gdy WebView przestał raportować stan (tło
apki, zamrożona strona), po powrocie doliczał cały ten czas, mimo że film
mógł nie grać. `advanceWatch` ma teraz **`MAX_WATCH_STEP_MS = 2000`** — jedna
obserwacja dolicza najwyżej ~2 s (poll stanu to ~0,5 s); przerwy w tle nie
zawyżają licznika. Test w `watchTime.test.ts`.
- `console.log('[KidsTube:usage] +Ns')` oraz log wczytania (`used=…s limit=…min`) — diagnostyka.
- Karta pokazuje jednoznacznie: `Limit: X min · Pozostało: Y min`.

## Twarde cięcie limitu (ADR 0002/0005)

- Limit sprawdzany był tylko przy starcie; w trakcie film grał dalej po
  wyczerpaniu budżetu. Teraz `App.recordPlayedSeconds` aktualizuje też stan
  `usedSecondsToday`, a `PlayerScreen` dostaje `remainingVideoSeconds`:
  - w momencie `remaining <= 0` **pauzuje** odtwarzanie i pokazuje overlay
    „Czas na dziś wykorzystany” z **„Tylko dźwięk”** / „Wróć do listy”;
  - przejście na audio wznawia odtwarzanie (film był spauzowany).
- Pozostały czas widoczny też w **prawym górnym roku** playera, gdy pasek
  kontrolek jest aktywny (`controlsVisible`).

## Feedback zapisu (panel → Czas)

- **`ui/ScheduleEditor.tsx`**: po zapisie **„Zapisano ✓”**, a po edycji
  dowolnego pola **„Niezapisane zmiany”** (`status` idle/saved/dirty).

## Licznik u dziecka

- **`ui/ChildHomeScreen.tsx`**: pod powitaniem „⏳ Zostało N min na dziś”
  (albo „Limit na dziś wykorzystany — możesz słuchać z wyłączonym obrazem”).
- `App` liczy `remainingSecondsToday(normalizeSchedule(schedule), usedSecondsToday)`
  i przekazuje jako `remainingVideoSeconds`; odświeża się po wyjściu z playera.

## Co zostaje otwarte (świadomie)

- **Twarde cięcie w trakcie sesji** przy wyczerpaniu limitu (ADR 0002/0005):
  limit sprawdzany jest przy starcie odtwarzania; licznik już zasila usage,
  ale brak reakcji na przekroczenie budżetu w trakcie. Osobny krok.
- **Błędy wewnątrz embeda** (film niedostępny / `playabilityStatus`): pokryte
  są błędy sieci/HTTP WebView; komunikat z odtwarzacza jeszcze nie.
- Projektowanie i implementacja **ADR 0010** (historia decyzji + akcje zbiorcze).
- ADR 0009 (import katalogu, checkpoint) — nadal niezaimplementowany.
