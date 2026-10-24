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
| Metadane filmu | **oEmbed** (`youtube.com/oembed`) — tytuł, autor, miniatura. **Data publikacji** z InnerTube `player` (`microformat.playerMicroformatRenderer.publishDate`) — oEmbed jej nie zwraca. Bez klucza API. |
| Akceptacja | Per kanał: `auto_approve` (nowe filmy od razu do biblioteki po syncu) albo `manual` (przy skanie RSS **wszystkie** filmy kanału trafiają na listę do zatwierdzenia). *(ADR 0001)* |
| Propozycje i decyzje | Lista oczekująca: propozycje dziecka **+** filmy z kanałów `manual`, źródło wpisu oznaczone (RSS / propozycja). Decyzja (dopuść/odrzuć) zapisywana w historii — append-only, last-wins, zmienialna przez rodzica, auto-rozstrzyganie powtórek. *(ADR 0001)* |
| Historia i akcje zbiorcze | Zakładka **Decyzje** (grupa Historia): pełny log append-only od najnowszych (wynik, źródło ręczne/auto, czas), dotknięcie → dialog zmiany (last-wins), przeżywa usunięte filmy/kanały. Akcje masowe (cofnięcie autoakceptacji, usunięcie kanału) z obowiązkowym potwierdzeniem i liczbą filmów — zbiorcze odrzucenia jako osobne decyzje. *(ADR 0010)* |
| Wyszukiwanie/dodawanie | Link / „Udostępnij” — fundament (działa zawsze). Wyszukiwarka YouTube w panelu rodzica — prototyp z bramką oceny stabilności. Bez klucza API. *(ADR 0005)* |
| Dodawanie linków | `ACTION_SEND` (Udostępnij) jako główna, pewna droga; intent-filters VIEW jako best-effort. |
| Odtwarzanie | WebView (embed — brak reklam pre-roll) + **własne natywne kontrolki**: play/pauza, pasek postępu/seek, napisy (domyślnie OFF), wybór ścieżki audio. Dotyk WebView wyłączony — sterowanie idzie przez most `injectJavaScript` ↔ `movie_player`. **Gesty**: tap w środek = pauza/wznowienie, double-tap na brzegach = −10 s / +10 s. Nawigacja zamknięta allowlistą (tylko embed zatwierdzonego filmu). Koniec filmu: „Zagraj ponownie / Wróć do listy” (w trybie audio — pętla); błędy sieci: jawny retry + wznowienie best-effort; **licznik limitu = czas faktycznego odtwarzania**. *(ADR 0003, 0004b)* |
| Logo YouTube | **Nie ukrywamy** — widoczne m.in. przy buforowaniu; spełnia wymóg atrybucji. |
| Ścieżki audio | Tylko **oryginał + polski**, start na oryginale; wybór znika, gdy jest tylko jedna ścieżka. Docelowo lista języków konfigurowana przez rodzica. *(ADR 0008)* |
| Świat dziecka | 4 zakładki (Feed · Kanały · Do zatwierdzenia · Historia — **Do zatwierdzenia pokazuje tylko własne propozycje**), nawigacja wstecz po ścieżce użytkownika, stan obejrzenia na kafelkach (nowy / minuty / w całości — nie w „Do zatwierdzenia"), wznowienie od zapisanej pozycji (podgląd rodzica od początku), historia oglądania per dzień. *(ADR 0004)* |
| Świat rodzica | Grupy zakładek (Treści · Historia · Ustawienia), wspólne filtrowanie/grupowanie po kanałach (pasek ikon), lista oczekująca z rozróżnieniem źródła (RSS / propozycja dziecka), **podgląd filmu w każdej liście treści** oraz historia decyzji (last-wins) + podgląd historii oglądania. *(ADR 0005)* |
| Czas | **Jedno okno tygodniowe** (bramka wideo) + **dzienny limit wideo** (twarde cięcie, ostrzeżenie 5 min przed) + **audio bez limitu i poza oknem** (tryb audio, nie kategoria treści) + **tryb snu** 1 h z resetem na ekranie audio. Zastąpiło dawny „tryb nocny”. *(ADR 0002)* |
| Synchronizacja | Tylko przy otwarciu aplikacji (+ ręczne „Odśwież” / sync z panelu); timer w tle odroczony do backlogu z bramką oceny. *(ADR 0006)* |
| Import katalogu | Jawny przycisk **„Wczytaj cały katalog”** na kanale: pełna lista przez InnerTube (paginacja), bez klucza API; status wg polityki kanału; **wznawialny** — checkpoint kursora, dzienny budżet stron, miękki stop przy limicie/błędzie. *(ADR 0009)* |
| Dystrybucja | Rodzinny sideload z GitHub Releases (debug keystore). Google Play — przyszła, odwracalna decyzja z bramką oceny. *(ADR 0007)* |
| PIN | PBKDF2-SHA256, losowa sól (`@noble/hashes`). |
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
    types.ts                  Channel, Video, Settings
    youtubeUrl.ts             parsowanie linków (watch/shorts/embed/youtu.be/vnd.youtube)
    rss.ts                    parser Atom feedu kanału
    content.ts                reguły: auto/manual, merge sync, widok dziecka
    decisions.ts              historia decyzji (append-only, last-wins) + rzut statusu
    dates.ts                  format daty publikacji (bez Intl)
    schedule.ts               okno oglądania, limit dzienny wideo, tryb audio / tryb snu
    watchTime.ts              licznik faktycznego odtwarzania (limit dzienny)
    watchState.ts             stan obejrzenia per film + pozycja wznowienia
    watchHistory.ts           historia oglądania: scalanie i grupowanie po dniach
    duration.ts               zwarte etykiety czasu (`12m / 1h:40m`)
    watchHistoryView.ts       etykiety historii: dni i polskie daty
    childNavigation.ts        stos nawigacji dziecka (zakładki + kanał)
    plural.ts                 polskie odmiany („1 film / 2 filmy / 5 filmów”)
    playerGuard.ts            allowlist nawigacji WebView (tylko embed białego filmu)
  data/
    repository.ts             interfejs trwałości
    memoryRepository.ts       implementacja in-memory (testy)
    asyncStorageRepository.ts implementacja na urządzeniu
  services/
    youtubeMetadata.ts        oEmbed
    channelSync.ts            pobieranie RSS + merge do repo
    incomingLink.ts           obsługa linku z share/VIEW
  security/pin.ts             hashowanie i weryfikacja PIN
  native/shareIntent.ts       most do natywnego modułu ShareIntent / Linking
  version.ts                  wersja aplikacji (z package.json)
  ui/                         ekrany (bez zewnętrznej nawigacji)
  ui/child/                   siatka Feed, lista kanałów, propozycje dziecka
  ui/WatchHistoryList.tsx     historia po dniach: wariant dziecka i rodzica
  ui/ChannelAvatar.tsx        wspólny awatar kanału (zdjęcie lub inicjał)
  ui/player/PlayerControls.tsx  natywny pasek: play/pauza, seek, CC, audio
android/app/src/main/
  AndroidManifest.xml         intent-filters (VIEW + SEND)
  java/com/kidtube/           ShareIntentModule / Package / Store
```

Kształt plików ewoluuje wg ADR-ów. **Log decyzji** (`domain/decisions.ts` +
`Repository.listDecisions/recordDecision`) jest append-only i last-wins —
`Video.status` to tylko rzutowany cache (ADR 0001). Historia oglądania i stan
obejrzenia dołączą do warstwy `domain/` + `data/` (ADR 0004).

## Testy

```bash
npm test          # 135 testów: URL, RSS, reguły list, decyzje (last-wins), harmonogram + tryb snu + przeskoki, licznik czasu odtwarzania, stan obejrzenia + historia oglądania, nawigacja dziecka, daty, PIN, sync, linki, player, render App
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

### Uprawnienia / wymagane domeny build-time

Gradle potrzebuje **`repo.reactnative.dev`** (Maven Central przekierowuje tam
artefakty `com.facebook.react:react-android`). W środowisku z allowlistą trzeba
ją dodać.

## Obsługa linków w Androidzie

- **Udostępnij** z YouTube/przeglądarki → nasz `ACTION_SEND` → natywny moduł
  `ShareIntent` → `handleIncomingLink`:
  - film dozwolony → odtwarzanie,
  - znany i zablokowany → komunikat,
  - nieznany → wpis `pending` (źródło `share`).
- **Linki `youtube.com/watch` / `youtu.be` / `vnd.youtube:`** → `Linking`
  (RN). Uwaga: Google ma zweryfikowane App Links, więc domyślnie wygra
  oficjalna aplikacja YouTube; rodzic może wskazać KidTube w
  Ustawienia → Domyślne aplikacje → Otwieranie linków.
- **Propozycje dziecka** (zakładka „Do zatwierdzenia”) wpadają do tej samej
  listy oczekującej (źródło `propose`).

## Backlog

- Prawdziwe audio w tle przy zgaszonym ekranie: foreground service + MediaSession
  (niezawodny tryb audio — WebView pauzuje po zgaszeniu ekranu).
- Sync RSS w tle / timer — odroczony z bramką oceny (ADR 0006).
- Wyszukiwarka YouTube w panelu rodzica — prototyp z bramką oceny (ADR 0005).
- Wiele profili dzieci.
- Natywne crypto dla PIN (obecnie pure-JS).
- *(Odrzucone świadomie: wiele okien harmonogramu / osobne dla weekendu —
  patrz ADR 0002; „godzina ciszy” nocna — patrz ADR 0002.)*
