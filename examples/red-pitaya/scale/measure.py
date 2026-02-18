#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import time
import sys
from koheron import connect, command

# -----------------------------------------------------------------------------
# 1. Treiber-Definition
# -----------------------------------------------------------------------------
# Diese Klasse spiegelt die Funktionen wider, die wir in scale.hpp definiert haben.
# Der Koheron-Client nutzt dies, um die Befehle an das FPGA zu senden.
class ScaleDriver(object):
    def __init__(self, client):
        self.client = client

    # Setzt die Frequenz des Sinus-Generators (void set_frequency(double))
    @command()
    def set_frequency(self, frequency_hz):
        pass 

    # Liest den aktuellen Wert der Messbrücke (uint32_t get_adc_data())
    @command()
    def get_adc_data(self):
        return self.client.recv_uint32()

    # Optional: LEDs steuern (void set_leds(uint32_t))
    @command()
    def set_leds(self, value):
        pass


# -----------------------------------------------------------------------------
# 2. Hauptprogramm (Main)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    # Konfiguration: IP-Adresse des Red Pitaya (Umgebungsvariable oder Standard)
    host = os.getenv('HOST', '192.168.8.193') 
    instrument_name = 'digital-scale'  # Muss exakt zum 'name' in config.yml passen!

    # Kalibrierungs-Faktor (Beispielwert - muss experimentell ermittelt werden)
    # Formel: Gewicht = (Messwert - Tara) * CALIBRATION_FACTOR
    CALIBRATION_FACTOR = 0.0005 
    EXCITATION_FREQ = 125000  # 125 kHz Sinus-Anregung

    try:
        print(f"Verbinde mit Red Pitaya auf {host} ({instrument_name})...")
        client = connect(host, name=instrument_name)
        driver = ScaleDriver(client)

        # 1. Initiale Einstellungen senden
        driver.set_frequency(EXCITATION_FREQ)
        driver.set_leds(255) # Alle LEDs an als "Aktiv"-Zeichen
        print(f"Anregungsfrequenz gesetzt auf: {EXCITATION_FREQ} Hz")

        # 2. Tara-Vorgang (Nullpunkt bestimmen)
        print("Führe Tara-Kalibrierung durch (Bitte Waage nicht belasten)...")
        time.sleep(1) # Kurz warten, bis sich alles einschwingt
        
        # Wir nehmen 10 Messwerte und bilden den Mittelwert
        offsets = []
        for _ in range(20):
            offsets.append(driver.get_adc_data())
            time.sleep(0.05)
        
        tare_value = sum(offsets) / len(offsets)
        print(f"Tara ermittelt: {tare_value:.2f} (Rohwert)")

        # 3. Mess-Schleife
        print("\nStarte Messung... (Drücken Sie STRG+C zum Beenden)")
        print("-" * 60)
        print("{:<15} | {:<15} | {:<15}".format("Rohwert", "Differenz", "Gewicht (kg)"))
        print("-" * 60)

        while True:
            # Wert vom FPGA holen
            raw_val = driver.get_adc_data()
            
            # Berechnung
            # Wir nutzen abs(), da die Brückenspannung je nach Phase positiv/negativ driften kann
            # oder der ADC-Wert je nach Implementierung schwankt.
            diff = raw_val - tare_value
            weight_kg = diff * CALIBRATION_FACTOR

            # Anzeige aktualisieren (mit \r überschreiben wir die Zeile für flüssige Optik)
            # Wenn Sie ein Log-File wollen, entfernen Sie das end='\r'
            sys.stdout.write(f"\r{raw_val:<15} | {diff:<15.1f} | {weight_kg:<15.3f} kg")
            sys.stdout.flush()
            
            # Abtastrate für die Anzeige (z.B. 10 Hz)
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\nMessung vom Benutzer beendet.")
        if 'driver' in locals():
            driver.set_leds(0) # LEDs ausschalten

    except Exception as e:
        print(f"\n\nFehler bei der Verbindung oder Ausführung: {e}")
        print("Stellen Sie sicher, dass das Instrument auf dem Red Pitaya läuft.")
