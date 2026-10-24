# KidTube — Kont tekst domenowy

Aplikacja do kuratorowanego oglądania YouTube: rodzic zatwierdza treści, dziecko widzi tylko dozwoloną bibliotekę. Bez konta Google i bez backendu.

## Język

**Biblioteka (dziecka)**:
Zbiór filmów i kanałów widocznych dziecku; zawiera wyłącznie pozycje dozwolone.
_Avoid_: „Wszystkie filmy", „Kanały YouTube"

**Kanał**:
Kanał YouTube dodany przez rodzica; niesie politykę i może być zablokowany.
_Avoid_: Strona, Twórca

**Polityka kanału**:
Reguła dla nowych filmów kanału: `auto_approve` (pojawiają się w bibliotece od razu) albo `manual` (nie trafiają nigdzie automatycznie — rodzic dodaje filmy ręcznie).
_Avoid_: Automatyczna akceptacja w znaczeniu „na stałe dozwolone"

**Propozycja**:
Zgłoszenie filmu przez dziecko do rozstrzygnięcia przez rodzica. Żyje w liście oczekującej.
_Avoid_: Życzenie, Prośba o film

**Propozycja kanału**:
Udostępniony link do kanału, którego KidTube jeszcze nie obserwuje. Oczekujący byt **tylko dla rodzica** — nie jest `Channel`, nie synchronizuje RSS, nie trafia do świata dziecka ani do historii decyzji. Zatwierdzenie tworzy kanał `manual`, odrzucenie usuwa propozycję (może wrócić później).
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

**Decyzja**:
Rozstrzygnięcie propozycji filmu (dopuść / odrzuć); ręczne (rodzic) lub automatyczne (powtórka wcześniejszej decyzji przy ponownej propozycji). Rodzic może w każdej chwili zmienić dowolną decyzję historyczną; dla wszystkich kolejnych rozstrzygnięć — w tym autoakceptacji — liczy się decyzja najnowsza. Zapisywana w historii decyzji jako nieusuwalny wpis. Zatwierdzenie/odrzucenie propozycji kanału nie jest decyzją o filmie.
_Avoid_: Werdykt, Zatwierdzenie jako jedyny rodzaj

**Pochodzenie filmu**:
Film może znać swój kanał (id) z RSS albo metadanych (`channelId` z InnerTube). Sam film **nie zakłada kanału** — dodanie kanału jest osobną decyzją strukturalną rodzica (ADR 0013), więc ręcznie dodany film bez rozpoznanego `channelId` pozostaje bez kanału.
_Avoid_: Automatyczne zakładanie kanału z linku do filmu

**Cofnięcie autoakceptacji kanału**:
Zmiana polityki kanału z `auto_approve` na `manual` albo usunięcie kanału. Panel rodzica pyta wtedy, czy cofnąć też zatwierdzenia wszystkich dozwolonych filmów z tego kanału; odrzucenie pociąga za sobą zbiorcze decyzje w historii.

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
Licznik na ekranie trybu audio; po odliczeniu (domyślnie 1 h) odtwarzanie się zatrzymuje. Przycisk na ekranie resetuje odliczanie do pełnej godziny.
_Avoid_: Limit audio — to nie limit, tylko wyłącznik po zaśnięciu

**Tryb audio**:
Odtwarzanie filmu z obrazem wyłączonym; nie liczy się do limitu dziennego i nie wymaga okna oglądania. To wciąż ten sam materiał — zmienia się tylko prezentacja i licznik.
_Avoid_: Osobna kategoria treści „audio”

**Podgląd (rodzica)**:
Odtworzenie filmu przez rodzica przed rozstrzygnięciem (lista oczekująca, wyniki wyszukiwarki). Własny kontekst odtwarzania — bez wpływu na limit dzienny, stan obejrzenia ani historię oglądania dziecka.
_Avoid_: Podgląd jako „odtworzenie wliczane do limitu”

**Feed**:
Główna zakładka dziecka — wspólny strumień dozwolonych filmów na dużych miniaturach, sortowany od najświeżej rozstrzygniętych.
_Avoid_: Lista, Wszystkie filmy

**Kanały (zakładka)**:
Lista kanałów z logo; wejście w kanał pokazuje feed wyfiltrowany do jego filmów.
_Avoid_: Subskrypcje (nie ma prenumeraty — decyzje robi rodzic)

**Historia oglądania**:
Zapis ostatnio otwieranych materiałów wraz z czasem spędzonym (suma oraz rozbicie na tryb audio/wideo). Grupowana po dniach — nagłówek dnia ze statystykami, potem lista. U dziecka lista z miniaturami, w panelu rodzica lista tekstowa bez miniaturek. Zapis lokalny.
_Avoid_: Historia przeglądania — to nie WebView, to odtwarzanie

**Stan obejrzenia**:
Per-film: nowy (nigdy nieodtwarzany; badge znika po pierwszym odtworzeniu), obejrzany w całości (dojście do końca odtwarzania), albo częściowo (postęp w minutach — czas trwania z oEmbed nie jest niezawodny). Widoczny na kafelkach we wszystkich widokach dziecka.
_Avoid_: Progress w znaczeniu „pasek ładowania sieci"

**Wznowienie**:
Otwarcie częściowo obejrzanego filmu startuje od zapisanej pozycji (postęp). Dotyczy tylko dziecka; podgląd rodzica zawsze gra od początku i nie zmienia postępu dziecka.
_Avoid_: Autoodtwarzanie, „od początku” jako domyślne w świecie dziecka

**Wstecz (nawigacja)**:
Cofanie kontekstowe po ścieżce użytkownika: z feedu → do feedu, z kanału → do kanału, z odtwarzacza → tam, skąd przyszło dziecko.
_Avoid_: „Wstecz = zawsze do ekranu głównego”

## Kolejność prezentacji

Feed i kanały — od najświeżej rozstrzygniętych; historia oglądania — od najświeżej odtwarzanych; powtórka decyzji ustawia film na górze feedu.