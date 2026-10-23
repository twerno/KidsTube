# ADR 0003 — Odtwarzanie: embed, własne kontrolki, koniec filmu i błędy

> Gesty ekranowe (pauza w centrum, ±10 s na brzegach): **ADR 0004b**.

Odtwarzanie to WebView z embejem (!) zatwierdzonego filmu — embed nie wyświetla
pre-rolli (obserwacja z prompt.md), a kontrolki są w całości nasze (natywne):
play/pauza, pasek postępu/seek, napisy (domyślnie OFF), wybór ścieżki audio.
Dotyk w WebView wyłączony — sterowanie idzie mostem `injectJavaScript`
↔ `movie_player`; nawigacja WebView zamknięta allowlistą (tylko embed
zatwierdzonego filmu — blockuje sugestie/related YouTube).

Koniec filmu to nasz ekran: przyciski **„Zagraj ponownie"** i **„Wróć do
listy"** (bez autoodtwarzania „następnego" — kuratorstwo to kompozycja,
kolejność wybiera dziecko jawnie). W trybie audio materiał odtwarza się
w pętli (pętlę ucina tryb snu, ADR 0002).

Błędy i przerwy sieci: jawny ekran **„Spróbuj ponownie" / „Wróć do listy"**;
po przerwie w trakcie — wznowienie od miejsca przerwy (best-effort przez
seek, bez gwarancji ze strony embeda); przy drugiej porażce podpowiedź
„sprawdź internet". Żadnych automatycznych ponowień w tle.

**Licznik limitu liczy czas faktycznego odtwarzania** (stan play zgłaszany
z odtwarzacza), nie czas otwartego ekranu. To rework obecnego kodu, który
liczył czas od wejścia do wyjścia z playera — pauza, błąd i ładowanie
muszą wypadać z licznika.

## Rozważone opcje

- **Auto-następny po filmie (strumień jak w YouTube)** — odrzucony: dziecko
  nie odchodzi od ekranu, a przy twardym limicie „następny" i tak urwałby
  się w połowie; mija się z kuratorstwem.
- **Automatyczne ponawianie ładowania w tle** — odrzucone: dziecko patrzy
  w „kręcące się kółko" bez informacji; jawny retry daje sprawczość.
- **Seek do końca filmu** liczy się jako „obejrzany w całości" (ADR 0004).

## Konsekwencje

- Detekcja końca filmu (zdarzenie z playera) zasila stan obejrzenia.
- Czas na ekranie błędu i pauzie nie zużywa limitu dziennego.
- W trybie audio ekran jest przygaszony (nie czarny): timer snu zawsze
  widoczny, play/pauza, wstecz; bez seeka (pętla zawraca).