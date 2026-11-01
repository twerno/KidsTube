# ADR 0022 — Rekord PIN w Android Keystore

> Status: **wdrożone** (0.11.8). Uzupełnia ADR 0012 i ADR 0017.

PIN rodzica nigdy nie był zapisywany jawnie — w bazie leżał tylko hash
PBKDF2-SHA256 z losową solą. Nadal jednak hash, sól i liczba iteracji były
zwykłymi polami w `Settings` w AsyncStorage, a więc trafiały do kopii danych
aplikacji i były czytelne po wyciągnięciu plików urządzenia. Chcemy, żeby
materiał PIN był dodatkowo zaszyfrowany kluczem, którego nie da się wyjąć
z urządzenia.

## Decyzja

Rekord PIN (`hash`, `salt`, `iterations`) jest przechowywany **poza
`Settings` i poza kopią bazy**, w prywatnych `SharedPreferences`
(`kidtube_secure`), jako **ciphertext AES/GCM**. Klucz AES-256 jest generowany
w **Android Keystore** (alias `kidtube_pin_v1`, bez eksportu). Szyfrowanie,
odszyfrowanie i czyszczenie realizuje natywny moduł `PinStorage`; JS widzi
tylko `save`/`load`/`clear` i nigdy nie dotyka klucza.

- Zapisywany jest cały rekord jako JSON, z IV o zmiennej długości
  (prefiks długości IV), tag GCM 128-bit.
- Odszyfrowanie niemożliwe (zmieniony/unieważniony klucz, uszkodzony wpis)
  traktujemy jako **brak PIN-u** — aplikacja prosi o nowy kod zamiast się
  wysypać.
- `clear` usuwa ciphertext i klucz Keystore.
- Backend i eksport bazy nadal nie zawierają PIN-u (ADR 0017).
- Weryfikacja i blokada po błędnych próbach (ADR 0012) pozostają bez zmian;
  zmienia się tylko miejsce i forma przechowywania rekordu.

## Migracja

Przy starcie repozytorium czyta stare pola `settings.pinHash/pinSalt/
pinIterations`. Jeśli bezpieczny magazyn jest już zajęty — wygrywa on. Jeśli
nie, rekord jest przenoszony do Keystore, a stare pola są usuwane z
AsyncStorage. Gdy moduł natywny jest niedostępny (testy, inne platformy),
repozytorium zostawia stare pola jako fallback, żeby rodzic nie został
zablokowany; na Androidzie moduł jest zawsze obecny.

## Rozważone opcje

- **Zostawić hash w AsyncStorage** — odrzucone: hash z solą jest wprawdzie
  jednokierunkowy, ale nadal pozwala na offline zgadywanie PIN-u po kopii
  danych; Keystore podnosi koszt ataku.
- **EncryptedSharedPreferences (androidx.security)** — odrzucone na teraz:
  dodatkowa zależność i kolejna warstwa; własny AES/GCM + Keystore jest
  wystarczający i nie wymaga nowych paczek.
- **PIN w Keychain/Keystore jako sekret zamiast hasha** — odrzucone: nadal
  potrzebujemy soli i iteracji do weryfikacji; hash w Keystore jest prostszy.
- **Biometria jako zamiennik** — poza zakresem (ADR 0012).
- **Eksport PIN-u w kopii bazy** — odrzucone: PIN jest urządzeniowy, kopia ma
  działać po przywróceniu na innym telefonie z nowym kodem.

## Konsekwencje

- `Repository` zyskuje `getPinRecord`/`savePinRecord`/`clearPinRecord`;
  `Settings.pinHash*` zostają tylko jako pole migracyjne (deprecated).
- `App` trzyma `pinRecord` w stanie i używa go w bramce PIN, zmianie kodu
  i dodatkowym czasie; `applyBackup` zachowuje rekord urządzenia, a nie pola
  w snapshotcie.
- Nowy natywny `PinStorageModule` (AES/GCM + Keystore) i most
  `native/pinStorage.ts` (bezpieczny no-op poza Androidem).
- Kopia bazy nadal nie zawiera PIN-u; `pinGuard` pozostaje lokalny.
- Wymagane testy: serializacja/parsowanie mostu, odrzucanie uszkodzonego
  rekordu, brak modułu, błędy natywne, migracja starych pól, zachowanie PIN-u
  przy imporcie bazy.
