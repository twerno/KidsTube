Potrzebujemy aplikacjia na telefon z andoidem > 14.
Aplikacja ma pozwolić dziecku na korzystanie z youtube, ale ma umożliwić rodzicom kontrolę nad tym co dziecko może oglądać.
Wyobrażam sobie białe i czarne listy filmów i/lub kanałów konfigurowane przez rodzica.
Nie zakładam logowania do konta google.
Sądze, ze konfiguracja może się odbywać offline na telefonie, po wpisaniu kodu rodzica.

Otwarta sprawa jest, czy aplikacja ma umożliwaic dostep do strony youtube i filtrowac jedynie, czy wyswietlany film jest dozwolony (i pozowlic dziecku dodac film/kanala do listy oczekujacych na zatwierdzenie).
Czy rodzic w panelu dodaje filmy, a dziecku wysweitla sie lista dozwolonych filmow i kanalow.

Zauważyłem rownież, że jesli wyswietla się film poprzez iframe 
```
<iframe width="560" height="315" src="https://www.youtube.com/embed/UN-0gLuVOZU?si=wmO06CYLyUdbE0gt" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
```
nie youtube nie wyswietla reklam - co rowniez, jest istotne, bo reklamy moga zawierac tresci nie dla dzieci. 
Obserwacja 2, youtube poluzowuje kontole adblokow kiedy dostaja naglowek przegladarki mobilnej.

Co potrzebujemy ustalic?
Jesli chodzi oo technologie to czekam na propozycje, ale osobiscie moze daloby sie wykonac to w react i typescript?

pracujesz w sandboxie z ograniczonym dostepem do internetu, ale do youtube i googlevide powinien byc dostep, jesli czegosbrakuje to popros.