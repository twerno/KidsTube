# Notatki — sesja: rdzeń decyzji z ADR 0001 (log append-only, last-wins)

Zapis tego, co zrobione i co zostaje. Bez commita do czasu akceptacji.

## Co wdrożono (kod)

- **`domain/types.ts`**: `DecisionOutcome` (`allow` / `reject`),
  `DecisionSource` (`manual` / `auto`), `Decision` (videoId, outcome, source,
  at, `channelId` jako snapshot kanału).
- **`domain/decisions.ts`** *(nowy, czysty)*:
  - `statusForOutcome`, `latestDecision` (last-wins, późniejszy wpis wygrywa
    przy równym czasie), `decisionsForVideo`,
  - `projectStatus` / `projectVideos` — widoczność = ostatnia decyzja, a bez
    decyzji fallback na zapisany `Video.status` (np. auto-approve z syncu),
  - `repeatProposalDecision` — powtórka propozycji rozstrzyga się wg ostatniej
    decyzji jako wpis `auto` (albo `undefined`, gdy brak historii),
  - `manualDecision`.
- **`domain/content.ts`**: `videoSortTime` + `videosForChild(videos, decisions)`
  — feed sortowany **od najświeżej rozstrzygniętych** (decyzja, a bez niej
  publikacja/dodanie).
- **`data/repository.ts`**: `listDecisions()` / `recordDecision()`.
  `recordDecision` dopisuje do logu **i** odświeża cache `Video.status`.
- **`data/memoryRepository.ts`** i **`data/asyncStorageRepository.ts`**: nowy
  zbiór `@kidstube/decisions/v1` (append-only, przeżywa usunięcie filmu i kanału).
- **`App.tsx`**: ładuje decyzje; `projectedVideos = projectVideos(...)` jest
  źródłem dla dziecka i panelu; akcje rodzica nagrywają decyzję `manual`;
  przełączenie kanału na `auto_approve` nagrywa po decyzji na każdy pending;
  propozycja dziecka (`propose`) przy istniejącej historii dopisuje wpis `auto`.

## Czego świadomie NIE zrobiono (drugi krok)

> Spisane jako **ADR 0010** (`docs/adr/0010-panel-decyzji-historia-i-zbiorcze-akcje.md`);
> implementacja w osobnej sesji.

- **Widok historii decyzji** w panelu rodzica (grupa „Historia”).
- **Dialogi zbiorcze**: cofnięcie autoakceptacji (`auto_approve → manual`) i
  usunięcie kanału → pytanie o zbiorcze odrzucenie dozwolonych filmów.
- Ręcznie dodany film nadal **nie zakłada kanału** (`manual`): brak pewnego
  `channelId` z oEmbed (przyszłe źródło: strona kanału / InnerTube).

## Dopracowanie UI panelu (ta sesja, 0.4.x)

- **Pasek ikon kanałów** (`ui/parent/ChannelBar.tsx`) zamiast akordeonu i
  chipów tekstowych; pozycja **„Wszystkie”** + ikony kanałów z nazwą
  i liczbą filmów; ponowne dotknięcie czyści filtr (ADR 0005).
- **Liczniki statusów** w chipach `VideosTab` (Dozwolone / Oczekujące /
  Zablokowane), liczone w obrębie wybranego kanału.
- **Data publikacji**: RSS daje `publishedAt`; dla filmów z linku przez
  InnerTube `player` (`fetchPublishDate`). Pokazana w `VideoRow` i na
  kafelkach dziecka; `domain/dates.ts` (`formatPublishedDate`, bez `Intl`).
- **Podgląd w każdej liście** (Oczekujące **i** Filmy), niezależnie od
  statusu; akcje wiersza w **jednym wierszu** (kompaktowy `Button`).
- **Scroll list**: wymuszony `removeClippedSubviews={false}` (RN 0.88 na
  Androidzie domyślnie `true` — lista wracała do góry) + `maintainVisibleContentPosition`.
- Wersje: **0.4.0 → 0.4.6**; testy: **97 → 99**.

## Migracja

- Bez sztucznego backfillu: starsze statusy (`allowed` / `blocked`) działają
  jako fallback w `projectStatus`, dopóki nie pojawi się pierwsza decyzja.
  Dzięki temu nie fabrykujemy historii (żadnego fałszywego „auto”).

## Testy / stan

- `npm test` = **97** (było 79): `decisions.test.ts`, `decisionRepository.test.ts`,
  rozszerzony `content.test.ts`.
- `npx tsc --noEmit`, `npx eslint .` — czysto. Wersja: **0.3.2 → 0.4.0**.
