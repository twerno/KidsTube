# ADR 0016 — Panel rodzica: indeks, sekcje i reguły widoku

Panel rodzica wyrósł w płaski rząd sześciu zakładek, w którym codzienne
zatwierdzanie stało obok rzadkich ustawień, filtry dublowały się w każdej
liście, a zakładka „Decyzje” (ADR 0010) nigdy nie powstała. Ten ADR porządkuje
**wyłącznie UX i informację**: panel staje się **indeksem z podsumowaniem i
sekcjami**, z jawnym stosem nawigacji i jednym zestawem reguł dla filtrów,
liczników, pustych stanów i podglądu. Reguły domenowe (decyzje, polityka
kanału, limity czasu, uprawnienia dziecka) **nie zmieniają się** — poza
sześcioma świadomymi wyjątkami wypisanymi niżej. Grupowanie zakładek z ADR 0005
zostaje zastąpione; reszta ADR 0005 obowiązuje.

## Decyzja

### Indeks panelu

Panel po PIN-ie otwiera **indeks**: pionowo przewijana lista.

- Na górze **podsumowanie** — trzy wiersze, dane wyłącznie z istniejącego stanu:
  1. `Pozostało wideo dziś: 1h:15m` (albo `Bez limitu`, gdy bramka wyłączona),
  2. `Dziś — Filmy: 1h:15m (3) · Audio: 12m (2)`,
  3. `7 dni — Filmy: 25m (2) · Audio: 7m (1)` (średnia dzienna / 7 dni
     kalendarzowych, dni bez oglądania liczą się jako zero; wartości ułamkowe
     są zaokrąglane).
  Nawias w wierszu 2 to liczba **materiałów odtworzonych w danym trybie**
  (materiał częściowo wideo, częściowo audio liczy się w obu). Legenda pod
  wierszem wyjaśnia nawias. Format czasu: `formatCompactDuration`.
- Niżej **sekcje** jako klikalne przyciski. Każda pokazuje swój stan bez
  otwierania (liczba, włączone/wyłączone). Wejście w sekcję to osobny ekran.

### Sekcje (kolejność)

1. **Do zatwierdzenia** — licznik = **wszystkie pozycje czekające na decyzję**
   (filmy + propozycje kanałów), bez rzeczownika: `Do zatwierdzenia (12)`;
   gdy są propozycje kanałów, podpis `10 filmów · 2 kanały`.
2. **Biblioteka** — filmy i kanały widoczne dziecku.
3. **Zablokowane** — archiwum; **bez licznika**, zawsze widoczna.
4. **Dodaj film/kanał**.
5. **Historia oglądania**.
6. **Kontrola czasu oglądania**.
7. **Zmień kod rodzica**.
8. **Powiąż z linkami YouTube**.
9. **Log**.

Sekcja 3 jest archiwum, nie kolejką — dlatego nie pokazuje liczby (liczba nie
zmienia żadnej decyzji rodzica). Pozostałe sekcje pokazują stan tylko tam, gdzie
jest on sygnałem do działania.

### Sekcja 1 — Do zatwierdzenia

- **Poziom 1 (źródło):** `Wszystkie · Z kanału · Od dziecka · Z linku`.
  - `Z kanału` = filmy z `source: 'rss'` (skan kanału `manual`).
  - `Od dziecka` = wyłącznie `source: 'propose'` (przycisk dziecka).
  - `Z linku` = `source: 'share'` i `source: 'manual'` — wszystko, co przyszło
    linkiem, niezależnie od tego, kto go wkleił. Udostępnienie z `ACTION_SEND`
    nie jest przypisywane dziecku.
- **Poziom 2 (kanał):** wspólny **pasek kanałów** (awatar + nazwa + liczba), ten
  sam komponent co w sekcji 2. Pozycja **„Kanał nieznany”** = filmy **bez
  `channelId`** (nazwa z oEmbed nie tworzy pozycji); widoczna tylko wtedy, gdy
  takie filmy istnieją. Kanał z `channelId`, ale bez rekordu `Channel`, ma
  zwykłą pozycję z markerem **„nieobserwowany”** — zatwierdzenie jego filmu
  założy kanał wyciszony (ADR 0015).
- **Propozycje kanałów** — osobna grupa na górze listy (jak dotychczas), akcje
  `Dodaj kanał` / `Odrzuć` / `Spróbuj ponownie`.
- Filmy z **zablokowanych kanałów** nie pojawiają się tutaj (patrz
  „Widoczność i blokada kanału”).

### Sekcja 2 — Biblioteka

- **Poziom 1:** `Filmy | Kanały`.
- **Filmy:** wyłącznie filmy `allowed`, których kanał nie jest zablokowany —
  czyli dokładnie to, co widzi dziecko. Pasek kanałów jak wyżej; przy aktywnym
  filtrze kanału pojawia się jawny przycisk **„Edytuj kanał”** (tap w ikonę
  nadal tylko filtruje — ADR 0005).
- **Kanały:** lista kart kanałów; **bez inputa dodawania** (przeniesiony do
  sekcji 4). Tap w wiersz otwiera **kartę kanału** jako ekran.
- **Karta kanału** (jeden komponent w trzech kontekstach: tutaj, z paska w
  „Filmach”, inline w sekcji 4): nazwa, handle, avatar, liczby `dozwolone /
  oczekujące`, polityka (`auto_approve` / `manual`), wyciszenie, blokada.
  **Bez „Usuń”** i bez „Synchronizuj”.

### Sekcja 3 — Zablokowane

- Zawsze widoczna; pusta → `Nic nie zostało zablokowane ani odrzucone.`
- Zawiera: **kanały zablokowane wraz z ich filmami** (akcja `Odblokuj`) oraz
  **filmy zablokowane decyzją** (akcja `Przywróć`). To jedyne miejsce, w którym
  te akcje istnieją.
- Cofnięcie zgody w sekcji 2 przenosi film tutaj; przywrócenie wraca go do
  biblioteki.

### Sekcja 4 — Dodaj film/kanał

- Jedno pole linku i jedno działanie **„Dodaj”**. Typ linku rozpoznawany
  **lokalnie** (`parseYouTubeLink`, bez sieci); żadnego switcha i żadnego
  wyboru przed wklejeniem.
- **Film → zawsze `allowed`** + decyzja `manual: allow` (i kanał wyciszony,
  gdy `channelId` znany, a kanału nie ma — ADR 0015). Pod polem pojawia się
  **kafelek filmu** (ten sam co w „Filmach”): `Podgląd`, `Cofnij zgodę`.
- **Kanał → `policy: 'manual'`, `muted: false`, `status: 'allowed'`**, od razu
  synchronizacja RSS (filmy trafiają do sekcji 1). Pod polem pojawia się
  **karta kanału**. Nowy kanał dostaje `manual`; kanał już istniejący
  zachowuje politykę, którą rodzic wybrał wcześniej.
- **Czerwone ostrzeżenie**, gdy kanał dodawanego filmu jest zablokowany: film
  zostaje dodany (`allowed`), ale kafelek mówi, że dziecko go nie widzi;
  cofnięcie = istniejące `Cofnij zgodę` (nowa decyzja `manual: reject`,
  last-wins).
- **Wszystko albo nic:** brak tytułu lub `channelId` (film) / brak feedu
  (kanał) → **nic nie zapisujemy**; krótki komunikat, `Szczegóły` z dokładnym
  powodem, `Spróbuj ponownie` z zachowanym linkiem.
- Kafelek pod inputem jest **efemeryczny** — pokazuje ostatnio dodaną pozycję
  w sesji sekcji i znika po jej opuszczeniu.

### Sekcja 5 — Historia oglądania

Jak dotychczas: pogrupowana po dniach, w panelu lista tekstowa bez miniaturek.
**Podgląd dostępny dla każdego materiału**, także takiego, którego nie ma już
w bibliotece (odtwarzanie po `videoId` ze snapshotu, z etykietą
`nie ma już w bibliotece`).

### Sekcja 6 — Kontrola czasu oglądania

Jak dotychczas: wykorzystanie dzisiaj, pula dodatkowego czasu, reset licznika
i edytor okna / limitu dziennego.

### Sekcja 7 — Zmień kod rodzica

Jak dotychczas (dotychczasowy ekran ustawiania PIN), ale **powrót prowadzi do
indeksu panelu**, nie do świata dziecka.

### Sekcja 8 — Powiąż z linkami YouTube

Jak dotychczas (ADR 0014): przełącznik + wejście w systemowe ustawienia
otwierania linków.

### Sekcja 9 — Log

- Bufor **w pamięci**, ostatnie ~100 zdarzeń bieżącej sesji: czas, poziom, tag,
  komunikat. Tylko odczyt.
- **Bez persystencji, bez eksportu, bez danych wrażliwych** — PIN nie jest
  logowany w żadnej formie.
- Zdarzenia, które dotąd szły wyłącznie do `console.log` (`[KidTube:*]`), trafiają
  też do bufora. Sekcja jest jedynym kanałem diagnozy dla rodzica, bo aplikacja
  jest sideloadowana (ADR 0007) i nie ma dostępu do `logcat`.

### Pasek decyzji (10 s)

- Po każdej decyzji podjętej w panelu (wiersz listy albo podgląd) na dole
  pojawia się pasek: wynik („Zatwierdzono” / „Odrzucono”), tytuł filmu i
  **`Cofnij`**. Znika po 10 sekundach; kolejna decyzja zastępuje pasek
  i resetuje licznik.
- `Cofnij` przywraca stan sprzed decyzji: film był `pending` → wpis
  `retract` (wraca do kolejki); był `allowed` → nowa decyzja `allow`; był
  `blocked` → nowa decyzja `reject`.
- To rozszerza model ADR 0001 o **trzeci wynik decyzji `retract`**
  (projekcja: `pending`). Historia pozostaje **append-only** — cofnięcie jest
  nowym wpisem, nie usunięciem. Powtórka propozycji po `retract` nie
  auto-rozstrzyga: film zostaje w kolejce.
- Pasek dotyczy wyłącznie decyzji podejmowanych w panelu; świat dziecka nie
  ma takiej akcji.

### Nawigacja

- Jawny **stos ekranów panelu**: `indeks → sekcja → karta kanału → podgląd`.
  Cofnięcie zdejmuje ekran; na indeksie zamyka panel. Sprzętowy back robi to
  samo co strzałka (dziś panel nie ma żadnego `BackHandler`).
- **„Zamknij” tylko w nagłówku indeksu**; sekcje mają strzałkę wstecz. Wyjście
  z panelu wymaga więc dwóch cofnięć z sekcji.
- **Filtry i pozycja listy przeżywają powrót** w obrębie sesji panelu i
  resetują się przy jego zamknięciu. Podgląd i karta kanału niosą adres
  powrotu — po decyzji w podglądzie rodzic wraca do sekcji z zachowanym filtrem,
  nie na początek kolejki.

### Liczniki i filtry

- Liczby przy chipach to **przecięcie obu poziomów**: poziom 1 liczy się
  w obrębie wybranego kanału, pasek kanałów — w obrębie wybranego źródła. Liczba
  znaczy „ile zobaczę po tapnięciu”.
- Jeśli wybrany kanał zniknie z paska (zablokowany), filtr czyści się sam.
- **Pusto w filtrze ≠ pusto w ogóle**: komunikat filtrowany mówi `Brak w tym
  filtrze`, a lista bez danych mówi, że nic nie ma.

### Synchronizacja

- **Bez przycisku „Synchronizuj”.** Manualny sync = **pull-to-refresh** na
  listach treści: sekcja 1, sekcja 2 (Filmy, Kanały). Nie w „Zablokowanych”
  (sync nic tam nie tworzy) ani w „Historii oglądania” (dane lokalne).
- Ten sam wspólny przebieg co przy starcie aplikacji i pull-to-refresh dziecka;
  równoległe wywołania scali się w jeden (ADR 0006).

### Widoczność i blokada kanału

- **Stan kanału nigdy nie przepisuje statusu filmu.** Widoczność wynika
  z projekcji: decyzja najnowsza + stan kanału.
- Blokada kanału: kanał i **wszystkie jego filmy** (także oczekujące) trafiają
  pod kanał w sekcji „Zablokowane”; filmy zatwierdzone zachowują `allowed`.
- Odblokowanie **przywraca** filmy do stanu sprzed blokady: oczekujące wracają
  do kolejki, dozwolone do biblioteki. Żadne decyzje nie są przy tym zapisywane.
- Filmy kanału zablokowanego są **tylko do odczytu** (podgląd, znacznik
  „wstrzymany”) — decyzja per film nic by nie zmieniła, więc nie jest oferowana.
- **„Usuń kanał” znika.** Rolę usuwania przejmuje blokada: kanał znika z listy
  i z oczu dziecka, ale pozostaje odwracalny. Kasowanie rekordu kanału zostawiało
  filmy dziecku widoczne i odtwarzało kanał w pasku jako „nieobserwowany”.

### Podgląd (rodzica)

- Dostępny **zawsze** i wszędzie, gdzie pojawia się materiał: sekcje 1, 2, 3 i 5.
- Akcje zależą od statusu: `pending` → `Odrzuć / Akceptuj`; `allowed` →
  `Cofnij zgodę`; `blocked` → `Przywróć`. Zero tapnięć, które nic nie zmieniają.
- Bez wpływu na limit dzienny, stan obejrzenia ani historię dziecka (ADR 0005).

## Świadome zmiany wobec dzisiejszego działania

To refactor UX, ale pięć rzeczy **celowo** zmienia zachowanie — zapisane,
żeby nikt ich później nie „naprawiał”:

1. **Dodawanie traci switch.** Nie ma już „dodaj film jako oczekujący” ani
   „dodaj kanał od razu jako `auto_approve`”: film zawsze wchodzi jako
   `allowed`, kanał jako `manual` i `not muted`.
2. **Błąd sieci przy dodawaniu nie tworzy rekordu.** Dziś powstawał film
   z tytułem równym `videoId` (od razu widoczny dziecku) albo kanał z tytułem
   `UC…`. Teraz: nic nie zapisujemy, komunikat + ponowna próba.
3. **„Usuń kanał” znika** — zastąpione odwracalną blokadą (wyżej).
4. **Pole „Imię dziecka” znika z panelu** do czasu ADR personalizacji. Zapisane
   imię nadal się wyświetla u dziecka; nie da się go zmienić ani ustawić.
5. **Nowa sekcja „Log”** — bufor sesyjny, jak wyżej.
6. **Trzeci wynik decyzji `retract` + pasek cofnięcia (10 s)** — opis wyżej;
   dotyka modelu decyzji z ADR 0001 (dopuść / odrzuć / cofnij).

Zmiany **1–3 oraz 6 są trwałe**, **4** jest regresją tymczasową wpisaną do backlogu,
a **5** jest dodatkiem diagnostycznym.

## Poza zakresem

- **Zakładka „Decyzje” (ADR 0010) i potwierdzenia akcji masowych.** Nowa IA
  rezerwuje miejsce: przyszła sekcja `Decyzje` wejdzie obok „Historii
  oglądania”. Do tego czasu przełączenie polityki na `auto_approve` nadal
  **po cichu dopuszcza wszystkie oczekujące filmy** kanału — znany dług.
- **Personalizacja dziecka** (imię, avatar, kolor) — osobny ADR.
- **Import katalogu kanału (ADR 0009)** — osobny cykl życia (paginacja,
  checkpoint, budżet stron).
- **Wyjątek „zachowaj jeden film z zablokowanego kanału”.** Wymaga rozdzielenia
  tego, co dziś skleja `Channel.status`: obecność w panelu, pobieranie RSS,
  widoczność filmów u dziecka. Do czasu tego ADR-a blokada ukrywa wszystkie
  filmy kanału.
- **Czas ostatniej synchronizacji / „nowe od ostatniej wizyty”** — nie ma
  takiego stanu i ten ADR go nie dodaje.

## Rozważone opcje

- **Płaski rząd chipów (stan obecny)** — odrzucony: brak hierarchii, część
  zakładek poza krawędzią ekranu, brak miejsca na podsumowanie.
- **Grupy zakładek z ADR 0005 (dwa poziomy chipów)** — odrzucone: podwójna
  nawigacja, grupa i zakładka konkurują o uwagę, a „Ustawienia → Ustawienia”
  wymagało sztucznych nazw.
- **Hub z kafelkami** — odrzucony na rzecz listy z podsumowaniem: kafelki dają
  więcej miejsca na liczby, ale wymagają nowego ekranu i tracą kontekst przy
  skakaniu między listami.
- **Licznik przy „Zablokowane”** — odrzucony: archiwum nie sygnalizuje pracy
  do wykonania.
- **Ukrywanie „Zablokowane”, gdy pusta** — odrzucone: indeks skacze między
  wejściami, rodzic nie uczy się układu.
- **„Kanał nieznany” = kanał nieobserwowany** — odrzucone: dwa różne skutki
  zatwierdzenia pod jedną etykietą.
- **Usuwanie rekordu kanału** — odrzucone: filmy zostają dziecku, kanał wraca
  do paska jako nieobserwowany; blokada jest odwracalna i robi to samo.
- **Zapis decyzji `reject` przy blokadzie kanału** — odrzucony: cicha akcja
  masowa, nieodwracalna, wprost sprzeczna z „filmy zatwierdzone bez zmian”.
- **Best-effort zapis przy błędzie sieci** — odrzucony: śmieci w bibliotece
  widoczne dziecku.
- **Podgląd bez akcji** — odrzucony: rodzic obejrzał film i musi wracać do
  wiersza; **podgląd z oboma akcjami na sztywno** — odrzucony: bezsensowne
  wpisy w historii.

## Konsekwencje

- Panel przestaje być zakładkami w jednym pliku: powstaje moduł tras panelu ze
  stosem, `ParentScreen` rozpada się na indeks + ekrany sekcji, a `App.tsx`
  oddaje orkiestrację panelu (dziś ~740 linii i 25 propsów `ParentScreen`).
- Etykiety źródła (`SOURCE_LABEL`) wychodzą z `PendingTab` — UI nie może
  dostarczać etykiet warstwie orkiestracji.
- Filtr kanałów działa po `channelId` (dane już je mają); dzisiejsze filtrowanie
  po `channelTitle` znika razem z ikonami budowanymi z tytułów.
- Pokrycie testami: dziś panel nie ma **ani jednego** testu UI. Nowe reguły
  (liczniki-przecięcia, projekcja blokady, akcje podglądu wg statusu, błędy
  dodawania, stos nawigacji) muszą dostać testy — inaczej refactor jest
  niezweryfikowany.
- „Zablokowane” rośnie bez licznika i bez czyszczenia; rekordy zablokowanych
  kanałów zostają na zawsze (brak usuwania) — świadomie, dla odwracalności.
- Sekcja „Log” po restarcie aplikacji jest pusta — to nie jest kronika, tylko
  bufor sesji.
