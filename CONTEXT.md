# KidTube — Kont tekst domenowy

Aplikacja do kuratorowanego oglądania YouTube: rodzic zatwierdza treści, dziecko widzi tylko dozwoloną bibliotekę. Bez konta Google i bez backendu.

## Język

**Biblioteka (dziecka)**:
Zbiór filmów i kanałów widocznych dziecku; zawiera wyłącznie pozycje dozwolone.
_Avoid_: „Wszystkie filmy", „Kanały YouTube"

**Kanał**:
Kanał YouTube dodany przez rodzica; niesie politykę, może być zablokowany albo wyciszony.
_Avoid_: Strona, Twórca

**Kanał wyciszony**:
Kanał widoczny w liście kanałów rodzica, ale niepobierający RSS. Powstaje, gdy rodzic zatwierdzi film z kanału, którego jeszcze nie obserwuje; jawne dodanie kanału zdejmuje wyciszenie. Wyciszenie nie blokuje ani nie usuwa filmów; filmy zaimportowane z katalogu są zapisane, ale nie pojawiają się w kolejce, dopóki kanał jest wyciszony.
_Avoid_: Kanał zablokowany, Kanał usunięty, Kanał nieobserwowany

**Kanał zablokowany**:
Kanał ukryty dziecku i wyłączony z synchronizacji; jego filmy — także oczekujące — trafiają pod kanał w sekcji „Zablokowane”. Blokada nie zapisuje decyzji: odblokowanie przywraca filmy do stanu sprzed blokady. **Wyjątek**: ręczna zgoda rodzica na pojedynczy film, nowsza niż blokada, czyni ten film widocznym bez odblokowywania kanału.
_Avoid_: Usunięty kanał, Kanał wyciszony (to inny stan)

**Aktualizacja kanału**:
Czy kanał pobiera RSS (i katalog). W panelu przełącznik „Aktualizuj kanał (RSS)”; wyłączenie to stan `muted`.
_Avoid_: Subskrypcja, Obserwowanie

**Polityka kanału**:
Reguła dla nowych filmów kanału: `auto_approve` (od razu w bibliotece), `manual` (w kolejce do zatwierdzenia), `auto_block` (od razu odrzucone) albo `quiet` (zapisane w cache, ale poza kolejką — widoczne na ekranie kanału i możliwe do pojedynczego zatwierdzenia).
_Avoid_: Automatyczna akceptacja w znaczeniu „na stałe dozwolone"

**Propozycja**:
Zgłoszenie filmu przez dziecko do rozstrzygnięcia przez rodzica. Żyje w liście oczekującej.
_Avoid_: Życzenie, Prośba o film

**Propozycja kanału**:
Udostępniony link do kanału, którego KidTube jeszcze nie obserwuje. Oczekujący byt **tylko dla rodzica** — nie jest `Channel`, nie synchronizuje RSS, nie trafia do świata dziecka ani do historii decyzji. Zatwierdzenie tworzy kanał `manual` (a jeśli kanał już istnieje jako wyciszony — odcisza go i wznawia RSS), odrzucenie usuwa propozycję (może wrócić później).
_Avoid_: Kanał oczekujący, Zablokowany kanał (to inny stan)

**Lista oczekująca („do zatwierdzenia”)**:
Propozycje dziecka, filmy z kanałów `manual` (dołączone skanem RSS) oraz propozycje kanałów (osobna sekcja, tylko u rodzica), nierozstrzygnięte przez rodzica. U rodzica źródło wpisu jest oznaczone; u dziecka widoczne są tylko własne propozycje filmów.
_Avoid_: Pending jako lista tylko jednego źródła

**Udostępnienie linku**:
Link do filmu lub kanału przysłany przez `ACTION_SEND`. Trafia do wspólnego potoku: film jest dodawany/rozstrzygany wg decyzji i polityki kanału, kanał staje się propozycją kanału. Nie uruchamia odtwarzania i nie omija bramek czasu.
_Avoid_: Odtworzenie linku, „Zagraj teraz”

**Przechwycenie linku (VIEW)**:
Opcjonalne, domyślnie wyłączone przyjęcie przez KidTube systemowego otwarcia linku YouTube (ADR 0014). Przetwarza link tym samym potokiem co udostępnienie; wyłączenie opcji usuwa KidTube z kandydatów systemu.
_Avoid_: Domyślny handler jako stan domyślny, Blokowanie YouTube

**Rekord PIN**:
Hash PBKDF2, sól i liczba iteracji rodzica. Przechowywany poza `Settings` i kopią bazy, zaszyfrowany kluczem z Android Keystore; PIN jawny nigdy nie jest zapisywany.
_Avoid_: PIN w AsyncStorage, PIN w kopii bazy

**Decyzja**:
Rozstrzygnięcie propozycji filmu (dopuść / odrzuć / cofnij); ręczne (rodzic) lub automatyczne (powtórka wcześniejszej decyzji przy ponownej propozycji). Rodzic może w każdej chwili zmienić dowolną decyzję historyczną; dla wszystkich kolejnych rozstrzygnięć — w tym autoakceptacji — liczy się decyzja najnowsza. Zapisywana w historii decyzji jako nieusuwalny wpis. Zatwierdzenie/odrzucenie propozycji kanału nie jest decyzją o filmie.
_Avoid_: Werdykt, Zatwierdzenie jako jedyny rodzaj

**Cofnięcie decyzji**:
Nowa decyzja, która przywraca film do stanu sprzed rozstrzygnięcia — zwykle z powrotem do kolejki. Historia pozostaje append-only: ostatnia decyzja znaczy „brak decyzji”. W panelu dostępna przez 10 s od decyzji.
_Avoid_: Usunięcie wpisu, Kasowanie decyzji

**Widoczność filmu**:
Czy film jest widoczny dziecku: wynika z decyzji najnowszej i stanu kanału. Stan kanału nigdy nie nadpisuje statusu filmu — zablokowany kanał ukrywa wszystkie swoje filmy bez zapisywania decyzji.
_Avoid_: Status filmu jako widoczność (status to tylko rzut decyzji)

**Pochodzenie filmu**:
Film może znać swój kanał (id) z RSS albo metadanych (`channelId` z InnerTube). Zatwierdzenie filmu z kanału nieobserwowanego zakłada **kanał wyciszony** (ADR 0015), żeby film dało się grupować i później zarządzać kanałem; nie uruchamia to RSS. Film bez rozpoznanego `channelId` pozostaje bez kanału.
_Avoid_: Automatyczne zakładanie kanału z linku do filmu, Subskrypcja przy zatwierdzeniu filmu

**Kanał nieobserwowany**:
Kanał znany z identyfikatora i nazwy (film z linku, propozycja dziecka), ale nieobecny na liście kanałów rodzica. Ma pozycję w filtrze kanałów; zatwierdzenie jego filmu zakłada go jako kanał wyciszony.
_Avoid_: Kanał nieznany, Obcy kanał

**Kanał nieznany**:
Film, dla którego nie udało się ustalić kanału — brak identyfikatora, mimo że nazwa z oEmbed bywa widoczna. Nie da się go przypiąć do pozycji kanału ani założyć z niego kanału.
_Avoid_: Kanał nieobserwowany (to inny stan), Kanał usunięty

**Cofnięcie autoakceptacji kanału**:
Zmiana polityki kanału z `auto_approve` na `manual`. Panel rodzica pyta wtedy, czy cofnąć też zatwierdzenia wszystkich dozwolonych filmów z tego kanału; odrzucenie pociąga za sobą zbiorcze decyzje w historii.

**Historia decyzji**:
Pełny, nieusuwalny zapis decyzji wraz z czasem i źródłem; widok rodzica. Po zapadnięciu decyzji propozycja znika z listy oczekującej.
_Avoid_: Log, Dziennik zmian

**Okno oglądania**:
Jedyny przedział czasowy w tygodniu (ten sam dla każdego dnia); bramka dla trybu wideo — poza oknem wideo nie jest dostępne.
_Avoid_: Okna (liczba mnoga), Harmonogram per dzień

**Limit dzienny**:
Budżet minut wideo na dzień kalendarzowy (reset lokalną północą); dotyczy wyłącznie trybu wideo. Po wyczerpaniu — do północy dostępny tylko tryb audio.
_Avoid_: Limit per okno, Limit tygodniowy

**Tryb snu** („timer”):
Licznik na ekranie trybu audio; po odliczeniu (domyślnie 30 min) odtwarzanie się zatrzymuje. Każda aktywność na ekranie audio (dotknięcie gdziekolwiek, play/pauza, seek, pętla) restartuje odliczanie do pełnych 30 minut — osobny przycisk resetu nie istnieje; po wystrzeleniu tylko jawne „Wznów” uruchamia odtwarzanie ponownie. Ekran audio ma przygaszone podświetlenie (15%), przywracane po wyjściu. W trakcie odtwarzania ekran jest trzymany (nie blokuje się), a po zatrzymaniu — pauza, koniec, wystrzelenie licznika — przestaje być trzymany, więc telefon blokuje się zwykłym systemowym limitem wygaszania.
_Avoid_: Limit audio — to nie limit, tylko wyłącznik po zaśnięciu

**Tryb audio**:
Odtwarzanie filmu z obrazem wyłączonym; nie liczy się do limitu dziennego i nie wymaga okna oglądania. To wciąż ten sam materiał — zmienia się tylko prezentacja i licznik.
_Avoid_: Osobna kategoria treści „audio”, Audiobook, Audiobooki

**Podgląd (rodzica)**:
Odtworzenie filmu przez rodzica przed rozstrzygnięciem (lista oczekująca, wyniki wyszukiwarki). Własny kontekst odtwarzania — bez wpływu na limit dzienny, stan obejrzenia ani historię oglądania dziecka.
_Avoid_: Podgląd jako „odtworzenie wliczane do limitu”

**Feed**:
Główna zakładka dziecka — wspólny strumień dozwolonych filmów na dużych miniaturach, sortowany od najnowszej daty publikacji (nie decyzji ani importu), grupowany w pasma: ten tydzień · ten miesiąc · kolejne miesiące roku bez roku w nagłówku („w październiku”, „we wrześniu”, …) · miesiące lat poprzednich z rokiem („w grudniu 2025”, …).
_Avoid_: Lista, Wszystkie filmy

**Kanały (zakładka)**:
Lista kanałów z logo; wejście w kanał pokazuje feed wyfiltrowany do jego filmów.
_Avoid_: Subskrypcje (nie ma prenumeraty — decyzje robi rodzic)

**Historia oglądania**:
Zapis ostatnio otwieranych materiałów wraz z czasem spędzonym (suma oraz rozbicie na tryb audio/wideo). Grupowana po dniach — nagłówek dnia ze statystykami, potem lista. U dziecka lista z miniaturami, w panelu rodzica lista tekstowa bez miniaturek. Zapis lokalny.
_Avoid_: Historia przeglądania — to nie WebView, to odtwarzanie

**Kontynuuj oglądanie**:
Zakładka dziecka agregująca filmy rozpoczęte, ale nieukończone (zapisany postęp ≥ 10 s, `completed: false`), grupowane po lokalnym dniu ostatniego odtwarzania (Dziś · Wczoraj · data), dni od najnowszego. Filmy ukończone, nigdy nieotwarte i tapnięte na chwilę są pomijane.
_Avoid_: Wznowienie (to sposób otwarcia, nie widok), Historia oglądania

**Wyszukiwarka**:
Lokalny filtr list filmów po tytule i nazwie kanału. W feedzie, widoku kanału dziecka i ekranie kanału rodzica; nie zmienia liczników ani danych.
_Avoid_: Wyszukiwarka YouTube, Filtr źródła

**Stan obejrzenia**:
Per-film: nowy (nigdy nieodtwarzany; badge znika po pierwszym odtworzeniu), obejrzany w całości (dojście do końca odtwarzania), albo częściowo (postęp w minutach — czas trwania z oEmbed nie jest niezawodny). Widoczny na kafelkach we wszystkich widokach dziecka.
_Avoid_: Progress w znaczeniu „pasek ładowania sieci"

**Wznowienie**:
Otwarcie częściowo obejrzanego filmu startuje od zapisanej pozycji (postęp). Dotyczy tylko dziecka; podgląd rodzica zawsze gra od początku i nie zmienia postępu dziecka.
_Avoid_: Autoodtwarzanie, „od początku” jako domyślne w świecie dziecka

**Wstecz (nawigacja)**:
Cofanie kontekstowe po ścieżce użytkownika: z feedu → do feedu, z kanału → do kanału, z odtwarzacza → tam, skąd przyszło dziecko.
_Avoid_: „Wstecz = zawsze do ekranu głównego”

## Panel rodzica

**Indeks panelu (rodzica)**:
Ekran wejściowy panelu: podsumowanie stanu na górze i lista sekcji. Sekcja pokazuje swój stan (liczba, włączone/wyłączone) bez otwierania.
_Avoid_: Menu, Dashboard, Strona główna panelu

**Sekcja (panelu)**:
Jedno zadanie rodzica dostępne z indeksu (zatwierdzanie, biblioteka, dodawanie, historia, czas, kod, linki). Wejście w sekcję to osobny ekran; cofnięcie wraca do indeksu.
_Avoid_: Zakładka, Karta

**Baza danych (sekcja)**:
Eksport i import całej lokalnej bazy w jednym pliku JSON; import odtwarza kopię — zastępuje stan, nigdy nie scala.
_Avoid_: Backup w znaczeniu automatycznym, Synchronizacja

**Kopia bazy**:
Plik JSON z pełnym snapshotem domeny: biblioteka, kanały, decyzje, historia oglądania i ustawienia — **bez kodu rodzica**, stanu blokady PIN i logu sesji; jawny, niezaszyfrowany.
_Avoid_: Dump AsyncStorage, Kopia w chmurze

**Zablokowane (sekcja)**:
Archiwum kanałów i filmów zablokowanych przez rodzica — jedyne miejsce, w którym działa „Odblokuj” i „Przywróć”. Nie jest kolejką, więc nie pokazuje liczby.
_Avoid_: Czarna lista (jako nazwa widoku), Kosz

## Katalog i kopia

**Katalog kanału**:
Pełna lista filmów kanału pobrana przez InnerTube (poza ~15 pozycjami z RSS). Import jest jawny, powolny i wznawialny; polityka kanału decyduje o statusie filmów.
_Avoid_: Backfill, Pełny RSS, Import playlisty (to inny, przyszły temat)

**Kursor importu**:
Token kontynuacji ostatniej wczytanej strony katalogu, zapisany przy kanale. Pozwala dokończyć import bez zaczynania od zera i wykryć wygasły token.
_Avoid_: Offset, Strona

## Kolejność prezentacji

Feed, kanał i biblioteka — od najnowszej daty publikacji, a dla filmów bez daty publikacji — od daty importu; grupowanie po tygodniu i po miesiącach kalendarzowych (miesiące bieżącego roku bez roku, starsze z rokiem) używa wyłącznie daty publikacji (brak daty → „Bez daty”, uzupełniana w tle z InnerTube); „Kontynuuj oglądanie” — po dniu ostatniego odtwarzania (Dziś · Wczoraj · data); historia oglądania — od najświeżej odtwarzanych. Decyzja rodzica nie zmienia kolejności.