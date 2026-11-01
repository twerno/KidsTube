# ADR 0020 — Listy: kolejność, „Kontynuuj oglądanie”, wyszukiwarka, pasek przewijania

> Status: **wdrożone** (0.11.0); **częściowo zastąpione**: pasma dat przez
> ADR 0024 (miesiące zamiast „poprzedni miesiąc / starsze”), a „Kontynuuj
> oglądanie” przez ADR 0023 (pasma dzienne, próg 10 s, uzupełnianie brakujących
> dat publikacji). Zastępuje regułę kolejności z ADR 0001/0004.

## Kolejność i grupowanie

Listy filmów są sortowane **od najnowszego według daty publikacji**
(`publishedAt`). Gdy data publikacji jest nieznana, do **sortowania** używana
jest data importu (`addedAt`) — dzięki temu lista pozostaje stabilna, gdy
katalog nie dostarczył daty. Data importu **nie tworzy jednak grupy daty**:
film dociągnięty z katalogu dziś nie jest „z tego tygodnia”, jeśli nie znamy
jego daty publikacji — trafia do „Bez daty”. Moment decyzji rodzica nie
wpływa już na kolejność: zatwierdzenie starego filmu nie wypycha go na górę
feedu. Dotyczy to feedu dziecka, widoku kanału (dziecko i rodzic) oraz
biblioteki w panelu.

Feed i widok kanału grupują filmy w pasma dat:

- **W tym tygodniu** (od poniedziałku),
- **W tym miesiącu**,
- kolejne miesiące roku, każdy osobno („We wrześniu”, „W październiku”, …),
- miesiące lat poprzednich, każdy osobno, z rokiem („W grudniu 2025”, …),
- **Bez daty** na końcu (sortowane w środku tej grupy po dacie importu).

*(Pasma miesięczne: ADR 0024 — wcześniej był jeden „poprzedni miesiąc” i
zbiorcze „Starsze”).*

Grupowanie jest wyłącznie prezentacją: nie zmienia danych ani decyzji.
(Zmienione przez ADR 0023): „Kontynuuj oglądanie” grupuje się po dniu
ostatniego odtwarzania, nie po dacie publikacji.

## „Kontynuuj oglądanie”

Nowa zakładka dziecka agreguje filmy, które mają zapisany postęp
(`positionSeconds > 0`, `completed: false`) i nadal są w bibliotece. Filmy
ukończone i nigdy nieotwarte są pomijane. Wejście w kafelek otwiera odtwarzacz
od zapisanej pozycji (dotychczasowa reguła wznowienia).

*(Zmienione przez ADR 0023)*: film liczy się jako rozpoczęty od 10 s
odtwarzania, a kolejność i pasma idą po dniu ostatniego odtwarzania.

## Wyszukiwarka

Feed, kanał (dziecko) i ekran kanału (rodzic) mają pole wyszukiwania po
tytule i nazwie kanału. Filtr jest lokalny i nie zmienia liczników ani
zapytań sieciowych. Pusty wynik ma własny komunikat zamiast ogólnego
„brak filmów”.

## Pasek przewijania

Wszystkie pionowe listy (dziecko i panel rodzica) jawnie włączają
`showsVerticalScrollIndicator` i `persistentScrollbar` (Android), żeby
długość listy i pozycja były widoczne przez cały czas przewijania, a nie
tylko w trakcie dotyku.

## Konsekwencje

- `domain/content.ts`: `videoSortTime` zwraca datę publikacji/dodania;
  `videosForChild` i `videosForChannel` sortują malejąco.
- Nowy `domain/videoGroups.ts` z czystym grupowaniem po datach i polskimi
  nazwami miesięcy (bez `Intl`).
- `VideoGrid` używa `SectionList` z wierszami po dwa kafelki; nadal jest
  wirtualizowany.
- `ChildTab` zyskuje `continue`; nawigacja wstecz działa jak dla pozostałych
  zakładek.
