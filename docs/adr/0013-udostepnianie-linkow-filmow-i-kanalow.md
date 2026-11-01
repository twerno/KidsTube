# ADR 0013 — Udostępnianie linków YouTube: film i kanał na listę oczekujących

> Wdrożone — szczegóły: `docs/notes/ADR-0013-0014-wdrozenie.md`.

Udostępnienie linku (`ACTION_SEND`) jest najbardziej pewną drogą dodawania
treści do KidTube (ADR 0005, ADR 0007). Obecny potok rozpoznaje film i tworzy
wpis `pending`, ale nie wiąże go z kanałem, więc nie potrafi zastosować polityki
`auto_approve`. Link do kanału kończy się komunikatem zamiast trafić do rodzica.
To dwie luki w tym samym mechanizmie.

Decyzja: **każdy udostępniony link YouTube jest automatycznie przetwarzany
przez jeden wspólny potok** — niezależnie od tego, czy pochodzi z aplikacji
YouTube, przeglądarki, innej aplikacji czy z opcjonalnego przechwytywania
linków (ADR 0014). Obsługiwane są dwa rodzaje celu: **film** i **kanał**.
Link do playlisty, wyszukiwania, strony głównej lub innego nieobsługiwanego
kształtu nie jest dodawany; aplikacja pokazuje komunikat i nie otwiera
przeglądarki.

## Wejście i wspólne reguły

- Z udostępnionego tekstu wyciągamy **pierwszy rozpoznany link YouTube**
  (albo sam identyfikator filmu / `@handle`); resztę tekstu ignorujemy.
- Rozpoznajemy te same kształty co parser linków: `watch`, `shorts`, `live`,
  `embed`, `youtu.be`, `vnd.youtube:`, `/channel/UC…`, `/@handle`, `/c/…`,
  `/user/…`.
- **Deduplikacja jest obowiązkowa**: powtórne udostępnienie tego samego filmu
  lub kanału nie tworzy drugiego wpisu.
- Udostępnienie **nie uruchamia odtwarzania** — także wtedy, gdy film jest już
  zaakceptowany. Traktujemy akcję jako dodanie/rozstrzygnięcie treści; po
  przetworzeniu aplikacja pokazuje potwierdzenie, a dziecko otwiera film
  samodzielnie z biblioteki. Udostępnienie nie omija też bramek czasu
  (ADR 0002) ani zasad widoczności.
- Metadane są pobierane **best-effort**. Brak sieci nie blokuje dodania filmu
  ani zapisania propozycji kanału; wpis może tymczasowo mieć identyfikator
  zamiast tytułu.
- Udostępnienie nie wymaga kodu rodzica: prowadzi wyłącznie do listy
  oczekującej albo do statusu wynikającego z wcześniej zaufanej polityki
  kanału. Rozstrzygnięcie propozycji kanału wymaga już panelu rodzica.

## Film

Dla linku do filmu:

1. Jeśli film już istnieje, nie tworzymy duplikatu. Widoczność rozstrzyga
   ostatnia decyzja (ADR 0001) albo zapisany status.
2. Dla nowego filmu pobieramy metadane: oEmbed (tytuł, miniatura) oraz
   InnerTube `player` (data publikacji i **`channelId`**). Rozpoznanie kanału
   jest potrzebne tylko do zastosowania jego polityki — nie tworzy kanału.
3. Status filmu spoza biblioteki wynika z kanału i historii decyzji:
   - kanał znany i **zablokowany** → `blocked`,
   - ostatnia decyzja to **odrzucenie** → `blocked`,
   - ostatnia decyzja to **dopuszczenie** → `allowed` (historia przeżywa
     usunięcie filmu, więc nie pytamy o niego ponownie),
   - kanał znany, nieblokowany, polityka **`auto_approve`** → `allowed`,
   - w pozostałych przypadkach → `pending`: kanał `manual`, kanał nieznany
     albo brak pewnego `channelId`.

Nowy film dozwolony przez politykę `auto_approve` **nie dostaje wpisu
w historii decyzji** — dokładnie tak jak filmy z synchronizacji RSS (ADR 0001).
Polityka nadaje status wyłącznie filmowi, który nie ma jeszcze decyzji;
ostatnia decyzja rodzica zawsze wygrywa z polityką kanału. Dotyczy to także
starszych filmów kanału `auto_approve`, nie tylko nowości z RSS.

Film z udostępnienia zapisujemy ze źródłem `share` i — gdy udało się je
rozpoznać — z `channelId` oraz nazwą kanału. **Nie zakładamy kanału
automatycznie** na podstawie filmu: dodanie kanału jest osobną, strukturalną
akcją rodzica, a nie efektem ubocznym linku do jednego filmu.

## Kanał

Dla linku do kanału:

- **kanał już znany i dozwolony** → bez duplikatu; komunikat „Kanał już
  dodany”. Nie zmieniamy jego polityki.
- **kanał znany i zablokowany** → komunikat; nie tworzymy propozycji i nie
  odblokowujemy kanału. Rodzic musi to zrobić jawnie w liście kanałów.
- **kanał nieznany** → powstaje **propozycja kanału**: nowy, oczekujący byt,
  jeszcze nie `Channel`. Rozwiązujemy link do `channelId` przez InnerTube
  (dla `@handle`, `/c/…`, `/user/…`, `/channel/UC…`) i zapisujemy surowy link,
  metadane oraz czas zgłoszenia.

Propozycja kanału:

- **nie synchronizuje RSS**, nie pojawia się w bibliotece dziecka i nie
  zmienia świata dziecka,
- jest widoczna **wyłącznie w panelu rodzica** — w zakładce Oczekujące,
  w osobnej sekcji „Kanały”, z etykietą „udostępniony kanał”,
- jest deduplikowana po `channelId`, a gdy kanału nie udało się rozwiązać —
  po surowym linku.

Rodzic rozstrzyga propozycję w panelu:

- **„Dodaj kanał”** tworzy `Channel` z polityką **`manual`** i statusem
  `allowed`, a następnie uruchamia RSS. Wszystkie bieżące filmy kanału trafiają
  na listę oczekujących zgodnie z ADR 0001. Rodzic może później włączyć
  auto-akceptację i skorzystać z akcji zbiorczych (ADR 0010).
- **„Odrzuć”** usuwa propozycję. To nie jest decyzja o filmie, więc nie trafia
  do historii decyzji (ADR 0001/ADR 0010); ten sam kanał może zostać
  zaproponowany ponownie.

Nowy kanał zawsze startuje z polityką `manual`. Udostępnienie nie jest
wystarczającym zaufaniem, by objąć kanał auto-akceptacją — to musi być osobna
decyzja rodzica.

Gdy rozwiązanie kanału się nie uda (brak sieci, zmieniony handle), propozycja
zostaje zapisana z surowym linkiem i stanem „nierozwiązana”. Rodzic może
ponowić rozwiązanie albo ją odrzucić. Nie dopasowujemy kanału po samym tytule
ani nazwie autora — to zbyt zawodne.

## Widoczność i komunikaty

- Wpisy filmowe ze źródłem `share`, które pozostają `pending`, trafiają do
  listy oczekujących rodzica; ich etykieta i widoczność w świecie dziecka
  pozostają zgodne z ADR 0001 i ADR 0004.
- Propozycje kanałów są wyłącznie rodzicielskie. Udostępnienie linku do kanału
  kończy się potwierdzeniem, że kanał czeka na decyzję rodzica.
- Komunikaty po przetworzeniu: „Dodano do zatwierdzenia” (film `pending`),
  „Dodano do biblioteki” (film `allowed` przez `auto_approve`), „Już
  w bibliotece” (znany film dozwolony), „Zablokowane” (film lub kanał
  zablokowany), „Kanał dodany do zatwierdzenia” (nowa propozycja kanału),
  „Kanał już dodany” (znany kanał).

## Rozważone opcje

- **Zawsze `pending` dla udostępnionego filmu** — odrzucone: przeczy polityce
  `auto_approve`; rodzic już zaufał kanałowi, a link nie jest nową decyzją.
- **Udostępniony kanał dodawany od razu jako `Channel`** — odrzucone: link nie
  jest zgodą na wejście kanału do biblioteki dziecka; dodanie kanału ma być
  jawną akcją rodzica.
- **Nowy kanał od razu z `auto_approve`** — odrzucone: jedno udostępnienie nie
  może objąć zaufaniem wszystkich przyszłych filmów kanału.
- **Dopasowanie kanału po tytule / nazwie autora z oEmbed** — odrzucone:
  tytuły nie są identyfikatorami, łatwe do podrobienia i mylne.
- **Automatyczne zakładanie kanału z linku do filmu** — odrzucone: zaśmieca
  listę kanałów i miesza strukturalną decyzję z dodaniem jednego filmu.
- **Odrzucanie udostępnienia bez sieci** — odrzucone: link ma trafić do
  rodzica także wtedy, gdy metadanych nie da się teraz pobrać.
- **Osobna skrzynka udostępnień** — odrzucone: lista oczekujących jest już
  właściwym miejscem; druga lista dublowałaby proces decyzji.
- **Automatyczne odtwarzanie dozwolonego filmu po udostępnieniu** — odrzucone:
  udostępnienie nie musi pochodzić od dziecka i nie powinno przejmować ekranu;
  dodanie/rozstrzygnięcie treści to inna intencja niż „zagraj teraz”.
- **Propozycje kanałów w historii decyzji** — odrzucone: historia dotyczy
  decyzji o filmach (ADR 0001/ADR 0010), a dodanie kanału jest akcją
  strukturalną, nie allow/reject filmu.
- **Propozycje kanałów widoczne u dziecka** — odrzucone: dziecko nie zarządza
  kanałami i nie może ich zatwierdzać.
- **Import playlisty z udostępnionego linku** — poza zakresem; playlisty to
  odrębny temat (por. ADR 0009).
- **Otwieranie nieznanego linku w WebView/przeglądarce** — odrzucone: łamie
  kuratorowany model biblioteki (ADR 0001/ADR 0003).

## Konsekwencje

- Potok `services/incomingLink.ts` zyskuje rozróżnienie wyniku: film
  `allowed` przez politykę, film `pending`, propozycja kanału (rozwiązana lub
  nierozwiązana), kanał znany / zablokowany.
- Metadane filmu muszą zwracać `channelId` z InnerTube `player` (dziś
  wykorzystywany głównie do daty publikacji).
- Powstaje lokalny typ **propozycji kanału** i rekord w repozytorium, osobny
  od `Channel`. Dopiero zatwierdzenie tworzy `Channel` i uruchamia RSS.
- Panel Oczekujące dostaje drugi rodzaj elementu (kanał) oraz akcje
  „Dodaj kanał” / „Odrzuć”; lista filmów i jej decyzje pozostają bez zmian.
- Propozycje kanałów nie trafiają do historii decyzji i nie podlegają
  last-wins. Po odrzuceniu mogą wrócić jako nowa propozycja.
- Filmy `auto_approve` z udostępnienia nie tworzą decyzji, więc ich późniejsze
  zbiorcze odrzucenie działa przez zwykłe akcje ADR 0010.
- Wymagane testy: film z kanału `auto_approve` / `manual` / zablokowanego /
  nieznanego; starszy film z `auto_approve`; ostatnia decyzja wygrywa
  z polityką; powtórne udostępnienie bez duplikatu; kanał nowy, znany,
  zablokowany i nierozwiązany; zatwierdzenie kanału tworzy `manual` i kolejkuje
  RSS; odrzucenie nie zostawia decyzji; brak autoodtwarzania.
- Po wdrożeniu trzeba zaktualizować README i CONTEXT (lista oczekujących
  zyskuje propozycje kanałów, a opis obsługi linków przestaje być wyłącznie
  filmowy).
