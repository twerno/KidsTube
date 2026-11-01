# KidsTube

Aplikacja na Androida dla dziecka, które ma oglądać YouTube z **kuratorowanej
biblioteki** zatwierdzonej przez rodzica. Bez logowania do Google, bez backendu,
konfiguracja w pełni offline (chroniona kodem rodzica).

## Decyzje projektowe

Każda decyzja ma **zamknięte ADR** (`docs/adr/`, numeracja przy wierszu);
uzasadnienia i odrzucone alternatywy — w ADR-ach. Słownik terminów
domenowych: `CONTEXT.md` (root repozytorium).

| Temat | Decyzja |
| --- | --- |
| Model | **B — kuratorowana biblioteka.** Rodzic dodaje filmy/kanały, dziecko widzi tylko dozwolone. |
| Źródło danych | **RSS kanału** (`feeds/videos.xml?channel_id=…`) — ok. 15 najnowszych filmów na kanał. Bez YouTube Data API, bez scrapingu. |
| Metadane filmu | **oEmbed** (`youtube.com/oembed`) — tytuł, autor, miniatura. **Data publikacji i `channelId`** z InnerTube `player` (`microformat.playerMicroformatRenderer.publishDate`, `videoDetails.channelId`) — oEmbed ich nie zwraca. Bez klucza API. |
| Akceptacja | Per kanał: `auto_approve` (nowe filmy od razu do biblioteki), `manual` (wszystkie nowe filmy na listę do zatwierdzenia), `auto_block` (nowe filmy od razu odrzucone) albo `quiet` (nowe filmy w cache, poza kolejką — widoczne na ekranie kanału). Osobny przełącznik **„Aktualizuj kanał (RSS)”**. *(ADR 0001, 0019)* |
| Kanał wyciszony | Kanał widoczny w panelu (grupy, filtry, filmy), ale **bez pobierania RSS**. Zatwierdzenie filmu z nieobserwowanego kanału zakłada go jako wyciszony; jawne dodanie kanału lub zatwierdzenie propozycji odcisza go. Wyciszenie ≠ blokada — filmy zostają u dziecka. Osobna polityka `quiet` pozwala pobierać nowe filmy do cache, ale trzymać je poza kolejką. *(ADR 0015, 0019)* |
| Propozycje i decyzje | Lista oczekująca: propozycje dziecka **+** filmy z kanałów `manual` + **propozycje kanałów** (osobna sekcja), źródło wpisu oznaczone. Decyzja filmu — append-only, last-wins, zmienialna przez rodzica, auto-rozstrzyganie powtórek. Cofnięcie z paska (10 s) to nowa decyzja `retract` — film wraca do kolejki. Propozycja kanału nie jest decyzją filmu. *(ADR 0001, 0013, 0016)* |
| Historia i akcje zbiorcze | Zakładka **Decyzje** (grupa Historia): pełny log append-only od najnowszych (wynik, źródło ręczne/auto, czas), dotknięcie → dialog zmiany (last-wins), przeżywa usunięte filmy/kanały. Akcje masowe (cofnięcie autoakceptacji, usunięcie kanału) z obowiązkowym potwierdzeniem i liczbą filmów — zbiorcze odrzucenia jako osobne decyzje. *(ADR 0010)* |
| Wyszukiwanie/dodawanie | Link / „Udostępnij” — fundament (działa zawsze). Wyszukiwarka YouTube w panelu rodzica — prototyp z bramką oceny stabilności. Bez klucza API. *(ADR 0005)* |
| Udostępnianie linków | Jeden wspólny potok dla **filmu i kanału** (`ACTION_SEND`): film wg ostatniej decyzji / polityki kanału (`allowed` / `pending` / `blocked`), kanał jako **propozycja kanału** widoczna tylko u rodzica. Bez duplikatów, bez autoodtwarzania, bez otwierania przeglądarki. *(ADR 0013)* |
| Linki otwierane w KidsTube | Opcjonalny przełącznik w Ustawieniach rodzica: osobny, domyślnie **wyłączony** alias aktywności z filtrami `VIEW`; włączenie/wyłączenie wg ustawienia. Wybór domyślnego handlera nadal w systemie (bez `autoVerify`). *(ADR 0014)* |
| Odtwarzanie | WebView (embed — brak reklam pre-roll) + **własne natywne kontrolki**: play/pauza, pasek postępu/seek, napisy (domyślnie OFF), wybór ścieżki audio. Dotyk WebView wyłączony — sterowanie idzie przez most `injectJavaScript` ↔ `movie_player`. **Gesty**: tap w środek = pauza/wznowienie, double-tap na brzegach = −10 s / +10 s. Nawigacja zamknięta allowlistą (tylko embed zatwierdzonego filmu). Koniec filmu: „Zagraj ponownie / Wróć do listy” (w trybie audio — **pętla wielokrotna**, restart przez jedno polecenie playera); błędy sieci: jawny retry + wznowienie best-effort; **licznik limitu = czas faktycznego odtwarzania**. Film gra **pełnoekranowo**: pasek stanu i przyciski nawigacji Androida są ukryte (wracają w trybie audio i po wyjściu; gest od krawędzi odsłania je chwilowo). *(ADR 0003, 0004b)* |
| Logo YouTube | **Nie ukrywamy** — widoczne m.in. przy buforowaniu; spełnia wymóg atrybucji. |
| Ścieżki audio | Tylko **oryginał + polski**, start na oryginale; wybór znika, gdy jest tylko jedna ścieżka. Docelowo lista języków konfigurowana przez rodzica. *(ADR 0008)* |
| Świat dziecka | 5 zakładek (Feed · Kontynuuj · Kanały · Do zatwierdzenia · Historia — **Do zatwierdzenia pokazuje tylko własne propozycje**), nawigacja wstecz po ścieżce użytkownika, stan obejrzenia na kafelkach (nowy / minuty / w całości — nie w „Do zatwierdzenia"), wznowienie od zapisanej pozycji (podgląd rodzica od początku), historia oglądania per dzień. **Kontynuuj oglądanie** agreguje rozpoczęte, nieukończone filmy w kolejności daty publikacji. *(ADR 0004, 0020)* |
| Kolejność i listy | Feed, kanał i biblioteka: **od najnowszej daty publikacji**, a bez daty publikacji — od daty importu. Grupowanie używa tylko daty publikacji (brak daty → „Bez daty”). Feed/kanał grupowane: ten tydzień · ten miesiąc · poprzedni miesiąc · starsze. Wyszukiwarka po tytule/kanale w feedzie i widoku kanału. Wszystkie pionowe listy mają stały pasek przewijania. *(ADR 0020)* |
| Świat rodzica | **Indeks** panelu: podsumowanie (pozostały czas wideo dziś, dziś i średnia 7 dni w rozbiciu filmy/audio) + sekcje z podglądem stanu: Do zatwierdzenia · Biblioteka · Zablokowane · Dodaj film/kanał · Historia oglądania · Kontrola czasu · Zmień kod · Linki YouTube · Baza danych · Log. Nawigacja stosem (cofnięcie wraca po ścieżce, 2× zamyka panel), pull-to-refresh zamiast przycisku sync, filtry źródła i kanału z licznikami „ile zobaczę”, **ekran kanału z filtrami Zaakceptowane / Odrzucone / Oczekujące (bez „Wszystkie”)**, podgląd filmu wszędzie, blokada kanału zamiast usuwania. *(ADR 0005, 0016, 0018)* |
| Czas | **Jedno okno tygodniowe** (bramka wideo) + **dzienny limit wideo** (twarde cięcie, ostrzeżenie 5 min przed) + **audio bez limitu i poza oknem** (tryb audio, nie kategoria treści) + **tryb snu** 30 min z resetem przy każdej aktywności na ekranie audio i **przygaszonym podświetleniu** (15%) + **dodatkowy czas wideo** (+15 min / +1 h, pula na dziś, PIN rodzica). Zastąpiło dawny „tryb nocny”. *(ADR 0002, 0011, 0021)* |
| Katalog kanału | **„Pobierz wszystkie”** na karcie kanału: pełna lista przez InnerTube `browse` z paginacją, tempo 3–7 s, checkpoint per kanał (wznawialne po tapnięciu), stop na pierwszym błędzie, timeout 20 s; **„Pobierz od nowa” / „Pobierz ponownie”** resetuje kursor i pobiera katalog od początku; filmy z kanałów wyciszonych są zapisywane, ale poza kolejką; **Akceptuj/Odrzuć wszystkie** z toastem cofnięcia. *(ADR 0009, 0019)* |
| Synchronizacja | Przy otwarciu aplikacji (jeden przebieg po pokazaniu biblioteki z pamięci) i na żądanie: przeciągnięcie w dół w widoku dziecka (feed / kanały / kanał) albo „Synchronizuj” w panelu. Równoległe żądania są scalane w jeden przebieg; timer w tle odroczony do backlogu z bramką oceny. *(ADR 0006)* |
| Import katalogu | Jawny przycisk **„Wczytaj cały katalog”** na kanale: pełna lista przez InnerTube (paginacja), bez klucza API; status wg polityki kanału; **wznawialny** — checkpoint kursora, dzienny budżet stron, miękki stop przy limicie/błędzie. *(ADR 0009)* |
| Dystrybucja | Rodzinny sideload z GitHub Releases (debug keystore). Google Play — przyszła, odwracalna decyzja z bramką oceny. *(ADR 0007)* |
| PIN | PBKDF2-SHA256, losowa sól (`@noble/hashes`); blokada profilu rodzica na 3 min po 3 błędnych PIN-ach, stan lokalny i wspólny dla panelu i dodatkowego czasu. *(ADR 0012)* |
| Kopia bazy | **Panel → Baza danych**: eksport całej bazy do jednego pliku JSON (`kidstube-backup-…`) przez systemowy wybór miejsca; import **zastępuje** bazę (bez scalania), waliduje cały plik przed zapisem, ma rollback i wykrywanie przerwanego importu. `pinGuard`, log i **kod rodzica** poza kopią. Plik jawny, bez PIN-u. *(ADR 0017)* |
| Wersje | `minSdk 26` (Android 8), `targetSdk 36`, `compileSdk 37`. |

### Dlaczego RSS, a nie „wszystkie filmy”

Kanałowy RSS zwraca tylko najnowsze ~15 pozycji. Pełny backfill przez
YouTube Data API (`playlistItems.list`) wymagałby klucza API — świadomie
odłożony. Starsze pozycje dociąga jawny import całego katalogu przez InnerTube
(ADR 0009). Nowe filmy dochodzą na bieżąco przy każdej synchronizacji (ADR 0006:
sync tylko przy otwarciu aplikacji).

## Architektura

```
App.tsx                       orkiestracja: bramka PIN, routing, akcje rodzica
src/
  domain/                     czysta logika (zero I/O, w pełni testowalna)
    types.ts                  Channel, ChannelProposal, Video, Settings
    youtubeUrl.ts             parsowanie linków (watch/shorts/embed/youtu.be/vnd.youtube)
    rss.ts                    parser Atom feedu kanału
    content.ts                reguły: polityki kanału, merge sync, widok dziecka, kontynuacja
    decisions.ts              historia decyzji (append-only, last-wins) + rzut statusu
    dates.ts                  format daty publikacji (bez Intl)
    pinGuard.ts               blokada profilu rodzica po błędnych PIN-ach
    schedule.ts               okno, limit dzienny, pula dodatkowego czasu, tryb audio / sen
    watchTime.ts              licznik faktycznego odtwarzania (limit dzienny)
    watchState.ts             stan obejrzenia per film + pozycja wznowienia
    watchHistory.ts           historia oglądania: scalanie i grupowanie po dniach
    duration.ts               zwarte etykiety czasu (`12m / 1h:40m`)
    watchHistoryView.ts       etykiety historii: dni i polskie daty
    childNavigation.ts        stos nawigacji dziecka (zakładki + kanał)
    plural.ts                 polskie odmiany („1 film / 2 filmy / 5 filmów”)
    panel.ts                  selektory panelu: kolejka, biblioteka, archiwum, pasek kanałów, statusy kanału
    watchStats.ts             statystyki czasu: dziś i średnia 7 dni (filmy/audio)
    log.ts                    bufor sesyjny zdarzeń (ring, 100 wpisów)
    playerGestures.ts         strefy gestów odtwarzacza (środek / brzegi)
    playerGuard.ts            allowlist nawigacji WebView (tylko embed białego filmu)
    videoGroups.ts            grupowanie filmów: tydzień / miesiąc / poprzedni miesiąc
    channels.ts               flaga wyciszenia, kanał z zatwierdzonego filmu
    backup.ts                 format kopii bazy: koperta, wersja schematu, walidacja
    catalog.ts                tempo importu katalogu (5 s ± 2 s) i checkpoint
  data/
    repository.ts             interfejs trwałości
    memoryRepository.ts       implementacja in-memory (testy)
    asyncStorageRepository.ts implementacja na urządzeniu
  services/
    youtubeMetadata.ts        oEmbed + InnerTube player (data, channelId)
    channelSync.ts            pobieranie RSS + merge do repo
    channelProposals.ts       propozycje kanałów: resolve, zatwierdź/odrzuć
    channelMuting.ts          kanały wyciszone: tworzenie przy decyzji + backfill
    incomingLink.ts           wspólny potok linku z share/VIEW
    addByLink.ts              dodawanie filmu/kanału z linku (wszystko albo nic)
    databaseBackup.ts         eksport/import bazy: snapshot, walidacja, zastąpienie
    youtubeCatalog.ts         InnerTube browse: strony katalogu, wznawianie, checkpoint
    logStore.ts               magazyn logu sesji dla sekcji „Log”
  security/pin.ts             hashowanie i weryfikacja PIN
  native/shareIntent.ts       most do natywnego modułu ShareIntent / Linking
  native/backupFile.ts        most SAF: zapis/odczyt pliku kopii JSON
  native/youtubeLinkHandler.ts most do włączania/wyłączania aliasu VIEW
  version.ts                  wersja aplikacji (z package.json)
  ui/                         ekrany (bez zewnętrznej nawigacji)
  ui/parent/ParentPanel.tsx   stos ekranów panelu rodzica (ADR 0016)
  ui/parent/PanelIndex.tsx    indeks: podsumowanie + sekcje
  ui/parent/ChannelScreen.tsx ekran kanału: karta + filtry statusów + lista filmów
  ui/parent/*Section.tsx      sekcje panelu (oczekujące, biblioteka, zablokowane, dodaj, …)
  ui/parent/DatabaseSection.tsx  eksport/import bazy z potwierdzeniem PIN
  ui/parent/CatalogProgressModal.tsx  modalny postęp importu katalogu
  ui/child/                   siatka Feed, lista kanałów, propozycje dziecka
  ui/WatchHistoryList.tsx     historia po dniach: wariant dziecka i rodzica
  ui/ChannelAvatar.tsx        wspólny awatar kanału (zdjęcie lub inicjał)
  ui/player/PlayerControls.tsx  natywny pasek: play/pauza, seek, CC, audio
android/app/src/main/
  AndroidManifest.xml         SEND + osobny alias VIEW (domyślnie wyłączony)
  java/com/kidstube/           ShareIntentModule / YouTubeLinkHandlerModule / BackupFileModule / SystemUiModule / Package
```

Kształt plików ewoluuje wg ADR-ów. **Log decyzji** (`domain/decisions.ts` +
`Repository.listDecisions/recordDecision`) jest append-only i last-wins —
`Video.status` to tylko rzutowany cache (ADR 0001). Historia oglądania i stan
obejrzenia dołączą do warstwy `domain/` + `data/` (ADR 0004).

## Testy

```bash
npm test          # 310 testów: URL, RSS, reguły list, decyzje (last-wins), harmonogram + tryb snu + przeskoki, licznik czasu odtwarzania, stan obejrzenia + historia oglądania, nawigacja dziecka, gesty odtwarzacza, daty, PIN, sync (także przy starcie, pull-to-refresh i kanałach wyciszonych), linki + propozycje kanałów, handler VIEW, kopia bazy (walidacja formatu, rollback, przerwany import), filtry statusów ekranu kanału, polityki nowych filmów, grupowanie dat, kontynuacja oglądania, katalog kanału (paginacja, tempo, checkpoint, wznowienie), player, render App
npx tsc --noEmit  # typy
npx eslint .      # lint
```

## Build (Android)

Wymagania: JDK 17, Android SDK (platform 37, build-tools 37.0.0, NDK 27.1.12297006,
CMake 3.22.1).

```bash
source env-android.sh        # ustawia ANDROID_HOME / JAVA_HOME
cd android
./gradlew :app:assembleDebug    # APK debug (wymaga Metro)
./gradlew :app:assembleRelease  # APK release, self-contained
# debug:   android/app/build/outputs/apk/debug/app-debug.apk
# release: android/app/build/outputs/apk/release/app-release.apk
```

Release jest podpisany domyślnym keystore debug (wygodne do sideloadu w
rodzinie/GitHubie). Na Google Play trzeba wygenerować własny keystore.

### Otwieranie linków po sideloadzie

Udostępnianie (`Udostępnij` → KidsTube) działa od razu po instalacji. Aby linki
klikane w innych aplikacjach otwierały się w KidsTube, rodzic musi:

1. w panelu rodzica → Ustawienia włączyć **„Otwieraj linki YouTube
   w KidsTube”** (domyślnie wyłączone),
2. w systemie wybrać KidsTube jako domyślną aplikację dla linków YouTube
   (Android 12+: Ustawienia → Aplikacje → Domyślne aplikacje → Otwieranie
   linków; przycisk w aplikacji otwiera właściwy ekran).

Jeśli zainstalowana jest oficjalna aplikacja YouTube, jej zweryfikowane App
Links mogą nadal wygrywać — wtedy trzeba wyłączyć YouTube albo wyczyścić jego
ustawienia domyślne. KidsTube nie blokuje innych aplikacji i nie wymusza bycia
domyślnym handlerem.

### Uprawnienia / wymagane domeny build-time

Gradle potrzebuje **`repo.reactnative.dev`** (Maven Central przekierowuje tam
artefakty `com.facebook.react:react-android`). W środowisku z allowlistą trzeba
ją dodać.

## Obsługa linków w Androidzie

- **Udostępnij** z YouTube/przeglądarki → `ACTION_SEND` → moduł
  `ShareIntent` → wspólny potok `handleIncomingLink` (ADR 0013):
  - film znany/dozwolony → „Już w bibliotece”, bez odtwarzania,
  - film nowy: `channelId` z InnerTube → ostatnia decyzja rodzica wygrywa,
    inaczej polityka kanału (`auto_approve` → biblioteka, `auto_block` →
    zablokowane, `manual`/`quiet`/nieznany → lista oczekujących),
  - kanał znany → „Kanał już dodany” / „Zablokowane”,
  - kanał nieznany → **propozycja kanału** w panelu rodzica (osobna sekcja
    „Kanały” w zakładce Oczekujące); zatwierdzenie tworzy kanał `manual`
    i uruchamia RSS, odrzucenie nie zostawia decyzji,
  - link nieobsługiwany → komunikat, bez otwierania przeglądarki.
- **Otwieranie linków `youtube.com/...` w KidsTube** (ADR 0014):
  Ustawienia rodzica → „Otwieraj linki YouTube w KidsTube”, **domyślnie
  wyłączone**. Włączenie uaktywnia osobny alias aktywności z filtrami `VIEW`
  (film i kanał, obsługiwane hosty/ścieżki); wyłączenie usuwa KidsTube
  z kandydatów systemu. Rodzic wybiera KidsTube jako domyślny handler
  w systemie — KidsTube tego nie wymusza (brak `autoVerify`/Digital Asset
  Links dla `youtube.com`). Gdy YouTube jest zainstalowany, jego zweryfikowane
  App Links mogą wygrywać. Udostępnianie (`ACTION_SEND`) działa zawsze,
  niezależnie od przełącznika.
- **Propozycje dziecka** (zakładka „Do zatwierdzenia”) wpadają do tej samej
  listy oczekującej (źródło `propose`), ale link do kanału nie tworzy
  propozycji kanału — kanałami zarządza wyłącznie rodzic.

## Katalog kanału

Na karcie kanału (Biblioteka → Kanały → kanał) jest **„Pobierz wszystkie”**:

- pełna lista filmów kanału przez InnerTube `browse` (RSS daje tylko ~15),
- tempo celowo ludzkie: 3–7 s losowej pauzy między stronami,
- postęp w modalnym panelu z „Przerwij”; bieg kończy się na końcu katalogu albo
  na pierwszym błędzie/timeoucie (20 s), checkpoint zostaje i „Kontynuuj
  pobieranie” wznawia od kursora,
- polityka kanału decyduje o statusie (`auto_approve` → dozwolone, `auto_block`
  → zablokowane, `manual` → oczekujące, `quiet` → oczekujące poza kolejką),
- filmy kanału **wyciszonego** są zapisywane, ale nie trafiają do kolejki, póki
  kanał jest wyciszony; karta ma wtedy **Akceptuj/Odrzuć wszystkie** z toastem
  cofnięcia (10 s),
- **„Pobierz od nowa”** (przerwany import) i **„Pobierz ponownie”** (katalog
  ukończony) resetują kursor i pobierają katalog od pierwszej strony — to
  naprawia niedokończone pobrania bez ręcznego czyszczenia bazy,
- katalog dociąga też **datę publikacji** z etykiet względnych YouTube
  („2 days ago”); brak etykiety → „Bez daty” (data importu tylko jako
  fallback sortowania w tej grupie),
- **„Zablokuj wszystkie filmy”** odrzuca wszystkie filmy kanału, blokuje kanał
  i wyłącza RSS; pojedynczy film można później dopuścić z podglądu w sekcji
  „Zablokowane” („Zezwól na ten film”).

## Kopia bazy (eksport/import)

Panel rodzica → **Baza danych**:

1. **Eksportuj bazę do JSON** — potwierdź kodem rodzica, wybierz miejsce zapisu
   (systemowy wybór plików), plik `kidstube-backup-RRRR-MM-DD-HHmm.json`.
2. **Importuj bazę z JSON** — wskaż plik, sprawdź podsumowanie (data, wersja,
   liczby), potwierdź kodem. Import **zastępuje całą bazę**; nie scala danych.
   Po sukcesie panel się zamyka, a kod rodzica pochodzi z pliku.

Plik nie jest szyfrowany: zawiera imię dziecka, historię oglądania i decyzje,
ale **nie zawiera kodu rodzica** — PIN zostaje na urządzeniu. Po imporcie
obowiązuje dotychczasowy kod; na nowym telefonie ustawisz nowy. Stan blokady
PIN i log sesji również nie są częścią kopii.

## Backlog

- Prawdziwe audio w tle przy zgaszonym ekranie: foreground service + MediaSession
  (niezawodny tryb audio — WebView pauzuje po zgaszeniu ekranu).
- **Zakładka „Decyzje” (ADR 0010) + potwierdzenia akcji masowych** — na nowej
  IA z ADR 0016 (miejsce: sekcja obok „Historii oglądania”). Do tego czasu
  przełączenie polityki na auto-akceptację po cichu dopuszcza wszystkie
  oczekujące filmy kanału.
- **Personalizacja dziecka** (imię, avatar/kolor) — pole imienia usunięte
  z panelu (ADR 0016); zapisane imię nadal się wyświetla, nie da się go zmienić.
- **Wyjątek „zachowaj jeden film z zablokowanego kanału”** — wymaga rozdzielenia
  flag kanału (panel / RSS / widoczność u dziecka), ADR 0016 zostawia to poza zakresem.
- Sync RSS w tle / timer — odroczony z bramką oceny (ADR 0006).
- Wyszukiwarka YouTube w panelu rodzica — prototyp z bramką oceny (ADR 0005).
- Wiele profili dzieci.
- Natywne crypto dla PIN (obecnie pure-JS).
- *(Odrzucone świadomie: wiele okien harmonogramu / osobne dla weekendu —
  patrz ADR 0002; „godzina ciszy” nocna — patrz ADR 0002.)*
