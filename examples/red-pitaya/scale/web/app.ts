class App {

    private imports: Imports;
    private plotBasics: PlotBasics;
    public connector: Connector;
    private sw: HTMLInputElement;
    private slider: HTMLInputElement;

    private tareOffset = 0;
    private calibrationFactor = 0.0005;

    private adc0LiveEl: HTMLElement;
    private adc1LiveEl: HTMLElement;
    private weightEl: HTMLElement;

    constructor(window: Window, document: Document, ip: string, plot_placeholder: JQuery) {

        const client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init(() => {
                this.imports = new Imports(document);
                this.connector = new Connector(client);

                const n_pts = 12192;
                const x_min = 0;
                const x_max = 62.5;
                const y_min = -11;
                const y_max = 11;

                this.plotBasics = new PlotBasics(document, plot_placeholder, n_pts, x_min, x_max, y_min, y_max, this.connector, 'setRange', 'Datenpunkt');

                const xLabelSpan = <HTMLSpanElement>document.getElementById('plot-title');
                xLabelSpan.innerHTML = 'Zeit';

                this.bindBramTools(document);
                this.bindScaleTools(document);

                this.updatePlot();
                this.updateScaleLoop();
            });
        }, false);

        this.slider = document.getElementById('slider1') as HTMLInputElement;
        this.slider.addEventListener('input', () => {
            if (this.sw.checked) {
                this.connector.setFunction(1, Number(this.slider.value));
            } else {
                this.connector.setFunction(0, Number(this.slider.value));
            }
        });

        window.onbeforeunload = () => {
            client.exit();
        };
    }

    private bindBramTools(document: Document): void {
        this.sw = <HTMLInputElement>document.getElementById('switch1');
        this.sw.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;
            if (target.checked) {
                this.connector.setFunction(1, Number(this.slider.value));
            } else {
                this.connector.setFunction(0, Number(this.slider.value));
            }
        });

        const sw2 = <HTMLInputElement>document.getElementById('switch2');
        sw2.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;
            if (target.checked) {
                this.connector.setChannel(1);
            } else {
                this.connector.setChannel(0);
            }
        });
    }

    private bindScaleTools(document: Document): void {
        this.adc0LiveEl = <HTMLElement>document.getElementById('adc0-live');
        this.adc1LiveEl = <HTMLElement>document.getElementById('adc1-live');
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

    updatePlot(): void {
        this.connector.getDecimatedData((plot_data: number[][], range_x: jquery.flot.range) => {
            this.plotBasics.redrawRange(plot_data, range_x, 'Spannung', () => {
                requestAnimationFrame(() => {
                    this.updatePlot();
                });
            });
        });
    }

    private updateScaleLoop(): void {
        this.connector.getAdcRawData(8, (adc0, adc1) => {
            this.adc0LiveEl.innerText = adc0.toString();
            this.adc1LiveEl.innerText = adc1.toString();

            const weight = (adc0 - this.tareOffset) * this.calibrationFactor;
            this.weightEl.innerText = weight.toFixed(3);

            setTimeout(() => {
                this.updateScaleLoop();
            }, 100);
        });
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
