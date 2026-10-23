# Notatki — sesja: projekt (ADR 0001–0009) + wdrożenie ADR 0001

Zapis tego, co zostało zrobione i co pozostaje. Kolejny punkt (następny ADR)
w nowej sesji.

## 1. Warsztat projektowy → dokumenty

- **`CONTEXT.md`** (root) — słownik terminów domenowych.
- **`docs/adr/0001–0009`** — zamknięte decyzje:
  - 0001 model treści (biblioteka, propozycje, decyzje)
  - 0002 czas (okno, limit wideo, audio, tryb snu)
  - 0003 odtwarzanie (embed, kontrolki, koniec, błędy)
  - 0004 świat dziecka (zakładki, nawigacja, stan obejrzenia, historia)
  - 0005 świat rodzica (grupy zakładek, UX limitu, dodawanie treści)
  - 0006 synchronizacja RSS (tylko przy otwarciu)
  - 0007 dystrybucja (sideload → Play później)
  - 0008 ścieżki audio (oryginał + polski, start na oryginale)
  - 0009 dodawanie kolekcji (pełny katalog przez InnerTube, wznawialny)
- **`KidTube/README.md`** — tabela decyzji z odnośnikami do ADR-ów.
- **`AGENTS.md`** (root) — środowisko piaskownicy (emulator, proxy, toolchain).

## 2. ADR 0001 — co wdrożono (kod)

- `domain/types.ts`: nowe źródło `VideoSource = 'propose'`.
- `domain/content.ts`: `rssPendingVideos()`, `proposalsForChild()`.
- `services/incomingLink.ts`: parametr `source` (`share` | `propose`).
- `ui/ChildHomeScreen.tsx`: zakładki **Feed / Do zatwierdzenia**, dialog
  **„Zaproponuj film"** (wklejenie linku → `pending`/`propose`), własne
  propozycje tylko w zakładce; przycisk przeniesiony do „Do zatwierdzenia".
- `ui/parent/PendingTab.tsx`: rozróżnienie źródeł („z kanału · RSS" /
  „propozycja dziecka") + filtry.
- `ui/parent/VideoRow.tsx`: przycisk **Podgląd** dla oczekujących.
- `ui/parent/PreviewScreen.tsx` *(nowy)*: podgląd rodzica (embed + kontrolki,
  Odrzuć/Akceptuj/Wstecz); kontekst rodzica bez wpływu na limit/stan/historię.
- `ParentScreen.tsx` / `App.tsx`: trasa `preview`, obsługa propozycji dziecka.
- Testy: `content.test.ts` (+2 reguły), `incomingLink.test.ts` (+`propose`).

## 3. Poprawki z testów manualnych (emulator, poza ADR 0001)

- **Seek w embedzie** (`EmbedPlayer.tsx`): scalanie/ponawianie celu seeka,
  podtrzymanie pozycji w RN, `pageX` + `measureInWindow`, odmowa oddania
  respondera. Działa przy przeciąganiu i klikaniu.
- **Ścieżki audio**: język/typ dekodowany z base64 `id` ścieżki; mapa kodów →
  polskie nazwy; lista przewijalna; polityka **oryginał + polski**, start na
  oryginale (→ ADR 0008).
- **Grupy kanałów** (`VideosTab.tsx`): akordeon — rozwinięty dokładnie jeden.
- **Seed** (`dev/seed.ts`): podmieniony na `ssr2cTC2bhs`; stary usuwany przy
  starcie.

## 4. Co pozostało z ADR 0001 (do kolejnej sesji)

- Pełny **log decyzji** (append-only, last-wins) + **auto-rozstrzyganie
  powtórek**; panel rodzica: historia decyzji + dialog zmiany.
- Cofnięcie autoakceptacji / usunięcie kanału → pytanie o zbiorcze odrzucenia.
- „Decyzja bieżąca" jako jedyne źródło prawdy dla widoczności (statusy to rzut).

## 5. Stan jakości

- `npm test` = **68 testów**, `npx tsc --noEmit` i `npx eslint .` czysto.
- APK release zbudowany i zainstalowany w emulatorze (Android 16).

## 6. Otwarte wątki / TODO

- Sync RSS w tle (~2×/dzień) — z bramką oceny (ADR 0006).
- Prototyp wyszukiwarki w panelu rodzica — z bramką oceny (ADR 0005).
- Implementacja ADR 0009 (import katalogu, checkpoint) + zbiorcze „zatwierdź
  wszystkie"; implementacja ADR 0002 (czas, tryb snu).
- UX / Material 3; prawdziwe audio w tle; wiele profili dzieci; natywne crypto
  PIN.