# ADR 0019 — Kanał: aktualizacja, polityka nowych filmów, blokada kanału

> Status: **wdrożone** (0.11.0). Rozszerza ADR 0001, 0009, 0015 i 0018.

Dotychczas kanał miał dwa niezależne przełączniki: `auto_approve` / `manual`
oraz flagę `muted` (brak RSS). Rodzic nie mógł jednym ustawieniem powiedzieć
„nowe filmy tego kanału mają być od razu blokowane” ani „pobieraj je do cache,
ale nie pokazuj w kolejce”. Blokada kanału nie miała też jawnej akcji
zbiorczej, a po zablokowaniu kanału nie dało się dopuścić pojedynczego filmu
bez odblokowywania całości.

## Decyzja

### Aktualizacja kanału

`Channel.muted` pozostaje znacznikiem „nie pobieraj RSS”. W UI jest pokazany
wprost jako przełącznik **„Aktualizuj kanał (RSS)”** (wartość przeciwna do
`muted`). Wyłączenie zatrzymuje zarówno RSS, jak i import katalogu.

### Polityka nowych filmów

`ChannelPolicy` ma cztery wartości:

| Wartość | Zachowanie nowego filmu |
| --- | --- |
| `auto_approve` | od razu `allowed` — trafia do biblioteki dziecka, |
| `manual` | `pending` — trafia do kolejki „Do zatwierdzenia”, |
| `auto_block` | od razu `blocked` — trafia do archiwum, |
| `quiet` | `pending`, ale **poza kolejką** — film jest zapisany w cache i widoczny na ekranie kanału (zakładka Oczekujące), skąd rodzic może go pojedynczo zatwierdzić. |

`quiet` jest polityką nowych filmów, a nie blokadą kanału: dotychczasowe
zaakceptowane filmy zostają w bibliotece dziecka. `muted` i `quiet` mogą
współistnieć (kanał bez RSS + ciche nowe filmy), ale `quiet` sam nie wyłącza
RSS.

Filmy z jawnych źródeł (`share`, `propose`, `manual`) **nie są ukrywane**
przez `quiet`/`muted`. Tylko skan kanału (`source: 'rss'`, w tym katalog)
respektuje cache-only. Dzięki temu udostępniony link zawsze trafia do właściwej
zakładki, a propozycja dziecka nie ginie.

### „Zablokuj wszystkie filmy z kanału”

Jedna akcja z potwierdzeniem, która:

1. dopisuje decyzję `reject` dla każdego filmu kanału, który nie jest jeszcze
   zablokowany (osobne wpisy — historia pozostaje append-only),
2. ustawia kanał na `status: 'blocked'`,
3. ustawia `muted: true` (wyłącza RSS),
4. zapisuje `Channel.blockedAt = teraz`.

### Wyjątek: pojedynczy film z zablokowanego kanału

Zablokowany kanał nadal ukrywa swoje filmy, ale rodzic może zatwierdzić
**jeden wybrany film** bez odblokowywania kanału. Wyjątkiem jest wyłącznie
ręczna decyzja `allow` (`source: 'manual'`) nowsza niż `blockedAt`. Taka
decyzja sprawia, że film jest widoczny u dziecka i w bibliotece rodzica,
mimo że kanał pozostaje zablokowany. Starsze zgody i automatyczne powtórki
decyzji wyjątku nie tworzą.

W panelu ścieżka to podgląd filmu w sekcji „Zablokowane” → **„Zezwól na ten
film”**. Filmy już odrzucone mają też bezpośrednie „Przywróć”.

## Konsekwencje

- `domain/panel.ts` dostaje selektory świadome `decisions` i `blockedAt`;
  `libraryVideos`, `blockedVideos` i `isBlockedChannelVideo` przyjmują historię
  decyzji (domyślnie pustą dla zgodności).
- `pendingVideos` filtruje cache-only tylko dla `source: 'rss'`.
- `incomingLink` przy istniejącym, nierozstrzygniętym filmie z RSS
  przepisuje `source` na `share`/`propose`, żeby wpis pojawił się we właściwej
  zakładce.
- Kopia bazy akceptuje nowe wartości `policy` i pole `blockedAt`.
- Ekran kanału pokazuje cztery chipy polityki oraz przycisk blokady całego
  kanału; dotychczasowy przełącznik auto-akceptacji znika.
