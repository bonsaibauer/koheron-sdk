class App {

    private imports: Imports;
    private plotBasics: PlotBasics;
    public connector: Connector;

    private signalModeSelect: HTMLSelectElement;
    private frequencySlider: HTMLInputElement;
    private frequencyValueEl: HTMLElement;

    private tareOffset = 0;
    private calibrationFactor = 0.0005;

    private adc0ValueEl: HTMLElement;
    private adc1ValueEl: HTMLElement;
    private dac0ValueEl: HTMLElement;
    private dac1ValueEl: HTMLElement;
    private weightEl: HTMLElement;

    private rmsIn1El: HTMLElement;
    private rmsIn2El: HTMLElement;
    private rmsOut1El: HTMLElement;
    private rmsOut2El: HTMLElement;

    private lastOut0 = 0;
    private lastOut1 = 0;
    private readonly sampleRateHz = 125000000;
    private lastPlotRangeUs: jquery.flot.range = {from: 0, to: 0};

    private curveVisible: {[key: string]: boolean} = {
        in1: true,
        in2: true,
        out1: true,
        out2: true,
        weight: false,
        calibration: false
    };

    constructor(window: Window, document: Document, ip: string, plot_placeholder: JQuery) {

        const client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init(() => {
                this.imports = new Imports(document);
                this.connector = new Connector(client);

                this.plotBasics = new PlotBasics(document, plot_placeholder, 4096, 0, 4096, -11, 11, this.connector, '', '');
                this.bindControls(document);
                this.bindLegendToggle(document, plot_placeholder);
                this.bindPlotActions(document);
                this.bindScaleTools(document);

                this.updateDiagnosticsPlot();
                this.updateScaleLoop();
            });
        }, false);

        window.onbeforeunload = () => {
            client.exit();
        };
    }

    private bindControls(document: Document): void {
        this.signalModeSelect = <HTMLSelectElement>document.getElementById('signal-mode');
        this.frequencySlider = <HTMLInputElement>document.getElementById('slider1');
        this.frequencyValueEl = <HTMLElement>document.getElementById('freq-value');

        const applySignal = () => {
            const signalType = Number(this.signalModeSelect.value);
            const freq = Number(this.frequencySlider.value);
            this.connector.setFunction(signalType, freq);
            this.frequencyValueEl.innerText = freq.toString();
        };

        this.signalModeSelect.addEventListener('change', () => applySignal());
        this.frequencySlider.addEventListener('input', () => applySignal());

        this.bindCurveToggle(document, 'curve-in1', 'in1');
        this.bindCurveToggle(document, 'curve-in2', 'in2');
        this.bindCurveToggle(document, 'curve-out1', 'out1');
        this.bindCurveToggle(document, 'curve-out2', 'out2');
        this.bindCurveToggle(document, 'curve-weight', 'weight');
        this.bindCurveToggle(document, 'curve-calibration', 'calibration');

        applySignal();
    }

    private bindCurveToggle(document: Document, elementId: string, key: string): void {
        const checkbox = <HTMLInputElement>document.getElementById(elementId);
        checkbox.checked = this.curveVisible[key];
        checkbox.addEventListener('change', () => {
            this.curveVisible[key] = checkbox.checked;
        });
    }

    private bindLegendToggle(document: Document, plotPlaceholder: JQuery): void {
        plotPlaceholder.on('click', '.legendLabel', (event: JQueryEventObject) => {
            const label = ($(event.currentTarget).text() || '').trim();
            const key = this.getSeriesKeyFromLabel(label);

            if (!key) {
                return;
            }

            this.curveVisible[key] = !this.curveVisible[key];
            this.setCheckboxFromKey(document, key, this.curveVisible[key]);
        });
    }

    private bindPlotActions(document: Document): void {
        const resetBtn = <HTMLButtonElement>document.getElementById('btn-plot-reset-view');
        if (!resetBtn) {
            return;
        }

        resetBtn.addEventListener('click', () => {
            this.plotBasics.resetView(this.lastPlotRangeUs.from, this.lastPlotRangeUs.to);
        });
    }

    private getSeriesKeyFromLabel(label: string): string | null {
        if (label === 'IN1') return 'in1';
        if (label === 'IN2') return 'in2';
        if (label === 'OUT1') return 'out1';
        if (label === 'OUT2') return 'out2';
        if (label === 'Weight (kg)') return 'weight';
        if (label === 'Kalibrierung') return 'calibration';
        return null;
    }

    private setCheckboxFromKey(document: Document, key: string, checked: boolean): void {
        const elementMap: {[key: string]: string} = {
            in1: 'curve-in1',
            in2: 'curve-in2',
            out1: 'curve-out1',
            out2: 'curve-out2',
            weight: 'curve-weight',
            calibration: 'curve-calibration'
        };

        const elementId = elementMap[key];
        if (!elementId) {
            return;
        }

        const checkbox = <HTMLInputElement>document.getElementById(elementId);
        if (checkbox) {
            checkbox.checked = checked;
        }
    }

    private bindScaleTools(document: Document): void {
        this.adc0ValueEl = <HTMLElement>document.getElementById('adc0-value');
        this.adc1ValueEl = <HTMLElement>document.getElementById('adc1-value');
        this.dac0ValueEl = <HTMLElement>document.getElementById('dac0-value');
        this.dac1ValueEl = <HTMLElement>document.getElementById('dac1-value');
        this.weightEl = <HTMLElement>document.getElementById('weight-value');

        this.rmsIn1El = <HTMLElement>document.getElementById('rms-in1');
        this.rmsIn2El = <HTMLElement>document.getElementById('rms-in2');
        this.rmsOut1El = <HTMLElement>document.getElementById('rms-out1');
        this.rmsOut2El = <HTMLElement>document.getElementById('rms-out2');

        const calibrationInput = <HTMLInputElement>document.getElementById('input-calibration');
        const saveScaleBtn = <HTMLButtonElement>document.getElementById('btn-save-scale');
        const tareBtn = <HTMLButtonElement>document.getElementById('btn-tare');

        this.calibrationFactor = this.parseNumber(calibrationInput.value, this.calibrationFactor);

        saveScaleBtn.onclick = () => {
            this.calibrationFactor = this.parseNumber(calibrationInput.value, this.calibrationFactor);
        };

        tareBtn.onclick = () => {
            this.connector.getAdcRawData(16, (adc0, _) => {
                this.tareOffset = adc0;
            });
        };
    }

    private updateDiagnosticsPlot(): void {
        this.connector.getAdcSnapshot((adcRaw) => {
            this.connector.getDacSnapshot((dacRaw) => {
                const in1Counts = this.extractChannelCounts(adcRaw, false, true);
                const in2Counts = this.extractChannelCounts(adcRaw, true, true);
                const out1Counts = this.extractChannelCounts(dacRaw, false, false);
                const out2Counts = this.extractChannelCounts(dacRaw, true, false);

                const in1 = this.countsToVolt(in1Counts);
                const in2 = this.countsToVolt(in2Counts);
                const out1 = this.countsToVolt(out1Counts);
                const out2 = this.countsToVolt(out2Counts);

                const weightSeries = this.countsToKg(in1Counts);
                const calibrationSeries = this.countsToCalibration(in1Counts);

                const range: jquery.flot.range = {
                    from: 0,
                    to: this.sampleIndexToMicroseconds(Math.max(1, in1.length - 1))
                };
                this.lastPlotRangeUs = range;

                const allSeries: {[key: string]: jquery.flot.dataSeries} = {
                    in1: { label: 'IN1', data: this.toPlotData(in1), color: '#1f77b4' },
                    in2: { label: 'IN2', data: this.toPlotData(in2), color: '#ff7f0e' },
                    out1: { label: 'OUT1', data: this.toPlotData(out1), color: '#2ca02c' },
                    out2: { label: 'OUT2', data: this.toPlotData(out2), color: '#d62728' },
                    weight: { label: 'Weight (kg)', data: this.toPlotData(weightSeries), color: '#9467bd' },
                    calibration: { label: 'Kalibrierung', data: this.toPlotData(calibrationSeries), color: '#8c564b' }
                };

                const series: jquery.flot.dataSeries[] = [];
                for (const key in allSeries) {
                    if (this.curveVisible[key]) {
                        series.push(allSeries[key]);
                    }
                }

                this.plotBasics.redrawSeries(series, range, () => {
                    requestAnimationFrame(() => this.updateDiagnosticsPlot());
                });

                if (in1.length > 0) {
                    this.lastOut0 = out1[out1.length - 1];
                    this.lastOut1 = out2[out2.length - 1];

                    this.adc0ValueEl.innerText = in1Counts[in1Counts.length - 1].toString();
                    this.adc1ValueEl.innerText = in2Counts[in2Counts.length - 1].toString();
                    this.dac0ValueEl.innerText = out1[out1.length - 1].toFixed(3);
                    this.dac1ValueEl.innerText = out2[out2.length - 1].toFixed(3);

                    this.rmsIn1El.innerText = this.computeRms(in1).toFixed(3);
                    this.rmsIn2El.innerText = this.computeRms(in2).toFixed(3);
                    this.rmsOut1El.innerText = this.computeRms(out1).toFixed(3);
                    this.rmsOut2El.innerText = this.computeRms(out2).toFixed(3);
                }
            });
        });
    }

    private updateScaleLoop(): void {
        this.connector.getAdcRawData(8, (adc0, _) => {
            const weight = (adc0 - this.tareOffset) * this.calibrationFactor;
            this.weightEl.innerText = weight.toFixed(3);

            setTimeout(() => {
                this.updateScaleLoop();
            }, 100);
        });
    }

    private extractChannelCounts(raw: Uint32Array, upperWord: boolean, isOffsetBinary: boolean): number[] {
        const data = new Array<number>(raw.length);

        for (let i = 0; i < raw.length; i++) {
            const sample = upperWord ? ((raw[i] >> 16) & 0x3FFF) : (raw[i] & 0x3FFF);
            data[i] = isOffsetBinary ? this.offsetBinary14ToSigned(sample) : this.toSigned14(sample);
        }

        return data;
    }

    private toSigned14(value14: number): number {
        let value = value14 & 0x3FFF;
        if ((value & 0x2000) !== 0) {
            value -= 0x4000;
        }
        return value;
    }

    // ADC data is offset-binary in this design (0..16383 maps to -8192..+8191).
    private offsetBinary14ToSigned(value14: number): number {
        const value = value14 & 0x3FFF;
        return ((value - 8192) & 0x3FFF) - 8192;
    }

    private countsToVolt(values: number[]): number[] {
        return values.map(v => v / 819.2);
    }

    private countsToKg(values: number[]): number[] {
        return values.map(v => (v - this.tareOffset) * this.calibrationFactor);
    }

    private countsToCalibration(values: number[]): number[] {
        return values.map(v => v * this.calibrationFactor);
    }

    private computeRms(values: number[]): number {
        if (values.length === 0) {
            return 0;
        }

        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            sum += values[i] * values[i];
        }

        return Math.sqrt(sum / values.length);
    }

    private toPlotData(values: number[]): number[][] {
        const targetPts = 2048;
        const step = Math.max(1, Math.ceil(values.length / targetPts));
        const points: number[][] = [];

        for (let i = 0; i < values.length; i += step) {
            points.push([this.sampleIndexToMicroseconds(i), values[i]]);
        }

        return points;
    }

    private sampleIndexToMicroseconds(sampleIndex: number): number {
        return (sampleIndex / this.sampleRateHz) * 1e6;
    }

    private parseNumber(raw: string, fallback: number): number {
        const parsed = parseFloat(raw);
        if (isNaN(parsed)) {
            return fallback;
        }
        return parsed;
    }

}

let app = new App(window, document, location.hostname, $('#plot-placeholder'));
