# AGENTS.md — KidsTube: środowisko i piaskownica

To, czego **nie ma** w README (sieć, emulator, gotchas toolchainu).
Architektura, decyzje, testy, build Android — patrz `KidsTube/README.md`.

## Sandbox — sieć

- Linuxowy kontener, internet tylko z białej listy:
  `*.youtube.com`, `*.googlevideo.com`, `i.ytimg.com`, `developers.google.com`, repozytoria pakietów
  (npm, `dl.google.com`, `repo.reactnative.dev`). Brakujący dostęp — poprosić.
- Procesy JVM (gradle, maven, sdkmanager) chodzą przez proxy
  `gateway.docker.internal:3128` (ustawiane przez `JAVA_TOOL_OPTIONS`).
  `curl`/`wget`/`npm` — bezpośrednio.

## Emulator Androida

- Android **16** (kernel `6.12.38-android16`), x86_64,
  urządzenie `sdk_gphone64_x86_64`.
- Serwer adb na hoście (`host.docker.internal:5037`):

  ```bash
  source env-android.sh
  adb -H host.docker.internal -P 5037 -s emulator-5554 devices -l
  adb -H host.docker.internal -P 5037 -s emulator-5554 install KidsTube/android/app/build/outputs/apk/release/app-release.apk
  adb -H host.docker.internal -P 5037 -s emulator-5554 logcat
  ```

- [`adb` = `$ANDROID_HOME/platform-tools/adb`] adb **nie jest w PATH** przed
  source'owaniem `env-android.sh`; `./adb` w katalogu roboczym nie istnieje.
- Sieć z guesta jest (weryfikowane z emulatora): `youtube.com` i
  `developers.google.com` osiągalne — testy integracyjne WebView/embed
  w emulatorze są wykonalne.

## Toolchain (pokaźne pułapki)

- `source env-android.sh` **przed każdym buildem Gradle**: ustawia
  `ANDROID_HOME=/home/agent/android-sdk`, `JAVA_HOME`=JDK 17
  (`/usr/lib/jvm/java-17-openjdk-amd64`) i dopina `platform-tools` +
  `cmdline-tools/latest/bin` do PATH.
- Domyślny `java` w kontenerze to **JDK 25** — build bez tych zmiennych
  pada na wersji JVM.
- Instalowane SDK (bez ponownej instalacji): build-tools 36/37,
  platform `android-37.0`, NDK `27.1.12297006`, cmake `3.22.1`.

## Repo

- Root repozytorium = `/home/agent/workspace` (git tu siedzi),
  `KidsTube/` to aplikacja RN. Jeden commit na `master`, drzewo czyste,
  brak remote.
- Git user ustawiony lokalnie: `KidsTube Dev <dev@kidstube.local>`.
- UI i komunikaty aplikacji — po polsku (to produkt, nie scaffold).

## Workflow po wykonaniu pracy

- Po ukończeniu pracy **nie commituj** — najpierw zbuduj APK release i
  zainstaluj w emulatorze do testów (komendy w sekcji „Emulator Androida”).
- Commit dopiero po akceptacji zmian przez użytkownika.

## Stan na start

- APK zbudowane: `KidsTube/android/app/build/outputs/apk/{debug,release}/`
  (release 21 MB — sideload do emulatora).
- `npm test` = 99 testów, `npx tsc --noEmit` i `npx eslint .` — czysto.

## Kompilacje testowe

- pamiętaj o zwiększeniu wersji podczas przygotowywania kolejnej kompilacji testowej
- pin rodzica to 1111