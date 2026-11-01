# ADR 0021 — Ekran audio: reset licznika po aktywności i przygaszone podświetlenie

> Status: **wdrożone** (0.11.0). Uzupełnia ADR 0002.
> Uzupełnione przez ADR 0025: w trakcie odtwarzania ekran nie może się
> zablokować (a po zatrzymaniu nie jest już trzymany, więc telefon gaśnie
> systemowym limitem wygaszania).

Ekran audio to ekran zasypiania: dziecko słucha z wyłączonym obrazem, a po
30 minutach odtwarzanie ma się zatrzymać. Rodzic chciał, żeby każda aktywność
znaczyła „jeszcze nie śpię” i przesuwała wyłączenie o pełne 30 minut, więc
osobny przycisk „Reset” zniknął. Dodatkowo jasny ekran w ciemnym pokoju
przeszkadza — potrzebne jest przygaszenie rzeczywistego podświetlenia.

## Reset po aktywności

W trybie audio **każda interakcja** resetuje odliczanie do pełnych 30 minut:

- dotknięcie ekranu w dowolnym miejscu,
- play/pauza,
- przewijanie i skoki ±30 s / ±5 min (także start przeciągania paska),
- przełączenie pętli.

Po wystrzeleniu licznika odtwarzanie jest zatrzymane, a **dotknięcia nie
wznawiają go po cichu**: trzeba użyć przycisku **„Wznów”** (wznowienie =
nowe odliczanie 30 minut). Dzięki temu przypadkowy dotyk w nocy nie uruchamia
filmu. Osobny przycisk resetu nie jest potrzebny — każdy dotyk już resetuje
licznik.

Reset po aktywności dotyczy wyłącznie trybu audio. W trybie wideo licznik
limitu dziennego nadal liczy faktyczne odtwarzanie i nie reaguje na dotknięcia.

## Przygaszenie ekranu

W trybie audio aplikacja ustawia jasność okna Androida na **0,15** (15%).
To realne przygaszenie podświetlenia, nie tylko nakładka na obraz. Jasność
systemowa jest przywracana przy:

- przejściu z audio do wideo,
- wyjściu z odtwarzacza,
- odmontowaniu ekranu.

Operacja jest best-effort: brak modułu natywnego (testy, inne platformy) lub
błąd systemu nie może przerwać odtwarzania.

## Konsekwencje

- `domain/sleepMode.ts` dostaje `resetSleepOnActivity`: gasi licznik tylko,
  gdy jeszcze nie wystrzelił.
- `PlayerScreen` nasłuchuje `onTouchStart` na ekranie audio (tap gdziekolwiek =
  reset) i resetuje licznik we wszystkich akcjach audio; przycisk „Reset”
  został usunięty.
- `native/systemUi.ts` + `SystemUiModule.kt` dostają `setScreenBrightness`
  i `restoreScreenBrightness`; stała `AUDIO_DIM_BRIGHTNESS = 0.15`.
- Testy: przejścia licznika oraz most natywny (w tym bezpieczny brak modułu).
