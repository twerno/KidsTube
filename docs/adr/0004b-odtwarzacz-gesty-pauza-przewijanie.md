# ADR 0004b — Odtwarzacz: gesty na ekranie (pauza w centrum, ±10 s na brzegach)

ADR 0003 ustanowił w pełni natywne kontrolki i całkowicie wyłączony dotyk w
WebView; dziś cała powierzchnia odtwarzacza to jedna warstwa `Pressable`, która
po dotknięciu tylko pokazuje pasek kontrolek. Dla dziecka naturalniejszy jest
bezpośredni gest na obrazie, jak w YouTube: dotknięcie środka zatrzymuje/wznawia,
a podwójne dotknięcie przy brzegach przewija w tył/w przód. Ten ADR ustala ten
model; implementacja — osobny krok (niezaimplementowane).

## Decyzja

W trybie **wideo** (dotyk w WebView nadal wyłączony — to nadal warstwa RN nad
obrazem):

- **Pojedyncze dotknięcie w strefie środkowej** → przełącza **pauza / wznowienie**
  (to samo co przycisk play/pauza) i pokazuje pasek kontrolek.
- **Podwójne dotknięcie w lewej strefie brzegowej** → **−10 s**; w **prawej** →
  **+10 s**. Seek jest przycinany do `[0, duration]`, a na ekranie pojawia się
  krótka informacja zwrotna („−10 s" / „+10 s").
- **Pojedyncze dotknięcie poza centrum** (np. raz na brzegu) → tylko pokazuje
  pasek kontrolek (jak dziś), nie zmienia odtwarzania.
- **Pasek kontrolek ma priorytet**: gdy jest widoczny, dotknięcia jego przycisków
  (play, seek, CC, audio) działają normalnie — warstwa gestów leży pod nim.
- Gesty są **nieaktywne**, gdy na wierzchu jest overlay końca, błędu lub cięcia
  limitu — te ekrany mają własne przyciski.
- W **trybie audio** gesty nie obowiązują: tam jest osobny ekran z `AudioControls`.

### Rozpoznanie gestu

Podwójne dotknięcie składa się z dwóch pojedynczych, więc pojedynczego tapnięcia
w centrum **nie wykonujemy natychmiast** — czekamy krótko (~250 ms) na ewentualne
drugie dotknięcie. Bez tego pauza włączałaby się w trakcie podwójnego tapnięcia
na brzegu. Strefy: środek ~50% szerokości, brzegi po ~25% z każdej strony.

## Rozważone opcje

- **Pojedyncze dotknięcie gdziekolwiek = pauza** — odrzucone: nie zostaje
  intuicyjny sposób na samo pokazanie paska, a przypadkowe tapnięcia pauzują.
- **Podwójne dotknięcie w centrum = pauza** — odrzucone: sprzeczne z nawykiem
  z YouTube i z prostotą „tap w środek".
- **Przewijanie o 5 s / 30 s** — odrzucone: 10 s to kompromis (mniejsze kroki
  są nużące, większe gubią kontekst).
- **Gesty także w trybie audio** — odrzucone: ekran audio rządzi się własnymi
  kontrolkami (pętla, tryb snu); mieszanie gestów myli.

## Konsekwencje

- Nowa warstwa rozpoznawania gestów nad `EmbedPlayer`, współdzieląca `seekTo`
  z paskiem (`PlayerHandle.seekTo`) i logikę pokazywania paska (`showControls`).
- Opóźnienie pojedynczego tapnięcia (~250 ms) jest odczuwalne; dotyczy tylko
  pauzy w centrum.
- Bez zmian w DTO postępu (ADR 0004): seek przez gest zapisuje pozycję tak samo
  jak każdy inny seek.
