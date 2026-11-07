# Funkenfeld

Eine Bomben-Arena für 2 bis 4 Spieler direkt im Browser. Eigene Grafik, klassische Regeln.

**Spielen:** https://bunwichtig.github.io/startrek-db/

## So spielt ihr zusammen

1. Einer öffnet die Seite, gibt Name, Raumname und Passwort ein und klickt **Raum erstellen**.
2. Die anderen öffnen dieselbe Seite, geben denselben Raumnamen und dasselbe Passwort ein und klicken **Raum beitreten**.
3. Der Gastgeber klickt **Spiel starten**. Sein Browser berechnet das Spiel und muss offen bleiben.

Die Browser verbinden sich direkt miteinander (WebRTC über [PeerJS](https://peerjs.com)). Es gibt keinen eigenen Server.

## Regeln

- Pfeiltasten oder WASD zum Laufen, Leertaste oder Enter für eine Bombe. Auf dem Handy gibt es Tasten.
- Bomben explodieren nach 2,5 Sekunden als Kreuz, sprengen Kisten und lösen andere Bomben aus.
- Wer vom Feuer getroffen wird, ist für die Runde raus. Wer zuerst die eingestellte Zahl an Runden gewinnt (Standard 3), gewinnt das Spiel.
- Power-ups aus Kisten: 💣 eine Bombe mehr, 🔥 größere Explosion, 👟 schneller laufen, 🦶 Bomben wegkicken.
- Seltene **Mega-Items** mit bunt leuchtendem Rahmen: 🌟 Megafeuer (maximale Explosion, eine Bombe mehr), 💥 Durchschlag (Explosionen gehen durch Kisten), 🛡️ Schild (übersteht einen Treffer), 👻 Geist (10 Sekunden durch Kisten und Bomben laufen).
- Ecken-Hilfe: Wer knapp an einer Abzweigung vorbei ist oder vor einer Ecke steht, rutscht automatisch in den freien Gang.

## Einstellungen (Gastgeber, in der Lobby)

- **Spielvariante:** Klassisch oder Schrumpfendes Feld. Bei Letzterem fallen ab 1:00 Restzeit von außen nach innen Blöcke, wer darunter steht, ist raus.
- **Feldgröße:** Klein (11 × 9), Mittel (15 × 13), Groß (19 × 15), Riesig (23 × 17).
- **Power-up-Chance:** 0 bis 100 % pro gesprengter Kiste.
- **Rundensiege zum Gewinnen:** 1 bis 5.
- **Mega-Items:** an oder aus.

## Sound

Alle Geräusche (Bombe legen, Explosion, Power-up, Treffer, Rundenstart, Sieg, Countdown in den letzten 10 Sekunden) werden direkt im Browser erzeugt.
Unter dem Spielfeld lässt sich der Ton aus- und einschalten.

## Rangliste

Auf der Startseite steht eine Rangliste mit Siegen, gespielten Spielen und gewonnenen Runden.
Ein Spiel zählt, sobald jemand die eingestellten Rundensiege erreicht hat. Gespeichert wird im Browser (localStorage).
Beim Beitreten tauschen Gastgeber und Mitspieler ihre Spiele aus, so haben alle denselben Stand.
Spieler werden über ihren Namen zugeordnet, also immer denselben Namen benutzen.

## Lokal testen

```sh
python -m http.server 8000
```

Dann `http://localhost:8000/?local` in zwei Tabs öffnen. Mit `?local` laufen die Tabs ohne Internet über den Browser selbst.

## Backup der Star-Trek-Datenbank

Die frühere Star-Trek-Schiffsdatenbank liegt unverändert in [`startrek-backup/`](startrek-backup/) und ist weiter erreichbar unter
https://bunwichtig.github.io/startrek-db/startrek-backup/site/ .
Der Stand vor dem Umbau ist ausserdem in der Git-Historie erhalten (Commit `54d6f9c`).
Die monatliche Datenaktualisierung ist abgeschaltet (der Workflow liegt im Backup-Ordner).
