class App {

    private imports: Imports;
    private plotBasics: PlotBasics;
    public connector: Connector;

    private signalTypeSelect: HTMLSelectElement;
    private slider: HTMLInputElement;

    private tareOffset = 0;
    private calibrationFactor = 0.0005;

    private adc0LiveEl: HTMLElement;
    private adc1LiveEl: HTMLElement;
    private dac0LiveEl: HTMLElement;
    private dac1LiveEl: HTMLElement;
    private adc0ScaleEl: HTMLElement;
    private adc1ScaleEl: HTMLElement;
    private dac0ScaleEl: HTMLElement;
    private dac1ScaleEl: HTMLElement;
    private weightEl: HTMLElement;
    private signalLabelEl: HTMLElement;
    private lastOut0 = 0;
    private lastOut1 = 0;

    constructor(window: Window, document: Document, ip: string, plot_placeholder: JQuery) {

        const client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init(() => {
                this.imports = new Imports(document);
                this.connector = new Connector(client);

                this.plotBasics = new PlotBasics(document, plot_placeholder, 4096, 0, 4096, -11, 11, this.connector, '', 'Diagnose IN/OUT');
                this.bindBramTools(document);
                this.bindScaleTools(document);

                this.updateDiagnosticsPlot();
                this.updateScaleLoop();
            });
        }, false);

        window.onbeforeunload = () => {
            client.exit();
        };
    }

    private bindBramTools(document: Document): void {
        this.signalTypeSelect = <HTMLSelectElement>document.getElementById('signal-type');
        this.slider = <HTMLInputElement>document.getElementById('slider1');
        this.signalLabelEl = <HTMLElement>document.getElementById('signal-label');

        const applySignal = () => {
            const signalType = Number(this.signalTypeSelect.value);
            const freq = Number(this.slider.value);
            this.connector.setFunction(signalType, freq);
            this.signalLabelEl.innerText = this.signalTypeName(signalType);
        };

        this.signalTypeSelect.addEventListener('change', () => applySignal());
        this.slider.addEventListener('input', () => applySignal());

        applySignal();
    }

    private bindScaleTools(document: Document): void {
        this.adc0LiveEl = <HTMLElement>document.getElementById('adc0-live');
        this.adc1LiveEl = <HTMLElement>document.getElementById('adc1-live');
        this.dac0LiveEl = <HTMLElement>document.getElementById('dac0-live');
        this.dac1LiveEl = <HTMLElement>document.getElementById('dac1-live');
        this.adc0ScaleEl = <HTMLElement>document.getElementById('adc0-scale');
        this.adc1ScaleEl = <HTMLElement>document.getElementById('adc1-scale');
        this.dac0ScaleEl = <HTMLElement>document.getElementById('dac0-scale');
        this.dac1ScaleEl = <HTMLElement>document.getElementById('dac1-scale');
        this.weightEl = <HTMLElement>document.getElementById('weight-value');

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
                const in1 = this.extractChannel(adcRaw, false);
                const in2 = this.extractChannel(adcRaw, true);
                const out1 = this.extractChannel(dacRaw, false);
                const out2 = this.extractChannel(dacRaw, true);

                const range: jquery.flot.range = {
                    from: 0,
                    to: Math.max(1, in1.length - 1)
                };

                const series: jquery.flot.dataSeries[] = [
                    { label: 'IN1', data: this.toPlotData(in1), color: '#1f77b4' },
                    { label: 'IN2', data: this.toPlotData(in2), color: '#ff7f0e' },
                    { label: 'OUT1', data: this.toPlotData(out1), color: '#2ca02c' },
                    { label: 'OUT2', data: this.toPlotData(out2), color: '#d62728' }
                ];

                this.plotBasics.redrawSeries(series, range, () => {
                    requestAnimationFrame(() => this.updateDiagnosticsPlot());
                });

                if (in1.length > 0) {
                    this.adc0LiveEl.innerText = in1[in1.length - 1].toFixed(3);
                    this.adc1LiveEl.innerText = in2[in2.length - 1].toFixed(3);
                    this.dac0LiveEl.innerText = out1[out1.length - 1].toFixed(3);
                    this.dac1LiveEl.innerText = out2[out2.length - 1].toFixed(3);
                    this.lastOut0 = out1[out1.length - 1];
                    this.lastOut1 = out2[out2.length - 1];
                }
            });
        });
    }

    private updateScaleLoop(): void {
        this.connector.getAdcRawData(8, (adc0, adc1) => {
            const weight = (adc0 - this.tareOffset) * this.calibrationFactor;
            this.weightEl.innerText = weight.toFixed(3);
            this.adc0ScaleEl.innerText = adc0.toString();
            this.adc1ScaleEl.innerText = adc1.toString();
            this.dac0ScaleEl.innerText = this.lastOut0.toFixed(3);
            this.dac1ScaleEl.innerText = this.lastOut1.toFixed(3);

            setTimeout(() => {
                this.updateScaleLoop();
            }, 100);
        });
    }

    private extractChannel(raw: Uint32Array, upperWord: boolean): number[] {
        const data = new Array<number>(raw.length);

        for (let i = 0; i < raw.length; i++) {
            const sample = upperWord ? ((raw[i] >> 16) & 0x3FFF) : (raw[i] & 0x3FFF);
            data[i] = this.signed14ToVolt(sample);
        }

        return data;
    }

    private signed14ToVolt(value14: number): number {
        let value = value14 & 0x3FFF;
        if ((value & 0x2000) !== 0) {
            value -= 0x4000;
        }
        return value / 819.2;
    }

    private toPlotData(values: number[]): number[][] {
        const targetPts = 2048;
        const step = Math.max(1, Math.ceil(values.length / targetPts));
        const points: number[][] = [];

        for (let i = 0; i < values.length; i += step) {
            points.push([i, values[i]]);
        }

        return points;
    }

    private signalTypeName(signalType: number): string {
        if (signalType === 0) {
            return 'Sinus';
        }
        if (signalType === 1) {
            return 'Saegezahn';
        }
        return 'Dreieck';
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
