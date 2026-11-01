# ADR 0015 — Kanał wyciszony: widoczny w panelu, bez pobierania RSS

> Uzupełnienie ADR 0019: jawne linki i propozycje z kanału wyciszonego trafiają
> do kolejki; tylko skany RSS/katalog respektują cache-only.

Rodzic widzi w panelu film z kanału, którego nie ma na liście kanałów
(np. film dodany ręcznie albo zatwierdzony z linku). Taki film ma nazwę kanału,
ale nie ma rekordu `Channel`: nie da się go pogrupować po kanale, filtrować,
ani później zarządzać kanałem. Z drugiej strony automatyczne „dodanie kanału”
przy każdym zatwierdzonym filmie zasilałoby RSS i wrzucało dziesiątki
oczekujących pozycji — czyli robiło z filmu decyzję o subskrypcji.

Decyzja: `Channel` dostaje opcjonalną flagę **`muted`**. Kanał wyciszony
**nadal istnieje i widnieje w liście kanałów rodzica**, ale **nie pobiera
listy RSS**. Wyciszenie nie jest blokadą: filmy już zatwierdzone zostają
widoczne u dziecka, a kanał może nadal grupować swoje filmy w panelu.

## Reguły

1. **Jawne dodanie kanału nigdy nie tworzy kanału wyciszonego.** Dodanie z
   zakładki „Kanały” (`manual` lub `auto_approve`) oraz zatwierdzenie
   propozycji kanału ustawiają `muted: false` i uruchamiają RSS.
2. **Zatwierdzenie filmu z nieznanego kanału zakłada kanał wyciszony.**
   Jeśli film ma `channelId`, a kanału nie ma w repozytorium, powstaje rekord:
   `policy: 'manual'`, `status: 'allowed'`, `muted: true`, tytuł z
   `video.channelTitle` (fallback: `channelId`). Nie pobieramy wtedy RSS.
   Jeśli film nie ma `channelId`, kanału nie tworzymy — brak stabilnej
   tożsamości do deduplikacji i przyszłego syncu.
3. **Jawne dodanie kanału, który już istnieje jako wyciszony, zdejmuje
   wyciszenie** (`muted: false`) i wznawia pobieranie RSS. Dotyczy to zarówno
   formularza „Dodaj kanał”, jak i zatwierdzenia propozycji kanału.

Dodatkowo, przy starcie aplikacji uruchamiamy **idempotentny backfill**: każdy
film, którego rzutowany status (z historii decyzji) to `allowed`, a jego
`channelId` nie ma rekordu kanału, dostaje kanał wyciszony. Dzięki temu stare
dane i filmy dodane przed wdrożeniem tej reguły zachowują się tak samo.

## Zachowanie

- `syncChannel` i `syncAllChannels` pomijają kanały z `muted: true` —
  niezależnie od tego, czy sync idzie ze startu, pull-to-refresh, panelu czy
  akcji jawnego dodania.
- Wyciszenie jest niezależne od `status` i `policy`. Kanał `auto_approve`,
  który zostanie wyciszony, po prostu nie dostaje nowych filmów z RSS.
  Po odciszeniu nowe filmy znów podlegają jego polityce.
- **Blokada jest silniejsza niż wyciszenie**: kanał `blocked` jest ukryty
  u dziecka i nie pobiera RSS; wyciszenie niczego tu nie zmienia.
- Dziecko nadal widzi kanał, jeśli ma on zatwierdzone filmy — wyciszenie nie
  usuwa treści i nie chowa kanału w świecie dziecka.
- Usunięcie kanału nadal usuwa jego filmy (ADR 0001/0013). Wyciszenie jest
  alternatywą dla usunięcia, gdy rodzic chce zachować kanał i jego filmy,
  ale nie chce subskrybować feedu.
- W panelu rodzica kanał wyciszony ma badge **„wyciszony”** i przełącznik
  **„Wyciszony — bez pobierania listy RSS”**. Odciszenie od razu uruchamia
  jeden sync tego kanału (o ile nie jest zablokowany), tak jak jawne dodanie.

## Rozważone opcje

- **Usuwanie kanału zamiast wyciszenia** — odrzucone: usuwa też filmy i traci
  grupowanie/historię; rodzic często chce tylko przestać pobierać feed.
- **Osobna flaga „obserwuj” obok kanału** — odrzucone: dwa stany opisujące to
  samo (czy pobierać RSS) i więcej miejsc, w których mogą się rozjechać.
- **Automatyczne zakładanie normalnego kanału przy zatwierdzeniu filmu** —
  odrzucone: natychmiastowy sync `manual` wrzuciłby wszystkie bieżące filmy
  kanału na listę oczekującą, czyli decyzja o jednym filmie zmieniałaby
  subskrypcje.
- **Kanał wyciszony jako `blocked`** — odrzucone: blokada ukrywa filmy
  u dziecka i ma inne znaczenie; wyciszenie dotyczy tylko pobierania RSS.
- **Brak backfillu** — odrzucone: filmy dodane przed tą zmianą zostałyby bez
  kanałów, a ich panel nadal nie pozwalałby filtrować po kanale.

## Konsekwencje

- `Channel.muted?: boolean` — brak flagi oznacza `false`, więc dane w
  AsyncStorage nie wymagają migracji.
- Powstaje czysta warstwa `domain/channels.ts` (`isChannelMuted`,
  `withChannelMuted`, `mutedChannelForVideo`) oraz serwis
  `services/channelMuting.ts` (tworzenie kanału przy zatwierdzeniu i backfill).
- Zatwierdzenie propozycji kanału może teraz zwrócić `unmuted` (kanał istniał
  jako wyciszony) — panel pokazuje wtedy komunikat o odciszeniu.
- Ręczne dodanie filmu pobiera teraz `channelId`/`channelTitle` z InnerTube
  `player`, żeby reguła 2 mogła zadziałać również dla tej ścieżki.
- Zmienia się wcześniejsze założenie z ADR 0013 / `CONTEXT.md`, że „film nigdy
  nie zakłada kanału”: zatwierdzony film może założyć kanał **wyciszony**.
  Pełne dodanie kanału (z RSS) pozostaje osobną decyzją rodzica.
- Wymagane testy: brak flagi = niemutowany; sync pomija wyciszone i wraca po
  odciszeniu; zatwierdzenie filmu z nieznanego kanału tworzy jeden wyciszony
  kanał (bez duplikatu); backfill pomija filmy odrzucone/oczekujące i kanały
  już znane; jawne dodanie / zatwierdzenie propozycji odcisza istniejący kanał.
- README i `CONTEXT.md` opisują nowy stan kanału; wersja aplikacji rośnie
  wraz z tą zmianą.
