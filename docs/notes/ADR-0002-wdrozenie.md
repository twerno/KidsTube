# Notatki — sesja: wdrożenie ADR 0002 (czas: okno, limit wideo, audio, tryb snu)

Zapis tego, co zostało zrobione. Jeden commit, drzewo czyste.

## ADR 0002 — co wdrożono (kod)

- **`domain/types.ts`**: `Schedule.windows: TimeWindow[]` → **jedno okno**
  `Schedule.window?` (`TimeWindow` bez `days` — ten sam rytm każdego dnia);
  usunięte `audioOnlyAfterMinute` (dawne „godzina ciszy").
- **`domain/schedule.ts`**:
  - `canPlay(schedule, mode, usedSecondsToday, date)` — `mode: 'video' | 'audio'`;
    **audio nigdy nie jest bramkowane** (poza oknem i nad limitem), wideo — okno + limit.
  - `isWithinWindow` (pojedyncze okno, wrap po północy), usunięte
    `isWithinWindows` / `isAudioOnlyNow`.
  - `normalizeSchedule` — migracja legacy: bierze `windows[0]` jako okno,
    **kasuje** `audioOnlyAfterMinute`, żeby nie wracał po round-tripie.
- **`domain/sleepMode.ts`** *(nowy, czysty)*: licznik trybu snu 1 h — `SLEEP_DURATION_MS`,
  `freshSleepTimer` / `tickSleepTimer` (strzał dokładnie raz, pauza = stop licznika,
  reset) / `formatCountdown` (h:mm:ss).
- **`App.tsx`**:
  - `startPlay` (wideo) → alert przy braku zgody z przyciskiem **„Tylko dźwięk"**
    (openPlayer audio bez bramki);
  - naliczanie użycia **tylko w trybie wideo** (audio nie zużywa limitu dziennego);
  - `onAudioOnlyChange` — tryb audio podniesiony do trasy, toggle w playerze
    rozlicza segment wideo w chwili przełączenia.
- **`ui/PlayerScreen.tsx`**: ekran audio z **licznikiem trybu snu** (zawsze widoczny),
  przycisk „Zresetuj licznik (1 h)"; po odliczeniu playback pauzuje, ekran zostaje,
  „▶ Wznów odtwarzanie (1 h)" = play + nowe odliczanie. Tekst „Tryb nocny" →
  **„Tryb audio"** (słownik CONTEXT.md).
- **`ui/ScheduleEditor.tsx` / `parent/ScheduleTab.tsx`**: usunięte pole „Tryb nocny",
  zapis pojedynczego okna, walidacja od ≠ do, hint o audio poza bramką.

## Testy

- `__tests__/schedule.test.ts` — przepisane pod nowe API: jedno okno = każdy
  dzień, wrap po północy, audio zawsze dozwolone, migracja legacy.
- `__tests__/sleepMode.test.ts` *(nowy)* — tick/strzał/pauza/reset/format.
- `npm test` = **75 testów** (było 68), `npx tsc --noEmit` i `npx eslint .` czysto.
- Wersja: **0.2.7 → 0.3.0**.

## Otwarte wątki (ślady świadomych decyzji)

- Limit liczony z czasu otwarcia playera (segmenty wideo). Dokładniejsze
  „faktyczne odtwarzanie" (sumowanie `state.playing`) — przy implementacji
  ADR 0003, razem z licznikiem w playerze.
- „Pętla" w trybie audio na końcu filmu — UX ADR 0003 (na razie ten sam ekran
  końca co dla wideo).
- Czas w tle przy zgaszonym ekranie (foreground service) — nadal w backlogu,
  bez zmian.