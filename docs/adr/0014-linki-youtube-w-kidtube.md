# ADR 0014 — Linki YouTube otwierane w KidsTube: opcjonalny handler rodzica

> Wdrożone — szczegóły: `docs/notes/ADR-0013-0014-wdrozenie.md`. Uzupełnienie ADR 0013.

Gdy w telefonie nie ma aplikacji YouTube albo rodzic ją zablokował, dotknięcie
linku `youtube.com/...` nadal trafia do przeglądarki. Rodzic nie ma prostego
sposobu, by takie linki prowadziły do KidsTube — a właśnie wtedy chciałby, żeby
cała droga do YouTube przechodziła przez kuratorowaną aplikację. Jednocześnie
przechwytywanie linków nie może być domyślnym, niezauważalnym zachowaniem:
zmienia systemowe otwieranie linków na całym urządzeniu.

Decyzja: w **Ustawieniach rodzica** powstaje opcjonalny przełącznik
**„Otwieraj linki YouTube w KidsTube”**, domyślnie **wyłączony**. Włączenie
powoduje, że KidsTube staje się kandydatem systemu do obsługi linków YouTube
(`VIEW`); wyłączenie wycofuje tę kandydaturę. Udostępnianie przez `ACTION_SEND`
(ADR 0013) działa zawsze, niezależnie od tego ustawienia.

## Mechanizm

- Linki `VIEW` obsługuje **osobny komponent aktywności** (aktywność lub alias
  aktywności) z filtrami dla obsługiwanych hostów i kształtów linków, a nie
  główna aktywność aplikacji. Komponent jest **domyślnie wyłączony** i jest
  włączany/wyłączany razem z ustawieniem.
- Dzięki temu wyłączenie opcji naprawdę usuwa KidsTube z kandydatów systemu;
  nie zostawia aplikacji, która przechwytuje link, a potem go ignoruje.
- Filtry obejmują wyłącznie kształty rozpoznawane przez parser: hosty
  `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`,
  `youtube-nocookie.com`, `youtu.be` oraz schemat `vnd.youtube:`; ścieżki filmu
  i kanału (`watch`, `shorts`, `live`, `embed`, `channel`, `@handle`, `c`,
  `user`), a także `youtu.be/<id>` i `vnd.youtube:<id>`. Nie przechwytujemy
  całego `youtube.com` ani nieznanych ścieżek.
- **Nie używamy `autoVerify` ani pliku Digital Asset Links.** Weryfikacja
  wymaga kontroli nad domeną `youtube.com`, której KidsTube nie ma. Udawanie
  weryfikacji byłoby nieskuteczne i mylące.
- Po włączeniu opcji **rodzic sam wybiera KidsTube jako domyślny handler**
  w systemie. Aplikacja pokazuje wyjaśnienie i przycisk otwierający właściwe
  ustawienie systemowe (na nowszych Androidach „Otwieraj domyślnie”, na
  starszych — szczegóły aplikacji).
- Gdy YouTube jest zainstalowany, jego zweryfikowane App Links mogą nadal
  wygrywać. Rodzic może wtedy wyłączyć/zablokować YouTube albo wyczyścić jego
  ustawienia domyślne. **KidsTube nie blokuje innych aplikacji** — robi to
  systemowy mechanizm kontroli rodzicielskiej, a nie ta aplikacja.
- Przechwytywanie dotyczy wyłącznie linków przychodzących z zewnątrz
  (`VIEW`). Nie obejmuje nawigacji wewnątrz aplikacji YouTube ani linków
  klikanych w przeglądarce, jeśli system nadal wybiera inną aplikację.

## Przetwarzanie linku

- Link przechwycony przez `VIEW` przechodzi **ten sam potok co udostępnienie**
  (ADR 0013): film może być `allowed`, `pending` lub `blocked`, a kanał trafia
  jako propozycja do panelu rodzica.
- Link nie uruchamia odtwarzania, nie omija bramek czasu (ADR 0002), nie
  otwiera WebView z dowolną stroną YouTube i nie daje dziecku dostępu do
  przeglądarki.
- Nieznany lub nieobsługiwany link nie jest przechwytywany; jeśli mimo to
  trafi do aplikacji, pokazujemy komunikat i nie dodajemy treści.
- Link z `VIEW` jest buforowany do momentu wczytania ustawień i repozytorium,
  a następnie przetwarzany **dokładnie raz**. Start zimny i powrót do żywej
  aplikacji muszą być idempotentne; ten sam link nie może utworzyć dwóch
  wpisów.
- Gdy ustawienie jest wyłączone, a aplikacja mimo to otrzyma `VIEW` (np. stan
  systemowy po zmianie), **nie dodaje treści** i pokazuje komunikat o
  wyłączonej obsłudze linków. Nie próbujemy wtedy otwierać linku sami, żeby
  nie wpaść w pętlę przekierowań.

## UX i bezpieczeństwo

- Przełącznik jest w panelu rodzica (PIN, ADR 0012), domyślnie wyłączony.
  Włączenie pokazuje krótkie wyjaśnienie skutków systemowych i skrót do
  ustawień domyślnych.
- Przy wyłączaniu, gdy KidsTube jest domyślnym handlerem, aplikacja ostrzega,
  że linki przestaną się w niej otwierać, i podpowiada wybór innej aplikacji
  w systemie. Nie możemy zmienić domyślnego handlera programowo.
- Ustawienie jest lokalne, przeżywa restart i dotyczy całego urządzenia.
  Nie jest przypisane do profilu dziecka ani do konta (konta nie ma).
- Włączenie opcji nie wymaga ponownego PIN-u przy każdym linku: to bramka
  konfiguracji, a nie każde zdarzenie. Samo przetworzenie linku nadal podlega
  polityce kanałów i decyzjom rodzica.
- Dziecko nie może zmienić ustawienia, ale może skorzystać z przechwyconego
  linku: trafi on do biblioteki tylko wtedy, gdy pozwala na to polityka
  `auto_approve` albo wcześniejsza decyzja rodzica, a w przeciwnym razie czeka
  na rodzica.

## Rozważone opcje

- **Filtry `VIEW` aktywne zawsze, a przełącznik tylko w JavaScript** —
  odrzucone: przy wyłączonej opcji KidsTube mógłby przechwytywać linki
  i pokazywać pusty ekran albo komunikat, zamiast oddać je innym aplikacjom.
- **`autoVerify` / sztuczne Digital Asset Links** — odrzucone: nie mamy
  kontroli nad domeną YouTube; weryfikacja nie przejdzie, a zachowanie
  systemu może się pogorszyć.
- **Programowe ustawienie KidsTube jako domyślnego handlera** — odrzucone:
  Android nie daje aplikacji takiego uprawnienia; wybór należy do użytkownika.
- **Domyślnie włączone przechwytywanie** — odrzucone: zmienia systemowe
  otwieranie linków bez świadomej decyzji rodzica; opcja ma być opcjonalna.
- **Tylko udostępnianie, bez obsługi `VIEW`** — odrzucone: nie rozwiązuje
  przypadku, w którym YouTube nie ma albo jest zablokowany, a rodzic chce
  klikać linki bezpośrednio.
- **Otwieranie nieznanych linków w wewnętrznej przeglądarce** — odrzucone:
  omija kuratorowaną bibliotekę i allowlistę odtwarzacza (ADR 0001/ADR 0003).
- **Blokowanie YouTube przez KidsTube** — odrzucone: aplikacja nie ma takich
  uprawnień i nie powinna udawać systemowej kontroli rodzicielskiej; robi to
  rodzic ustawieniami urządzenia.
- **Osobny ekran „skrzynki linków”** — odrzucone: lista oczekujących z ADR 0013
  już jest właściwym miejscem.
- **PIN przy każdym przechwyconym linku** — odrzucone: utrudnia dziecku
  normalne korzystanie i nie zwiększa bezpieczeństwa, bo treść i tak przechodzi
  przez politykę kanału oraz decyzje rodzica.

## Konsekwencje

- `AndroidManifest.xml` potrzebuje osobnego komponentu z filtrami `VIEW`
  (albo aliasu), domyślnie wyłączonego; `ACTION_SEND` pozostaje w głównej
  aktywności i działa bez tej zmiany.
- Powstaje natywny most do włączania/wyłączania komponentu oraz lokalne
  ustawienie `youtubeLinkHandlerEnabled` (domyślnie `false`) w `Settings`.
- Przy starcie aplikacja synchronizuje stan komponentu z ustawieniem
  w sposób idempotentny; brak rekordu oznacza wyłączenie.
- System może zachować wcześniejszy wybór domyślnego handlera. Po ponownym
  włączeniu opcji rodzic może musieć jeszcze raz wybrać KidsTube w ustawieniach
  systemowych — UI ma to komunikować, a nie ukrywać.
- Zmiana stanu komponentu może na niektórych urządzeniach wymagać odświeżenia
  launchera lub restartu aplikacji; to ograniczenie platformy, nie błąd
  przepływu.
- ADR 0007 nadal obowiązuje: domyślny handler to ręczny krok rodzica przy
  sideloadzie. Ten ADR dodaje świadome włączanie/wyłączanie kandydatury, ale
  **nie znosi** ograniczeń weryfikacji App Links dla `youtube.com`.
- Wymagane testy: domyślnie wyłączone; włączenie/wyłączenie woła natywny most;
  `VIEW` przy wyłączonej opcji nie dodaje treści; `VIEW` przy włączonej
  przechodzi przez potok ADR 0013 (auto-approve / pending / blocked / kanał);
  `ACTION_SEND` działa w obu stanach; brak autoodtwarzania; nieobsługiwany link
  nie otwiera przeglądarki; zimny start przetwarza link tylko raz; ustawienie
  przeżywa restart.
- Po wdrożeniu README i instrukcja sideloadu muszą opisać wybór domyślnego
  handlera oraz różnicę między udostępnianiem a przechwytywaniem linków.
