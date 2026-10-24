# KidTube

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
| Akceptacja | Per kanał: `auto_approve` (nowe filmy od razu do biblioteki po syncu) albo `manual` (przy skanie RSS **wszystkie** filmy kanału trafiają na listę do zatwierdzenia). *(ADR 0001)* |
| Kanał wyciszony | Kanał widoczny w panelu (grupy, filtry, filmy), ale **bez pobierania RSS**. Zatwierdzenie filmu z nieobserwowanego kanału zakłada go jako wyciszony; jawne dodanie kanału lub zatwierdzenie propozycji odcisza go. Wyciszenie ≠ blokada — filmy zostają u dziecka. *(ADR 0015)* |
| Propozycje i decyzje | Lista oczekująca: propozycje dziecka **+** filmy z kanałów `manual` + **propozycje kanałów** (osobna sekcja), źródło wpisu oznaczone. Decyzja filmu — append-only, last-wins, zmienialna przez rodzica, auto-rozstrzyganie powtórek. Cofnięcie z paska (10 s) to nowa decyzja `retract` — film wraca do kolejki. Propozycja kanału nie jest decyzją filmu. *(ADR 0001, 0013, 0016)* |
| Historia i akcje zbiorcze | Zakładka **Decyzje** (grupa Historia): pełny log append-only od najnowszych (wynik, źródło ręczne/auto, czas), dotknięcie → dialog zmiany (last-wins), przeżywa usunięte filmy/kanały. Akcje masowe (cofnięcie autoakceptacji, usunięcie kanału) z obowiązkowym potwierdzeniem i liczbą filmów — zbiorcze odrzucenia jako osobne decyzje. *(ADR 0010)* |
| Wyszukiwanie/dodawanie | Link / „Udostępnij” — fundament (działa zawsze). Wyszukiwarka YouTube w panelu rodzica — prototyp z bramką oceny stabilności. Bez klucza API. *(ADR 0005)* |
| Udostępnianie linków | Jeden wspólny potok dla **filmu i kanału** (`ACTION_SEND`): film wg ostatniej decyzji / polityki kanału (`allowed` / `pending` / `blocked`), kanał jako **propozycja kanału** widoczna tylko u rodzica. Bez duplikatów, bez autoodtwarzania, bez otwierania przeglądarki. *(ADR 0013)* |
| Linki otwierane w KidTube | Opcjonalny przełącznik w Ustawieniach rodzica: osobny, domyślnie **wyłączony** alias aktywności z filtrami `VIEW`; włączenie/wyłączenie wg ustawienia. Wybór domyślnego handlera nadal w systemie (bez `autoVerify`). *(ADR 0014)* |
| Odtwarzanie | WebView (embed — brak reklam pre-roll) + **własne natywne kontrolki**: play/pauza, pasek postępu/seek, napisy (domyślnie OFF), wybór ścieżki audio. Dotyk WebView wyłączony — sterowanie idzie przez most `injectJavaScript` ↔ `movie_player`. **Gesty**: tap w środek = pauza/wznowienie, double-tap na brzegach = −10 s / +10 s. Nawigacja zamknięta allowlistą (tylko embed zatwierdzonego filmu). Koniec filmu: „Zagraj ponownie / Wróć do listy” (w trybie audio — pętla); błędy sieci: jawny retry + wznowienie best-effort; **licznik limitu = czas faktycznego odtwarzania**. *(ADR 0003, 0004b)* |
| Logo YouTube | **Nie ukrywamy** — widoczne m.in. przy buforowaniu; spełnia wymóg atrybucji. |
| Ścieżki audio | Tylko **oryginał + polski**, start na oryginale; wybór znika, gdy jest tylko jedna ścieżka. Docelowo lista języków konfigurowana przez rodzica. *(ADR 0008)* |
| Świat dziecka | 4 zakładki (Feed · Kanały · Do zatwierdzenia · Historia — **Do zatwierdzenia pokazuje tylko własne propozycje**), nawigacja wstecz po ścieżce użytkownika, stan obejrzenia na kafelkach (nowy / minuty / w całości — nie w „Do zatwierdzenia"), wznowienie od zapisanej pozycji (podgląd rodzica od początku), historia oglądania per dzień. *(ADR 0004)* |
| Świat rodzica | **Indeks** panelu: podsumowanie (pozostały czas wideo dziś, dziś i średnia 7 dni w rozbiciu filmy/audio) + sekcje z podglądem stanu: Do zatwierdzenia · Biblioteka · Zablokowane · Dodaj film/kanał · Historia oglądania · Kontrola czasu · Zmień kod · Linki YouTube · Log. Nawigacja stosem (cofnięcie wraca po ścieżce, 2× zamyka panel), pull-to-refresh zamiast przycisku sync, filtry źródła i kanału z licznikami „ile zobaczę”, podgląd filmu wszędzie, blokada kanału zamiast usuwania. *(ADR 0005, 0016)* |
| Czas | **Jedno okno tygodniowe** (bramka wideo) + **dzienny limit wideo** (twarde cięcie, ostrzeżenie 5 min przed) + **audio bez limitu i poza oknem** (tryb audio, nie kategoria treści) + **tryb snu** 1 h z resetem na ekranie audio + **dodatkowy czas wideo** (+15 min / +1 h, pula na dziś, PIN rodzica). Zastąpiło dawny „tryb nocny”. *(ADR 0002, 0011)* |
| Synchronizacja | Przy otwarciu aplikacji (jeden przebieg po pokazaniu biblioteki z pamięci) i na żądanie: przeciągnięcie w dół w widoku dziecka (feed / kanały / kanał) albo „Synchronizuj” w panelu. Równoległe żądania są scalane w jeden przebieg; timer w tle odroczony do backlogu z bramką oceny. *(ADR 0006)* |
| Import katalogu | Jawny przycisk **„Wczytaj cały katalog”** na kanale: pełna lista przez InnerTube (paginacja), bez klucza API; status wg polityki kanału; **wznawialny** — checkpoint kursora, dzienny budżet stron, miękki stop przy limicie/błędzie. *(ADR 0009)* |
| Dystrybucja | Rodzinny sideload z GitHub Releases (debug keystore). Google Play — przyszła, odwracalna decyzja z bramką oceny. *(ADR 0007)* |
| PIN | PBKDF2-SHA256, losowa sól (`@noble/hashes`); blokada profilu rodzica na 3 min po 3 błędnych PIN-ach, stan lokalny i wspólny dla panelu i dodatkowego czasu. *(ADR 0012)* |
| Kopia bazy | **Panel → Baza danych**: eksport całej bazy do jednego pliku JSON (`kidtube-backup-…`) przez systemowy wybór miejsca; import **zastępuje** bazę (bez scalania), waliduje cały plik przed zapisem, ma rollback i wykrywanie przerwanego importu. `pinGuard`, log i **kod rodzica** poza kopią. Plik jawny, bez PIN-u. *(ADR 0017)* |
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
    content.ts                reguły: auto/manual, merge sync, widok dziecka
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
    panel.ts                  selektory panelu: kolejka, biblioteka, archiwum, pasek kanałów
    watchStats.ts             statystyki czasu: dziś i średnia 7 dni (filmy/audio)
    log.ts                    bufor sesyjny zdarzeń (ring, 100 wpisów)
    playerGestures.ts         strefy gestów odtwarzacza (środek / brzegi)
    playerGuard.ts            allowlist nawigacji WebView (tylko embed białego filmu)
    channels.ts               flaga wyciszenia, kanał z zatwierdzonego filmu
    backup.ts                 format kopii bazy: koperta, wersja schematu, walidacja
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
    logStore.ts               magazyn logu sesji dla sekcji „Log”
  security/pin.ts             hashowanie i weryfikacja PIN
  native/shareIntent.ts       most do natywnego modułu ShareIntent / Linking
  native/backupFile.ts        most SAF: zapis/odczyt pliku kopii JSON
  native/youtubeLinkHandler.ts most do włączania/wyłączania aliasu VIEW
  version.ts                  wersja aplikacji (z package.json)
  ui/                         ekrany (bez zewnętrznej nawigacji)
  ui/parent/ParentPanel.tsx   stos ekranów panelu rodzica (ADR 0016)
  ui/parent/PanelIndex.tsx    indeks: podsumowanie + sekcje
  ui/parent/*Section.tsx      sekcje panelu (oczekujące, biblioteka, zablokowane, dodaj, …)
  ui/parent/DatabaseSection.tsx  eksport/import bazy z potwierdzeniem PIN
  ui/child/                   siatka Feed, lista kanałów, propozycje dziecka
  ui/WatchHistoryList.tsx     historia po dniach: wariant dziecka i rodzica
  ui/ChannelAvatar.tsx        wspólny awatar kanału (zdjęcie lub inicjał)
  ui/player/PlayerControls.tsx  natywny pasek: play/pauza, seek, CC, audio
android/app/src/main/
  AndroidManifest.xml         SEND + osobny alias VIEW (domyślnie wyłączony)
  java/com/kidtube/           ShareIntentModule / YouTubeLinkHandlerModule / BackupFileModule / Package
```

Kształt plików ewoluuje wg ADR-ów. **Log decyzji** (`domain/decisions.ts` +
`Repository.listDecisions/recordDecision`) jest append-only i last-wins —
`Video.status` to tylko rzutowany cache (ADR 0001). Historia oglądania i stan
obejrzenia dołączą do warstwy `domain/` + `data/` (ADR 0004).

## Testy

```bash
npm test          # 255 testów: URL, RSS, reguły list, decyzje (last-wins), harmonogram + tryb snu + przeskoki, licznik czasu odtwarzania, stan obejrzenia + historia oglądania, nawigacja dziecka, gesty odtwarzacza, daty, PIN, sync (także przy starcie, pull-to-refresh i kanałach wyciszonych), linki + propozycje kanałów, handler VIEW, kopia bazy (walidacja formatu, rollback, przerwany import), player, render App
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

Udostępnianie (`Udostępnij` → KidTube) działa od razu po instalacji. Aby linki
klikane w innych aplikacjach otwierały się w KidTube, rodzic musi:

1. w panelu rodzica → Ustawienia włączyć **„Otwieraj linki YouTube
   w KidTube”** (domyślnie wyłączone),
2. w systemie wybrać KidTube jako domyślną aplikację dla linków YouTube
   (Android 12+: Ustawienia → Aplikacje → Domyślne aplikacje → Otwieranie
   linków; przycisk w aplikacji otwiera właściwy ekran).

Jeśli zainstalowana jest oficjalna aplikacja YouTube, jej zweryfikowane App
Links mogą nadal wygrywać — wtedy trzeba wyłączyć YouTube albo wyczyścić jego
ustawienia domyślne. KidTube nie blokuje innych aplikacji i nie wymusza bycia
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
    inaczej polityka kanału (`auto_approve` → biblioteka, `manual`/nieznany →
    lista oczekujących),
  - kanał znany → „Kanał już dodany” / „Zablokowane”,
  - kanał nieznany → **propozycja kanału** w panelu rodzica (osobna sekcja
    „Kanały” w zakładce Oczekujące); zatwierdzenie tworzy kanał `manual`
    i uruchamia RSS, odrzucenie nie zostawia decyzji,
  - link nieobsługiwany → komunikat, bez otwierania przeglądarki.
- **Otwieranie linków `youtube.com/...` w KidTube** (ADR 0014):
  Ustawienia rodzica → „Otwieraj linki YouTube w KidTube”, **domyślnie
  wyłączone**. Włączenie uaktywnia osobny alias aktywności z filtrami `VIEW`
  (film i kanał, obsługiwane hosty/ścieżki); wyłączenie usuwa KidTube
  z kandydatów systemu. Rodzic wybiera KidTube jako domyślny handler
  w systemie — KidTube tego nie wymusza (brak `autoVerify`/Digital Asset
  Links dla `youtube.com`). Gdy YouTube jest zainstalowany, jego zweryfikowane
  App Links mogą wygrywać. Udostępnianie (`ACTION_SEND`) działa zawsze,
  niezależnie od przełącznika.
- **Propozycje dziecka** (zakładka „Do zatwierdzenia”) wpadają do tej samej
  listy oczekującej (źródło `propose`), ale link do kanału nie tworzy
  propozycji kanału — kanałami zarządza wyłącznie rodzic.

## Kopia bazy (eksport/import)

Panel rodzica → **Baza danych**:

1. **Eksportuj bazę do JSON** — potwierdź kodem rodzica, wybierz miejsce zapisu
   (systemowy wybór plików), plik `kidtube-backup-RRRR-MM-DD-HHmm.json`.
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
- **Import katalogu kanału** (ADR 0009) — jawne „Wczytaj cały katalog”.
- **Wyjątek „zachowaj jeden film z zablokowanego kanału”** — wymaga rozdzielenia
  flag kanału (panel / RSS / widoczność u dziecka), ADR 0016 zostawia to poza zakresem.
- Sync RSS w tle / timer — odroczony z bramką oceny (ADR 0006).
- Wyszukiwarka YouTube w panelu rodzica — prototyp z bramką oceny (ADR 0005).
- Wiele profili dzieci.
- Natywne crypto dla PIN (obecnie pure-JS).
- *(Odrzucone świadomie: wiele okien harmonogramu / osobne dla weekendu —
  patrz ADR 0002; „godzina ciszy” nocna — patrz ADR 0002.)*
