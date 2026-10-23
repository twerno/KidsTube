# ADR 0001 — Model treści: kuratorowana biblioteka + propozycje i decyzje

Dziecko widzi wyłącznie kuratorowaną bibliotekę — nigdy nie dotyka przeglądarki ani
wyszukiwarki YouTube (decyzja „B" z prompt.md). Rodzic dodaje kanały i filmy, dziecko
ogląda tylko to, co dozwolone.

Kanał niesie politykę: `auto_approve` (nowe filmy trafiają do biblioteki dziecka od
razu po synchronizacji) albo `manual` (przy skanowaniu RSS **wszystkie** filmy kanału
trafiają na **listę do zatwierdzenia** — rodzic rozstrzyga, co dziecko zobaczy).

Dziecko może też zgłosić **propozycję** filmu (przycisk „Zaproponuj film” / zakładka
„Do zatwierdzenia”). Propozycje i filmy z kanałów `manual` żyją na wspólnej liście
oczekującej do rozstrzygnięcia (źródło wpisu odróżnia `propose` od `rss`).
Każda **decyzja** (dopuść / odrzuć) jest zapisywana w **historii decyzji**
(append-only, z czasem i źródłem: ręczna / automatyczna). Rodzic może zmienić dowolną
decyzję w każdej chwili; dla kolejnych rozstrzygnięć — w tym powtórek propozycji —
liczy się decyzja najnowsza (last-wins). Powtórna propozycja tego samego filmu
rozstrzyga się automatycznie wg ostatniej decyzji.

Film zna swój kanał; ręcznie dodany film automatycznie zakłada kanał (polityka
`manual`), jeśli nie istnieje — panel rodzica grupuje i filtruje po kanałach.
Zmiana polityki kanału z `auto_approve` na `manual` albo usunięcie kanału
wywołuje pytanie o zbiorcze cofnięcie zatwierdzeń wszystkich dozwolonych filmów
kanału (zbiorcze odrzucenia jako decyzje w historii).

Filmy sortowane są od najświeżej rozstrzygniętych (feed dziecka i listy rodzica).

## Rozważone opcje

- **Model A (filtr na pełnym YouTube)** — odrzucony: wymaga filtrowania reklam,
  rekomendacji i treści w sugestiach — dokładnie to, od czego uciekamy.
- **Lista oczekująca wyłącznie z propozycji dziecka** — odrzucone: rodzic traci
  szybki wgląd w nowości kanałów `manual`; wszystko rozstrzygałby ręcznie od zera.
- **Filmy `auto_approve` tworzą wpisy decyzji przy syncu** — odrzucone: bez
  rozstrzygnięcia typu propozycja nie ma decyzji; liczy się moment dodania.

## Konsekwencje

- Historia decyzji przeżywa usunięte kanały (append-only); filmy (dozwolone —
  po potwierdzeniu — odrzucone, oczekujące i zablokowane) znikają z biblioteki
  wraz z kanałem.
- Usunięcie kanału wymaga dialogu (liczba filmów, których dotknie decyzja).
- „Ostatnia decyzja" to jedyne źródło prawdy dla widoczności filmu u dziecka —
  statusy pochodne (allowed/pending/blocked) są rzutem z historii.