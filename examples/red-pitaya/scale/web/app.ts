class App {
    private adcdac: AdcDac;
    private imports: Imports;
    private tareOffset = 0;
    private calibrationFactor = 0.0005;

    private adc0El: HTMLElement;
    private adc1El: HTMLElement;
    private adc0ScaleEl: HTMLElement;
    private adc1ScaleEl: HTMLElement;
    private weightEl: HTMLElement;

    constructor(window: Window, document: Document, ip: string) {
        const client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init(() => {
                this.imports = new Imports(document);
                this.adcdac = new AdcDac(client);
                this.bindUi(document);
                this.startLiveLoop();
            });
        }, false);

        window.onbeforeunload = () => {
            client.exit();
        };
    }

    private bindUi(document: Document): void {
        this.adc0El = <HTMLElement>document.getElementById('adc0-live');
        this.adc1El = <HTMLElement>document.getElementById('adc1-live');
        this.adc0ScaleEl = <HTMLElement>document.getElementById('adc0-scale');
        this.adc1ScaleEl = <HTMLElement>document.getElementById('adc1-scale');
        this.weightEl = <HTMLElement>document.getElementById('weight-value');

        const dac0Input = <HTMLInputElement>document.getElementById('dac0-input');
        const dac1Input = <HTMLInputElement>document.getElementById('dac1-input');
        const setDacBtn = <HTMLButtonElement>document.getElementById('btn-set-dac');

        const tareBtn = <HTMLButtonElement>document.getElementById('btn-tare');
        const calibrationInput = <HTMLInputElement>document.getElementById('input-calibration');
        const saveScaleBtn = <HTMLButtonElement>document.getElementById('btn-save-scale');

        this.calibrationFactor = this.parseNumber(calibrationInput.value, this.calibrationFactor);

        setDacBtn.onclick = () => {
            const dac0 = this.parseNumber(dac0Input.value, 0);
            const dac1 = this.parseNumber(dac1Input.value, 0);
            this.adcdac.setDac0(dac0);
            this.adcdac.setDac1(dac1);
        };

        tareBtn.onclick = () => {
            this.readAverageAdc0(16, avg => {
                this.tareOffset = avg;
            });
        };

        saveScaleBtn.onclick = () => {
            this.calibrationFactor = this.parseNumber(calibrationInput.value, this.calibrationFactor);
        };
    }

    private startLiveLoop(): void {
        const loop = () => {
            this.adcdac.getAdc((adc0, adc1) => {
                this.adc0El.innerText = adc0.toString();
                this.adc1El.innerText = adc1.toString();
                this.adc0ScaleEl.innerText = adc0.toString();
                this.adc1ScaleEl.innerText = adc1.toString();

                const weight = (adc0 - this.tareOffset) * this.calibrationFactor;
                this.weightEl.innerText = weight.toFixed(3);

                setTimeout(loop, 100);
            });
        };

        loop();
    }

    private readAverageAdc0(samples: number, cb: (avg: number) => void): void {
        let sum = 0;
        let count = 0;

        const sample = () => {
            this.adcdac.getAdc((adc0, _) => {
                sum += adc0;
                count += 1;

                if (count >= samples) {
                    cb(Math.round(sum / count));
                    return;
                }

                sample();
            });
        };

        sample();
    }

    private parseNumber(raw: string, fallback: number): number {
        const parsed = parseFloat(raw);
        if (isNaN(parsed)) {
            return fallback;
        }
        return parsed;
    }
}

let app = new App(window, document, location.hostname);
