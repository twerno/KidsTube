# ADR 0005 — Świat rodzica: grupy zakładek, UX limitu, dodawanie treści

Panel rodzica ma **grupy zakładek**: **Treści** (Filmy · Kanały · Oczekujące),
**Historia** (Decyzje · Oglądanie), **Ustawienia** (Harmonogram · Konto
dziecka). Grupowanie odzwierciedla dwie czynności — zarządzanie treścią
(codzienne) i wgląd (rzadszy). Listy treści (Filmy, Oczekujące) korzystają
ze wspólnego komponentu z **filtrowaniem/grupowaniem po kanałach**.

Lista **Oczekujących** pokazuje oba źródła z wyróżnieniem: filmy dołączone
skanem RSS z kanałów `manual` oraz propozycje dziecka (etykieta/filtr
„z kanału X · RSS” / „propozycja dziecka”). Każdy element daje **podgląd
filmu przed rozstrzygnięciem** — rodzic odtwarza materiał w panelu, zanim
zatwierdzi lub odrzuci.

**UX limitu dziennego**: twarde cięcie w momencie wyczerpania („limit to
limit") z ostrzeżeniem 5 minut przed; po limicie dziecko ląduje w trybie
audio (ADR 0002). Odrzucone łagodne kończenie bieżącego filmu — rodzic
wprost wybrał twardą interpretację limitu.

**Dodawanie treści**: fundamentem jest **link / Udostępnij** (wklejony
film, kanał, handle) — działa zawsze. **Wyszukiwarka YouTube w panelu**
(jak w README: „mini-przeglądarka") powstaje jako **prototyp z bramką
oceny**: zbudować, sprawdzić stabilność endpointu na `youtube.com`;
jeśli się potwierdzi — zostaje, jeśli nie — odrzucana bez szkody dla
podstawy. Wyszukiwarka jest wyłącznie narzędziem rodzica; dziecko nie ma
do niej drogi.

Interakcje: dotknięcie decyzji w historii → dialog zmiany (last-wins,
ADR 0001); dialog cofnięcia autoakceptacji/usunięcia kanału pokazuje
liczbę filmów, których dotknie („Cofnąć też zatwierdzenia 12 filmów
z kanału X?"). **Podgląd** działa w kontekście rodzica: nie wpływa na
limit dzienny, stan obejrzenia ani historię oglądania dziecka (osobny
kontekst odtwarzania; ta sama allowlista embeda, co w ADR 0003).
Konto dziecka: nazwa + kolor/awatar (bez konta Google).

## Rozważone opcje

- **8 wąskich zakładek w jednym rzędzie** — odrzucone: etykiety się tną,
  trudno trafić palcem.
- **Jedna przewijana strona z sekcjami** — odrzucona: długa strona, ryzyko
  przypadkowej edycji, brak wyraźnego porządku.
- **Łagodne cięcie limitu (dogranie bieżącego filmu)** — odrzucone: „limit
  to limit"; ostrzeżenie łagodzi szok, cięcie jest stanowcze.
- **Wyszukiwarka jako jedyna droga dodawania** — odrzucona: wymaga stabilnego
  endpointu; link działa zawsze.

## Konsekwencje

- Prototyp wyszukiwarki wymaga zdefiniowanego testu akceptacji (stabilność
  endpointu wg ustalonego kryterium), zanim decyzja przejdzie w trwałą.
- Dialogi zmiany decyzji i cofnięcia kanału to jedyne miejsca masowej
  edycji stanu — chronią przed przypadkowym zbiorczym odrzuceniem.