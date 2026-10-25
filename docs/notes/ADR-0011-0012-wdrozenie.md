# Notatki — sesja: ADR 0011 + ADR 0012 (dodatkowy czas, blokada PIN)

Zapis tego, co zrobione. Bez commita do czasu akceptacji.

## ADR 0011 — dodatkowy czas wideo

- Typ `ExtraTimePool` (`dateKey`, `grantedSeconds`, `remainingSeconds`) w
  `domain/types.ts`; lokalny rekord w `Repository` (`get/saveExtraTime`,
  klucz `@kidstube/extra-time/v1`), wspólny dla pamięci i AsyncStorage.
- Czyste reguły w `domain/schedule.ts`:
  - `emptyExtraTime` / `normalizeExtraTime` — pula wygasa z dniem,
  - `grantExtraTime` — kolejne nadania sumują się,
  - `hasTimeGate` — przycisk tylko przy włączonym harmonogramie i oknie/limicie,
  - `consumeVideoSeconds` — zachłannie: w oknie najpierw limit bazowy, pula
    dopiero po jego wyczerpaniu albo poza oknem; przy braku limitu bazowego
    w oknie pula się nie zużywa,
  - `canPlay` i `remainingSecondsToday` przyjmują opcjonalną pulę. Dodatnia
    pula zdejmuje bramkę okna i pokrywa wyczerpany limit; wskaźnik w oknie to
    `limit bazowy + pula`, poza oknem — tylko pula.
- `App` trzyma `extraTime` w stanie oraz w refach, żeby rozliczanie sekund
  odtwarzania było synchroniczne (total usage + pula bez wyścigu odczyt/zapis).
- UI: przycisk „Dodaj więcej czasu” w panelu dziecka (także gdy czas jest),
  w alercie blokady i w overlayu twardego cięcia; wybór `+15 min` / `+1 godz.`,
  potem PIN. Po nadaniu wskaźniki aktualizują się od razu; odtwarzacz po
  cięciu sam wznawia film, a alert otwiera wybrany film.
- Panel rodzica: ScheduleTab pokazuje dodatkowy czas i efektywne pozostałe
  minuty; „Wyzeruj licznik” czyści też pulę dnia.

## ADR 0012 — blokada PIN

- Czysty `domain/pinGuard.ts`: `canAttempt`, `recordFailure`, `recordSuccess`,
  `normalizePinGuard`, `remainingLockMs`, `formatLockCountdown`.
  3 kolejne błędy → blokada 3 min; sukces zeruje; po wygaśnięciu licznik wraca
  do zera; próby w trakcie blokady nie są weryfikowane.
- `PinGuardState` osobno w repozytorium (`@kidstube/pin-guard/v1`), nie
  w `Settings`; przeżywa restart (test AsyncStorage).
- Wspólna weryfikacja `verifyParentPin` w `App` dla panelu rodzica i promptu
  dodatkowego czasu; stan jest czytany z repo przed każdą próbą.
- `PinGateCard` (wspólny dla `GateScreen` i `PinPrompt`) pokazuje odliczanie
  `m:ss`, blokuje pole i przycisk, ale pozwala anulować i wrócić do dziecka.
  Błędy walidacji (za krótki PIN, niezgodne powtórzenie) nie wołają weryfikacji
  i nie liczą się do blokady. Pierwsze ustawienie PIN-u nie jest blokowane.

## Testy / stan

- Nowe: `__tests__/extraTime.test.ts` (10), `__tests__/pinGuard.test.ts` (4),
  `__tests__/timeControlsRepository.test.ts` (5).
- `npm test` = **164** (było 145), `tsc`/`eslint` czysto.
- Wersja: **0.4.26 → 0.5.0**, `versionCode 17 → 18`.
- APK release zbudowany i zainstalowany w emulatorze.

## Poprawka UX (0.5.1)

- Kolejność akcji „Dodaj więcej czasu” odwrócona: **najpierw PIN rodzica**,
  po poprawnym kodzie **popup z wyborem +15 min / +1 godz.**, a dopiero potem
  nadanie. Anulowanie wyboru niczego nie zmienia; nieudany PIN zostawia prompt
  z błędem/blokadą.
- Wersja: **0.5.0 → 0.5.1**, `versionCode 18 → 19`; `npm test` = 164,
  `tsc`/`eslint` czysto.
