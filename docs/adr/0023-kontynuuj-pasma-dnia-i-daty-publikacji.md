# ADR 0023 — „Kontynuuj oglądanie”: pasma po dniu odtwarzania, próg „rozpoczętego” filmu, uzupełnianie dat publikacji

> Status: **wdrożone** (0.11.14). Zmienia reguły kolejności i progu wejścia z
> ADR 0020 dla zakładki „Kontynuuj oglądanie” oraz dodaje uzupełnianie brakującej
> daty publikacji.

## Pasma dat w „Kontynuuj oglądanie”

Dotąd „Kontynuuj oglądanie” grupowało się po **dacie publikacji**, jak feed i
widok kanału (ADR 0020). To mylące: w zakładce o powrocie do zaczętego filmu
interesuje nas **kiedy dziecko go oglądało**, a nie kiedy film wrzucono na
YouTube — dwie listy obok siebie (feed i kontynuacja) miały te same nagłówki
(„W tym tygodniu”), ale różne znaczenie.

Zakładka grupuje więc filmy po **lokalnym dniu ostatniego odtwarzania**
(`WatchProgress.lastWatchedAt`):

- **Dziś**, **Wczoraj**, dalej **`23 października 2026`** — dokładnie te same
  nagłówki, których używa historia oglądania (`formatHistoryDay`),
- dni od najnowszego, a w obrębie dnia od najświeżej oglądanego filmu,
- data publikacji nie wpływa na kolejność ani na pasma.

Feed i widok kanału zostają przy pasmach publikacji (ADR 0020): tam pytaniem
jest „jak stare są te filmy”. Pasma są nadal wyłącznie prezentacją — dane i
decyzje się nie zmieniają.

## Próg „rozpoczętego” filmu

Do tej pory wystarczyło `positionSeconds > 0`, więc przypadkowe tapnięcie w
kafelek i wyjście po sekundzie wrzucało film do „Kontynuuj oglądanie”.
Film liczy się jako rozpoczęty po **10 sekundach** faktycznego odtwarzania
(`CONTINUE_MIN_POSITION_SECONDS`).

Dlaczego 10 s, a nie samo kliknięcie: kliknięcie nie jest oglądaniem — dziecko
często otwiera kafelek, żeby zobaczyć, co to, i wraca. 10 s to z jednej strony
za mało, by nazwać to „obejrzeniem”, z drugiej dość, by odróżnić zamiar od
przypadku; dziecko, które wyłączyło film po intro, nadal znajduje go w
„Kontynuuj”. Próg jest jedną stałą w `domain/content.ts`, więc zmiana na 5 s
albo 30 s to zmiana liczby i testu.

## „Bez daty” — uzupełnianie brakujących dat publikacji

`publishedAt` trafia do bazy tylko wtedy, gdy źródło je podało: RSS kanału (data
dokładna), `player` InnerTube (dokładna), import katalogu (etykieta względna,
np. „2 weeks ago”). Film zapisany przez starszą wersję aplikacji albo taki, dla
którego zapytanie o metadane nie powiodło się, zostawał **na zawsze** w „Bez
daty”, mimo że YouTube tę datę zna.

Dlatego po każdej synchronizacji leci mała, spokojna partia uzupełnień
(`services/dateBackfill.ts`):

- bierze filmy bez daty, od najświeżej zaimportowanych, pomija zablokowane,
- pyta `player` InnerTube o **dokładną** datę publikacji i zapisuje ją,
- maksymalnie 8 filmów na przebieg, 800 ms przerwy między zapytaniami,
- błąd nie jest ponawiany w tym samym przebiegu (kolejna synchronizacja
  spróbuje znowu), a uzupełnienie nie blokuje listy — spinner gaśnie wcześniej.

Partia jest celowo mała: „Bez daty” ma się opróżniać w tle, a nie zamieniać
każdą synchronizację w serię setek zapytań. Grupa „Bez daty” **nie znika z
kodu** — dopóki źródło nie poda daty, uczciwiej pokazać ją jako nieznaną niż
podstawić datę importu (ADR 0020).

## Konsekwencje

- `domain/videoGroups.ts`: `groupVideosByLastWatched` (+ `VideoDayGroup`);
  nazwy miesięcy z przyimkiem w jednej tablicy — „W październiku”, ale
  „We wrześniu” (wcześniej wszystkie miesiące dostawały „We”, co dawało
  „We październiku”).
- `domain/content.ts`: `CONTINUE_MIN_POSITION_SECONDS = 10`, sortowanie
  kontynuacji po `lastWatchedAt`.
- `ui/child/VideoGrid.tsx`: `groupBy: 'publicationDate' | 'lastWatched' | 'none'`.
- `services/dateBackfill.ts` + wywołanie w `App.tsx` po `syncAllChannels`.
