# Scale Instrument

Dieses Dokument beschreibt das Instrument `scale` (`examples/red-pitaya/scale`) im aktuellen Zustand.

## Ueberblick

`scale` ist ein Diagnose- und Waage-Instrument fuer Red Pitaya mit:
- Signalgenerator (BRAM-Rampe, Sinus, Saegezahn, Dreieck)
- Live-Plot fuer IN/OUT/Weight
- Gewichtsberechnung mit Tara und Kalibrierfaktor
- RMS- und Momentanwert-Anzeige fuer IN/OUT
- Linker Navigation und responsivem Hauptbereich

Relevante Dateien:
- FPGA/Driver: `examples/red-pitaya/scale/driver.hpp`
- Web App: `examples/red-pitaya/scale/web/app.ts`
- Web Connector: `examples/red-pitaya/scale/web/connector.ts`
- UI Layout: `examples/red-pitaya/scale/web/index.html`, `examples/red-pitaya/scale/web/scale.html`
- Globale Navigation/Layout: `web/navigation.html`, `web/main.css`, `web/navigation.ts`

## Hauptfunktionen

## 1) Signalgenerator
- Auswahl ueber UI: `signal-mode` (0..3)
- Frequenz ueber Slider `slider1`
- Aufruf: `set_dac_function(function, freq)`
- Waveform wird im Driver in DAC-BRAM erzeugt.

## 2) Plot
- Kurven: `IN1`, `IN2`, `OUT1`, `OUT2`, `Weight (kg)`
- Kurven sind ueber Checkboxen und Legend-Klick ein/ausblendbar.
- `Standardansicht` setzt die Plotansicht zurueck.
- Plot-Refresh laeuft kontinuierlich und bleibt responsiv.

## 3) Scale-Funktionen
- `Tara`: setzt den Nullpunkt aus gemittelten ADC-Werten.
- Kalibrierfaktor: `kg pro ADC-Schritt`.
- Gewicht: `(adc0 - tareOffset) * calibrationFactor`.

## 4) Rechte Messwertanzeige
- Momentanwerte: `ADC0`, `ADC1`, `DAC0`, `DAC1`
- RMS-Werte: `RMS IN1`, `RMS IN2`, `RMS OUT1`, `RMS OUT2`

## 5) Layout
- Linke Spalte: Plot, `Standardansicht`, `Scale`-Panel.
- Rechte Spalte: Signalquelle, Kurven, RMS, ADC/DAC.
- `Scale`-Panel steht direkt unter `Standardansicht` mit gleicher Kastenbreite.

## Datenpfade

IN-Daten:
- Quelle: `get_decimated_data(channel)`
- Bereitstellung als serverseitig dekodierte Float-Werte.

OUT-Daten:
- Quelle: `get_decimated_dac_data(channel)`
- Bereitstellung als serverseitig dekodierte Float-Werte.

Zusatzdaten:
- Tara/Weight-Anzeige nutzt `get_adc_raw_data(nAvg)`.

## Driver API (AdcDacBram)

Wichtige Kommandos:
- `set_dac_function(uint32_t function, double f)`
- `get_decimated_data(uint32_t channel)`
- `get_decimated_dac_data(uint32_t channel)`
- `get_adc_raw_data(uint32_t n_avg)`

## Build und Deployment

Lokaler Build:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml all
```

Auf Board laden/starten:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml HOST=<BOARD-IP> run
```

Empfehlung:
- Nach Deploy Browser hart neu laden (Cache leeren), damit aktuelles `app.js` aktiv ist.

## Betriebs-Hinweise

- Ohne passendes Eingangssignal/Loopback kann IN wie Rauschen aussehen.
- Bei niedriger Frequenz ist im sichtbaren Fenster ggf. nur ein Teil der Periode sichtbar.
- Fuer schnelle Sichtpruefung eignen sich hoehere Frequenzen (z. B. 50-100 kHz).
