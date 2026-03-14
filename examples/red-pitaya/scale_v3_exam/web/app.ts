class App {

    // ----------------------------
    // Module: Configuration
    // ----------------------------
    // Runtime configuration:
    // - DAC: sine, 100 kHz, 0.5 Vpk, OUT1+OUT2 (set in driver)
    // - Plot decimation: stride with max 2048 points
    // - Feature extraction: IQ projection on last 8000 samples
    // - Calibration: hybrid exponential/linear mapping
    // - LEDs: 8 LEDs, 200 g per LED step
    private readonly sampleRateHz = 125000000;
    private readonly usPerSample = 1e6 / this.sampleRateHz;
    private readonly signalFrequencyHz = 100000;
    private readonly featureWindowSamples = 8000;
    private readonly plotMaxPoints = 2048;

    private readonly calibExpA = 5.5777;
    private readonly calibExpBkg = 1.1420;
    private readonly calibExpC = -5.9575;
    private readonly calibLinM = 0.006771;
    private readonly calibLinN = 6.0657;

    private readonly ledCount = 8;
    private readonly gramsPerLed = 200;

    // ----------------------------
    // Module: Runtime State
    // ----------------------------
    private plotBasics: PlotBasics;
    private connector: Connector;

    private runningFrameStartUs = 0;

    private iqBaseI = Number.NaN;
    private iqBaseQ = Number.NaN;

    private featureTare = 0;
    private lastFeatureRaw = 0;
    private lastLedMask = -1;

    private weightEl: HTMLElement;
    private tareEl: HTMLElement;
    private ledCountEl: HTMLElement;
    private ledWeightEl: HTMLElement;
    private ledDots: HTMLElement[] = [];

    // ----------------------------
    // Module: Initialization
    // ----------------------------
    constructor(window: Window, document: Document, ip: string, plotPlaceholder: JQuery) {
        const client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init(() => {
                new Imports(document);
                this.connector = new Connector(client);

                this.plotBasics = new PlotBasics(plotPlaceholder, 0, 4096, -11, 11);

                this.bindScaleControls(document);
                this.bindLedPanel(document);

                this.updateLoop();
            });
        }, false);

        window.onbeforeunload = () => {
            if (this.connector) {
                this.connector.setLeds(0);
            }
            client.exit();
        };
    }

    // ----------------------------
    // Module: UI Binding
    // ----------------------------
    private bindScaleControls(document: Document): void {
        this.weightEl = <HTMLElement>document.getElementById('weight-value');
        this.tareEl = <HTMLElement>document.getElementById('scale-tare-feature');

        const tareButton = <HTMLButtonElement>document.getElementById('btn-tare');
        tareButton.addEventListener('click', () => {
            this.featureTare = this.lastFeatureRaw;
            this.tareEl.innerText = this.featureTare.toFixed(4);
        });

        this.tareEl.innerText = this.featureTare.toFixed(4);
    }

    private bindLedPanel(document: Document): void {
        const indicators = <HTMLElement>document.getElementById('led-indicators');
        this.ledCountEl = <HTMLElement>document.getElementById('led-active-count');
        this.ledWeightEl = <HTMLElement>document.getElementById('led-weight-g');

        indicators.innerHTML = '';
        this.ledDots = [];
        for (let i = 0; i < this.ledCount; i++) {
            const dot = document.createElement('div');
            dot.className = 'led-dot';
            indicators.appendChild(dot);
            this.ledDots.push(dot);
        }
    }

    // ----------------------------
    // Module: Runtime Loop
    // ----------------------------
    private updateLoop(): void {
        this.connector.getAdcDualData((in1Raw, in2Raw) => {
            this.connector.getDecimatedDacData((out1Indexed) => {
                const sampleCount = Math.max(0, Math.min(in1Raw.length, in2Raw.length));
                if (sampleCount <= 0) {
                    requestAnimationFrame(() => this.updateLoop());
                    return;
                }

                const frameStartUs = this.runningFrameStartUs;
                const frameEndUs = frameStartUs + (sampleCount - 1) * this.usPerSample;

                const in1Plot = this.decimateToTimePoints(in1Raw, frameStartUs);
                const in2Plot = this.decimateToTimePoints(in2Raw, frameStartUs);
                const out1Plot = this.indexedToTimePoints(out1Indexed, frameStartUs);

                const featureRaw = this.computeFeatureValue(in1Raw, in2Raw);
                this.lastFeatureRaw = featureRaw;

                const featureUsed = featureRaw - this.featureTare;
                const weightKg = this.computeWeightKg(featureUsed);
                this.weightEl.innerText = Math.max(0, weightKg).toFixed(3);

                this.updateLeds(weightKg);

                const featurePlot = [[frameStartUs, featureUsed], [frameEndUs, featureUsed]];
                const weightPlot = [[frameStartUs, weightKg], [frameEndUs, weightKg]];

                const series: jquery.flot.dataSeries[] = [];
                if (this.isCurveChecked('curve-in1')) series.push({ label: 'IN1', data: in1Plot, color: '#1f77b4' });
                if (this.isCurveChecked('curve-in2')) series.push({ label: 'IN2', data: in2Plot, color: '#ff7f0e' });
                if (this.isCurveChecked('curve-out1')) series.push({ label: 'OUT1', data: out1Plot, color: '#2ca02c' });
                // OUT1 and OUT2 share the same configured DAC waveform.
                if (this.isCurveChecked('curve-out2')) series.push({ label: 'OUT2', data: out1Plot, color: '#d62728' });
                if (this.isCurveChecked('curve-feature')) series.push({ label: 'Feature', data: featurePlot, color: '#9467bd' });
                if (this.isCurveChecked('curve-weight')) series.push({ label: 'Weight', data: weightPlot, color: '#8c564b' });

                const range: jquery.flot.range = { from: frameStartUs, to: frameEndUs };
                this.plotBasics.redrawSeries(series, range);
                this.runningFrameStartUs = frameEndUs;
                requestAnimationFrame(() => this.updateLoop());
            });
        });
    }

    // ----------------------------
    // Module: Signal Processing
    // ----------------------------
    private computeFeatureValue(in1: number[], in2: number[]): number {
        const n = Math.max(0, Math.min(in1.length, in2.length));
        if (n <= 0) {
            return 0;
        }

        const windowCount = Math.max(1, Math.min(this.featureWindowSamples, n));
        const start = n - windowCount;

        const omega = 2.0 * Math.PI * this.signalFrequencyHz / this.sampleRateHz;
        let meanIn1 = 0;
        let meanIn2 = 0;
        for (let i = 0; i < windowCount; i++) {
            meanIn1 += in1[start + i];
            meanIn2 += in2[start + i];
        }
        meanIn1 /= windowCount;
        meanIn2 /= windowCount;
        const scale = 2.0 / windowCount;

        let xSin = 0;
        let xCos = 0;
        let rSin = 0;
        let rCos = 0;

        for (let i = 0; i < windowCount; i++) {
            const idx = start + i;
            const theta = omega * i;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            const x = in1[idx] - meanIn1;
            const r = in2[idx] - meanIn2;

            xSin += x * sinTheta;
            xCos += x * cosTheta;
            rSin += r * sinTheta;
            rCos += r * cosTheta;
        }

        const xI = scale * xSin;
        const xQ = scale * xCos;
        const rI = scale * rSin;
        const rQ = scale * rCos;

        const den = Math.max(rI * rI + rQ * rQ, 1e-12);
        const iqI = (xI * rI + xQ * rQ) / den;
        const iqQ = (xQ * rI - xI * rQ) / den;

        if (!Number.isFinite(this.iqBaseI) || !Number.isFinite(this.iqBaseQ)) {
            this.iqBaseI = iqI;
            this.iqBaseQ = iqQ;
        }

        const dI = iqI - this.iqBaseI;
        const dQ = iqQ - this.iqBaseQ;
        const baseMag = Math.max(Math.sqrt(this.iqBaseI * this.iqBaseI + this.iqBaseQ * this.iqBaseQ), 1e-6);
        const uI = this.iqBaseI / baseMag;
        const uQ = this.iqBaseQ / baseMag;

        const feature = -(dI * uI + dQ * uQ);
        if (Number.isFinite(feature)) {
            return feature;
        }

        return 0;
    }

    private computeWeightKg(feature: number): number {
        const ratio = (feature - this.calibExpC) / this.calibExpA;
        const ratioSafe = Math.max(ratio, 1e-9);
        const expWeightKg = Math.log(ratioSafe) / this.calibExpBkg;

        const linWeightGram = (feature - this.calibLinN) / this.calibLinM;
        const linWeightKg = linWeightGram / 1000.0;

        const useExpBranch = Number.isFinite(expWeightKg) && ratio > 0 && (expWeightKg * 1000.0) <= 1000.0;
        const weightKg = useExpBranch ? expWeightKg : linWeightKg;

        if (!Number.isFinite(weightKg) || weightKg < 0) {
            return 0;
        }

        return weightKg;
    }

    // ----------------------------
    // Module: LED Output
    // ----------------------------
    private updateLeds(weightKg: number): void {
        const grams = Math.max(0, weightKg * 1000.0);
        const activeLeds = Math.max(0, Math.min(this.ledCount, Math.floor(grams / this.gramsPerLed)));
        const ledMask = activeLeds <= 0 ? 0 : (1 << activeLeds) - 1;

        if (ledMask !== this.lastLedMask) {
            this.lastLedMask = ledMask;
            this.connector.setLeds(ledMask);
        }

        for (let i = 0; i < this.ledDots.length; i++) {
            if (i < activeLeds) {
                this.ledDots[i].classList.add('on');
            } else {
                this.ledDots[i].classList.remove('on');
            }
        }

        this.ledCountEl.innerText = activeLeds.toString() + ' / ' + this.ledCount.toString();
        this.ledWeightEl.innerText = grams.toFixed(0) + ' g';
    }

    // ----------------------------
    // Module: Utility Helpers
    // ----------------------------
    private isCurveChecked(elementId: string): boolean {
        return (<HTMLInputElement>document.getElementById(elementId)).checked;
    }

    private decimateToTimePoints(values: number[], offsetUs: number): number[][] {
        const n = values.length;
        const points: number[][] = [];
        if (n <= 0) {
            return points;
        }

        const step = Math.max(1, Math.ceil(n / this.plotMaxPoints));
        for (let i = 0; i < n; i += step) {
            points.push([offsetUs + i * this.usPerSample, values[i]]);
        }
        return points;
    }

    private indexedToTimePoints(points: number[][], offsetUs: number): number[][] {
        const out: number[][] = new Array(points.length);
        for (let i = 0; i < points.length; i++) {
            out[i] = [offsetUs + points[i][0] * this.usPerSample, points[i][1]];
        }
        return out;
    }

}

let app = new App(window, document, location.hostname, $('#plot-placeholder'));
