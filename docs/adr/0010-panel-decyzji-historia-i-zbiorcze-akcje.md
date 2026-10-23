# ADR 0010 — Panel decyzji: historia i akcje zbiorcze

ADR 0001 ustalił, że decyzje rodzica są **append-only** i **last-wins**, a status
filmu (`allowed` / `pending` / `blocked`) to tylko rzut z historii. Pierwszy krok
— log decyzji, projekcja statusu i auto-rozstrzyganie powtórek propozycji — jest
wdrożony. Ten ADR domyka widoczną część modelu: bez wglądu w historię rodzic nie
może świadomie zmienić błędnej decyzji, a bez potwierdzenia akcje masowe (cofnięcie
autoakceptacji, usunięcie kanału) mogą zniknąć dziecku pół biblioteki jednym tapnięciem.

Decyzja: w panelu rodzica, w grupie **Historia** (ADR 0005), powstaje zakładka
**Decyzje** — pełny, **tylko do odczytu** widok logu:

- Lista **od najnowszych**, wpis pokazuje film (tytuł, miniatura), wynik
  (dopuszczony / odrzucony), **źródło** (ręczna / automatyczna) i **czas**.
  Źródło rozróżnia decyzję rodzica od auto-rozstrzygnięcia powtórki (ADR 0001).
- **Dotknięcie wpisu otwiera dialog zmiany decyzji** — zmiana nie edytuje
  historii, lecz dopisuje kolejny wpis (last-wins). Dialog oferuje także
  **Podgląd** filmu w kontekście rodzica (ADR 0005).
- Historia przeżywa **usunięte filmy i kanały** (append-only, ADR 0001), więc
  wpis może dotyczyć materiału nieobecnego już w bibliotece — wtedy widać sam
  zapis (tytuł/`videoId`, kanał-snapshot), bez akcji podglądu.
- Lista podlega filtrowaniu spójnemu z resztą panelu (pasek ikon kanałów / filtr
  wyniku / źródła), ale bez akcji zmieniających status poza pojedynczym dialogiem.

**Akcje zbiorcze** (jedyne miejsca masowej zmiany stanu — ADR 0005) dostają
obowiązkowe potwierdzenie z **liczbą dotkniętych filmów**:

- **Cofnięcie autoakceptacji** (`auto_approve → manual`) — pytanie „Cofnąć też
  zatwierdzenia N filmów z kanału X?". Potwierdzenie zapisuje **N osobnych
  decyzji** `manual: reject` (jedna na film) — historia pozostaje append-only,
  a statusy wynikają z projekcji. Odrzucenie pytania zostawia filmy dozwolone.
- **Usunięcie kanału** — to samo pytanie; po potwierdzeniu filmy znikają
  z biblioteki, a odrzucenia lądują w historii. Bez potwierdzenia usunięcie
  kanału nie rusza decyzji filmów (choć same filmy i tak znikają z biblioteki).

Wpisów zbiorczych **nie** grupujemy w jeden rekord: pojedyncze decyzje dają
spójny last-wins i pozwalają później zmienić wybrane filmy bez rozplątywania
zbioru.

## Rozważone opcje

- **Edycja / kasowanie wpisów historii** — odrzucona: łamie append-only i
  „decyzja najnowsza" — nie dałoby się odtworzyć, dlaczego film jest widoczny.
- **Zbiorcze odrzucenie jako jeden wpis „grupowy"** — odrzucone: komplikuje
  last-wins (co, gdy rodzic później dopuści jeden film z grupy?) i historię.
- **Ciche akcje masowe bez dialogu** — odrzucone: dokładnie to, przed czym
  chroni ADR 0005; łatwo nieodwracalnie ukryć dziecku wiele filmów.
- **Brak widoku historii** — odrzucone: model jest wtedy nieprzejrzysty, a
  „zmień decyzję" bez kontekstu czasu/źródła mylące.

## Konsekwencje

- Historia rośnie monotonicznie — lista Decyzji potrzebuje wydajnego
  renderowania (wirtualizacja/paginacja) i domyślnego filtra po czasie/kanałe.
- „Zatwierdź wszystkie" dla kanałów `manual` po imporcie katalogu (ADR 0009)
  to naturalne rozszerzenie tej samej mechaniki zbiorczej — poza zakresem tego
  ADR-u, ale budowane na nim.
- Ręcznie dodany film nadal **nie zakłada kanału** (`channelId` wymaga
  InnerTube) — świadomie odłożone, opisane jako osobna konsekwencja ADR 0001.
