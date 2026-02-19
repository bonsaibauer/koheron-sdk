class App {

    public plot: Plot;
    private fft: FFT;
    public fftApp: FFTApp;
    public laserDriver: LaserDriver;
    public laserControl: LaserControl;
    private exportFile: ExportFile;
    private imports: Imports;
    public ddsFrequency: DDSFrequency;
    private plotBasics: PlotBasics;

    private n_pts: number;
    private x_min: number;
    private x_max: number;
    private y_min: number;
    private y_max: number;
    private tareOffset: number = 0;
    private calibrationFactor: number = 0.0005;

    constructor(window: Window, document: Document,
                ip: string, plot_placeholder: JQuery) {
        let client = new Client(ip, 5);
        const page = document.body.getAttribute('data-page') || 'fft';

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init( () => {
                this.imports = new Imports(document);
                this.fft = new FFT(client);

                if (page === 'fft') {
                    this.fft.init( () => {
                        this.fftApp = new FFTApp(document, this.fft);
                        this.ddsFrequency = new DDSFrequency(document, this.fft);

                        this.n_pts = this.fft.fft_size / 2;
                        this.x_min = 0;
                        this.x_max = this.fft.status.fs / 1E6 / 2;
                        this.y_min = -200;
                        this.y_max = 170;

                        this.plotBasics = new PlotBasics(document, plot_placeholder, this.n_pts, this.x_min, this.x_max, this.y_min, this.y_max, this.fft, "", "Frequency (MHz)");
                        this.plot = new Plot(document, this.fft, this.plotBasics);

                        this.laserDriver = new LaserDriver(client);
                        this.laserControl = new LaserControl(document, this.laserDriver);
                        this.exportFile = new ExportFile(document, this.plot);
                    });
                } else {
                    this.initScalePage(document);
                }
            });
        }, false);

        window.onbeforeunload = () => { client.exit(); };
    }

    initScalePage(document: Document): void {
        const displayValue = <HTMLElement>document.getElementById('value');
        const adc0El = <HTMLElement>document.getElementById('adc-raw');
        const adc1El = <HTMLElement>document.getElementById('adc1-raw');
        const btnTare = <HTMLButtonElement>document.getElementById('btn-tare');
        const btnUpdate = <HTMLButtonElement>document.getElementById('btn-update-settings');
        const inputCalib = <HTMLInputElement>document.getElementById('input-calib');
        const inputFreq = <HTMLInputElement>document.getElementById('input-freq');

        this.applyScaleSettings(inputCalib, inputFreq);

        btnTare.onclick = () => {
            this.fft.getADCRawData(16, (adc0, _) => {
                this.tareOffset = adc0;
            });
        };

        btnUpdate.onclick = () => {
            this.applyScaleSettings(inputCalib, inputFreq);
        };

        const loop = () => {
            this.fft.getADCRawData(8, (adc0, adc1) => {
                adc0El.innerText = adc0.toString();
                adc1El.innerText = adc1.toString();
                const weight = (adc0 - this.tareOffset) * this.calibrationFactor;
                displayValue.innerText = weight.toFixed(3);
                setTimeout(loop, 100);
            });
        };
        loop();
    }

    applyScaleSettings(inputCalib: HTMLInputElement, inputFreq: HTMLInputElement): void {
        this.calibrationFactor = parseFloat(inputCalib.value);
        const freq = parseFloat(inputFreq.value);
        this.fft.setDDSFreq(0, freq);
    }

}

let app = new App(window, document, location.hostname, $('#plot-placeholder'));
