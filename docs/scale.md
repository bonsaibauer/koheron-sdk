# scale

## Zweck
`scale` ist ein Red-Pitaya-Instrument fuer Signaldiagnose und einfache Waagenanwendungen.
Es kombiniert einen DAC-Signalgenerator, eine ADC/DAC-Visualisierung, RMS-Auswertung sowie Tara- und Kalibrierfunktionen.

Projektpfad:
- `examples/red-pitaya/scale`

## Systemaufbau

### FPGA-Ebene
Die FPGA-Topologie stellt ADC/DAC-Datenpfade, BRAM-Puffer und AXI-Anbindung bereit.

Wichtige Dateien:
- `examples/red-pitaya/scale/block_design.tcl`
- `examples/red-pitaya/scale/address_counter_v1_0/address_counter.v`

### Server/Driver-Ebene
Der Driver `AdcDacBram` kapselt die Register- und Speicherzugriffe fuer Signalgenerierung und Datenerfassung.

Wichtige Datei:
- `examples/red-pitaya/scale/driver.hpp`

Kernmethoden:
- `set_dac_function(uint32_t function, double f)`
- `get_adc_snapshot()`
- `get_dac_snapshot()`
- `get_adc_raw_data(uint32_t n_avg)`
- `get_decimated_data(uint32_t channel)`
- `get_decimated_dac_data(uint32_t channel)`

### Web-UI-Ebene
Die Weboberflaeche steuert Generator, Plot und Scale-Funktionen.

Wichtige Dateien:
- `examples/red-pitaya/scale/web/index.html`
- `examples/red-pitaya/scale/web/scale.html`
- `examples/red-pitaya/scale/web/app.ts`
- `examples/red-pitaya/scale/web/connector.ts`
- `examples/red-pitaya/scale/web/plot-basics.ts`

## Signalfluss
1. UI setzt Signalform und Frequenz.
2. Driver erzeugt DAC-Werte und schreibt sie in DAC-BRAM.
3. ADC erfasst Eingangsdaten in ADC-BRAM.
4. Web-UI liest ADC/DAC-Daten und aktualisiert Plot und Kennwerte.
5. Gewichtsberechnung verwendet gemittelte ADC-Rohdaten.

## Bedienoberflaeche

### Signalquelle
- Auswahl der Signalform:
  - BRAM Ramp
  - Sinus
  - Saegezahn
  - Dreieck
- Frequenzsteuerung ueber Slider (Hz)

### Plot
- Achsen:
  - X: `Zeit [us]`
  - Y: `Spannung [V]`
- Kurven:
  - `IN1`, `IN2`, `OUT1`, `OUT2`, optional `Weight (kg)`
- Kurvenauswahl:
  - Checkboxen
  - Klick auf Legendenlabel
- Zoom:
  - Maus-Interaktion im Plot
  - Button `Standardansicht` zum Zuruecksetzen auf Default-Fenster

### RMS-Panel
Anzeige der Effektivwerte:
- RMS IN1
- RMS IN2
- RMS OUT1
- RMS OUT2

### ADC/DAC-Panel
Auswahl der Diagnosemetrik per Dropdown:
- `Min / Max`
- `Mittelwert`
- `Peak-to-Peak`

Die ausgewaehlte Metrik wird fuer alle Kanaele angezeigt:
- IN1 (ADC0)
- IN2 (ADC1)
- OUT1 (DAC0)
- OUT2 (DAC1)

### Scale-Panel
- Aktuelle Gewichtsanzeige in kg
- `Tara` zum Nullsetzen
- Kalibrierfaktor (`kg pro ADC-Schritt`)

## Datendarstellung und Kodierung
- `IN1/IN2` stammen aus ADC-Datenpfad.
- `OUT1/OUT2` stammen aus DAC-Datenpfad.
- ADC- und DAC-Daten koennen unterschiedliche numerische Kodierungen verwenden (z. B. Offset-Binary vs. Two's Complement), daher erfolgt kanalabhaengige Dekodierung in der UI/Driver-Logik.

## Build und Deployment

Build:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml
```

Upload/Start auf Red Pitaya:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml HOST=<BOARD-IP> run
```

Build-Artefakt:
- `tmp/examples/red-pitaya/scale/scale.zip`

## Betriebshinweise
- Ohne physische Verbindung zwischen Ausgang und Eingang gibt es kein internes Loopback.
- Fuer Signalvergleich ist eine externe Verbindung noetig (z. B. `OUT2 -> IN1` plus gemeinsame Masse).
- Einzelwertanzeige (Momentanwert) und RMS-/Statistikwerte beschreiben unterschiedliche Groessen und koennen daher deutlich voneinander abweichen.
