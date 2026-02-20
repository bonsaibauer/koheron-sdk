# Scale Instrument

Dieses Dokument beschreibt das Instrument `scale` (`examples/red-pitaya/scale`) und die aktuellen Aenderungen an der Datenaufbereitung/Decoder-Logik.

## Ueberblick

`scale` ist ein Diagnose- und Waage-Instrument fuer Red Pitaya mit:
- Signalgenerator (BRAM-Rampe, Sinus, Saegezahn, Dreieck)
- Live-Plot fuer IN/OUT-Signale
- Gewichtsberechnung mit Tara und Kalibrierung
- RMS- und Momentanwert-Anzeige fuer Kanaele

Relevante Dateien:
- FPGA/Driver: `examples/red-pitaya/scale/driver.hpp`
- Web App: `examples/red-pitaya/scale/web/app.ts`
- Web Connector: `examples/red-pitaya/scale/web/connector.ts`
- UI Layout: `examples/red-pitaya/scale/web/index.html`, `examples/red-pitaya/scale/web/scale.html`

## Hauptfunktionen

## 1) Signalgenerator
- Auswahl ueber UI: `signal-mode` (0..3)
- Frequenz ueber Slider `slider1`
- Frontend ruft `set_dac_function(function, freq)` auf
- Backend erzeugt die Waveform in BRAM (`driver.hpp`)

## 2) Plot
- IN1/IN2 werden laufend aktualisiert
- OUT1/OUT2 werden ebenfalls geplottet
- Kurven lassen sich via Checkbox und Legend-Klick ein/ausblenden
- `Standardansicht` setzt Zoom/Range zurueck

## 3) Scale-Funktionen
- `Tara`: setzt den Nullpunkt aus gemittelten ADC-Werten
- Kalibrierfaktor: `kg pro ADC-Schritt`
- Gewicht: aus ADC0 und Kalibrierung berechnet

## 4) Rechte Messwertanzeige
- ADC0/ADC1 Momentanwerte
- DAC0/DAC1 Momentanwerte
- RMS fuer IN1/IN2/OUT1/OUT2

## Decoder-/Datenpfad-Aenderungen

Ziel der Aenderung: den selbstgebauten Frontend-Raw-Decoder fuer Plotdaten vermeiden und robuste, serverseitig dekodierte Datenpfade nutzen.

### Vorher
- IN/OUT wurden im Frontend aus Raw-Snapshots dekodiert (14-bit Wortaufbereitung in TypeScript).
- Dadurch war das Verhalten empfindlich gegen Format-/Kodierungsabweichungen.

### Jetzt
- IN-Daten kommen serverseitig dekodiert ueber:
  - `get_decimated_data(channel)`
- OUT-Daten kommen serverseitig dekodiert ueber neuen Command:
  - `get_decimated_dac_data(channel)`

Implementierung:
- Neuer Driver-Command in `examples/red-pitaya/scale/driver.hpp`:
  - `std::vector<float>& get_decimated_dac_data(uint32_t channel)`
- Neuer Connector-Zugriff in `examples/red-pitaya/scale/web/connector.ts`:
  - `getDecimatedDacDataChannel(channel, callback)`
- `examples/red-pitaya/scale/web/app.ts` nutzt fuer Plot und OUT-Anzeige nur noch diese decodierten Pfade.

### Zusaetzlicher Fix
In `driver.hpp` wurde die DAC-Rampenkodierung vereinheitlicht:
- von modulo-basiert auf saubere 14-bit Maskierung (`& 0x3FFF`) im Rampenfall.

## Wie das Instrument intern arbeitet

## Abtastung/Signalfluss
1. UI setzt Signalgenerator (`set_dac_function`)
2. FPGA schreibt DAC-Werte in BRAM
3. ADC wird getriggert und Daten werden gelesen
4. Driver dekodiert Daten zu Float-Spannungen
5. Web-App zeichnet Serien und aktualisiert Kennwerte

## Gewichtsberechnung
- Basis: ADC0 Rohwert
- Tara: Offset-Abzug (`tareOffset`)
- Gewicht: `(adc0 - tareOffset) * calibrationFactor`

## Build und Deployment

Lokaler Build:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml all
```

Auf Board laden/starten:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml HOST=<BOARD-IP> run
```

Hinweis:
- Nach Deploy Browser hart neu laden (Cache leeren), damit neues `app.js` aktiv ist.

## Bekannte Hinweise
- Wenn am ADC kein externes Rueckfuehrsignal anliegt (z. B. DAC->ADC nicht verbunden), sehen IN-Kurven wie Rauschen aus.
- Bei niedriger Frequenz kann im sichtbaren Fenster nur ein Teil einer Periode zu sehen sein.
