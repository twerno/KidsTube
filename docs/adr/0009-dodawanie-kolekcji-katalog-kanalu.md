# ADR 0009 — Dodawanie kolekcji: pełny katalog kanału przez InnerTube

> Status: **wdrożone** (0.10.0).

Kanałowy RSS zwraca tylko ~15 najnowszych filmów (ADR 0001). Dla kanałów z
dużą biblioteką (np. audiobooki, ~250 pozycji) ręczne dodawanie linków jest
niepraktyczne. Potrzebujemy masowego dociągnięcia starszych pozycji.

Decyzja: rodzic dostaje na kanale **jawny przycisk „Wczytaj cały katalog"**.
Akcja pobiera pełną listę filmów kanału przez YouTube InnerTube
(`youtubei/v1/browse`, zakładka „Videos", paginacja tokenem `continuation`) —
tym samym publicznym klientem WEB, którego już używamy do rozwiązywania
kanałów, bez klucza API i bez backendu. Pobrane pozycje przechodzą przez
istniejący potok `rssToVideos` + `mergeSyncedVideos`, więc **polityka kanału
decyduje o statusie**: `auto_approve` → wszystkie dozwolone, `manual` →
wszystkie oczekujące (ADR 0001). Istniejące decyzje rodzica nie są nadpisywane
(merge zachowuje status znanych filmów).

Import jest świadomą akcją, nie automatycznym efektem dodania kanału — dodanie
kanału zostaje szybkie (RSS). Import pokazuje postęp/licznik („wczytano X
filmów") i **tempo jest celowo ludzkie**: przed każdym kolejnym żądaniem losowa
pauza `5 s ± 2 s`. To bezpiecznik, a nie odwzorowanie limitu Google — limit
niezalogowanego InnerTube jest nieznany i nieudokumentowany. Bieg trwa do końca
katalogu albo do pierwszego błędu (429/403/sieć/parse/timeout 20 s); nie ma
dziennego budżetu stron.

### Tempo, przebieg i wznawianie

- **Tempo**: pierwsze żądanie od razu, każde kolejne po losowej pauzie
  `3000 + Math.random()*4000` (3–7 s). Żadnych równoległych stron.
- **Koniec biegu**: wyczerpany katalog (`brak nextToken`) albo **pierwszy błąd**
  — 429/403, błąd sieci, nieparsowalna odpowiedź lub **timeout 20 s** na
  żądanie. Błąd kończy bieg miękko: checkpoint zostaje, panel pokazuje
  „Wczytano X · dokończ później".
- **Checkpoint per kanał**: token strony, która wyprodukowała ostatnią
  wczytaną stronę (`resumeToken`), licznik `imported`, `done` i ostatni błąd.
  Zapis po każdej stronie; przeżywa zamknięcie aplikacji. Licznik to **liczba
  filmów kanału po scaleniu**, nie suma stron — dzięki temu powtórka ostatniej
  strony przy wznowieniu niczego nie gubi ani nie dubluje.
- **Wznowienie tylko po jawnym tapnięciu** („Kontynuuj pobieranie”); start
  aplikacji niczego nie wznawia.
- Przed wznowieniem **ponawiamy ostatnią wczytaną stronę**, by wykryć, czy nowe
  filmy nie przesunęły zakresu; duplikaty są odsiewane po `videoId`, a licznik
  nie rośnie od powtórki.
- Wygasły token: powtórzona strona wraca pusta → checkpoint jest zerowany
  i następne pobranie startuje od początku (bezpieczne dzięki deduplikacji).
- **Panel postępu** jest modalny i blokuje panel na czas biegu; ma „Przerwij”
  (checkpoint zostaje) oraz licznik wczytanych filmów. Po `done` przycisk na
  karcie kanału jest nieaktywny: „Katalog wczytany”.

### Kanały wyciszone i zablokowane

- Przycisk „Pobierz wszystkie” jest na **każdym niezablokowanym** kanale, także
  wyciszonym — import jest jawną akcją i nie zmienia polityki ani wyciszenia.
- Filmy z kanału wyciszonego są **pobierane i zapisywane**, ale **nie pojawiają
  się w „Do zatwierdzenia”** dopóki kanał jest wyciszony. Po odciszeniu wracają
  do kolejki; akcje zbiorcze na karcie kanału obejmują je także wtedy, gdy są
  ukryte.
- Kanał zablokowany nie ma akcji importu — jego filmy i tak są niewidoczne dla
  dziecka, a karta w archiwum ma tylko „Odblokuj”.

### Daty publikacji z katalogu

RSS niesie dokładną datę publikacji. Katalog InnerTube podaje ją wyłącznie jako
etykietę względną („2 days ago”, „Streamed 1 month ago”), więc parser zamienia
ją na **przybliżony** `publishedAt` (miesiąc = 30 dni, rok = 365 dni). Zapytanie
katalogu wymusza `hl: 'en'`, żeby etykiety były parsowalne. Brak etykiety
oznacza `publishedAt` nieustawione — takie filmy trafiają do „Bez daty”, a nie
do grupy „ostatnio dodane”. Data importu służy wtedy wyłącznie jako fallback
sortowania wewnątrz „Bez daty”; nigdy nie udaje daty publikacji (ADR 0020).

## Rozważone opcje

- **Automatyczny import przy dodaniu kanału** — odrzucone: czas zależny od
  rozmiaru kanału, zaskoczenie setkami pozycji, obciążenie sieci bez decyzji
  rodzica.
- **Import z listą wyboru (checkboxy / „zaznacz wszystkie")** — odłożone:
  więcej kontroli, ale i więcej UI; można dobudować nad tym ADR-em, gdyby
  rodzic chciał importować wybiórczo.
- **Pełny backfill przez YouTube Data API** — odrzucone: wymaga klucza i
  konta (sprzeczne z „bez logowania do Google").

## Konsekwencje

- InnerTube to API wewnętrzne i nieudokumentowane — może się zmienić. Import
  jest więc akcją **best-effort**: przy błędzie/zmianie odpowiedzi zostaje RSS
  (~15) i komunikat, bez psucia reszty. Kształt odpowiedzi trzeba pokryć
  testami na utrwalonym JSON.
- Repo trzyma checkpoint importu per kanał (`resumeToken`, `imported`, `done`,
  `error`) — nowe pole `catalog` w modelu kanału, walidowane i eksportowane
  w kopii bazy (ADR 0017). Zablokowanie kanału checkpointu nie zeruje.
- Import rozłożony na dni jest z natury częściowy: dziecko widzi to, co już
  zaimportowane; reszta dochodzi stopniowo.
- RSS nadal odpowiada za „świeżość" (nowe filmy, ADR 0006), InnerTube tylko
  za jednorazowy backfill historii.
- Deduplikacja po `videoId` (merge). Kanały `manual` po imporcie mogą mieć
  setki pozycji oczekujących, dlatego karta kanału dostaje **„Akceptuj
  wszystkie” / „Odrzuć wszystkie”** z toastem cofnięcia (10 s, `retract` dla
  każdego filmu) — w duchu ADR 0001/0010/0016.
- „Kolekcja" w tym ADR oznacza katalog kanału. Import pojedynczej playlisty
  to odrębny, przyszły temat.