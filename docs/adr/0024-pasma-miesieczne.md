# ADR 0024 — Pasma miesięczne w listach filmów

> Status: **wdrożone** (0.11.15). Zastępuje pasma „poprzedni miesiąc /
> starsze” z ADR 0020.

## Problem

Dotychczasowy podział feedu i widoku kanału kończył się na czterech pasmach:
„W tym tygodniu”, „W tym miesiącu”, „We &lt;poprzedni miesiąc&gt;” i zbiorcze
„Starsze”. W bibliotece z materiałem z kilku lat wszystko starsze niż dwa
miesiące lądowało w jednym worze — bez informacji, czy film jest z zeszłego
kwartału, czy sprzed trzech lat, mimo że data jest znana.

## Decyzja

Listy grupują się po **kalendarzowym miesiącu publikacji**, od najnowszego:

1. **W tym tygodniu** (od poniedziałku),
2. **W tym miesiącu**,
3. kolejne miesiące **bieżącego roku**, każdy osobno i bez roku:
   „W październiku”, „We wrześniu”, „W sierpniu”, …, „W styczniu”,
4. miesiące **z lat poprzednich**, każdy osobno, z rokiem:
   „W grudniu 2025”, „W listopadzie 2025”, …, „W styczniu 2024”.

Zasady:

- rok w nagłówku pojawia się **tylko** dla miesiąca spoza bieżącego roku —
  w obrębie roku byłby szumem,
- pasma są ciągłe: nie ma już zbiorczego „Starsze”, więc liczba pasm rośnie z
  wiekiem biblioteki (to zamierzone — pasmo niesie informację),
- puste pasma są pomijane, więc w praktyce widać tylko miesiące, w których coś
  opublikowano,
- wewnątrz pasma kolejność bez zmian: od najnowszej daty publikacji,
- **„Bez daty”** zostaje na końcu (filmy bez znanej daty publikacji; daty
  uzupełnia backfill z ADR 0023),
- pasma pozostają czystą prezentacją: nie zmieniają danych ani decyzji.

„Kontynuuj oglądanie” ma własne pasma dzienne (ADR 0023) — ta zmiana jej nie
dotyczy.

## Konsekwencje

- `domain/videoGroups.ts`: klucz pasma miesiąca to `month:YYYY-MM` (sortowanie
  leksykograficzne = od najnowszego), a nagłówek buduje jedna tablica nazw
  miesięcy z przyimkiem w miejscowniku: „w październiku”, ale „we wrześniu”.
  Usunięte `startOfPreviousMonth`, `previousMonthTitle`, `groupKeyOf` i pasmo
  „Starsze”.
- `VideoGrid` bez zmian — dostaje pasma z tej samej funkcji.
- Wyszukiwarka i licznik filmów działają na płaskiej liście, więc pasma nie
  wpływają na wyniki.
