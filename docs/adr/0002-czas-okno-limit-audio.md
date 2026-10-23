# ADR 0002 — Czas: jedno okno tygodniowe, limit dzienny wideo, audio bez ograniczeń

Kontrola czasu to trzy niezależne, proste reguły: **jedno okno oglądania**
(od–do, ten sam rytm każdego dnia tygodnia) jako bramka dla wideo; **limit
dzienny wideo** (jeden budżet minut na dzień kalendarzowy, reset lokalną
północą); **audio bez ograniczeń** — dostępne zawsze, także poza oknem.

„Audio" to **tryb odtwarzania**, nie osobna kategoria treści: każdy film
z biblioteki można odtworzyć z obrazem wyłączonym; ten sam materiał, inna
prezentacja i inny licznik (audio nie zużywa limitu wideo).

Poza oknem lub po wyczerpaniu limitu dozwolony jest wyłącznie tryb audio.
To zastępuje dawne ustawienie „godzina ciszy" (`audioOnlyAfterMinute`) —
usunięte, brak dwóch niezależnych bramek.

**Tryb snu** na ekranie audio: zawsze widoczny licznik 1 h z przyciskiem
resetu; po odliczeniu odtwarzanie zatrzymuje się, ekran audio zostaje
(dziecko może wznowić; wznowienie = nowe odliczanie 1 h).

## Rozważone opcje

- **Wiele okien dziennie / klasy dni (szkolne–weekend)** — odrzucone:
  harmonogram ma pozostać prosty; weekend i dni robocze mają ten sam rytm.
  Powrót możliwy, gdyby pojawiło się realne zapotrzebowanie (backlog).
- **Osobna kategoria treści „audio" (audiobooki/muzyka jako drugi typ)** —
  odrzucone: rozbija model treści na dwie biblioteki; tryb wystarcza.
- **Cicha godzina nocna jako osobne ustawienie** — odrzucone: „po 20:00 tylko
  dźwiękiem" osiąga rodzic końcem okna albo limitem; jedna bramka mniej.
- **Kończenie bieżącego filmu po limicie (łagodne cięcie)** — odrzucone
  w ADR 0005 (twarde cięcie + ostrzeżenie).

## Konsekwencje

- Okno dotyczy wyłącznie wideo; audio działa 24/7 (np. audio na dobranoc).
- Tryb snu to wyłącznik po zaśnięciu, nie limit — nie koliduje z „audio
  bez ograniczeń" (pętla i tak się zatrzyma po 1 h).
- Limit mierzony jest czasem **faktycznego odtwarzania** wideo (patrz ADR 0003).