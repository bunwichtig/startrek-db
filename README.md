# Sternenregister – Star-Trek-Schiffsdatenbank

Fan-Datenbank über Raumschiffe und Schiffsklassen aus Star Trek, aufgebaut aus frei verfügbaren Quellen.
Sie ist die Grundlage für spätere Projekte wie Sternenkarten oder kleine Story-Spiele.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `site/` | Die Hauptseite: Bereich **Datenbank** (durchsuchbar, nach Quadranten aufklappbar, nach Fraktionen gruppiert) und Bereich **Datenbasis** (Quellen, Lizenzen, Rechte). Statisch, ohne Build-Schritt. |
| `data/raw/` | Unveränderte Rohdaten aus STAPI, Wikidata und Wikimedia Commons. |
| `data/ships.json` | Aufbereitete Datenbank mit Klassen, Schiffen, Fraktionen, Quadranten und Bildnachweisen. |
| `scripts/fetch_stapi.py` | Lädt Schiffe und Schiffsklassen von [STAPI](https://stapi.co). |
| `scripts/fetch_wikidata.py` | Lädt deutsche Namen, Beschreibungen und Bilder aus Wikidata und Commons. |
| `scripts/build.py` | Ordnet Fraktionen und Quadranten zu und schreibt `data/ships.json` und `site/data.js`. |
| `scripts/bundle.py` | Fasst die Seite zu einer einzigen HTML-Datei zusammen. |

Die GitHub Action `Daten abrufen` führt alle Schritte einmal im Monat aus und committet das Ergebnis.
Lokal geht es genauso:

```sh
python scripts/fetch_stapi.py
python scripts/fetch_wikidata.py
python scripts/build.py
python -m http.server -d site   # dann http://localhost:8000
```

## Quellen und Lizenzen

| Quelle | Lizenz | Verwendung |
| --- | --- | --- |
| [Memory Alpha](https://memory-alpha.fandom.com) über [STAPI](https://stapi.co) | Inhalte CC BY-NC 4.0, STAPI-Code MIT | Schiffe, Klassen, Status, Bewaffnung, Zugehörigkeit |
| [Wikidata](https://www.wikidata.org) | CC0 | Deutsche Namen, Beschreibungen, Bildverknüpfungen |
| [Wikimedia Commons](https://commons.wikimedia.org) | je Bild (meist CC BY-SA oder gemeinfrei) | Fotos, mit Urheber und Lizenz an jedem Bild |
| Eigene Silhouetten | CC0 | Schematische Schiffsgrafiken, erzeugt aus Fraktion und Typ |

Weil die Kerndaten aus Memory Alpha stammen, gilt für die Datenbank insgesamt **CC BY-NC 4.0**:
Weitergabe mit Namensnennung, keine kommerzielle Nutzung. Der Code dieses Repositorys steht unter MIT.

Star Trek und alle zugehörigen Marken gehören Paramount Global (CBS Studios). Dies ist ein
nicht-kommerzielles Fanprojekt ohne Verbindung zu Paramount oder CBS.
