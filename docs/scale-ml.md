# scale-ml

## Zweck
`scale-ml` ist ein Red-Pitaya-Instrument fuer Diagnose, Signalgenerierung und datengetriebene Kalibrierung.
Es erweitert `scale` um einen ML-Workflow, der ein Modell `Signal -> Kapazitaet -> Gewicht` trainiert und zur Laufzeit verwendet.

Projektpfad:
- `examples/red-pitaya/scale-ml`

## Systemaufbau

### FPGA-Ebene
Die Hardwarebasis entspricht `scale`: ADC/DAC-Datenpfade, BRAM-Puffer, AXI-Anbindung und Triggerlogik.

Wichtige Dateien:
- `examples/red-pitaya/scale-ml/block_design.tcl`
- `examples/red-pitaya/scale-ml/address_counter_v1_0/address_counter.v`

Hinweis zur Struktur:
- In `examples/red-pitaya/scale-ml/config.yml` wird der Core `../scale/address_counter_v1_0` eingebunden.

### Server/Driver-Ebene
Der Driver `AdcDacBram` kapselt Signalquelle, ADC/DAC-Bufferzugriffe und Rohdaten-Mittelung.

Wichtige Datei:
- `examples/red-pitaya/scale-ml/driver.hpp`

Kernmethoden:
- `set_dac_function(uint32_t function, double f)`
- `get_adc_snapshot()`
- `get_dac_snapshot()`
- `get_adc_raw_data(uint32_t n_avg)`
- `get_decimated_data(uint32_t channel)`
- `get_decimated_dac_data(uint32_t channel)`

### Web-UI-Ebene
Die UI kombiniert Diagnose-Plot, Scale-Runtime und ML-Training in Tabs.

Wichtige Dateien:
- `examples/red-pitaya/scale-ml/web/app.ts`
- `examples/red-pitaya/scale-ml/web/ml.html`

Geteilte Web-Bausteine aus `scale` (laut `config.yml`):
- `examples/red-pitaya/scale/web/connector.ts`
- `examples/red-pitaya/scale/web/plot-basics.ts`
- `examples/red-pitaya/scale/web/index.html`
- `examples/red-pitaya/scale/web/scale.html`

## Bedienoberflaeche

### Diagnose und Signalquelle
- Signalgenerator: BRAM Ramp, Sinus, Saegezahn, Dreieck
- Frequenzregelung per Slider
- Plotkurven: `IN1`, `IN2`, `OUT1`, `OUT2`, optional `Weight (kg)`
- Plot-Reset ueber `Standardansicht`

### Laufzeitanzeige
- Gewichtsanzeige in `kg`
- Live-Kapazitaet in `pF`
- Live-Gewicht aus Kapazitaetsmodell in `g`
- Tara-Funktion zum Nullsetzen
- Fallback-Kalibrierung:
  - Faktor `g pro ADC-Schritt`
  - Offset `g`

### ML-Workflow (3 Tabs)
1. `Referenz C(m)`
- Parametrierung des Referenzmodells:
  - `C(m) = A * exp(b*m) + C0`
  - `m(C) = ln((C-C0)/A)/b`
2. `Messung Signal->C`
- Modelltyp: `linear`, `quadratic`, `exponential`
- Signal-Feature:
  - `delta_counts`
  - `abs(delta_counts)`
  - `adc_raw`
  - `log(abs(delta)+1)`
- Optionen:
  - Inverse-Modus auf Eingabefeature
  - Trainingsdaten-Scope (`alle` oder `nur aktiver Modus`)
  - Outlier-Sigma
  - Ridge-Lambda
  - Referenzpunkt fuer lokalen Faktor
- Messpunktaufnahme mit Referenzgewicht
3. `Fit & Auswertung`
- Aktives Modell mit Kennzahlen:
  - verwendete Samples
  - lokaler Faktor `dC/dx`
  - Offset `C(x=0)`
  - `MAE`, `RMSE`, `Max Fehler`, `R^2`
- Uebernahme des trainierten Modells in die Laufzeit
- Messdatensatz-Tabelle mit Fehlern in `pF` und `g`
- Detailansicht und Scatter/Fit-Plot

## Daten- und Modellfluss
1. ADC-Rohwert wird mit Tara zu `delta_counts` normalisiert.
2. Aus dem gewaehlten Feature wird `x` gebildet.
3. Das Referenzmodell mappt Referenzgewicht auf Referenzkapazitaet `C_ref`.
4. Das ML-Modell approximiert `C_hat = f(x)`.
5. Laufzeitgewicht ergibt sich aus Rueckabbildung `m(C_hat)`.
6. Wenn kein Laufzeitmodell aktiv ist, wird Fallback-Faktor/Offset verwendet.

## Modellierung

Unterstuetzte Fit-Typen:
- Linear: `C = a*x`
- Quadratisch: `C = a*x^2 + b*x`
- Exponentiell: `C = a*exp(b*x)`

Robustheitsfunktionen:
- Optionale Outlier-Filterung ueber Sigma-Schwelle
- Optionale Ridge-Regularisierung ueber `lambda`
- Inverse-Transformation fuer schwierige Kennlinien

## Build und Deployment

Build:
```bash
make CONFIG=examples/red-pitaya/scale-ml/config.yml
```

Upload/Start auf Red Pitaya:
```bash
make CONFIG=examples/red-pitaya/scale-ml/config.yml HOST=<BOARD-IP> run
```

Build-Artefakt:
- `tmp/examples/red-pitaya/scale-ml/scale-ml.zip`

## Betriebshinweise
- Fuer Signalvergleich ist eine physische Verbindung zwischen OUT und IN notwendig.
- Tara sollte vor jeder Messreihe neu gesetzt werden.
- Gute Modellqualitaet erfordert mehrere, ueber den Arbeitsbereich verteilte Referenzgewichte.
