class App {
    private driver: ScaleDriver;
    private client: Client;

    private tareOffset: number = 0.0;
    private calibrationFactor: number = 0.0005;
    private isRunning: boolean = false;

    constructor(window: Window, document: Document, ip: string) {
        this.client = new Client(ip, 5);

        const displayValue = document.getElementById('value');
        const displayRaw = document.getElementById('adc-raw');
        const btnTare = <HTMLButtonElement>document.getElementById('btn-tare');
        const btnUpdate = <HTMLButtonElement>document.getElementById('btn-update-settings');
        const inputCalib = <HTMLInputElement>document.getElementById('input-calib');
        const inputFreq = <HTMLInputElement>document.getElementById('input-freq');

        this.client.init(() => {
            this.driver = new ScaleDriver(this.client);
            this.updateSettings(inputFreq);
            this.isRunning = true;
            this.updateLoop(displayValue, displayRaw);

            btnTare.onclick = () => {
                this.performTare();
            };

            btnUpdate.onclick = () => {
                this.calibrationFactor = parseFloat(inputCalib.value);
                this.updateSettings(inputFreq);
            };
        });

        window.onbeforeunload = () => { this.client.exit(); };
    }

    private updateSettings(inputFreq: HTMLInputElement) {
        const freq = parseFloat(inputFreq.value);
        this.driver.set_frequency(freq);
    }

    private performTare() {
        this.driver.get_adc_data((val) => {
            this.tareOffset = val;
        });
    }

    private updateLoop(displayEl: HTMLElement, debugEl: HTMLElement) {
        if (!this.isRunning) {
            return;
        }

        this.driver.get_adc_data((rawVal) => {
            debugEl.innerText = rawVal.toString();
            let diff = rawVal - this.tareOffset;
            let weight = diff * this.calibrationFactor;
            displayEl.innerText = weight.toFixed(3);

            setTimeout(() => {
                this.updateLoop(displayEl, debugEl);
            }, 100);
        });
    }
}

let app = new App(window, document, location.hostname);
