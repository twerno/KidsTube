# Notatki — sesja: ADR 0004a (świat dziecka — pozostały zakres)

Zapis tego, co zrobione. Bez commita do czasu akceptacji.

## Zakres wdrożony

- **Cztery zakładki dziecka**: Feed · Kanały · Do zatwierdzenia · Historia.
  Pasek zakładek jest poziomo przewijany (etykiety się nie tną).
- **Feed jako siatka** dwóch dużych miniatur w wierszu (`ui/child/VideoGrid.tsx`);
  ten sam komponent obsługuje widok kanału, więc badge stanu obejrzenia działa
  identycznie w obu miejscach.
- **Kanały**: lista kanałów z awatarem, nazwą i liczbą filmów
  (`ui/child/ChannelsList.tsx`). Wchodzi w kanał → feed wyfiltrowany po
  `channelId`. Lista pokazuje wyłącznie kanały dozwolone, które mają co najmniej
  jeden film w bibliotece dziecka (pusty kanał nie jest pokojem).
- **Nawigacja kontekstowa**: czysty reducer `domain/childNavigation.ts`
  (`selectChildTab`, `openChildChannel`, `goBackChild`, `activeChildTab`).
  Stos trzyma `App`, więc otwarcie odtwarzacza go nie gubi:
  feed → film → wstecz → feed; kanały → kanał → film → wstecz → kanał.
  Wejście w kanał dokłada widok na stos; wybór zakładki wraca do jej korzenia.
  Sprzętowy „wstecz” na Androidzie zdejmuje stos, a na korzeniu oddaje sterowanie
  systemowi. W widoku kanału jest też widoczny przycisk „‹ Kanały”.
- **Historia u dziecka**: `ui/WatchHistoryList.tsx` — sekcje po dniach
  (`Dziś` / `Wczoraj` / data), nagłówek dnia z sumą i rozbiciem
  `Wideo … · Audio …`, lista z miniaturami; każdy wpis ma swój czas i rozbicie.
- **Historia u rodzica**: ten sam komponent w panelu (zakładka
  „Historia oglądania”), wariant **bez miniaturek**, tylko do odczytu.
- **Formatowanie**: `domain/watchHistoryView.ts` (czas w pełnych minutach,
  godziny, polskie nazwy dni, rozbicie trybów) + `domain/plural.ts`
  (wspólne „1 film / 2 filmy / 5 filmów”).
- **Wspólny awatar kanału**: `ui/ChannelAvatar.tsx` — zdjęcie z
  `Channel.thumbnailUrl`, a dopóki go nie ma, deterministyczne kolorowe kółko
  z inicjałem (spójne z ADR 0005). Używa go pasek kanałów rodzica i lista dziecka.

## Decyzje po drodze

- **Puste kanały nie trafiają do dziecka**: `channelsForChild` liczy tylko
  dozwolone kanały z min. jednym playable filmem. Kanał `manual` bez decyzji
  rodzica nie jest jeszcze częścią biblioteki.
- **Historia to warstwa prezentacji**: `repository` już zwracał wpisy; `App`
  dociąga `listWatchHistory()` przy `reload()` (m.in. po wyjściu z playera),
  więc nie ma nowego modelu ani zapisu.
- **Nagłówek dnia ma sumę i rozbicie**: `WatchHistoryDay` dostał
  `audioSeconds` / `videoSeconds` obok `totalSeconds` — bez zmiany formatu
  zapisu historii.

## Testy / stan

- Nowe: `__tests__/childNavigation.test.ts` (6),
  `__tests__/watchHistoryView.test.ts` (3), rozszerzone
  `content.test.ts` (2) i `watchHistory.test.ts` (pola rozbicia dnia).
- `npm test` = **135** (było 124), `npx tsc --noEmit` i `npx eslint .` czysto.
- Wersja: **0.4.16 → 0.4.21**, `versionCode 11 → 12`.
- APK release: `KidsTube/android/app/build/outputs/apk/release/app-release.apk`,
  zainstalowany w emulatorze do testów.

## Poprawka po testach (0.4.22)

- **Jedna linia czasu zamiast dwóch**: wpis historii pokazuje teraz
  `oglądane / długość filmu` w formacie `1m / 1h:40m`. Długość pochodzi
  z cache `WatchProgress.durationSeconds` (ostatni znany czas z playera);
  gdy film nie ma jeszcze cache — pokazujemy samo `oglądane`.
- **Nagłówek dnia bez zdublowanego rozbicia**: tylko data po lewej i suma
  dnia po prawej (`Łącznie 1h:40m`), bez linii `Wideo … · Audio …`.
- **Historia dziecka jest klikalna**: dotknięcie wpisu otwiera odtwarzacz
  (z wznowieniem, ścieżką bramki czasu i budżetu jak zwykłe otwarcie filmu).
  Wpis filmu usuniętego/zablokowanego zostaje w historii, ale pokazuje
  komunikat „Film niedostępny”. Panel rodzica pozostaje read-only; jego wpisy
  pokazują teraz jedną, zwartą sumę czasu.
- Wersja: **0.4.21 → 0.4.22**, `versionCode 12 → 13`; `npm test` = 135,
  `tsc`/`eslint` czysto.

## Poprawka po testach (0.4.23)

- **Badge na feedzie/kanałach** pokazuje teraz pozycję w filmie z cache:
  `ostatnia oglądana minuta / długość` (np. `12m / 1h:40m`), a dla skrajnych
  stanów nadal `Nowy` / `✓ W całości`.
- **Historia dziecka** pokazuje tę samą pozycję plus czas sesji w zwartej
  postaci: `12m / 1h:40m · Sesja 25m`. Wpis pozostaje klikalny.
- **Panel rodzica** pokazuje wyłącznie czas sesji: `Sesja 25m`.
- Nagłówki dni nadal tylko suma dnia; formaty czasu (`formatCompactDuration`,
  `formatDurationRatio`) przeniesione do `domain/duration.ts`.
- Wersja: **0.4.22 → 0.4.23**, `versionCode 13 → 14`; `npm test` = 135,
  `tsc`/`eslint` czysto.
