# KidTube

Aplikacja na Androida dla dziecka, które ma oglądać YouTube z **kuratorowanej
biblioteki** zatwierdzonej przez rodzica. Bez logowania do Google, bez backendu,
konfiguracja w pełni offline (chroniona kodem rodzica).

## Decyzje projektowe

| Temat | Decyzja |
| --- | --- |
| Model | **B — kuratorowana biblioteka.** Rodzic dodaje filmy/kanały, dziecko widzi tylko dozwolone. |
| Źródło danych | **RSS kanału** (`feeds/videos.xml?channel_id=…`) — ok. 15 najnowszych filmów na kanał. Bez YouTube Data API, bez scrapingu. |
| Metadane filmu | **oEmbed** (`youtube.com/oembed`) — tytuł, autor, miniatura. Bez klucza API. |
| Akceptacja | Per kanał: `auto_approve` (nowe filmy od razu dozwolone) lub `manual` (trafiają do listy oczekujących). |
| Wyszukiwanie/dodawanie | A+C: mini-przeglądarka YouTube w panelu rodzica + wklejanie linku. Bez klucza API. |
| Dodawanie linków | `ACTION_SEND` (Udostępnij) jako główna, pewna droga; intent-filters VIEW jako best-effort. |
| Odtwarzanie | WebView (embed — brak reklam pre-roll) + **własne natywne kontrolki**: play/pauza, pasek postępu/seek, napisy (domyślnie OFF), wybór ścieżki audio. Dotyk WebView wyłączony — sterowanie idzie przez most `injectJavaScript` ↔ `movie_player`. Nawigacja zamknięta allowlistą (tylko embed zatwierdzonego filmu). |
| Logo YouTube | **Nie ukrywamy** — widoczne m.in. przy buforowaniu; spełnia wymóg atrybucji. |
| Czas | Harmonogram (okna godzinowe), limit dzienny w minutach, wyłącznik. |
| Tryb nocny | Po ustawionej godzinie wymusza **audio-only** (do audiobooków na dobranoc). |
| PIN | PBKDF2-SHA256, losowa sól (`@noble/hashes`). |
| Wersje | `minSdk 26` (Android 8), `targetSdk 36`, `compileSdk 37`. |

### Dlaczego RSS, a nie „wszystkie filmy”

Kanałowy RSS zwraca tylko najnowsze ~15 pozycji. Pełny backfill wymagałby
YouTube Data API (`playlistItems.list`) i klucza API — świadomie odłożone.
Nowe filmy dochodzą na bieżąco przy każdej synchronizacji.

## Architektura

```
App.tsx                       orkiestracja: bramka PIN, routing, akcje rodzica
src/
  domain/                     czysta logika (zero I/O, w pełni testowalna)
    types.ts                  Channel, Video, Settings
    youtubeUrl.ts             parsowanie linków (watch/shorts/embed/youtu.be/vnd.youtube)
    rss.ts                    parser Atom feedu kanału
    content.ts                reguły: auto/manual, merge sync, widok dziecka
    schedule.ts               okna czasowe, limit dzienny, tryb audio-only
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
  ui/player/PlayerControls.tsx  natywny pasek: play/pauza, seek, CC, audio
android/app/src/main/
  AndroidManifest.xml         intent-filters (VIEW + SEND)
  java/com/kidtube/           ShareIntentModule / Package / Store
```

## Testy

```bash
npm test          # 65 testów: URL, RSS, reguły list, harmonogram, PIN, sync, linki, player, render App
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

## Backlog

- Prawdziwe audio w tle przy zgaszonym ekranie: foreground service + MediaSession
  (obecny tryb nocny utrzymuje dźwięk, ale WebView pauzuje po zgaszeniu ekranu).
- Wiele okien harmonogramu / osobne dla weekendu.
- Wiele profili dzieci.
- Natywne crypto dla PIN (obecnie pure-JS).
