# ADR 0007 — Dystrybucja: rodzinny sideload jako fundament, Play jako przyszła opcja

KidsTube dystrybuujemy **rodzinnym sideloadem**: APK na GitHub Releases
(wygodne do instalacji w rodzinie), podpisane domyślnym keystore debug.
To pełnoprawny cel, nie wersja testowa. Google Play to **świadoma, odwracalna
decyzja na później** — podejmowana tylko, gdy popyt na instalację bez
ręcznych kroków przeważy koszty (własny keystore, proces weryfikacji,
polityka Play wobec aplikacji łączących się z YouTube, utrzymanie).

Żadna obecna decyzja techniczna nie zamyka drogi do Play — rozwijamy pod oba
kanaly. Przejście na Play wymaga osobnej oceny (odwracalność, ToS, App Links).

Zaakceptowana konsekwencja sideloadu: intenty „Udostępnij" z YouTube
(ACTION_SEND / linking) **przegrywają z oficjalną aplikacją YouTube**
(Google ma zweryfikowane App Links). Rodzic wskazuje KidsTube jako domyślny
handler linków ręcznie (Ustawienia → Domyślne aplikacje → Otwieranie linków);
przy publikacji na Play zweryfikowane App Links rozwiązują to systemowo.

## Rozważone opcje

- **Tylko sideload, bez perspektywy Play** — odrzucone: zamyka drogę bez
  powodu; koszt utrzymania i tak jest ten sam.
- **Play od razu** — odrzucone na teraz: koszty (keystore, polityka, ryzyko
  odrzucenia) nie są wynagradzane, dopóki nie ma popytu.

## Konsekwencje

- Instrukcja ustawiania KidsTube jako domyślnego handlera linków jest
  elementem wymaganej dokumentacji sideloadu.
- Decyzja do weryfikacji przy realnym rozprzestrzenieniu aplikacji.