# Wissenschaftliche Dokumentation des Instruments `scale_v3_exam` fuer das Koheron SDK

Dieses Dokument beschreibt das Mess- und Auswerteverfahren des Instruments `scale_v3_exam` auf der Red-Pitaya-Plattform im Koheron-SDK. Der Fokus liegt auf den im Code implementierten Berechnungen, den mathematischen Modellen und den wirksamen Parametern in FPGA, Treiber und Web-Client. Die dargestellte Kette reicht von der Signalerzeugung ueber die phasenstabile Datenerfassung bis zur Gewichtsabschaetzung und LED-Ausgabe. Grundlage sind die Dateien `driver.hpp`, `sample_counter.v`, `block_design.tcl`, `config.yml` und `web/app.ts`.

# Systemmodell und Datenfluss

Das Instrument ist als geschlossene Messkette aufgebaut. Im FPGA wird ein periodisches DAC-Signal aus dem BRAM zyklisch ausgegeben, waehrend ADC-Daten synchron dazu in ein separates BRAM geschrieben werden. Der Treiber liest beide Speicherbereiche ueber AXI aus, skaliert Rohcodes in Volt und stellt Vektoren fuer den Client bereit. Im Browser wird ein IQ-basiertes Merkmal aus zwei ADC-Kanaelen berechnet, getared und ueber eine hybride Kalibrierfunktion in Kilogramm transformiert. Parallel dazu wird aus dem Gewicht ein LED-Bitmuster erzeugt.

Die Speicherabbildung ist explizit in `config.yml` und `block_design.tcl` festgelegt: `control` bei `0x60000000` (4 KiB), `status` bei `0x50001000` (4 KiB), `adc` bei `0x40000000` (64 KiB), `dac` bei `0x40040000` (64 KiB) und `xadc` bei `0x43C00000` (64 KiB). Da ADC- und DAC-BRAM als 32-Bit-Worte adressiert werden, ergibt sich fuer beide Puffer die identische Laenge

$$
N_{ADC}=N_{DAC}=\frac{65536\ \text{Byte}}{4\ \text{Byte/Wort}}=16384.
$$

# Parametrisierung in FPGA und Treiber

Die zentrale Takt- und Abtastparametrisierung lautet `adc_clk = 125000000 Hz`; damit ist die zeitliche Aufloesung eines Samples

$$
T_s=\frac{1}{f_s}=\frac{1}{125\ \text{MHz}}=8\ \text{ns}=0.008\ \mu s.
$$

Im Treiber sind die Ausgangsparameter fuer die DAC-Anregung fest codiert: `configured_frequency_hz = 100000`, `configured_amplitude_vpk = 0.5`, `dac_full_scale_vpk = 1.0`, `dac_resolution = 2^14 = 16384`. Fuer die Plotdarstellung wird die DAC-Kurve auf maximal 2048 Punkte reduziert. Bei `N_DAC = 16384` folgt daraus die feste Dezimierung

$$
D_{plot}=\left\lceil\frac{16384}{2048}\right\rceil=8.
$$

Der FPGA-Counter hat `COUNT_WIDTH = 14`; damit ist der zulaessige Adressbereich auf `0..16383` abgestimmt. Das Control-Register `trig` wird bitweise doppelt genutzt: Bit 0 dient als Trigger-Toggle, die Bits 14 bis 1 transportieren den Parameter `count_max`. Genau diese Zuordnung entsteht im Blockdesign durch die Slices `DIN 0..0` auf `sample_counter/trig` und `DIN 14..1` auf `sample_counter/count_max`.

# Mathematisches Modell der DAC-Synthese

Die DAC-Wellenform wird bei Initialisierung erzeugt. Der Treiber berechnet zunaechst die nominelle Anzahl Zyklen innerhalb des BRAM-Fensters

$$
C_{full}=f_{cfg}\cdot\frac{N_{DAC}}{f_s},
$$

mit `f_cfg = 100000 Hz`. Numerisch ergibt das

$$
C_{full}=100000\cdot\frac{16384}{125000000}=13.1072.
$$

Es wird auf eine ganze Periodenzahl gerundet,

$$
P=\operatorname{round}(C_{full})=13,
$$

und daraus eine laengenkonsistente Replay-Laenge bestimmt,

$$
L=\operatorname{round}\left(P\cdot\frac{f_s}{f_{cfg}}\right)=\operatorname{round}(16250)=16250.
$$

Anschliessend setzt der Treiber `count_max=L-1=16249` in `trig[14:1]`. Fuer jedes Sample `i` gilt die normierte Phase

$$
\phi_i=\operatorname{frac}\left(\frac{P\cdot i}{L}\right),
$$

und daraus der 14-Bit-Sinuscode

$$
s_i=\operatorname{round}\left(\sin(2\pi\phi_i)\cdot\frac{2^{14}}{2.1}\cdot\frac{A_{vpk}}{1.0}\right),\quad A_{vpk}=0.5.
$$

Der gleiche 14-Bit-Wert wird auf beide DAC-Kanaele gespiegelt, indem er in die unteren und oberen 16 Bit des 32-Bit-Worts geschrieben wird. Die effektive Ausgangsfrequenz ergibt sich aus Replay-Geometrie und Periodenzahl,

$$
f_{out}=\frac{P\cdot f_s}{L}=\frac{13\cdot125000000}{16250}=100000\ \text{Hz}.
$$

Damit ist das Ausgangssignal bei den Standardwerten exakt auf 100 kHz quantisiert.

# Phasenstabile ADC-Erfassung durch `sample_counter`

Das FPGA-Modul `sample_counter` trennt bewusst den kontinuierlichen DAC-Adresslauf vom ADC-Erfassungsadresslauf. Der DAC-Zaehler laeuft stets modulo `count_max+1`, waehrend der ADC-Zaehler nur waehrend einer Capture-Phase aktiv ist. Formal gilt

$$
dac\_count[k+1]=(dac\_count[k]+1)\bmod(count\_max+1).
$$

Ein Trigger entsteht nicht als Pegel, sondern als Flankenereignis (`trig ^ trig_reg`). Dieses Ereignis setzt `capture_armed = 1`. Der eigentliche Start der Aufzeichnung erfolgt jedoch erst beim naechsten DAC-Wrap (`dac_count == count_max`). Dadurch startet jede ADC-Aufnahme mit identischer DAC-Phase, was die nachfolgende Lock-in/IQ-Auswertung robust macht.

Waerend `capture_active = 1`, wird pro Takt ein ADC-Wort geschrieben und `adc_count` hochgezaehlt, bis `adc_count == count_max`. Somit hat jede Aufnahme exakt `count_max+1 = L` Samples. Die BRAM-Adressen werden wortweise als Byteadresse ausgegeben,

$$
address = dac\_count \ll 2,\qquad address\_adc = adc\_count \ll 2.
$$

Das Write-Enable fuer ADC-BRAM ist waehrend der aktiven Capture-Phase gesetzt (`wen = 0xF`), sonst `0`.

# Rohdatenkodierung und Spannungsumrechnung

Jedes ADC-Wort enthaelt zwei 14-Bit-Samples, kanaelweise in den Bitfeldern `[13:0]` und `[29:16]`. Im Treiber wird aus dem 14-Bit-Zweierkomplement zuerst ein vorzeichenbehafteter Integer gebildet,

$$
q=\begin{cases}
raw14, & raw14<2^{13}\\
raw14-2^{14}, & raw14\ge2^{13}
\end{cases}
$$

und dann in Volt skaliert:

$$
V_{ADC}=\frac{q}{819.2}.
$$

Diese Umrechnung entspricht der im Code verwendeten Approximation eines Bereichs von etwa `+/-10 V`.

Fuer DAC-Diagnosedaten nutzt der Treiber ebenfalls die 14-Bit-Dekodierung, jedoch mit eigener Vollskalierung

$$
C_{FS,DAC}=\frac{2^{14}}{2.1},\qquad V_{DAC}=q\cdot\frac{1.0}{C_{FS,DAC}}.
$$

Die Darstellung im Plot ist damit physikalisch in Volt konsistent mit der im Treiber programmierten DAC-Synthese.

# IQ-Merkmalbildung im Web-Client

Die Gewichtsinformation wird nicht direkt aus einer Einzelamplitude bestimmt, sondern ueber eine komplexe Quotientenbildung zwischen Signal- und Referenzkanal. Verwendet wird ein gleitendes Endfenster von

$$
N_w=\min(8000,n),
$$

wobei `n` die verfuegbare Samplezahl des aktuellen Frames ist. Bei `f_s=125 MHz` entspricht `N_w=8000` einer Analysezeit von `64 us`.

Aus beiden Kanaelen werden zunaechst die Mittelwerte entfernt. Mit

$$
\omega=2\pi\frac{f_{sig}}{f_s},\qquad f_{sig}=100000\ \text{Hz},
$$

werden Sinus- und Kosinus-Projektionen berechnet:

$$
X_{sin}=\sum_{i=0}^{N_w-1}x_i\sin(\omega i),\ \ X_{cos}=\sum_{i=0}^{N_w-1}x_i\cos(\omega i),
$$
$$
R_{sin}=\sum_{i=0}^{N_w-1}r_i\sin(\omega i),\ \ R_{cos}=\sum_{i=0}^{N_w-1}r_i\cos(\omega i).
$$

Mit dem Skalierungsfaktor `2/N_w` entstehen die I/Q-Komponenten

$$
I_x=\frac{2}{N_w}X_{sin},\ Q_x=\frac{2}{N_w}X_{cos},\ I_r=\frac{2}{N_w}R_{sin},\ Q_r=\frac{2}{N_w}R_{cos}.
$$

Die komplexe Normierung `Z = X/R` wird komponentenweise implementiert als

$$
\text{den}=\max(I_r^2+Q_r^2,10^{-12}),
$$
$$
I_Z=\frac{I_xI_r+Q_xQ_r}{\text{den}},\qquad Q_Z=\frac{Q_xI_r-I_xQ_r}{\text{den}}.
$$

Im ersten gueltigen Frame wird `(I_0,Q_0)=(I_Z,Q_Z)` als Basispunkt gespeichert. Fuer alle folgenden Frames wird die Aenderung entlang der normierten Basisrichtung projiziert,

$$
\Delta I = I_Z-I_0,\quad \Delta Q = Q_Z-Q_0,
$$
$$
\mathbf{u}_0=\frac{(I_0,Q_0)}{\max(\sqrt{I_0^2+Q_0^2},10^{-6})},
$$
$$
F_{raw}=-(\Delta I\,u_{0,I}+\Delta Q\,u_{0,Q}).
$$

Dieses Skalarmerkmal `F_raw` ist die eigentliche Messgroesse fuer die Waage und repraesentiert eine gerichtete Aenderung des komplexen Signalverhaeltnisses relativ zum Referenzzustand.

# Tarierung, hybride Kalibrierung und Gewichtsausgabe

Die Tarierung erfolgt als additive Offset-Korrektur im Merkmalsraum,

$$
F=F_{raw}-F_{tare}.
$$

Die Gewichtsschaetzung kombiniert zwei Kalibrierzweige. Der exponentielle Zweig invertiert ein Modell der Form `F = A*exp(B_kg*w_kg)+C`:

$$
w_{exp,kg}=\frac{\ln\left(\max\left(\frac{F-C}{A},10^{-9}\right)\right)}{B_{kg}},
$$

mit `A=5.5777`, `B_kg=1.1420`, `C=-5.9575`. Der lineare Zweig arbeitet in Gramm:

$$
w_{lin,g}=\frac{F-N}{M},\qquad w_{lin,kg}=\frac{w_{lin,g}}{1000},
$$

mit `M=0.006771` und `N=6.0657`.

Die Branch-Logik ist im Code exakt so definiert: Der exponentielle Zweig wird nur genutzt, wenn das Ergebnis endlich ist, `(F-C)/A > 0` gilt und `w_exp <= 1 kg`. Andernfalls wird der lineare Zweig genutzt. Dadurch entsteht ein expliziter Arbeitsbereichswechsel bei etwa `F = 11.5176`; mit den aktuellen Koeffizienten ist der Uebergang nicht zwangsweise stetig. Abschliessend wird die Ausgabe auf nichtnegative Werte begrenzt:

$$
w_{kg}=\max(0, w_{selected,kg}).
$$

# LED-Quantisierung und Visualisierung

Die LED-Anzeige bildet das finale Gewicht als stufenfoermige Quantisierung ab. Zuerst wird in Gramm umgerechnet,

$$
g=\max(0,1000\cdot w_{kg}).
$$

Dann wird die Anzahl aktiver LEDs bestimmt als

$$
N_{LED}=\operatorname{clip}\left(\left\lfloor\frac{g}{200}\right\rfloor,0,8\right),
$$

und daraus der Bitmaskenwert

$$
mask=\begin{cases}
0, & N_{LED}=0\\
(1\ll N_{LED})-1, & N_{LED}>0
\end{cases}
$$

gebildet. Diese Maske wird nur bei Aenderung an den Treiber gesendet. Dadurch bleibt die Steuerung effizient und deterministic, waehrend die UI gleichzeitig den gleichen diskreten Zustand als Punkteanzeige rendert.

# Zeitachse, Plot-Decimation und beobachtbare Ausgangsgroessen

Die Anzeigezeitachse wird als laufende Mikrosekundenachse gefuehrt. Fuer einen Frame mit `n` Samples gilt

$$
t_{end}=t_{start}+(n-1)\cdot T_s.
$$

ADC-Kurven werden auf maximal `2048` Punkte verdichtet mit

$$
step=\left\lceil\frac{n}{2048}\right\rceil,
$$

waehrend DAC-Punkte bereits im Treiber als `(Index, Volt)`-Paare mit Schrittweite `8` bereitgestellt werden. Fuer die Gewichtsanzeige werden pro Frame konstante Liniensegmente ueber den gesamten Zeitbereich gezeichnet; damit sind Signal-, Feature- und Gewichtsniveau direkt in derselben Zeitbasis vergleichbar.

# Schlussfolgerung

`scale_v3_exam` implementiert ein durchgaengig koharentes Messinstrument, in dem Signalquelle, synchrone Erfassung und algorithmische Auswertung mathematisch eng gekoppelt sind. Die zentrale technische Entscheidung ist die phasenstabile Erfassung am DAC-Wrap in Verbindung mit einer IQ-Quotientenprojektion relativ zu einem Basispunkt. Diese Architektur reduziert die Empfindlichkeit gegen absolute Amplitudenschwankungen und extrahiert eine robuste, gerichtete Merkmalsgroesse. Die nachgelagerte hybride Kalibrierung ueberfuehrt dieses Merkmal in eine praxisnahe Gewichtsmetrik und koppelt sie direkt an eine diskrete LED-Rueckmeldung. Damit ist das Beispiel nicht nur ein GUI-Demonstrator, sondern ein vollstaendiger Referenzaufbau fuer ein FPGA-gestuetztes, modellbasiertes Waegeinstrument im Koheron-SDK.
