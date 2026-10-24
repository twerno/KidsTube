# ADR 0017 — Baza danych: eksport i import kopii w pliku JSON

> Propozycja — nie wdrożone. Rozszerza ADR 0016 o sekcję „Baza danych”.

KidTube jest w pełni lokalna: nie ma konta ani backendu (ADR 0007), a cała
biblioteka, kanały, decyzje, historia oglądania, ustawienia i kod rodzica żyją
w AsyncStorage. Reinstalacja, zmiana telefonu albo poważny błąd oznaczają dziś
utratę wszystkiego — nie ma sposobu, by rodzic zrobił kopię i później ją
przywrócił.

Dane są rozproszone po kilku kluczach: `settings`, `channels`,
`channelProposals`, `videos`, `decisions`, `usage`, `watchProgress`,
`watchHistory`, `extraTime` oraz `pinGuard`. Log jest wyłącznie buforem sesji
(ADR 0016), a `pinGuard` to stan blokady PIN (ADR 0012).

Decyzja: w panelu rodzica powstaje sekcja **„Baza danych”** (`database`),
umieszczona po **„Powiąż z linkami YouTube”**, a przed **„Log”**. Zawiera dwie
akcje:

- **„Eksportuj bazę do JSON”**,
- **„Importuj bazę z JSON”**.

Sekcja obsługuje **całą lokalną bazę**, a nie pojedyncze listy. Import jest
**odtworzeniem kopii**: zastępuje całą bazę, nie scala jej z obecnymi danymi.

## Eksport

- Eksport tworzy **spójny snapshot przez repozytorium**, a nie surowy zrzut
  kluczy AsyncStorage. Dzięki temu format pliku nie zależy od wewnętrznych
  nazw kluczy i może ewoluować razem z modelem domeny.
- Plik zapisujemy przez systemowy wybór miejsca (Android Storage Access
  Framework, `ACTION_CREATE_DOCUMENT`, MIME `application/json`). Proponowana
  nazwa: `kidtube-backup-YYYY-MM-DD-HHmm.json`.
- Nie potrzebujemy uprawnień do pamięci ani sieci. Anulowanie wyboru miejsca
  oznacza brak pliku i brak zmian w bazie.
- Eksport nie zmienia danych, nie uruchamia synchronizacji i nie blokuje
  dłużej niż na czas odczytu snapshotu.
- Eksport wymaga potwierdzenia aktualnym kodem rodzica (ADR 0012), ponieważ
  plik zawiera dane wrażliwe.
- Plik zawiera **hash i sól kodu rodzica** (nigdy jawny PIN), imię dziecka,
  pełną historię oglądania i decyzje. To dane wrażliwe — UI musi to jasno
  powiedzieć przed zapisem.

## Format pliku

Plik jest jednym obiektem JSON z jawną kopertą:

```json
{
  "format": "kidtube-db",
  "schemaVersion": 1,
  "exportedAt": "2026-10-24T12:34:56.000Z",
  "appVersion": "0.8.0",
  "data": {
    "settings": {},
    "channels": [],
    "channelProposals": [],
    "videos": [],
    "decisions": [],
    "usage": {},
    "watchProgress": [],
    "watchHistory": [],
    "extraTime": null
  }
}
```

- `format` musi mieć wartość `kidtube-db`; inne pliki są odrzucane.
- `schemaVersion` to wersja formatu, niezależna od `appVersion`.
- `exportedAt` to znacznik czasu w ISO 8601 (UTC), a `appVersion` służy tylko
  do informacji i diagnostyki.
- `data` zawiera wszystkie trwałe kolekcje domenowe: ustawienia (w tym
  `schedule`, `youtubeLinkHandlerEnabled` i dane PIN-u), kanały (w tym
  `muted`), propozycje kanałów, filmy, decyzje (łącznie z `retract`), zużycie
  czasu, postęp, historię oglądania i pulę dodatkowego czasu.
- **Poza plikiem pozostają**: `pinGuard` (stan blokady PIN jest lokalny dla
  urządzenia i zostanie wyzerowany po imporcie) oraz log sesji (ADR 0016
  wprost wyklucza jego eksport).
- Kolejność tablic jest zachowywana; decyzje pozostają w kolejności
  append-only, bo ich kolejność ma znaczenie dla last-wins.

## Import

Import uruchamia systemowy wybór pliku (`ACTION_OPEN_DOCUMENT`, JSON lub
`text/plain`), wczytuje cały plik i **najpierw go waliduje**. Dopóki cały
dokument nie przejdzie walidacji, baza pozostaje nietknięta.

### Walidacja

- Wymagana jest poprawna koperta `format` i `schemaVersion`.
- Akceptujemy tylko wersję znaną tej aplikacji. Wersja nowsza jest odrzucana
  z komunikatem „plik z nowszej wersji”; starsze wersje mogą być obsłużone
  migracją, gdy taka powstanie.
- Wymagane są wszystkie kolekcje wersji 1; brakująca kolekcja to błąd, nie
  ciche „puste dane”.
- Sprawdzane są typy, dozwolone wartości enumów, zakresy liczb (np. sekundy
  nieujemne, minuty okna w zakresie doby), unikalność identyfikatorów kanałów,
  filmów, propozycji i postępu oraz unikalność wpisów historii po
  `(videoId, dateKey)`. Decyzje mogą występować wielokrotnie dla tego samego
  filmu — to normalna historia append-only.
- **Sieroty są dozwolone**: decyzja lub historia może dotyczyć filmu, którego
  już nie ma; film może nie mieć rekordu kanału; propozycja może być
  nierozwiązana. Nie odrzucamy poprawnych danych tylko dlatego, że biblioteka
  była wcześniej czyszczona.
- Jeśli plik zawiera dane PIN-u, musi to być komplet `pinHash`, `pinSalt`
  i `pinIterations`; niepełny zestaw jest błędem. Brak danych PIN-u jest
  dozwolony — po imporcie aplikacja przejdzie przez ustawianie kodu.
- Nieznane pola w znanej wersji są ignorowane; nieznana nowsza wersja jest
  odrzucana. Dzięki temu przyszłe, kompatybilne dodatki nie psują importu.

### Potwierdzenie i zastąpienie bazy

- Po walidacji panel pokazuje podsumowanie pliku: datę eksportu, wersję,
  liczbę kanałów, filmów, decyzji i wpisów historii oraz ostrzeżenie, że
  **cała obecna baza zostanie zastąpiona**.
- Komunikat mówi też, że import przywraca ustawienia i **kod rodzica z pliku**
  (jeśli plik go zawiera) oraz liczniki czasu z pliku. Rodzic powinien znać
  kod z kopii; bez niego po imporcie może utracić dostęp do panelu.
- Panel sugeruje **najpierw wyeksportować obecną bazę**, żeby mieć drogę
  powrotu.
- Import wymaga ponownego potwierdzenia aktualnym kodem rodzica (wspólna
  bramka PIN i blokada, ADR 0012). Anulowanie lub błędny PIN nie zmieniają
  bazy.
- Po potwierdzeniu import jest **operacją wyłączną**: panel blokuje akcje
  i synchronizację, czeka na bieżące zapisy i dopiero wtedy zastępuje dane.
- Import jest transakcją repozytorium: przed nadpisaniem odkładana jest kopia
  rollback; zapis wszystkich kolekcji jest jedną operacją. Jeśli zapis się nie
  powiedzie, poprzednia baza jest przywracana. Przy starcie aplikacja wykrywa
  niedokończony import i kończy go albo wraca do poprzedniego stanu — baza nie
  może zostać częściowo nadpisana.
- Po udanym imporcie aplikacja **zamyka panel i przeładowuje cały stan**.
  Ponowne wejście do panelu wymaga kodu z importu (albo ustawienia nowego
  kodu, jeśli plik go nie miał). Import nie uruchamia synchronizacji ani
  backfillu z ADR 0015; to robi dopiero następny start lub pull-to-refresh.
- `pinGuard` nie jest importowany: po sukcesie stan blokady jest zerowany,
  a po niepowodzeniu nie jest nadpisywany zawartością pliku.

## Bezpieczeństwo

- Plik jest **jawnym JSON-em**, nie jest szyfrowany. Zawiera hash PIN-u, sól,
  imię dziecka, historię oglądania i decyzje. Rodzic powinien traktować go jak
  dane wrażliwe i nie wysyłać go przypadkowo.
- Nie eksportujemy jawnego PIN-u ani żadnych sekretów innych niż pochodne
  PBKDF2 potrzebne do odtworzenia logowania.
- Import **nie ufa zawartości pliku**: waliduje dane, nie wykonuje kodu, nie
  pobiera niczego z sieci i nie uruchamia linków. Nieznany plik może jednak
  zmienić bibliotekę i kod rodzica, dlatego wymagane jest świadome
  potwierdzenie.
- Eksport i import są akcjami rodzica za bramką PIN; nieudane próby liczą się
  do wspólnej blokady z ADR 0012.
- Nie ma automatycznego backupu, harmonogramu ani chmury. Miejsce zapisu
  wybiera rodzic, a plik nie opuszcza urządzenia bez jego decyzji.

## Rozważone opcje

- **Surowy dump AsyncStorage** — odrzucone: wiąże plik z wewnętrznymi nazwami
  kluczy, nie waliduje danych i utrudnia wykluczenie `pinGuard` oraz przyszłe
  migracje.
- **Import przez scalanie (merge)** — odrzucone w wersji 1: konfliktuje
  ustawienia, kod rodzica i append-only historię; restore ma być
  deterministyczny. Selektywne scalanie to ewentualna przyszła funkcja.
- **Import bez walidacji / częściowy** — odrzucone: może zostawić bazę
  w niespójnym stanie i zniszczyć dane rodzica.
- **Import tylko treści, bez ustawień i PIN-u** — odrzucone: nie odtwarza
  pełnej kopii; przeniesienie na nowy telefon wymagałoby ręcznej
  rekonfiguracji.
- **Eksport automatyczny / do chmury** — odrzucone: brak backendu i konta
  (ADR 0007), a wysyłanie historii i hasha PIN-u bez jawnej decyzji rodzica
  byłoby ryzykowne.
- **Kopia tylko w pamięci prywatnej aplikacji** — odrzucone: ginie razem
  z odinstalowaniem, czyli dokładnie w najczęstszym scenariuszu odtwarzania.
- **Import przez „Udostępnij” zamiast wyboru pliku** — odrzucone: nie daje
  stabilnego pliku do późniejszego przywrócenia; SAF jest właściwym
  mechanizmem dla kopii.
- **Szyfrowanie pliku kopii** — odłożone poza wersję 1: wymaga zarządzania
  kluczem i odzyskiwania po zapomnianym PIN-ie. Na teraz jawny JSON
  z wyraźnym ostrzeżeniem.
- **Import z zachowaniem obecnego PIN-u** — odrzucone: kopia ma odtwarzać
  także kod rodzica; inaczej przeniesienie na nowy telefon wymagałoby
  dodatkowej konfiguracji. Ryzyko jest komunikowane przed importem.
- **Brak ponownego PIN-u przy eksporcie/imporcie** — odrzucone: eksport
  ujawnia wrażliwe dane, a import może podmienić kod rodzica; panel może być
  otwarty, więc sama obecność w panelu to za mało.
- **Automatyczna synchronizacja po imporcie** — odrzucone: zmieniałaby
  odtworzony stan zanim rodzic go zobaczy.
- **Import wielu plików naraz** — poza zakresem; jedna kopia, jedno
  potwierdzenie, jeden spójny stan.

## Konsekwencje

- `SectionKey` i indeks panelu (ADR 0016) zyskują `database`; kolejność:
  `… → Powiąż z linkami YouTube → Baza danych → Log`. `Log` pozostaje ostatni.
- Powstaje ekran sekcji „Baza danych” z opisem, dwoma przyciskami, stanem
  operacji (eksport/import), podsumowaniem pliku i potwierdzeniem. Same dane
  nie są edytowalne w UI.
- Repozytorium zyskuje operacje snapshotu i zastąpienia bazy; nie mogą to być
  niezależne zapisy z ekranu. Wymagana jest kopia rollback i wykrywanie
  niedokończonego importu przy starcie.
- Powstaje czysta warstwa walidacji/migracji formatu (np. `domain/backup.ts`)
  oraz natywny most do SAF (`ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT`).
- Nowe kolekcje domenowe wymagają podniesienia `schemaVersion` i migracji
  importu. Eksport zawsze zapisuje najnowszą wersję.
- Po imporcie trzeba ponownie zastosować ustawienie `youtubeLinkHandlerEnabled`
  do komponentu linków (ADR 0014), bo stan systemowy nie jest częścią pliku.
- `pinGuard` jest zerowany; log sesji nie jest częścią kopii i pozostaje
  buforem bieżącej sesji.
- Wymagane testy: poprawny eksport zawiera wszystkie kolekcje i nie zawiera
  `pinGuard`/logu; import poprawnego pliku zastępuje bazę; błędny JSON,
  nieznana wersja, brak kolekcji, duplikaty i zły PIN nie zmieniają bazy;
  anulowanie importu nie zmienia bazy; rollback po błędzie zapisu; po imporcie
  stan jest przeładowany, panel zamknięty, a kod pochodzi z pliku; import nie
  uruchamia syncu/backfillu; ustawienie linków jest ponownie zastosowane.
- Po wdrożeniu README i instrukcja dla rodzica muszą opisać format kopii,
  miejsce zapisu, brak szyfrowania i to, że import zastępuje całą bazę oraz
  może zmienić kod rodzica.
