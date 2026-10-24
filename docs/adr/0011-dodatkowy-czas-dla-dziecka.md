# ADR 0011 — Dodatkowy czas dla dziecka: doraźne przedłużenie bez edycji harmonogramu

> Wdrożone w 0.5.0 — szczegóły: `docs/notes/ADR-0011-0012-wdrozenie.md`.

Harmonogram z ADR 0002 jest trwałą regułą: jedno okno oglądania i dzienny
limit wideo. Rodzicowi bywa jednak potrzebny wyjątek — gość, wyjątkowy
wieczór, dokończenie filmu — bez zmiany reguły na kolejne dni. Edycja okna
albo limitu jest w tym celu niewygodna i ryzykowna: łatwo zapomnieć ją cofnąć.

Decyzja: rodzic może przyznać dziecku **dodatkowy czas wideo** — jednorazową
pulę minut na bieżący dzień — przyciskiem **„Dodaj więcej czasu”**:

- w panelu dziecka, przy wskaźniku pozostałego czasu (także gdy czas jeszcze
  jest — np. przed wyjściem),
- w widokach informujących o braku czasu: w alercie przy próbie odtworzenia
  poza oknem / po limicie oraz w overlayu po twardym cięciu w odtwarzaczu.

Kwoty: **+15 minut** i **+1 godzina**. Przycisk jest akcją **rodzica**:
dotknięcie otwiera wybór kwoty, a następnie prosi o kod rodzica (ten sam PIN
co wejście do panelu; ADR 0012). Dziecko nie może samo przyznać sobie czasu.

## Semantyka

- Dodatkowy czas dotyczy **wyłącznie trybu wideo**. Tryb audio pozostaje bez
  ograniczeń (ADR 0002) i nie zużywa puli.
- Pula jest przypisana do **lokalnego dnia kalendarzowego** i wygasa z lokalną
  północą, razem z limitem dziennym. Niewykorzystany czas nie przechodzi na
  kolejny dzień.
- Rozliczanie jest zachłanne względem dostępności: **w oknie, dopóki jest
  limit bazowy, zużywamy limit bazowy**; pula dodatkowa schodzi dopiero po
  wyczerpaniu limitu bazowego albo poza oknem. Dzięki temu nadanie nie marnuje
  się na czas, który i tak był dozwolony, a poza oknem daje dokładnie N minut
  (nie N + resztę limitu bazowego).
- **Dopóki pula jest większa od zera, bramka okna nie obowiązuje** dla wideo:
  dozwolony zakres z harmonogramu zostaje czasowo unieważniony. Po wyczerpaniu
  puli reguły ADR 0002 wracają natychmiast.
- Efektywny limit dnia to **limit bazowy + suma nadań**. „Wydłużenie limitu”
  realizuje się przez pulę, bez modyfikacji `Schedule`: okno i limit
  w harmonogramie pozostają nietknięte, a nadanie jest warstwą wyjątku.
- Kolejne nadania **sumują się** (dwa razy +15 daje 30 minut). Stan puli to
  data dnia, suma przyznanych sekund i pozostałe sekundy; jest zapisywany
  lokalnie i przeżywa restart aplikacji.
- Po przyznaniu UI od razu odświeża pozostały czas; jeśli akcja przyszła
  z zablokowanego odtwarzania, aplikacja wznawia ten sam film. Z panelu
  dziecka nadanie tylko odblokowuje wideo — film wybiera dziecko.
- Przycisk jest widoczny tylko przy włączonym harmonogramie i istniejącej
  bramce (okno lub limit > 0). Przy wyłączonym harmonogramie albo przy braku
  okna i limitu dodatkowy czas nie miałby czego zmienić.
- Wskaźniki pokazują efektywny pozostały czas: limit bazowy + pula w oknie,
  a poza oknem — tylko pula. Przy braku limitu bazowego pula jest jedynym
  licznikiem. Ostrzeżenie 5 minut przed końcem (ADR 0005) dotyczy efektywnego
  pozostałego czasu.
- To mechanizm czasu, nie decyzja o treści: nadanie nie trafia do historii
  decyzji (ADR 0001/0010) i nie zmienia statusów filmów. Podgląd rodzica
  (ADR 0005) pozostaje poza mechanizmem — nie jest bramkowany i nie zużywa
  puli.

## Rozważone opcje

- **Edycja harmonogramu na czas wyjątku** — odrzucona: zmienia regułę trwale,
  łatwo zapomnieć cofnąć; dotyka kolejnych dni.
- **Tylko podniesienie limitu dziennego** — odrzucone: nie pomaga poza oknem,
  czyli w najczęstszym przypadku „brak czasu”.
- **Tylko obejście okna bez dodatkowych minut** — odrzucone: po wyczerpaniu
  limitu nic nie daje; potrzebne jest i wydłużenie limitu, i unieważnienie okna.
- **Przycisk bez kodu rodzica** — odrzucony: dziecko samo znosiłoby limit.
- **Przycisk wyłącznie w panelu rodzica** — odrzucony: rodzic jest zwykle przy
  dziecku na ekranie „brak czasu”; przechodzenie do Ustawień niweczy sens
  szybkiej akcji.
- **Czas liczony zegarem od nadania** — odrzucony: pula mogłaby wygasnąć, gdy
  dziecko nie ogląda; rozliczamy faktyczne odtwarzanie (ADR 0003), a ważność
  domykamy końcem dnia.
- **Przenoszenie niewykorzystanej puli na kolejny dzień** — odrzucone:
  kumulacja wymyka się kontroli i przeczy dziennemu resetowi limitu.
- **Zużycie najpierw puli dodatkowej** — odrzucone: w oknie marnowałoby się na
  czas, który i tak był dozwolony; poza oknem dawałoby N + resztę limitu.
- **Osobna kategoria treści / osobny tryb „extra”** — odrzucone: to nadal ten
  sam tryb wideo, zmienia się tylko bramka.

## Konsekwencje

- `domain/schedule.ts` zyskuje pojęcie puli dodatkowej: bramka wideo musi
  uwzględniać pozostałą pulę przed oknem i limitem, a limit bazowy liczyć bez
  sekund rozliczonych jako dodatkowe. Funkcje pozostają czyste i testowalne.
- `usedSecondsToday` nadal sumuje całe odtwarzanie wideo (historia, panel),
  ale do bramki potrzebne jest rozdzielenie zużycia bazowego i dodatkowego —
  inaczej po wyczerpaniu puli limit bazowy byłby sztucznie „zjedzony”.
- Nowy lokalny rekord puli (data, przyznane, pozostałe sekundy); brak migracji
  harmonogramu, bo `Schedule` pozostaje bez zmian.
- UI: przycisk i wybór kwoty w panelu dziecka, w alercie blokady i w overlayu
  odtwarzacza; wskaźniki i ostrzeżenie 5 min liczą efektywny czas.
- Akcja korzysta z bramki PIN i podlega blokadzie z ADR 0012. Dziecko może
  wywołać prompt PIN, więc nieudane próby mogą czasowo zablokować rodzica.
- Brak cofnięcia nadania w UI: pomyłka wygasa przez zużycie albo z końcem dnia.
  Świadomie nie dokładamy kolejnego mechanizmu; kwota jest mała, a nadanie
  wymaga PIN-u.
- Nadanie blisko północy może zostać wykorzystane tylko częściowo — pula
  wygasa z dniem, tak jak limit dzienny. Po północy rodzic może przyznać
  kolejne; to spójne z resetem limitu, choć wymaga świadomości przy późnych
  nadaniach.