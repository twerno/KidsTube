# ADR 0018 — Ekran kanału: filtry statusów bez „Wszystkie”

> Wdrożone w 0.9.2. Rozszerza ADR 0016.

ADR 0016 daje ekran kanału z jedną listą **wszystkich** filmów kanału: dozwolone,
oczekujące i odrzucone są wymieszane. Przy kanale z dużą biblioteką rodzic nie
może skupić się na jednej czynności — przejrzeć bibliotekę, wrócić do
odrzuconego filmu albo rozstrzygnąć kolejkę. Globalne sekcje „Do zatwierdzenia”
i „Zablokowane” rozdzielają statusy, ale tracą kontekst konkretnego kanału.

Decyzja: na **ekranie kanału** (otwieranym z Biblioteki → Kanały oraz przez
„Edytuj kanał” przy filtrze kanału) pojawiają się **dokładnie trzy filtry
statusu**:

- **Zaakceptowane** — filmy `status: 'allowed'`,
- **Odrzucone** — filmy `status: 'blocked'`,
- **Oczekujące** — filmy `status: 'pending'`.

Nie ma filtra **„Wszystkie”** ani domyślnego widoku bez filtra. Zawsze aktywny
jest dokładnie jeden z trzech statusów.

## Zakres

- Filtry dotyczą wyłącznie ekranu kanału w panelu rodzica, czyli miejsca, w
  którym widoczna jest karta kanału i lista jego filmów.
- **Dziecko** nie dostaje tych filtrów: w świecie dziecka i tak widoczne są
  tylko filmy dozwolone (ADR 0004/ADR 0016).
- **„Zablokowane”** pozostaje archiwum z ADR 0016: zablokowane kanały pokazują
  tam swoje filmy bez tych filtrów. Zablokowany kanał nie jest otwierany jako
  zwykły ekran kanału.
- Karta kanału inline w sekcji **„Dodaj film/kanał”** nie ma listy filmów, więc
  nie dostaje filtrów.
- Filtr kanału w sekcji **Biblioteka → Filmy** pozostaje filtrem biblioteki
  (tylko filmy dozwolone); nie mieszamy go z filtrami statusu na ekranie
  kanału.

## Domyślny filtr

Domyślnie aktywny jest **„Zaakceptowane”**. Ekran kanału otwiera się przede
wszystkim z biblioteki — miejsca, w którym rodzic ogląda to, co widzi dziecko —
więc pokazanie najpierw zaakceptowanych filmów jest spójne z kontekstem wejścia.
Kolejka oczekujących jest o jedno tapnięcie dalej, ale jej licznik jest widoczny
na chipie.

- Świeże otwarcie ekranu kanału zawsze startuje od „Zaakceptowanych”.
- Wybrany filtr przeżywa wejście w podgląd i powrót (stos ekranów ADR 0016).
- Po opuszczeniu ekranu kanału wybór nie jest pamiętany — kolejne wejście znowu
  zaczyna od „Zaakceptowanych”.

## Liczniki i puste stany

- Każdy chip pokazuje liczbę filmów w danym statusie w obrębie kanału, np.
  `Zaakceptowane (12)`. Liczniki są niezależne od aktywnego filtra — pokazują
  cały stan kanału, nie przecięcie z innym filtrem.
- Chipy z zerem **pozostają widoczne i klikalne**; nie chowamy ich, żeby układ
  nie skakał, a rodzic wiedział, że dany status istnieje i jest pusty.
- Trzy chipy leżą w **jednej linii** i nie zawijają się do drugiej. Na wąskich
  ekranach użyj wariantu kompaktowego (mniejszy padding i font, tekst
  jednolinijkowy) zamiast `flexWrap`.
- Po decyzji liczniki i lista aktualizują się od razu.
- Pusty wynik ma komunikat zależny od filtra:
  - „Brak zaakceptowanych filmów w tym kanale.”,
  - „Brak odrzuconych filmów w tym kanale.”,
  - „Brak oczekujących filmów w tym kanale.”.
  Nie używamy ogólnego „Brak filmów”, bo zawsze działa jakiś filtr.
- Karta kanału pozostaje bez zmian; nowe liczby są na chipach. Nie dodajemy
  czwartego chipa ani sumy „wszystkich”.

## Zachowanie listy i akcje

- Filtry są **wyłącznie widokiem**: nie zmieniają statusów, decyzji ani
  historii (ADR 0001/ADR 0010). Rodzic nadal podejmuje te same decyzje co
  dotychczas.
- Akcje w wierszach wynikają ze statusu, jak w ADR 0016:
  - „Zaakceptowane” → `Podgląd`, `Cofnij zgodę`,
  - „Odrzucone” → `Podgląd`, `Przywróć`,
  - „Oczekujące” → `Podgląd`, `Odrzuć`, `Akceptuj`.
- Po akcji rodzic **zostaje w aktywnym filtrze**. Jeśli ostatni oczekujący film
  został właśnie rozstrzygnięty, lista pokazuje pusty stan „Oczekujące”, zamiast
  automatycznie przeskakiwać do innego statusu.
- Kolejność filmów w obrębie filtra pozostaje dotychczasową kolejnością ekranu
  kanału; ten ADR nie zmienia sortowania.

## Rozważone opcje

- **Czwarty chip „Wszystkie”** — odrzucone: wprost sprzeczne z decyzją; lista
  mieszana jest tym, od czego odchodzimy.
- **Brak chipa, ale domyślnie lista wszystkich** — odrzucone: to nadal
  nieograniczony widok i nie realizuje filtrów.
- **Domyślnie „Oczekujące”** — odrzucone: ekran jest otwierany z biblioteki,
  więc pierwszy widok powinien odpowiadać kontekstowi „to, co dziecko widzi”.
  Kolejka jest widoczna przez licznik i jedno tapnięcie.
- **Domyślnie pierwszy niepusty status** — odrzucone: zachowanie zależałoby od
  danych, a ekran zmieniałby się między wejściami.
- **Ukrywanie chipów z zerem** — odrzucone: układ skacze, a rodzic traci
  informację, że status istnieje.
- **Automatyczne przełączanie po rozstrzygnięciu ostatniej pozycji** — odrzucone:
  rodzic traci kontekst i nie wie, dlaczego lista się zmieniła.
- **Grupowanie listy po statusach z nagłówkami zamiast filtrów** — odrzucone:
  nadal trzeba przewijać mieszany ekran; filtry dają jeden cel na raz.
- **Filtry również w „Zablokowanych” i u dziecka** — odrzucone: archiwum i świat
  dziecka mają inne reguły widoczności; nie mieszamy ich z zarządzaniem
  kanałem.
- **Zapamiętywanie filtra między osobnymi wejściami w kanał** — odrzucone:
  prowadziłoby do mylącego stanu „dlaczego widzę tylko odrzucone?”; filtr żyje
  w obrębie sesji ekranu i podglądu.

## Konsekwencje

- `domain/panel.ts` zyskuje czyste selektory statusów kanału (np. lista według
  `allowed` / `blocked` / `pending` oraz liczniki), żeby UI nie filtrowało
  statusów ad hoc.
- Ekran kanału w `ParentPanel` przechowuje aktywny filtr i przekazuje do listy
  tylko filmy wybranego statusu; stan filtra jest lokalny dla ekranu.
- Nowy wspólny wiersz chipów statusu może korzystać z istniejącego komponentu
  `Chip`; etykiety statusów pozostają w warstwie UI.
- `ChannelDetails` pozostaje bez zmian: jego dotychczasowe liczniki opisują
  kanał, a nie aktywny filtr.
- Wymagane testy: domyślnie „Zaakceptowane”; brak chipa „Wszystkie”; trzy chipy
  zawsze widoczne; filtrowanie po statusie; liczniki; puste stany per filtr;
  decyzja aktualizuje liczniki i nie zmienia aktywnego filtra; filtr przeżywa
  podgląd i wraca; świeże wejście resetuje do „Zaakceptowanych”; dziecko,
  „Zablokowane” i karta inline w „Dodaj” pozostają bez filtrów.
- Po wdrożeniu README/ADR 0016 należy uzupełnić o nowy stan ekranu kanału.
