# ADR 0004a — Świat dziecka: pozostały zakres (zakładki, nawigacja, siatka, historia)

ADR 0004 ustalił kształt świata dziecka (cztery zakładki, nawigacja kontekstowa,
stan obejrzenia, historia oglądania). Ta sesja wdrożyła **warstwę danych i
wznowienie**: rdzeń `domain/watchState.ts` + `domain/watchHistory.ts`, trwałość
w `Repository` (memory + AsyncStorage), zbieranie pozycji/czasu w `PlayerScreen`
i `App`, badge stanu obejrzenia na kafelkach Feed oraz poprawki (wyłączony
harmonogram zdejmuje limit, wznowienie bez skoku 0 → X, etykiety bez migania).
Pozostały zakres — widoczna nawigacja i widoki — zapisujemy tutaj, żeby nie
podejmować decyzji ponownie.

## Decyzje z tej sesji (uzupełnienie ADR 0004)

- **Wznowienie = ostatnia pozycja odtwarzania**, nie suma czasu. `WatchProgress`
  trzyma `positionSeconds`; cofnięcie przewijania cofa punkt wznowienia.
  Ukończony film (sticky `completed`) startuje od zera. Dotyczy **tylko dziecka**
  — podgląd rodzica zawsze od początku i nie rusza stanu dziecka.
- **`durationSeconds` w postępie**: czas trwania z playera cache'ujemy po
  pierwszym otwarciu, żeby suwak startował we właściwym miejscu bez czekania na
  ładowanie; przy ładowaniu cache jest nadpisywany realną wartością
  (samowalidacja). Filmy nigdy nieotwarte nie potrzebują długości (pozycja = 0).- **Historia = agregat per film × dzień** (nie osobny wpis na sesję): jeden wpis
  z rozbiciem `audioSeconds` / `videoSeconds`, snapshot tytułu/miniatury/kanału
  (przeżywa usunięcie), `firstWatchedAt` / `lastWatchedAt`. Grupowanie po dniach,
  dni malejąco, materiały w dniu od najświeżej.
- **Start odtwarzania przez `start=` w embedzie** (natywny offset), seek dopiero
  jako zabezpieczenie, gdy embed zignoruje parametr.
- **Stan obejrzenia** pokazywany na kafelkach we wszystkich widokach dziecka
  **poza „Do zatwierdzenia"**.

## Pozostały zakres (do wdrożenia)

- **Cztery zakładki**: Feed · Kanały · Do zatwierdzenia · Historia oglądania
  (dziś tylko Feed + Do zatwierdzenia).
- **Feed jako siatka dużych miniatur** (dziś lista wierszy).
- **Kanały**: lista z logo; wejście w kanał = feed wyfiltrowany do jego filmów.
- **Nawigacja kontekstowa**: stos wstecz po ścieżce użytkownika (feed → film →
  wstecz → feed; kanały → kanał → film → wstecz → kanał), zapamiętany per wejście.
- **Historia u dziecka**: grupowana po dniach (nagłówek dnia ze statystykami),
  lista z miniaturami, suma i rozbicie audio/wideo.
- **Historia u rodzica**: ta sama historia w grupie Historia, lista **tekstowa
  bez miniaturek**, read-only.

## Konsekwencje

- Dane są już zbierane i trwałe — pozostałe widoki to warstwa prezentacji nad
  `watchProgress` / `watchHistory` z `App`, bez zmian w modelu ani w playerze.
- Stos nawigacji dziecka to nowy element; do rozstrzygnięcia w trakcie wdrożenia,
  czy trzymać go w `ChildHomeScreen`, czy wydzielić do `domain`/`ui` (czysty
  reducer ścieżki). Preferowane: czysty reducer + testy.
- Testy, `tsc`, `eslint` i build release — jak przy pozostałych ADR-ach.
