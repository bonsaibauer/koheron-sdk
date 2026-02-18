class App {
    private driver: ScaleDriver;
    private client: Client;

    private tareOffset: number = 0.0;
    private calibrationFactor: number = 0.0005;
    private fftBuffer: number[] = [];

    constructor(window: Window, document: Document, ip: string) {
        this.client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            new Imports(document);

            this.client.init(() => {
                this.driver = new ScaleDriver(this.client);

                if (document.body.getAttribute('data-page') === 'scale') {
                    this.initScalePage(document);
                }

                if (document.body.getAttribute('data-page') === 'fft') {
                    this.initFftPage(document);
                }
            });
        }, false);

        window.onbeforeunload = () => { this.client.exit(); };
    }

    private initScalePage(document: Document): void {
        const displayValue = <HTMLElement>document.getElementById('value');
        const displayRaw = <HTMLElement>document.getElementById('adc-raw');
        const btnTare = <HTMLButtonElement>document.getElementById('btn-tare');
        const btnUpdate = <HTMLButtonElement>document.getElementById('btn-update-settings');
        const inputCalib = <HTMLInputElement>document.getElementById('input-calib');
        const inputFreq = <HTMLInputElement>document.getElementById('input-freq');

        this.updateSettings(inputFreq);

        btnTare.onclick = () => {
            this.performTare();
        };

        btnUpdate.onclick = () => {
            this.calibrationFactor = parseFloat(inputCalib.value);
            this.updateSettings(inputFreq);
        };

        this.scaleLoop(displayValue, displayRaw);
    }

    private initFftPage(document: Document): void {
        const plotPlaceholder = <HTMLDivElement>document.getElementById('plot-placeholder');
        const rawLabel = <HTMLElement>document.getElementById('fft-raw');
        const inputFftSize = <HTMLInputElement>document.getElementById('fft-size');
        const inputFftPeriod = <HTMLInputElement>document.getElementById('fft-period');

        const canvas = document.createElement('canvas');
        canvas.id = 'fft-canvas';
        canvas.width = Math.max(900, plotPlaceholder.clientWidth || 900);
        canvas.height = 420;
        canvas.style.width = '100%';
        canvas.style.height = '420px';
        plotPlaceholder.innerHTML = '';
        plotPlaceholder.appendChild(canvas);

        this.fftLoop(inputFftSize, inputFftPeriod, rawLabel);
    }

    private updateSettings(inputFreq: HTMLInputElement): void {
        const freq = parseFloat(inputFreq.value);
        this.driver.set_frequency(freq);
    }

    private performTare(): void {
        this.driver.get_adc_data((val) => {
            this.tareOffset = val;
        });
    }

    private scaleLoop(displayEl: HTMLElement, debugEl: HTMLElement): void {
        this.driver.get_adc_data((rawVal) => {
            debugEl.innerText = rawVal.toString();
            const diff = rawVal - this.tareOffset;
            const weight = diff * this.calibrationFactor;
            displayEl.innerText = weight.toFixed(3);

            setTimeout(() => {
                this.scaleLoop(displayEl, debugEl);
            }, 100);
        });
    }

    private fftLoop(inputFftSize: HTMLInputElement, inputFftPeriod: HTMLInputElement, rawLabel: HTMLElement): void {
        this.driver.get_adc_data((rawVal) => {
            const signed = this.toSigned14(rawVal);
            rawLabel.innerText = signed.toString();

            this.fftBuffer.push(signed);
            const fftSize = this.clamp(this.parseOrDefault(inputFftSize.value, 128), 32, 256);
            while (this.fftBuffer.length > fftSize) {
                this.fftBuffer.shift();
            }

            if (this.fftBuffer.length >= fftSize) {
                const mags = this.computeMagnitudeSpectrum(this.fftBuffer);
                this.drawSpectrum(mags);
            }

            const period = this.clamp(this.parseOrDefault(inputFftPeriod.value, 120), 60, 1000);
            setTimeout(() => {
                this.fftLoop(inputFftSize, inputFftPeriod, rawLabel);
            }, period);
        });
    }

    private toSigned14(v: number): number {
        const x = v & 0x3FFF;
        return x >= 0x2000 ? x - 0x4000 : x;
    }

    private parseOrDefault(v: string, fallback: number): number {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : fallback;
    }

    private clamp(v: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, v));
    }

    private computeMagnitudeSpectrum(samples: number[]): number[] {
        const n = samples.length;
        const bins = Math.floor(n / 2);
        const result = new Array<number>(bins);

        for (let k = 0; k < bins; k++) {
            let re = 0.0;
            let im = 0.0;
            for (let i = 0; i < n; i++) {
                const phi = (2.0 * Math.PI * k * i) / n;
                re += samples[i] * Math.cos(phi);
                im -= samples[i] * Math.sin(phi);
            }
            result[k] = Math.sqrt(re * re + im * im);
        }

        return result;
    }

    private drawSpectrum(mags: number[]): void {
        const canvas = <HTMLCanvasElement>document.getElementById('fft-canvas');
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        let maxMag = 1.0;
        for (let i = 0; i < mags.length; i++) {
            if (mags[i] > maxMag) {
                maxMag = mags[i];
            }
        }

        ctx.strokeStyle = '#2b7cff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < mags.length; i++) {
            const x = (i / (mags.length - 1)) * (w - 1);
            const y = h - (mags[i] / maxMag) * (h - 2) - 1;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
}

let app = new App(window, document, location.hostname);
