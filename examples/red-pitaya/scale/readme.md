\# Digitale Kapazitive Waage (Red Pitaya)



Dieses Projekt implementiert eine kapazitive Waage auf dem Red Pitaya (Koheron SDK).

Es erzeugt ein Sinus-Signal (Excitation), sendet es durch eine Messbrücke und misst die Amplitude des Antwortsignals, um daraus ein Gewicht zu berechnen.



\## Aufbau der Hardware



1\.  \*\*Ausgang:\*\* Verbinde `OUT 1` des Red Pitaya mit dem Eingang der Kapazitiven Messbrücke.

2\.  \*\*Eingang:\*\* Verbinde den Ausgang der Messbrücke mit `IN 1` des Red Pitaya.

3\.  \*\*Masse:\*\* Verbinde die Massen (GND) der Schaltungen.



\## Installation \& Kompilierung



Stellen Sie sicher, dass das Koheron SDK installiert ist.



1\.  Kompilieren des Instruments (Bitstream \& Software):

&nbsp;   ```bash

&nbsp;   make

&nbsp;   ```



2\.  Installieren auf dem Red Pitaya (ersetze IP durch deine Board-IP):

&nbsp;   ```bash

&nbsp;   export HOST=192.168.8.193

&nbsp;   make install

&nbsp;   ```



\## Benutzung



\### Option A: Webinterface

1\.  Öffne im Browser: `http://192.168.8.193/koheron/digital-scale`

2\.  Drücke "TARA" bei unbelasteter Waage.

3\.  Stelle den Kalibrierungsfaktor ein, bis das Gewicht stimmt.



\### Option B: Python Skript

1\.  Führe das Skript aus:

&nbsp;   ```bash

&nbsp;   python3 measure.py

&nbsp;   ```



\## Projektstruktur



\* `block\_design.tcl`: FPGA Hardware-Design (DDS Generator + ADC Schnittstelle).

\* `constraints.xdc`: Pin-Belegung für ADC, DAC und LEDs.

\* `config.yml`: Konfiguration der Speicheradressen und Treiber.

\* `scale.hpp`: C++ Treiber für den FPGA-Zugriff.

\* `web/`: TypeScript/HTML Benutzeroberfläche.

\* `measure.py`: Standalone Python-Skript zur Messung.

