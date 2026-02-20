# scale

## Zweck
`scale` ist ein Red-Pitaya-Instrument fuer Signaldiagnose und einfache Waagen-Funktion.
Es kombiniert:
- DAC-Signalgenerator (`Sinus`, `Saegezahn`, `Dreieck`, `BRAM Ramp`)
- ADC/DAC-Plot in Echtzeit
- RMS- und Momentanwert-Anzeigen
- Tara + Kalibrierfaktor fuer Gewichtsanzeige

Pfad: `examples/red-pitaya/scale`

## Aufbau
### 1. FPGA/Driver
- `examples/red-pitaya/scale/block_design.tcl`: Topologie (ADC, DAC, BRAM, AXI)
- `examples/red-pitaya/scale/address_counter_v1_0/address_counter.v`: Capture-Adressierung
- `examples/red-pitaya/scale/driver.hpp`: Server-Driver `AdcDacBram`

### 2. Server/API
Wichtige Driver-Methoden:
- `set_dac_function(function, f)`
- `get_adc_snapshot()`
- `get_dac_snapshot()`
- `get_adc_raw_data(n_avg)`
- `get_decimated_data(channel)`
- `get_decimated_dac_data(channel)`

### 3. Web-UI
- `examples/red-pitaya/scale/web/index.html`
- `examples/red-pitaya/scale/web/scale.html`
- `examples/red-pitaya/scale/web/app.ts`
- `examples/red-pitaya/scale/web/connector.ts`
- `examples/red-pitaya/scale/web/plot-basics.ts`

## Datenfluss
1. UI setzt Wellenform/Frequenz -> `set_dac_function`
2. Driver schreibt DAC-Waveform in DAC-BRAM
3. ADC erfasst Eingangssignal in ADC-BRAM (triggered capture)
4. UI liest Snapshots und rendert Kurven
5. Gewichtsanzeige nutzt `get_adc_raw_data` (Mittelung)

## Anzeige-Logik
- X-Achse: `Zeit [us]`
- Y-Achse: `Spannung [V]` (skalierte Amplitude)
- `OUT1/OUT2` sind DAC-Datenpfad-Werte
- `IN1/IN2` sind ADC-Messwerte

Wichtig:
- Ohne physische Verkabelung gibt es kein internes OUT->IN-Loopback.
- Fuer Vergleich muss z. B. `OUT2 -> IN1` extern verbunden sein.

## Bedienung
- `Signalquelle`: Form + Frequenz
- `Kurven`: Ein/Aus pro Signal (Checkbox + Legendenklick)
- `Standardansicht`: setzt Plot auf Standardfenster
- `RMS`: Effektivwerte pro Kanal
- `ADC/DAC`: Momentanwerte
- `Scale`: Tara + Kalibrierung

## Build und Run
Build:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml
```

Deploy/Run:
```bash
make CONFIG=examples/red-pitaya/scale/config.yml HOST=<RP-IP> run
```

Artefakt:
- `tmp/examples/red-pitaya/scale/scale.zip`

## Typische Probleme
1. `IN1/IN2` bleiben 0
- Capture/Trigger-Pfad nicht aktiv oder altes Bitstream/Server laeuft noch.
- Neu bauen + deployen.

2. IN sieht wie Rauschen aus trotz Kabel
- Falsche Verkabelung/GND fehlt.
- Dekodierungsthema (ADC Offset-Binary vs DAC Two's-Complement).

3. OUT und IN nicht identisch
- OUT-Plot ist DAC-Datenpfad, IN ist reale ADC-Messung.
- Kleine Abweichungen/Offset/Rauschen sind normal.
