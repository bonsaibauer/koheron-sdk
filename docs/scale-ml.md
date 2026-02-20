# scale-ml

## Zweck
`scale-ml` erweitert `scale` um eine datenbasierte Kalibrierhilfe.
Neben normaler Diagnose/Scale-Funktion werden Kalibrier-Messpunkte gesammelt und ein einfaches lineares Modell berechnet.

Pfad: `examples/red-pitaya/scale-ml`

## Aufbau
### 1. FPGA/Driver
- Gleicher Hardware-Basisaufbau wie `scale`:
  - ADC, DAC, BRAM, AXI, Address Counter
- Relevante Dateien:
  - `examples/red-pitaya/scale-ml/block_design.tcl`
  - `examples/red-pitaya/scale-ml/address_counter_v1_0/address_counter.v`
  - `examples/red-pitaya/scale-ml/driver.hpp`

### 2. Server/API
Driver `AdcDacBram` mit denselben Kernmethoden wie `scale`:
- `set_dac_function(function, f)`
- `get_adc_snapshot()` / `get_dac_snapshot()`
- `get_adc_raw_data(n_avg)`
- `get_decimated_data(channel)` / `get_decimated_dac_data(channel)`

### 3. Web-UI + ML-Logik
- `examples/red-pitaya/scale-ml/web/app.ts` enthaelt:
  - normale Plot-/Scale-Logik
  - Datensatzverwaltung (`CalibrationSample`)
  - Modellstruktur (`CalibrationModel`)
  - Rechenlogik fuer lineare Empfehlung (Faktor/Offset)
- Weitere Dateien:
  - `examples/red-pitaya/scale-ml/web/connector.ts`
  - `examples/red-pitaya/scale-ml/web/plot-basics.ts`
  - `examples/red-pitaya/scale-ml/web/index.html`

## ML-Kalibrierworkflow
1. Tara setzen
2. Reales Gewicht auflegen
3. Reales Gewicht im ML-Eingabefeld eintragen
4. Messpunkt aufnehmen (`Measure + Add`)
5. Mehrere Punkte sammeln
6. Empfohlenen Faktor/Offset pruefen
7. Empfehlung uebernehmen

## Modellidee
- Lineares Mapping zwischen ADC-Delta und Realgewicht:
  - `gewicht = faktor * delta_counts + offset`
- Bewertungskennzahlen in UI:
  - `MAE`
  - `RMSE`

## Build und Run
Build:
```bash
make CONFIG=examples/red-pitaya/scale-ml/config.yml
```

Deploy/Run:
```bash
make CONFIG=examples/red-pitaya/scale-ml/config.yml HOST=<RP-IP> run
```

Artefakt:
- `tmp/examples/red-pitaya/scale-ml/scale-ml.zip`

## Hinweise
- Gute Modellqualitaet braucht mehrere, gut verteilte Gewichte.
- Immer gleiche mechanische Randbedingungen nutzen (Auflagepunkt, Temperatur, Ruhezeit).
- Bei Hardwarewechsel neu kalibrieren.
