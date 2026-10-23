# ADR 0009 — Dodawanie kolekcji: pełny katalog kanału przez InnerTube

Kanałowy RSS zwraca tylko ~15 najnowszych filmów (ADR 0001). Dla kanałów z
dużą biblioteką (np. audiobooki, ~250 pozycji) ręczne dodawanie linków jest
niepraktyczne. Potrzebujemy masowego dociągnięcia starszych pozycji.

Decyzja: rodzic dostaje na kanale **jawny przycisk „Wczytaj cały katalog"**.
Akcja pobiera pełną listę filmów kanału przez YouTube InnerTube
(`youtubei/v1/browse`, zakładka „Videos", paginacja tokenem `continuation`) —
tym samym publicznym klientem WEB, którego już używamy do rozwiązywania
kanałów, bez klucza API i bez backendu. Pobrane pozycje przechodzą przez
istniejący potok `rssToVideos` + `mergeSyncedVideos`, więc **polityka kanału
decyduje o statusie**: `auto_approve` → wszystkie dozwolone, `manual` →
wszystkie oczekujące (ADR 0001). Istniejące decyzje rodzica nie są nadpisywane
(merge zachowuje status znanych filmów).

Import jest świadomą akcją, nie automatycznym efektem dodania kanału — dodanie
kanału zostaje szybkie (RSS). Import pokazuje postęp/licznik („zaimportowano X
filmów") i ogranicza się do **budżetu stron na jedno uruchomienie**, więc kanał
z dziesiątkami tysięcy filmów nie zamuli telefonu ani nie wyczerpie limitu —
całość dopełnia się stopniowo, w kolejnych dniach.

### Wznawianie i odporność na limity

InnerTube bez klucza może podlegać limitom (np. dzienny budżet, 429, chwilowa
blokada). Import jest więc **wznawialny**, a nie jednorazowy:

- Po każdej stronie zapisujemy **kursor kontynuacji** (token), liczbę
  zaimportowanych pozycji i status (`done`) — per kanał, w repo (obok kanału).
- Jedno uruchomienie pobiera tylko **budżet stron** w danym dniu (np. 10 stron
  ≈ 300 filmów). Po wykorzystaniu budżetu import **pauzuje** i wraca przy
  następnej okazji, kontynuując od kursora — nie od początku.
- Błąd/limit/brak tokenu kończy bieg **miękko**: zachowujemy checkpoint,
  pokazujemy „wczytano do X, dokończ później", i nie psujemy już pobranych
  danych.
- Przed wznowieniem **ponawiamy ostatnią wczytaną stronę**, by wykryć, czy nowe
  filmy nie przesunęły zakresu; duplikaty i tak są odsiewane po `videoId`.
- Wyczerpany/wygasły token (YouTube je unieważnia) oznacza restart od początku —
  bezpieczny, bo merge deduplikuje; licznik pokazuje postęp.

Stan importu jest trwały (przeżywa zamknięcie aplikacji), więc kolejny dzień
startuje z kursora, a nie od zera.

## Rozważone opcje

- **Automatyczny import przy dodaniu kanału** — odrzucone: czas zależny od
  rozmiaru kanału, zaskoczenie setkami pozycji, obciążenie sieci bez decyzji
  rodzica.
- **Import z listą wyboru (checkboxy / „zaznacz wszystkie")** — odłożone:
  więcej kontroli, ale i więcej UI; można dobudować nad tym ADR-em, gdyby
  rodzic chciał importować wybiórczo.
- **Pełny backfill przez YouTube Data API** — odrzucone: wymaga klucza i
  konta (sprzeczne z „bez logowania do Google").

## Konsekwencje

- InnerTube to API wewnętrzne i nieudokumentowane — może się zmienić. Import
  jest więc akcją **best-effort**: przy błędzie/zmianie odpowiedzi zostaje RSS
  (~15) i komunikat, bez psucia reszty. Kształt odpowiedzi trzeba pokryć
  testami na utrwalonym JSON.
- Repo trzyma checkpoint importu per kanał (kursor, licznik, `done`) — to nowe
  pole w modelu kanału; usunięcie i ponowne dodanie kanału zeruje checkpoint.
- Import rozłożony na dni jest z natury częściowy: dziecko widzi to, co już
  zaimportowane; reszta dochodzi stopniowo.
- RSS nadal odpowiada za „świeżość" (nowe filmy, ADR 0006), InnerTube tylko
  za jednorazowy backfill historii.
- Deduplikacja po `videoId` (merge). Kanały `manual` po imporcie mogą mieć
  setki pozycji oczekujących — panel rodzica potrzebuje zbiorczej akcji
  „zatwierdź wszystkie" (naturalne rozszerzenie w duchu ADR 0001/0005).
- „Kolekcja" w tym ADR oznacza katalog kanału. Import pojedynczej playlisty
  to odrębny, przyszły temat.