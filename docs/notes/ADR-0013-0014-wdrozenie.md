# Notatki — sesja: ADR 0013 + ADR 0014 (linki YouTube, propozycje kanałów)

Zapis tego, co zrobione. Bez commita do czasu akceptacji.

## ADR 0013 — wspólny potok linków i propozycje kanałów

- `services/incomingLink.ts` obsługuje teraz oba rodzaje celu jednym potokiem:
  - film: istniejący wpis nie jest duplikowany; status bierze się z blokady
    kanału, ostatniej decyzji (last-wins, także po usunięciu filmu) albo polityki
    kanału (`auto_approve` → `allowed`, `manual`/nieznany → `pending`),
  - nowy film zapisuje `channelId`/`channelTitle` z InnerTube `player`
    (oEmbed dalej daje tytuł, autora i miniaturę), źródło `share`,
  - kanał znany → `channel-known` / `channel-blocked`; nieznany → propozycja,
  - propozycja kanału jest deduplikowana po `channelId`, a gdy linku nie da się
    rozwiązać — po surowym linku; nierozwiązana może być ponowiona przez rodzica.
- `decideIncomingVideoStatus` w `domain/content.ts` ustala kolejność:
  zablokowany kanał → ostatnia decyzja → polityka kanału. Auto-akceptacja przez
  politykę **nie** tworzy wpisu w historii decyzji.
- Udostępnienie **nie uruchamia odtwarzania** (zgodnie z odrzuconą opcją
  „Automatyczne odtwarzanie dozwolonego filmu” i wymaganym testem „brak
  autoodtwarzania”); poprawiono też sprzeczne zdanie w ADR 0013.
- Propozycja dziecka (`source: 'propose'`) pozostaje propozycją filmu: polityka
  kanału jej nie auto-akceptuje, ale wcześniejsza decyzja rodzica nadal wygrywa
  (auto-rozstrzyganie powtórki zostaje w `App`).
- Nowe typy i trwałość: `ChannelProposal` (`domain/types.ts`),
  `Repository.list/get/upsert/removeChannelProposal`, klucz
  `@kidstube/channel-proposals/v1` w AsyncStorage.
- `services/channelProposals.ts`: resolve przez InnerTube, zapis z deduplikacją,
  zatwierdzenie (zawsze `manual` + `allowed` + RSS), odrzucenie (bez decyzji),
  ponowienie rozwiązania.
- Panel rodzica, zakładka Oczekujące: osobna sekcja **Kanały** z etykietą
  „udostępniony kanał”, akcjami „Dodaj kanał” / „Odrzuć”, a dla nierozwiązanych
  „Spróbuj ponownie”. Licznik zakładki obejmuje filmy + propozycje kanałów.
- Komunikaty po linku: „Dodano do zatwierdzenia”, „Dodano do biblioteki”,
  „Już w bibliotece”, „Zablokowane”, „Kanał dodany do zatwierdzenia”,
  „Kanał już dodany”; nieobsługiwany link daje komunikat i nie otwiera
  przeglądarki. Link do kanału wysłany przez dziecko nie tworzy propozycji.

## ADR 0014 — opcjonalny handler VIEW

- `AndroidManifest.xml`: główna aktywność obsługuje już tylko `ACTION_SEND`;
  linki `VIEW` przeniesione do **osobnego aliasu** `.YouTubeLinkHandlerActivity`
  z `android:enabled="false"`. Filtry obejmują obsługiwane hosty i ścieżki
  filmu/kanału, `youtu.be/…` i `vnd.youtube:`; bez `autoVerify` i Digital Asset
  Links.
- `YouTubeLinkHandlerModule.kt` (most `YouTubeLinkHandler`): włącza/wyłącza
  komponent przez `setComponentEnabledSetting`, sprawdza, czy KidsTube jest
  domyślnym handlerem, i otwiera systemowe „Otwieraj domyślnie” (fallback:
  szczegóły aplikacji). JS-owy wrapper `native/youtubeLinkHandler.ts` jest
  bezpiecznym no-opem bez modułu natywnego.
- `Settings.youtubeLinkHandlerEnabled` — domyślnie `false`, przeżywa restart.
  Przy starcie `App` synchronizuje stan aliasu z ustawieniem (idempotentnie).
  Przełącznik i skrót do ustawień systemowych są w Ustawieniach rodzica;
  włączenie pokazuje wyjaśnienie, wyłączenie ostrzega, gdy KidsTube był
  domyślnym handlerem.
- `native/shareIntent.ts`: osobne callbacki `onShare` / `onView`. `App` kolejkuje
  linki do momentu wczytania ustawień i repozytorium, przetwarza je raz,
  deduplikuje `VIEW` po surowym URL i przy wyłączonej opcji pokazuje komunikat,
  nie dodając treści. Udostępnianie działa w obu stanach.
- Bramka `VIEW` czyta ustawienie **z repozytorium w momencie przetwarzania**, a
  nie z pierwszego renderu Reacta — inaczej zimny start mógł odrzucić link jako
  „wyłączony”, mimo włączonego przełącznika (wykryte w teście emulatora).

## Testy / stan

- Nowe: `__tests__/incomingLink.test.ts` (20), `__tests__/channelProposals.test.ts`
  (9), `__tests__/youtubeLinkHandler.test.ts` (5).
- `npm test` = **191** (było 164), `npx tsc --noEmit` i `npx eslint .` czysto.
- README i `CONTEXT.md`: nowe terminy (propozycja kanału, udostępnienie linku,
  przechwycenie VIEW), opis potoku, wybór domyślnego handlera i sideloadu.
- Wersja: **0.5.1 → 0.6.0**, `versionCode 19 → 20`.
- APK release zbudowany i zainstalowany w emulatorze do testów.
