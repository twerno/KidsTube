# ADR 0008 — Ścieżki audio: tylko oryginał + polski, start na oryginale

YouTube potrafi udostępnić kilkanaście ścieżek audio (oryginał + auto-dubbingi
w wielu językach). Dla dziecka to zbędny i mylący wybór, a etykiety tych
ścieżek YouTube koduje tylko w `id` (base64 protobuf), więc nie mamy gotowej
listy nazw.

Decyzja: **udostępniamy wyłącznie ścieżkę oryginalną oraz polską**, a odtwarzanie
**startuje na oryginale**. Wybór jest widoczny tylko wtedy, gdy po filtrze
zostają co najmniej dwie ścieżki (np. brak polskiego dubbingu → przycisk znika).
Gdy YouTube nie zwróci żadnych metadanych ścieżek (starsze materiały), pokazujemy
wszystkie — bezpieczny fallback, żeby nie odebrać możliwości wyboru.

Wybór ograniczamy w playerze **tylko po stronie dziecka** — podgląd rodzica
i tak nie pokazuje wyboru ścieżek (ADR 0005).

## Rozważone opcje

- **Wszystkie ścieżki YouTube** — odrzucone: kilkanaście pozycji, brak
  czytelnych nazw z API, wybór bez wartości dla dziecka.
- **Bez wyboru ścieżek w ogóle** — odrzucone: polski dubbing bywa jedyną
  zrozumiałą wersją dla dziecka; chcemy zostawić tę możliwość.
- **Twardo „tylko oryginał"** — odrzucone: pozbawia dziecko polskiej wersji.

## Konsekwencje

- Rodzina językowa jest na razie zaszyta (oryginał + `pl`). Docelowo
  **rodzic skonfiguruje listę języków** w panelu rodzica (analogicznie do
  polityki kanałów); ten ADR opisuje stan obecny, do zastąpienia/rozszerzenia
  tamtą decyzją.
- Etykiety budujemy z kodu języka zakodowanego w `id` ścieżki (mapa kodów na
  polskie nazwy); oryginał dostaje dopisek „(oryginał)".
- Start na oryginale jest jednorazowy (kilka prób), żeby nie nadpisywać
  późniejszego ręcznego wyboru.