# ADR 0012 — Blokada profilu rodzica po trzech błędnych PIN-ach

> Wdrożone w 0.5.0 — szczegóły: `docs/notes/ADR-0011-0012-wdrozenie.md`.

PIN rodzica jest jedyną bramką panelu rodzica, a od ADR 0011 także przyznawania
dodatkowego czasu. Dziś weryfikacja nie ma żadnego ograniczenia: przy
4-cyfrowym kodzie dziecko może próbować kolejnych kombinacji bez końca.
Potrzebne jest proste, przewidywalne spowolnienie, które nie wymaga backendu.

Decyzja: po **trzech kolejnych nieudanych weryfikacjach PIN** profil rodzica
zostaje zablokowany na **3 minuty**. Blokada obejmuje każde wejście chronione
PIN-em — panel rodzica oraz przyznanie dodatkowego czasu (ADR 0011) — ale nie
blokuje świata dziecka ani odtwarzania audio.

## Zasady

- Licznik zwiększa się tylko wtedy, gdy poprawnie sformatowany PIN został
  faktycznie zweryfikowany i odrzucony. Błędy walidacji UI (puste pole, za
  krótki kod, niezgodne powtórzenie przy ustawianiu) nie są próbą zgadywania
  i nie liczą się do blokady.
- Udana weryfikacja **zeruje licznik** i zdejmuje blokadę.
- Trzecia nieudana próba ustawia `lockedUntil = teraz + 3 min`. Do tego czasu
  żadna weryfikacja nie jest wykonywana — także poprawny PIN nie skraca
  blokady.
- Po upływie blokady licznik wraca do zera: rodzic ma znowu trzy próby.
  Blokada nie eskaluje automatycznie (świadomie stała, nie progresywna).
- Stan (liczba nieudanych prób i `lockedUntil`) jest zapisywany **lokalnie**
  i przeżywa restart aplikacji oraz zabicie procesu. Trzymanie go tylko
  w pamięci byłoby obejściem: wystarczyłoby zamknąć i otworzyć aplikację.
- Blokada jest wspólna dla wszystkich punktów wejścia z PIN-em. Sukces w jednym
  z nich zeruje licznik; nie da się obejść blokady innym ekranem.
- Podczas blokady ekran kodu pokazuje komunikat i odliczanie (`m:ss`), a pole
  i przycisk są nieaktywne. Po odliczeniu ekran wraca do normalnego stanu.
- Blokada dotyczy **profilu rodzica**, nie całej aplikacji. Dziecko może
  anulować bramkę i dalej korzystać ze świata dziecka; tryb audio działa
  normalnie.
- Ustawianie pierwszego PIN-u nie podlega blokadzie (nie ma jeszcze sekretu).
  Zmiana PIN-u w już odblokowanym panelu nie jest próbą wejścia i nie zmienia
  licznika.

## Rozważone opcje

- **Brak blokady** — odrzucone: 4-cyfrowy PIN to 10 000 kombinacji; bez
  opóźnienia dziecko może je przelecieć w praktyce.
- **Blokada całej aplikacji** — odrzucona: dziecko nie powinno tracić dostępu
  do swojego świata z powodu pomyłki rodzica; celem jest profil rodzica.
- **Licznik tylko w pamięci** — odrzucone: restart aplikacji zerowałby blokadę.
- **Blokada dłuższa lub eskalująca (5/15/60 min)** — odrzucona: dziecko może
  celowo wywołać blokadę i odciąć rodzica; stałe 3 minuty są wystarczające
  w modelu rodzinnym i przewidywalne.
- **Blokada po N próbach w oknie czasu, zamiast kolejnych** — odrzucona:
  więcej stanu i niejasne „okno”; prosta zasada „3 kolejne, do sukcesu” jest
  łatwiejsza do wyjaśnienia.
- **Pozwolenie poprawnemu PIN-owi przerwać blokadę** — odrzucone: wtedy blokada
  nie chroni przed zgadywaniem; poprawny PIN i tak jest poprawny, ale nie
  chcemy, by próba w trakcie blokady kończyła się sukcesem.
- **Blokada tylko panelu, bez dodatkowego czasu** — odrzucona: PIN jest ten
  sam, więc byłoby to obejście przez drugi ekran.
- **Backend / zaufany zegar** — odrzucone: aplikacja jest offline i bez konta;
  nie ma serwera, który mógłby pilnować czasu.
- **Kasowanie danych po N próbach** — odrzucone: zbyt destrukcyjne; rodzic
  mógłby stracić bibliotekę przez trzy pomyłki.
- **Biometria zamiast blokady** — odrzucona jako zamiennik: nie rozwiązuje
  zgadywania PIN-u i zmienia model urządzenia; ewentualnie przyszłe
  uzupełnienie, poza zakresem.

## Konsekwencje

- Powstaje czysty moduł stanu blokady (np. `domain/pinGuard.ts`): funkcje
  `canAttempt`, `recordFailure`, `recordSuccess`, `remainingLockMs` — bez I/O,
  testowalne.
- Repozytorium dostaje mały lokalny rekord stanu (liczba prób, `lockedUntil`),
  wczytywany przy starcie. Nie jest to pole w `Settings`, żeby zwykła edycja
  ustawień nie kasowała licznika.
- `GateScreen` potrzebuje stanu blokady: wyłączone pole/przycisk, komunikat
  i odliczanie; `onUnlock` najpierw sprawdza `lockedUntil`, potem weryfikuje
  PIN.
- Ta sama logika obsługuje prompt PIN z ADR 0011. Nieudane próby przy próbie
  przyznania czasu liczą się do wspólnej blokady.
- Hashowanie PIN-u (PBKDF2-SHA256, losowa sól) zostaje bez zmian; blokada jest
  warstwą na wierzchu weryfikacji, a nie nowym mechanizmem kryptograficznym.
- Blokada opiera się na lokalnym zegarze. Zmiana czasu w systemie może ją
  skrócić lub wydłużyć, a wyczyszczenie danych aplikacji / reinstalacja ją
  zeruje. To akceptowalne w modelu rodzinnym; ochrona przed technicznym
  napastnikiem wymagałaby backendu lub uprawnień administracyjnych.
- Dziecko może celowo wpisać trzy błędne PIN-y i zablokować rodzicowi panel na
  3 minuty. To świadomie zaakceptowany koszt; blokada jest krótka, a świat
  dziecka działa dalej.
- Wymagane testy: dwie pomyłki bez blokady, trzecia blokuje, odliczanie,
  wygaśnięcie i reset licznika, sukces zeruje, blokada przeżywa restart,
  wspólny licznik dla panelu i dodatkowego czasu, błędy walidacji nie liczą się.