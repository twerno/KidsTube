# ADR 0025 — Ekran nie blokuje się podczas odtwarzania

> Status: **wdrożone** (0.11.16). Uzupełnia ADR 0002 i ADR 0021.

## Problem

Tryb audio to ekran zasypiania, ale mechanizm snu (ADR 0021) tylko pauzuje
odtwarzanie — telefon wyłącza się wyłącznie dzięki systemowemu limitowi
wygaszania ekranu. Zmierzone na emulatorze: podczas odtwarzania ekran trzyma
`FLAG_KEEP_SCREEN_ON` ustawiony przez WebView z YouTube, a po pauzie flaga
znika (`mHoldScreenWindow=null`), więc system może zablokować ekran.

To jest dokładnie ta zależność, która jest krucha: o ile YouTube trzyma ekran,
dopóki gra, o tyle nie ma żadnej gwarancji, że zrobi to w trybie audio
(obraz wyłączony), po buforowaniu, ani na każdej wersji WebView. Jeśli ekran
zaśnie w środku rozdziału, dziecko budzi się z zablokowanym telefonem i ciszą.

Jednocześnie odwrotna sytuacja jest groźna: gdyby aplikacja trzymała ekran
zawsze, telefon nie wyłączyłby się po zaśnięciu i świeciłby całą noc.

## Decyzja

**Odtwarzanie trzyma ekran, zatrzymanie — nie.**

- Dopóki materiał leci (`playing` lub `buffering`), KidTube sam ustawia
  `FLAG_KEEP_SCREEN_ON` na oknie i `keepScreenOn` na `decorView`. Ekran nie
  gaśnie, więc rozdział nie urywa się w połowie. Buforowanie liczy się jako
  „leci”, żeby krótkie zacięcie sieci nie oddało telefonu ekranowi blokady.
- Gdy odtwarzanie się zatrzyma — pauza dziecka, koniec filmu, zadziałanie
  licznika snu (ADR 0021), błąd — flaga jest **zdejmowana** (także z widoków
  potomnych, czyli z wake locka, który mógł wziąć WebView). Od tej chwili nic
  w aplikacji nie trzyma telefonu i blokuje go zwykły systemowy limit
  wygaszania ekranu.

Licznik snu **zostaje bez zmian** (tyka tylko przy odtwarzaniu, reset po
aktywności, po wystrzeleniu pauza i jawne „Wznów”). To celowe: skoro
zatrzymanie odtwarzania zwalnia ekran, telefon i tak się zablokuje — czy
pauzę zrobiło dziecko, czy licznik. Ten ADR nie zmienia więc semantyki snu,
tylko domyka drogę do „telefon gaśnie”.

Świadomie **nie** sięgamy po `DevicePolicyManager.lockNow()` (wymaga
administratora urządzenia) ani po zmianę systemowego limitu wygaszania
(wymaga `WRITE_SETTINGS`): obie rzeczy to zgody, których aplikacja dla dzieci
nie powinna wymuszać. Wystarczy nie przeszkadzać systemowi.

## Konsekwencje

- `SystemUiModule.kt`: `setKeepScreenOn(enabled)` — flaga okna + `decorView`
  (czyszczenie widoku zdejmuje też wake lock WebView).
- `native/systemUi.ts`: `setKeepScreenOn` w moście i `keepScreenAwake(enabled)`
  (best effort, brak modułu = no-op).
- `PlayerScreen`: efekt na `state.playing || state.buffering`, sprzątanie
  zdejmuje flagę przy pauzie, końcu, błędzie i odmontowaniu ekranu.
- Wymaga od rodzica sensownego systemowego limitu wygaszania ekranu (domyślnie
  30 s–2 min). „Nigdy” w ustawieniach Androida nadal oznacza telefon świecący
  całą noc — tego aplikacja bez uprawnień nie obejdzie.
- Testy mostka: przekazanie, no-op bez modułu, połykanie błędów.
