# ADR 0004 — Świat dziecka: zakładki, nawigacja kontekstowa, stan obejrzenia, historia

> Warstwa danych (postęp, wznowienie, historia) i badge stanu obejrzenia są
> wdrożone; pozostały zakres (zakładki, nawigacja, siatka, widoki historii)
> i decyzje z sesji wdrożeniowej: **ADR 0004a**.

Ekran główny dziecka to cztery zakładki: **Feed** (wspólny strumień dozwolonych
filmów na dużych miniaturach, sortowany od najświeżej rozstrzygniętych),
**Kanały** (listy kanałów z logo; wejście w kanał = feed wyfiltrowany do jego
filmów), **Do zatwierdzenia** (wyłącznie własne oczekujące propozycje; po
decyzji rodzica pozycja znika; filmy z kanałów `manual` czekają wyłącznie
w panelu rodzica — dziecko ich nie widzi) oraz **Historia oglądania**.

Nawigacja jest **kontekstowa**: wstecz cofa po ścieżce użytkownika
(feed → film → wstecz → feed; kanały → kanał → film → wstecz → kanał),
nigdy „zawsze do ekranu głównego". Ścieżka jest zapamiętywana per wejście.

**Stan obejrzenia** na kafelkach: **nowy** (nigdy nieodtwarzany; badge znika
po pierwszym odtworzeniu), **częściowo** (postęp w minutach — czas trwania
z oEmbed nie jest niezawodny, więc nie procenty), **obejrzany w całości**
(dojście do końca odtwarzania lub seek do końca). Widoczny we wszystkich
widokach dziecka **z wyjątkiem zakładki „Do zatwierdzenia"** (tam nic nie
było odtwarzane — stan nie ma sensu).

**Wznowienie**: otwarcie filmu, który dziecko już częściowo obejrzało,
startuje od miejsca, w którym poprzednio skończyło (zapisana pozycja =
postęp). Dotyczy wyłącznie świata dziecka; **podgląd w panelu rodzica zawsze
gra od początku** i nie zmienia stanu obejrzenia ani historii oglądania
dziecka (spójnie z definicją podglądu, CONTEXT.md).

**Historia oglądania** zapisuje ostatnio otwierane materiały wraz z czasem
spędzonym (suma + rozbicie na tryb audio/wideo). Grupowana po dniach:
nagłówek dnia ze statystykami, pod spodem lista — u dziecka z miniaturami,
w panelu rodzica lista tekstowa bez miniaturek (podgląd read-only).
Retencja bez końca, bez przycisku czyszczenia (spójnie z historią decyzji,
ADR 0001).

## Rozważone opcje

- **Sekcje kanałów na ekranie głównym** — odrzucone: łamie globalny porządek
  recencyjny i wymaga od dziecka rozumienia pojęcia kanału; kanał został
  osobną zakładką.
- **Lista płaska** — odrzucona na rzecz siatki dużych miniatur (wybór wzrokiem).
- **Zakładka „Do zatwierdzenia" ze stanem obejrzenia** — odrzucona wprost
  przez rodzica (tam nic nie było odtwarzane).
- **Historia z procentami** — odrzucona: czas trwania filmu z oEmbed nie jest
  niezawodny; minutowy postęp wystarcza.
- **Wznowienie także w podglądzie rodzica** — odrzucone: podgląd ma pokazać
  materiał od początku i nie może nadpisać postępu dziecka.

## Konsekwencje

- Stan obejrzenia i czasy są zbierane lokalnie przy odtwarzaniu (na zapas
  przy liczniku wideo, ADR 0003); nic nie opuszcza urządzenia.
- Historia w panelu rodzica daje wgląd „co dziecko faktycznie ogląda" obok
  historii decyzji (co rodzic dopuścił).
- Pozycja wznowienia trzymana jest per film lokalnie; nie opuszcza urządzenia.