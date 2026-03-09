// ----------------------------
// Module: Workflow Type System
// ----------------------------
type Phase2Input = 'in1' | 'in2' | 'in1_minus_in2' | 'in1_div_in2';
type Phase3Feature = 'rms' | 'true_rms' | 'iq_in2';
type Phase4Calibration = 'off' | 'tare_only' | 'scale_only' | 'tare_scale';
type Phase5Smoothing = 'none' | 'moving_average' | 'ema';
type DriverAction =
    'rms' |
    'true_rms';
type DriverRefreshMode = 'off' | '1hz' | '5hz';
type PlotDecimationMethod = 'none' | 'stride' | 'minmax' | 'mean';

// ----------------------------
// Module: Pipeline Data Model
// ----------------------------
interface PipelineResult {
    featureRaw: number;
    featureUsed: number;
    weightRaw: number;
    weightUsed: number;
    rmsIn1: number;
    rmsIn2: number;
    rmsOut1: number;
    rmsOut2: number;
    iqI: number;
    iqQ: number;
    iqA: number;
    iqARef: number;
    iqANorm: number;
    iqRefPhaseDeg: number;
}

interface FeatureComputationResult {
    feature: number;
    iqI: number;
    iqQ: number;
    iqA: number;
    iqARef: number;
    iqANorm: number;
    iqRefPhaseDeg: number;
}

// ----------------------------
// Module: App Controller
// ----------------------------
class App {

    // ----------------------------
    // State: Shared Runtime Handles
    // ----------------------------
    private plotBasics: PlotBasics;
    public connector: Connector;

    // ----------------------------
    // State: Signal Source Controls
    // ----------------------------
    private readonly sampleRateHz = 125000000;
    private readonly signalSourceDefaultFrequencyHz = 100000;
    private readonly signalSourceDefaultAmplitudeVpp = 1.0;
    private readonly signalSourceMaxFrequencyHz = 10000000;
    private readonly signalSourceMaxAmplitudeVpp = 2.0;
    private outputChannelSelect: HTMLSelectElement;
    private amplitudeInput: HTMLInputElement;
    private frequencyInput: HTMLInputElement;
    private phase1SaveBtn: HTMLButtonElement;
    private appliedOutputChannel = 2;
    private appliedFrequencyHz = this.signalSourceDefaultFrequencyHz;
    private appliedAmplitudeVpp = this.signalSourceDefaultAmplitudeVpp;

    // ----------------------------
    // State: Driver Panel Controls
    // ----------------------------
    private driverActionSelect: HTMLSelectElement;
    private driverRefreshModeSelect: HTMLSelectElement;
    private driverSamplesInput: HTMLInputElement;
    private driverRunBtn: HTMLButtonElement;
    private driverOutputEl: HTMLElement;
    private driverAutoTimer: number | null = null;
    private driverRequestInFlight = false;

    // ----------------------------
    // State: Workflow Controls
    // ----------------------------
    private phase2InputSelect: HTMLSelectElement;
    private phase3FeatureSelect: HTMLSelectElement;
    private phase4CalibrationSelect: HTMLSelectElement;
    private phase5SmoothingSelect: HTMLSelectElement;
    private phase2SaveBtn: HTMLButtonElement;
    private phase3SaveBtn: HTMLButtonElement;
    private phase4SaveBtn: HTMLButtonElement;
    private phase5SaveBtn: HTMLButtonElement;

    private rmsWindowSamplesInput: HTMLInputElement;
    private smoothingWindowInput: HTMLInputElement;
    private smoothingAlphaInput: HTMLInputElement;
    private divisionEpsilonInput: HTMLInputElement;
    private divisionClipInput: HTMLInputElement;
    private plotMaxPointsInput: HTMLInputElement;
    private smoothingWindowGroup: HTMLElement;
    private smoothingAlphaGroup: HTMLElement;
    private divisionEpsilonGroup: HTMLElement;
    private divisionClipGroup: HTMLElement;
    private appliedPhase2Input: Phase2Input = 'in1';
    private appliedPhase3Feature: Phase3Feature = 'rms';
    private appliedPhase4Calibration: Phase4Calibration = 'tare_scale';
    private appliedPhase5Smoothing: Phase5Smoothing = 'none';
    private appliedWindowSamples = 8000;
    private appliedSmoothingWindow = 5;
    private appliedSmoothingAlpha = 0.2;
    private appliedDivisionEpsilon = 0.01;
    private appliedDivisionClip = 100.0;

    // ----------------------------
    // State: Formula Output Fields
    // ----------------------------
    private formulaSourceEl: HTMLElement | null = null;
    private formulaInputEl: HTMLElement | null = null;
    private formulaFeatureEl: HTMLElement | null = null;
    private formulaCalibrationEl: HTMLElement | null = null;
    private formulaSmoothingEl: HTMLElement | null = null;
    private formulaPlotEl: HTMLElement | null = null;

    // ----------------------------
    // State: Live Trace Fields
    // ----------------------------
    private liveSourceEl: HTMLElement;
    private liveDriverActionEl: HTMLElement;
    private liveDriverResultEl: HTMLElement;
    private liveInputEl: HTMLElement;
    private liveAdcFormulaEl: HTMLElement;
    private liveSourceClampEl: HTMLElement;
    private liveDacFormulaEl: HTMLElement;
    private liveInputFormulaEl: HTMLElement;
    private liveInputGuardEl: HTMLElement;
    private liveLockinParamsEl: HTMLElement;
    private liveFeatureFormulaEl: HTMLElement;
    private liveCalibrationFormulaEl: HTMLElement;
    private liveCalibrationEvalEl: HTMLElement;
    private liveSmoothingFormulaEl: HTMLElement;
    private liveSmoothingEvalEl: HTMLElement;
    private livePlotDecimationEl: HTMLElement;
    private liveFeatureRawEl: HTMLElement;
    private liveFeatureUsedEl: HTMLElement;
    private liveFeatureTareEl: HTMLElement;
    private liveKFactorEl: HTMLElement;
    private liveWeightRawEl: HTMLElement;
    private liveWeightUsedEl: HTMLElement;
    private liveRmsIn12El: HTMLElement;
    private liveRmsOut12El: HTMLElement;
    private liveIqIEl: HTMLElement;
    private liveIqQEl: HTMLElement;
    private liveIqAEl: HTMLElement;
    private liveIqARefEl: HTMLElement;
    private liveIqANormEl: HTMLElement;
    private liveIqRefPhaseEl: HTMLElement;

    // ----------------------------
    // State: Scale Panel Fields
    // ----------------------------
    private scaleTareFeatureEl: HTMLElement;
    private weightEl: HTMLElement;
    private weightUnitEl: HTMLElement;

    private calibrationInput: HTMLInputElement;
    private calibrationSaveBtn: HTMLButtonElement;
    private tareBtn: HTMLButtonElement;
    private calibrationFactor = 0.0005;
    private featureTare = 0;

    // ----------------------------
    // State: Data Buffers
    // ----------------------------
    private latestIn1: number[] = [];
    private latestIn2: number[] = [];
    private latestIn1Plot: number[][] = [];
    private latestIn2Plot: number[][] = [];
    private out1Cache: number[] = [];
    private out2Cache: number[] = [];
    private out1Plot: number[][] = [];
    private out2Plot: number[][] = [];

    // ----------------------------
    // State: Derived Scalars
    // ----------------------------
    private featureTraceValue = 0;
    private weightTraceValue = 0;

    // ----------------------------
    // State: Smoothing Runtime
    // ----------------------------
    private smoothingHistory: number[] = [];
    private emaWeight = 0;
    private emaInitialized = false;
    private lastSmoothingEvaluationText = 'Off';
    private readonly iqNormalizationEpsilon = 0.000001;

    // ----------------------------
    // State: Plot Runtime
    // ----------------------------
    private lastPlotRangeUs: jquery.flot.range = {from: 0, to: 0};
    private runningPlotFrameStartUs = 0;
    private adcRawSize = 16384;
    private dacRawSize = 16384;
    private adcDecimationStep = 1;
    private dacDecimationStep = 1;
    private plotDecimationMethodSelect: HTMLSelectElement;

    private curveVisible: {[key: string]: boolean} = {
        in1: true,
        in2: true,
        out1: true,
        out2: true,
        feature: true,
        weight: true
    };

    // ----------------------------
    // Module: Initialization + Lifecycle
    // ----------------------------
    constructor(window: Window, document: Document, ip: string, plot_placeholder: JQuery) {
        const client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init(() => {
                new Imports(document);
                this.connector = new Connector(client);

                this.plotBasics = new PlotBasics(document, plot_placeholder, 4096, 0, 4096, -11, 11, this.connector, '', '');

                this.bindCurveControls(document);
                this.bindPlotActions(document);
                this.bindSignalSource(document);
                this.bindDriverPanel(document);
                this.bindWorkflowControls(document);
                this.bindScalePanel(document);

                this.applyPhase1Settings();
                this.applyPhase2Settings();
                this.applyPhase3Settings();
                this.applyPhase4Settings();
                this.applyPhase5Settings();
                this.updateFormulaAndParameterVisibility();

                this.updateDiagnosticsPlot();
                this.updateScaleLoop();
            });
        }, false);

        window.onbeforeunload = () => {
            if (this.driverAutoTimer !== null) {
                window.clearInterval(this.driverAutoTimer);
            }
            client.exit();
        };
    }

    // ----------------------------
    // Module: Plot + Curve UI
    // ----------------------------
    private bindCurveControls(document: Document): void {
        this.bindCurveToggle(document, 'curve-in1', 'in1');
        this.bindCurveToggle(document, 'curve-in2', 'in2');
        this.bindCurveToggle(document, 'curve-out1', 'out1');
        this.bindCurveToggle(document, 'curve-out2', 'out2');
        this.bindCurveToggle(document, 'curve-feature', 'feature');
        this.bindCurveToggle(document, 'curve-weight', 'weight');
    }

    private bindCurveToggle(document: Document, elementId: string, key: string): void {
        const checkbox = <HTMLInputElement>document.getElementById(elementId);
        checkbox.checked = this.curveVisible[key];
        checkbox.addEventListener('change', () => {
            this.curveVisible[key] = checkbox.checked;
        });
    }

    private bindPlotActions(document: Document): void {
        this.plotDecimationMethodSelect = <HTMLSelectElement>document.getElementById('plot-decimation-method');

        const onPlotSettingsChanged = () => {
            this.updateFormulaAndParameterVisibility();
        };

        this.plotDecimationMethodSelect.addEventListener('change', onPlotSettingsChanged);

        const plotPlaceholder = $('#plot-placeholder');
        plotPlaceholder.on('click', '.legendLabel', (event: JQueryEventObject) => {
            const label = ($(event.currentTarget).text() || '').trim();
            const key = this.getSeriesKeyFromLabel(label);

            if (!key) {
                return;
            }

            this.curveVisible[key] = !this.curveVisible[key];
            this.setCheckboxFromKey(document, key, this.curveVisible[key]);
        });

        const resetBtn = <HTMLButtonElement>document.getElementById('btn-plot-reset-view');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.plotBasics.resetView(this.lastPlotRangeUs.from, this.lastPlotRangeUs.to);
            });
        }
    }

    // ----------------------------
    // Module: Source + Driver Panel UI
    // ----------------------------
    private bindSignalSource(document: Document): void {
        this.outputChannelSelect = <HTMLSelectElement>document.getElementById('output-channel');
        this.amplitudeInput = <HTMLInputElement>document.getElementById('signal-amplitude');
        this.frequencyInput = <HTMLInputElement>document.getElementById('signal-frequency');
        this.phase1SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase1-save');

        const applyPhase1 = () => this.applyPhase1Settings();

        this.phase1SaveBtn.addEventListener('click', applyPhase1);
        this.amplitudeInput.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                applyPhase1();
            }
        });
        this.frequencyInput.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                applyPhase1();
            }
        });
    }

    private bindDriverPanel(document: Document): void {
        this.driverActionSelect = <HTMLSelectElement>document.getElementById('driver-action');
        this.driverRefreshModeSelect = <HTMLSelectElement>document.getElementById('driver-refresh-mode');
        this.driverSamplesInput = <HTMLInputElement>document.getElementById('driver-samples');
        this.driverRunBtn = <HTMLButtonElement>document.getElementById('btn-driver-run');
        this.driverOutputEl = <HTMLElement>document.getElementById('driver-output');

        this.driverActionSelect.addEventListener('change', () => this.updateDriverAutoRun());
        this.driverRefreshModeSelect.addEventListener('change', () => this.updateDriverAutoRun());
        this.driverSamplesInput.addEventListener('change', () => this.clampDriverSamplesInput());
        this.driverRunBtn.addEventListener('click', () => this.executeDriverAction());

        this.driverOutputEl.innerText = 'Ready.';
        if (this.liveDriverActionEl) {
            this.liveDriverActionEl.innerText = this.getDriverAction();
        }
        if (this.liveDriverResultEl) {
            this.liveDriverResultEl.innerText = 'Ready.';
        }
        this.clampDriverSamplesInput();
        this.updateDriverAutoRun();
    }

    private updateDriverAutoRun(): void {
        if (this.driverAutoTimer !== null) {
            window.clearInterval(this.driverAutoTimer);
            this.driverAutoTimer = null;
        }

        const mode = this.getDriverRefreshMode();
        if (mode === 'off') {
            return;
        }

        const intervalMs = mode === '1hz' ? 1000 : 200;
        this.driverAutoTimer = window.setInterval(() => this.executeDriverAction(), intervalMs);
    }

    private getDriverRefreshMode(): DriverRefreshMode {
        const mode = this.driverRefreshModeSelect.value;
        if (mode === 'off' || mode === '1hz' || mode === '5hz') {
            return mode;
        }
        return 'off';
    }

    private getDriverAction(): DriverAction {
        const action = this.driverActionSelect.value;
        if (action === 'rms' || action === 'true_rms') {
            return action;
        }
        return 'rms';
    }

    private getDriverSamples(): number {
        return 8000;
    }

    private clampDriverSamplesInput(): void {
        this.driverSamplesInput.value = this.getDriverSamples().toString();
    }

    private writeDriverOutput(text: string): void {
        const ts = new Date().toLocaleTimeString();
        this.driverOutputEl.innerText = '[' + ts + '] ' + text;
        if (this.liveDriverResultEl) {
            this.liveDriverResultEl.innerText = text;
        }
    }

    private executeDriverAction(): void {
        const action = this.getDriverAction();
        if (this.liveDriverActionEl) {
            this.liveDriverActionEl.innerText = action;
        }
        if (this.driverRequestInFlight) {
            return;
        }

        const n = this.getDriverSamples();
        this.driverRequestInFlight = true;
        const finalize = () => {
            this.driverRequestInFlight = false;
        };

        if (action === 'rms') {
            this.connector.getAdcRmsData(n, (rms0, rms1) => {
                this.writeDriverOutput(
                    'RMS (' + n.toString() + ' samples): IN1=' + rms0.toFixed(4) +
                    ', IN2=' + rms1.toFixed(4) +
                    ' counts'
                );
                finalize();
            });
            return;
        }

        if (action === 'true_rms') {
            this.connector.getAdcTrueRmsData((rms0, rms1, nPos, nNeg) => {
                this.writeDriverOutput(
                    'True RMS (8000 samples, +4000/-4000): IN1=' + rms0.toFixed(4) +
                    ', IN2=' + rms1.toFixed(4) +
                    ' counts, N+=' + nPos.toString() +
                    ', N-=' + nNeg.toString()
                );
                finalize();
            });
            return;
        }

        this.writeDriverOutput('Unknown driver action: ' + action);
        finalize();
    }

    // ----------------------------
    // Module: Workflow Panel UI
    // ----------------------------
    private bindWorkflowControls(document: Document): void {
        this.phase2InputSelect = <HTMLSelectElement>document.getElementById('phase2-input');
        this.phase3FeatureSelect = <HTMLSelectElement>document.getElementById('phase3-feature');
        this.phase4CalibrationSelect = <HTMLSelectElement>document.getElementById('phase4-calibration');
        this.phase5SmoothingSelect = <HTMLSelectElement>document.getElementById('phase5-smoothing');
        this.phase2SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase2-save');
        this.phase3SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase3-save');
        this.phase4SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase4-save');
        this.phase5SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase5-save');

        this.rmsWindowSamplesInput = <HTMLInputElement>document.getElementById('rms-window-samples');
        this.smoothingWindowInput = <HTMLInputElement>document.getElementById('smoothing-window');
        this.smoothingAlphaInput = <HTMLInputElement>document.getElementById('smoothing-alpha');
        this.divisionEpsilonInput = <HTMLInputElement>document.getElementById('division-epsilon');
        this.divisionClipInput = <HTMLInputElement>document.getElementById('division-clip');
        this.plotMaxPointsInput = <HTMLInputElement>document.getElementById('plot-max-points');
        this.smoothingWindowGroup = <HTMLElement>document.getElementById('smoothing-window-group');
        this.smoothingAlphaGroup = <HTMLElement>document.getElementById('smoothing-alpha-group');
        this.divisionEpsilonGroup = <HTMLElement>document.getElementById('division-epsilon-group');
        this.divisionClipGroup = <HTMLElement>document.getElementById('division-clip-group');

        this.formulaSourceEl = document.getElementById('formula-source');
        this.formulaInputEl = document.getElementById('formula-input');
        this.formulaFeatureEl = document.getElementById('formula-feature');
        this.formulaCalibrationEl = document.getElementById('formula-calibration');
        this.formulaSmoothingEl = document.getElementById('formula-smoothing');
        this.formulaPlotEl = document.getElementById('formula-plot');

        this.phase2SaveBtn.addEventListener('click', () => this.applyPhase2Settings());
        this.phase3SaveBtn.addEventListener('click', () => this.applyPhase3Settings());
        this.phase4SaveBtn.addEventListener('click', () => this.applyPhase4Settings());
        this.phase5SaveBtn.addEventListener('click', () => this.applyPhase5Settings());
        this.plotMaxPointsInput.addEventListener('change', () => this.updateFormulaAndParameterVisibility());
    }

    private applyPhase2Settings(): void {
        const mode = this.phase2InputSelect.value;
        if (mode === 'in1' || mode === 'in2' || mode === 'in1_minus_in2' || mode === 'in1_div_in2') {
            this.appliedPhase2Input = mode;
        }

        this.appliedDivisionEpsilon = this.clampDivisionEpsilon(this.parseNumber(this.divisionEpsilonInput.value, this.appliedDivisionEpsilon));
        this.appliedDivisionClip = this.clampDivisionClip(this.parseNumber(this.divisionClipInput.value, this.appliedDivisionClip));

        this.phase2InputSelect.value = this.appliedPhase2Input;
        this.divisionEpsilonInput.value = this.appliedDivisionEpsilon.toFixed(6);
        this.divisionClipInput.value = this.appliedDivisionClip.toFixed(3);

        this.updateFormulaAndParameterVisibility();
    }

    private applyPhase3Settings(): void {
        const mode = this.phase3FeatureSelect.value;
        if (mode === 'rms' || mode === 'true_rms' || mode === 'iq_in2') {
            this.appliedPhase3Feature = mode;
        }

        this.appliedWindowSamples = this.clampWindowSamples(this.parseNumber(this.rmsWindowSamplesInput.value, this.appliedWindowSamples));
        this.phase3FeatureSelect.value = this.appliedPhase3Feature;
        this.rmsWindowSamplesInput.value = this.appliedWindowSamples.toString();

        this.updateFormulaAndParameterVisibility();
    }

    private applyPhase4Settings(): void {
        const mode = this.phase4CalibrationSelect.value;
        if (mode === 'off' || mode === 'tare_only' || mode === 'scale_only' || mode === 'tare_scale') {
            this.appliedPhase4Calibration = mode;
        }

        this.phase4CalibrationSelect.value = this.appliedPhase4Calibration;
        this.updateFormulaAndParameterVisibility();
    }

    private applyPhase5Settings(): void {
        const mode = this.phase5SmoothingSelect.value;
        if (mode === 'none' || mode === 'moving_average' || mode === 'ema') {
            this.appliedPhase5Smoothing = mode;
        }

        this.appliedSmoothingWindow = this.clampSmoothingWindow(this.parseNumber(this.smoothingWindowInput.value, this.appliedSmoothingWindow));
        this.appliedSmoothingAlpha = this.clampSmoothingAlpha(this.parseNumber(this.smoothingAlphaInput.value, this.appliedSmoothingAlpha));

        this.phase5SmoothingSelect.value = this.appliedPhase5Smoothing;
        this.smoothingWindowInput.value = this.appliedSmoothingWindow.toString();
        this.smoothingAlphaInput.value = this.appliedSmoothingAlpha.toFixed(2);

        this.resetSmoothingState();
        this.updateFormulaAndParameterVisibility();
    }

    // ----------------------------
    // Module: Scale Panel UI
    // ----------------------------
    private bindScalePanel(document: Document): void {
        this.weightEl = <HTMLElement>document.getElementById('weight-value');
        this.weightUnitEl = <HTMLElement>document.getElementById('weight-unit');
        this.scaleTareFeatureEl = <HTMLElement>document.getElementById('scale-tare-feature');

        this.liveFeatureFormulaEl = <HTMLElement>document.getElementById('live-feature-formula');
        this.liveCalibrationFormulaEl = <HTMLElement>document.getElementById('live-calibration-formula');
        this.liveCalibrationEvalEl = <HTMLElement>document.getElementById('live-calibration-eval');
        this.liveSourceEl = <HTMLElement>document.getElementById('live-source');
        this.liveDriverActionEl = <HTMLElement>document.getElementById('live-driver-action');
        this.liveDriverResultEl = <HTMLElement>document.getElementById('live-driver-result');
        this.liveInputEl = <HTMLElement>document.getElementById('live-input');
        this.liveAdcFormulaEl = <HTMLElement>document.getElementById('live-adc-formula');
        this.liveSourceClampEl = <HTMLElement>document.getElementById('live-source-clamp');
        this.liveDacFormulaEl = <HTMLElement>document.getElementById('live-dac-formula');
        this.liveInputFormulaEl = <HTMLElement>document.getElementById('live-input-formula');
        this.liveInputGuardEl = <HTMLElement>document.getElementById('live-input-guard');
        this.liveLockinParamsEl = <HTMLElement>document.getElementById('live-lockin-params');
        this.liveSmoothingFormulaEl = <HTMLElement>document.getElementById('live-smoothing-formula');
        this.liveSmoothingEvalEl = <HTMLElement>document.getElementById('live-smoothing-eval');
        this.livePlotDecimationEl = <HTMLElement>document.getElementById('live-plot-decimation');
        this.liveFeatureRawEl = <HTMLElement>document.getElementById('live-feature-raw');
        this.liveFeatureUsedEl = <HTMLElement>document.getElementById('live-feature-used');
        this.liveFeatureTareEl = <HTMLElement>document.getElementById('live-feature-tare');
        this.liveKFactorEl = <HTMLElement>document.getElementById('live-k-factor');
        this.liveWeightRawEl = <HTMLElement>document.getElementById('live-weight-raw');
        this.liveWeightUsedEl = <HTMLElement>document.getElementById('live-weight-used');
        this.liveRmsIn12El = <HTMLElement>document.getElementById('live-rms-in12');
        this.liveRmsOut12El = <HTMLElement>document.getElementById('live-rms-out12');
        this.liveIqIEl = <HTMLElement>document.getElementById('live-iq-i');
        this.liveIqQEl = <HTMLElement>document.getElementById('live-iq-q');
        this.liveIqAEl = <HTMLElement>document.getElementById('live-iq-a');
        this.liveIqARefEl = <HTMLElement>document.getElementById('live-iq-aref');
        this.liveIqANormEl = <HTMLElement>document.getElementById('live-iq-anorm');
        this.liveIqRefPhaseEl = <HTMLElement>document.getElementById('live-iq-ref-phase');

        this.calibrationInput = <HTMLInputElement>document.getElementById('input-calibration');
        this.calibrationFactor = this.parseNumber(this.calibrationInput.value, this.calibrationFactor);

        this.calibrationSaveBtn = <HTMLButtonElement>document.getElementById('btn-save-scale');
        this.calibrationSaveBtn.addEventListener('click', () => {
            this.calibrationFactor = this.parseNumber(this.calibrationInput.value, this.calibrationFactor);
        });

        this.tareBtn = <HTMLButtonElement>document.getElementById('btn-tare');
        this.tareBtn.addEventListener('click', () => {
            const mode = this.getPhase4CalibrationMode();
            if (!this.usesTare(mode)) {
                return;
            }
            this.featureTare = this.featureTraceValue;
            this.scaleTareFeatureEl.innerText = this.featureTare.toFixed(4);
        });

        this.scaleTareFeatureEl.innerText = this.featureTare.toFixed(4);
        this.updateCalibrationUiState();
        this.liveDriverActionEl.innerText = this.getDriverAction();
        this.liveDriverResultEl.innerText = this.driverOutputEl ? this.driverOutputEl.innerText : 'Ready.';
    }

    // ----------------------------
    // Module: Formula + Live Trace
    // ----------------------------
    private applyPhase1Settings(): void {
        const signalType = 1; // Sine only
        const frequencyCmd = this.parseSignalSourceFrequencyHz(this.frequencyInput.value, this.signalSourceDefaultFrequencyHz);
        const outputChannel = Number(this.outputChannelSelect.value);
        const amplitudeCmdVpp = this.parseSignalSourceAmplitudeVpp(this.amplitudeInput.value, this.signalSourceDefaultAmplitudeVpp);
        const frequencyEff = this.clampFrequencyHz(frequencyCmd);
        const amplitudeEffVpp = this.clampAmplitudeVpp(amplitudeCmdVpp);
        const amplitudeEffVpk = amplitudeEffVpp / 2.0;

        this.appliedOutputChannel = Math.max(0, Math.min(2, Math.round(outputChannel)));
        this.appliedFrequencyHz = frequencyEff;
        this.appliedAmplitudeVpp = amplitudeEffVpp;

        this.connector.setFunction(signalType, this.appliedFrequencyHz);
        this.connector.setOutputChannel(this.appliedOutputChannel);
        this.connector.setAmplitude(amplitudeEffVpk);

        this.frequencyInput.value = this.formatFrequencyInputValue(this.appliedFrequencyHz);
        this.amplitudeInput.value = this.formatAmplitudeInputValue(this.appliedAmplitudeVpp);
        this.outputChannelSelect.value = this.appliedOutputChannel.toString();

        this.liveSourceEl.innerText = 'Sine -> ' + this.getOutputChannelLabel(this.appliedOutputChannel);
        this.liveSourceClampEl.innerText =
            'f_cmd=' + frequencyCmd.toFixed(1) +
            ' -> f_eff=' + this.appliedFrequencyHz.toFixed(1) +
            ' Hz, A_cmd=' + amplitudeCmdVpp.toFixed(3) +
            ' -> A_eff=' + this.appliedAmplitudeVpp.toFixed(3) + ' Vpp';
        this.liveDacFormulaEl.innerText =
            'sample14 = round(sin(2*pi*phase) * (2^14/2.1) * (A_vpk/10)), A_vpk=' +
            amplitudeEffVpk.toFixed(3) + ' Vpk';
    }

    private updateFormulaAndParameterVisibility(): void {
        this.applyDriverDecimationSettings();

        const inputMode = this.getPhase2InputMode();
        const featureMethod = this.getPhase3FeatureMethod();
        const calibrationMode = this.getPhase4CalibrationMode();
        const smoothingMethod = this.getPhase5SmoothingMethod();
        const divisionEpsilon = this.getDivisionEpsilon();
        const divisionClip = this.getDivisionClip();
        const plotMaxPoints = this.getPlotMaxPoints();
        const plotDecimation = this.getPlotDecimationMethod();

        const sourceFormula = 'f_eff = clamp(f_cmd, 1, 10e6), A_eff_vpp = clamp(A_cmd_vpp, 0, 2)';
        if (this.formulaSourceEl) {
            this.formulaSourceEl.innerText = sourceFormula;
        }
        if (this.formulaPlotEl) {
            this.formulaPlotEl.innerText =
                'Method=' + this.getPlotDecimationMethodLabel(plotDecimation) +
                ', N_plot_max=' + plotMaxPoints.toString() +
                ', X=running time (us)';
        }
        this.livePlotDecimationEl.innerText =
            'Method=' + this.getPlotDecimationMethodLabel(plotDecimation) +
            ', X=running time';

        const inputFormula = featureMethod === 'iq_in2'
            ? 'x[i] = IN1_V[i] - mean(IN1), r[i] = IN2_V[i] - mean(IN2), ref from IN2'
            : this.getPhase2InputFormula(inputMode, divisionEpsilon, divisionClip);
        if (this.formulaInputEl) {
            this.formulaInputEl.innerText = inputFormula;
        }
        this.liveAdcFormulaEl.innerText = 'IN_V = ADC_code / 819.2 (14-bit signed, approx +/-10 V)';
        this.liveInputFormulaEl.innerText = inputFormula;
        if (featureMethod === 'iq_in2') {
            this.liveInputGuardEl.innerText = 'IN2 -> phase estimate -> refI/refQ (90 deg)';
        } else if (inputMode === 'in1_div_in2') {
            this.liveInputGuardEl.innerText =
                'den_safe = sign(IN2_V) * max(|IN2_V|, ' +
                divisionEpsilon.toFixed(6) +
                '), clip = +/-' +
                divisionClip.toFixed(3);
        } else {
            this.liveInputGuardEl.innerText = 'Off';
        }

        let featureFormula = 'RMS = sqrt((1/N) * sum(x^2)), x from Phase-2 input';
        if (featureMethod === 'true_rms') {
            featureFormula = 'True RMS = sqrt((sum(x_pos^2) + sum(x_neg^2)) / (N_pos + N_neg)), N_pos=4000, N_neg=4000';
        } else if (featureMethod === 'iq_in2') {
            featureFormula =
                'I=(2/N)sum((IN1-mean(IN1))*refI), Q=(2/N)sum((IN1-mean(IN1))*refQ), ' +
                'A=sqrt(I^2+Q^2), A_norm=A/max(A_ref,eps)';
        }
        if (this.formulaFeatureEl) {
            this.formulaFeatureEl.innerText = featureFormula;
        }
        this.liveFeatureFormulaEl.innerText = featureFormula;

        let calibrationFormula = 'Weight = Feature';
        if (calibrationMode === 'off') {
            calibrationFormula = 'Weight = Feature';
        } else if (calibrationMode === 'tare_only') {
            calibrationFormula = 'Weight = Feature - Feature_tare';
        } else if (calibrationMode === 'scale_only') {
            calibrationFormula = 'Weight = Feature * k';
        } else {
            calibrationFormula = 'Weight = (Feature - Feature_tare) * k';
        }
        if (this.formulaCalibrationEl) {
            this.formulaCalibrationEl.innerText = calibrationFormula;
        }
        this.liveCalibrationFormulaEl.innerText = calibrationFormula;
        this.updateCalibrationUiState();

        this.smoothingWindowGroup.style.display = 'none';
        this.smoothingAlphaGroup.style.display = 'none';
        this.divisionEpsilonGroup.style.display = 'none';
        this.divisionClipGroup.style.display = 'none';

        if (featureMethod !== 'iq_in2' && inputMode === 'in1_div_in2') {
            this.divisionEpsilonGroup.style.display = 'block';
            this.divisionClipGroup.style.display = 'block';
        }

        if (featureMethod === 'true_rms') {
            this.liveLockinParamsEl.innerText = 'N+=4000, N-=4000 around zero crossing';
        } else if (featureMethod === 'iq_in2') {
            this.liveLockinParamsEl.innerText =
                'f_ref=' + this.appliedFrequencyHz.toFixed(1) +
                ' Hz, IN2 phase-locked, eps=' + this.iqNormalizationEpsilon.toFixed(6);
        } else {
            this.liveLockinParamsEl.innerText = 'Off';
        }

        if (smoothingMethod === 'none') {
            const smoothingFormula = 'Off';
            if (this.formulaSmoothingEl) {
                this.formulaSmoothingEl.innerText = smoothingFormula;
            }
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
        } else if (smoothingMethod === 'moving_average') {
            const smoothingFormula = 'y[n] = (1/M) * sum_{k=0..M-1}(x[n-k])';
            if (this.formulaSmoothingEl) {
                this.formulaSmoothingEl.innerText = smoothingFormula;
            }
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
            this.smoothingWindowGroup.style.display = 'block';
        } else {
            const smoothingFormula = 'y[n] = alpha * x[n] + (1 - alpha) * y[n-1]';
            if (this.formulaSmoothingEl) {
                this.formulaSmoothingEl.innerText = smoothingFormula;
            }
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
            this.smoothingAlphaGroup.style.display = 'block';
        }
        this.liveSmoothingEvalEl.innerText = this.lastSmoothingEvaluationText;
    }

    // ----------------------------
    // Module: Runtime Loops
    // ----------------------------
    private updateDiagnosticsPlot(): void {
        this.connector.getDecimatedDataChannel(0, (in1Indexed) => {
            this.connector.getDecimatedDataChannel(1, (in2Indexed) => {
                this.connector.getDecimatedDacDataChannel(0, (out1Indexed) => {
                    this.connector.getDecimatedDacDataChannel(1, (out2Indexed) => {
                        const frameStartUs = this.runningPlotFrameStartUs;
                        const frameSpanUs = this.sampleIndexToMicroseconds(Math.max(1, this.adcRawSize - 1));
                        const frameEndUs = frameStartUs + frameSpanUs;

                        const in1 = this.sampleIndexPointsToTimeUs(in1Indexed, frameStartUs);
                        const in2 = this.sampleIndexPointsToTimeUs(in2Indexed, frameStartUs);
                        this.latestIn1Plot = in1;
                        this.latestIn2Plot = in2;
                        this.latestIn1 = this.extractY(in1);
                        this.latestIn2 = this.extractY(in2);

                        this.out1Plot = this.sampleIndexPointsToTimeUs(out1Indexed, frameStartUs);
                        this.out2Plot = this.sampleIndexPointsToTimeUs(out2Indexed, frameStartUs);
                        this.out1Cache = this.extractY(this.out1Plot);
                        this.out2Cache = this.extractY(this.out2Plot);

                        const featureSeries = this.buildConstantSeries(this.latestIn1.length, this.featureTraceValue);
                        const featureSeriesNeg = this.buildConstantSeries(this.latestIn1.length, -this.featureTraceValue);
                        const weightSeries = this.buildConstantSeries(this.latestIn1.length, this.weightTraceValue);
                        const featurePlot = this.mapSeriesToReferenceX(this.latestIn1Plot, featureSeries);
                        const featurePlotNeg = this.mapSeriesToReferenceX(this.latestIn1Plot, featureSeriesNeg);
                        const weightPlot = this.mapSeriesToReferenceX(this.latestIn1Plot, weightSeries);
                        const adcStep = Math.max(1, this.adcDecimationStep);
                        const dacStep = Math.max(1, this.dacDecimationStep);

                        const range: jquery.flot.range = {
                            from: frameStartUs,
                            to: frameEndUs
                        };
                        this.lastPlotRangeUs = range;

                        const plotMaxPoints = this.getPlotMaxPoints();
                        const plotDecimation = this.getPlotDecimationMethod();
                        let nPlotEstimate = this.latestIn1Plot.length;
                        let series: jquery.flot.dataSeries[] = [];
                        const featureLabel = this.getFeatureSeriesLabel();
                        const allSeries: {[key: string]: jquery.flot.dataSeries} = {
                            in1: { label: 'IN1', data: this.latestIn1Plot, color: '#1f77b4' },
                            in2: { label: 'IN2', data: this.latestIn2Plot, color: '#ff7f0e' },
                            out1: { label: 'OUT1', data: this.out1Plot, color: '#2ca02c' },
                            out2: { label: 'OUT2', data: this.out2Plot, color: '#d62728' },
                            weight: { label: 'Weight', data: weightPlot, color: '#8c564b' }
                        };

                        for (const key in allSeries) {
                            if (!this.curveVisible[key]) {
                                continue;
                            }
                            series.push(allSeries[key]);
                        }

                        if (this.curveVisible.feature) {
                            series.push({ label: featureLabel + ' (+)', data: featurePlot, color: '#9467bd' });
                            series.push({ label: featureLabel + ' (-)', data: featurePlotNeg, color: '#9467bd' });
                        }

                        this.livePlotDecimationEl.innerText =
                            'Method=' + this.getPlotDecimationMethodLabel(plotDecimation) +
                            ', N_raw=' + this.adcRawSize.toString() +
                            ', step_drv=' + adcStep.toString() +
                            ', step_dac=' + dacStep.toString() +
                            ', N_plot_max=' + plotMaxPoints.toString() +
                            ', N_plot=' + nPlotEstimate.toString() +
                            ', X=running time';

                        this.plotBasics.setRangeX(range.from, range.to);
                        this.plotBasics.redrawSeries(series, range, () => {
                            requestAnimationFrame(() => this.updateDiagnosticsPlot());
                        });

                        this.liveRmsIn12El.innerText =
                            this.computeRms(this.latestIn1).toFixed(4) + ' / ' + this.computeRms(this.latestIn2).toFixed(4);
                        this.liveRmsOut12El.innerText =
                            this.computeRms(this.out1Cache).toFixed(4) + ' / ' + this.computeRms(this.out2Cache).toFixed(4);
                        this.runningPlotFrameStartUs = frameEndUs;
                    });
                });
            });
        });
    }

    private updateScaleLoop(): void {
        this.connector.getAdcDualData((in1, in2) => {
            const result = this.runPipeline(in1, in2, this.out1Cache, this.out2Cache);
            this.featureTraceValue = result.featureUsed;
            this.weightTraceValue = result.weightUsed;

            this.weightEl.innerText = result.weightUsed.toFixed(3);
            this.scaleTareFeatureEl.innerText = this.featureTare.toFixed(4);

            this.liveInputEl.innerText = this.getPhase3FeatureMethod() === 'iq_in2'
                ? 'IN1 (IQ demod with IN2 ref)'
                : this.getPhase2InputLabel(this.getPhase2InputMode());
            this.liveFeatureRawEl.innerText = result.featureRaw.toFixed(4);
            this.liveFeatureUsedEl.innerText = result.featureUsed.toFixed(4);
            this.liveFeatureTareEl.innerText = this.featureTare.toFixed(4);
            this.liveKFactorEl.innerText = this.calibrationFactor.toFixed(6);
            this.liveWeightRawEl.innerText = result.weightRaw.toFixed(4);
            this.liveWeightUsedEl.innerText = result.weightUsed.toFixed(4);
            this.liveIqIEl.innerText = result.iqI.toFixed(4);
            this.liveIqQEl.innerText = result.iqQ.toFixed(4);
            this.liveIqAEl.innerText = result.iqA.toFixed(4);
            this.liveIqARefEl.innerText = result.iqARef.toFixed(4);
            this.liveIqANormEl.innerText = result.iqANorm.toFixed(4);
            this.liveIqRefPhaseEl.innerText = result.iqRefPhaseDeg.toFixed(2) + ' deg';
            this.liveCalibrationEvalEl.innerText = this.buildCalibrationEvaluation(result.featureUsed, this.getPhase4CalibrationMode());
            this.liveSmoothingEvalEl.innerText = this.lastSmoothingEvaluationText;
            setTimeout(() => {
                this.updateScaleLoop();
            }, 100);
        });
    }

    // ----------------------------
    // Module: Signal Processing Core
    // ----------------------------
    private runPipeline(in1: number[], in2: number[], out1: number[], out2: number[]): PipelineResult {
        const rmsIn1 = this.computeRms(in1);
        const rmsIn2 = this.computeRms(in2);
        const rmsOut1 = this.computeRms(out1);
        const rmsOut2 = this.computeRms(out2);

        const feature = this.computeFeature(in1, in2);
        const featureRaw = feature.feature;
        const featureUsed = feature.feature;

        const calibrationMode = this.getPhase4CalibrationMode();
        const weightRaw = this.applyCalibration(featureUsed, calibrationMode);
        const weightUsed = this.applySmoothing(weightRaw);

        return {
            featureRaw,
            featureUsed,
            weightRaw,
            weightUsed,
            rmsIn1,
            rmsIn2,
            rmsOut1,
            rmsOut2,
            iqI: feature.iqI,
            iqQ: feature.iqQ,
            iqA: feature.iqA,
            iqARef: feature.iqARef,
            iqANorm: feature.iqANorm,
            iqRefPhaseDeg: feature.iqRefPhaseDeg
        };
    }

    private computeFeature(in1: number[], in2: number[]): FeatureComputationResult {
        const n = Math.min(in1.length, in2.length);
        if (n <= 0) {
            return {
                feature: 0,
                iqI: 0,
                iqQ: 0,
                iqA: 0,
                iqARef: 0,
                iqANorm: 0,
                iqRefPhaseDeg: 0
            };
        }

        const count = Math.max(1, Math.min(this.getWindowSamples(), n));
        const start = n - count;
        const method = this.getPhase3FeatureMethod();

        if (method === 'iq_in2') {
            return this.computeIqFeatureIn2(in1, in2, start, count);
        }

        const x = this.getInputSeriesForWindow(in1, in2, start, count, this.getPhase2InputMode());

        if (method === 'true_rms') {
            const value = this.computeTrueRmsBalanced(x, 4000);
            return {
                feature: value,
                iqI: 0,
                iqQ: 0,
                iqA: 0,
                iqARef: 0,
                iqANorm: 0,
                iqRefPhaseDeg: 0
            };
        }
        const value = this.computeRms(x);
        return {
            feature: value,
            iqI: 0,
            iqQ: 0,
            iqA: 0,
            iqARef: 0,
            iqANorm: 0,
            iqRefPhaseDeg: 0
        };
    }

    private computeIqFeatureIn2(in1: number[], in2: number[], start: number, count: number): FeatureComputationResult {
        const twoPiFOverFs = 2.0 * Math.PI * this.appliedFrequencyHz / this.sampleRateHz;
        const meanIn1 = this.computeMean(in1, start, count);
        const meanIn2 = this.computeMean(in2, start, count);

        let accSin = 0;
        let accCos = 0;
        for (let i = 0; i < count; i++) {
            const idx = start + i;
            const t = i;
            const theta = twoPiFOverFs * t;
            const r = in2[idx] - meanIn2;
            accSin += r * Math.sin(theta);
            accCos += r * Math.cos(theta);
        }

        const refPhase = Math.atan2(accCos, accSin);
        const scale = 2.0 / Math.max(1, count);

        let accI = 0;
        let accQ = 0;
        let accIRef = 0;
        let accQRef = 0;
        for (let i = 0; i < count; i++) {
            const idx = start + i;
            const t = i;
            const theta = twoPiFOverFs * t + refPhase;
            const refI = Math.sin(theta);
            const refQ = Math.cos(theta);
            const x = in1[idx] - meanIn1;
            const r = in2[idx] - meanIn2;

            accI += x * refI;
            accQ += x * refQ;
            accIRef += r * refI;
            accQRef += r * refQ;
        }

        const iqI = scale * accI;
        const iqQ = scale * accQ;
        const iqA = Math.sqrt(iqI * iqI + iqQ * iqQ);
        const iqIRef = scale * accIRef;
        const iqQRef = scale * accQRef;
        const iqARef = Math.sqrt(iqIRef * iqIRef + iqQRef * iqQRef);
        const iqANorm = iqA / Math.max(iqARef, this.iqNormalizationEpsilon);

        return {
            feature: iqANorm,
            iqI,
            iqQ,
            iqA,
            iqARef,
            iqANorm,
            iqRefPhaseDeg: refPhase * 180.0 / Math.PI
        };
    }

    private computeMean(values: number[], start: number, count: number): number {
        if (count <= 0) {
            return 0;
        }
        let sum = 0;
        for (let i = 0; i < count; i++) {
            sum += values[start + i];
        }
        return sum / count;
    }

    private getInputSeriesForWindow(in1: number[], in2: number[], start: number, count: number, mode: Phase2Input): number[] {
        const x: number[] = new Array(count);
        const eps = this.getDivisionEpsilon();
        const clip = this.getDivisionClip();

        for (let i = 0; i < count; i++) {
            const idx = start + i;
            if (mode === 'in1') {
                x[i] = in1[idx];
            } else if (mode === 'in2') {
                x[i] = in2[idx];
            } else if (mode === 'in1_div_in2') {
                const denBase = in2[idx];
                const den = Math.abs(denBase) >= eps ? denBase : (denBase >= 0 ? eps : -eps);
                let ratio = in1[idx] / den;
                if (ratio > clip) {
                    ratio = clip;
                } else if (ratio < -clip) {
                    ratio = -clip;
                }
                x[i] = ratio;
            } else {
                x[i] = in1[idx] - in2[idx];
            }
        }

        return x;
    }

    private buildInputSeriesForMode(in1: number[], in2: number[], mode: Phase2Input): number[] {
        const n = Math.min(in1.length, in2.length);
        if (n <= 0) {
            return [];
        }
        return this.getInputSeriesForWindow(in1, in2, 0, n, mode);
    }

    // ----------------------------
    // Module: Post-Processing (Phase 5)
    // ----------------------------
    private applySmoothing(weightRaw: number): number {
        const method = this.getPhase5SmoothingMethod();

        if (method === 'none') {
            this.lastSmoothingEvaluationText = 'Off: y = x = ' + weightRaw.toFixed(4);
            return weightRaw;
        }

        if (method === 'moving_average') {
            const m = this.getSmoothingWindow();
            this.smoothingHistory.push(weightRaw);
            while (this.smoothingHistory.length > m) {
                this.smoothingHistory.shift();
            }

            let sum = 0;
            for (let i = 0; i < this.smoothingHistory.length; i++) {
                sum += this.smoothingHistory[i];
            }
            const y = sum / this.smoothingHistory.length;
            this.lastSmoothingEvaluationText =
                'y = (1/' +
                this.smoothingHistory.length.toString() +
                ') * sum = ' +
                y.toFixed(4);
            return y;
        }

        const alpha = this.getSmoothingAlpha();
        if (!this.emaInitialized) {
            this.emaWeight = weightRaw;
            this.emaInitialized = true;
            this.lastSmoothingEvaluationText = 'EMA init: y = x = ' + weightRaw.toFixed(4);
        } else {
            const prev = this.emaWeight;
            this.emaWeight = alpha * weightRaw + (1 - alpha) * this.emaWeight;
            this.lastSmoothingEvaluationText =
                'y = ' +
                alpha.toFixed(3) +
                ' * ' +
                weightRaw.toFixed(4) +
                ' + ' +
                (1 - alpha).toFixed(3) +
                ' * ' +
                prev.toFixed(4) +
                ' = ' +
                this.emaWeight.toFixed(4);
        }
        return this.emaWeight;
    }

    private resetSmoothingState(): void {
        this.smoothingHistory = [];
        this.emaWeight = 0;
        this.emaInitialized = false;
        this.lastSmoothingEvaluationText = 'Off';
    }

    // ----------------------------
    // Module: Workflow Selection + Parameters
    // ----------------------------
    private getPhase2InputMode(): Phase2Input {
        return this.appliedPhase2Input;
    }

    private getPhase3FeatureMethod(): Phase3Feature {
        return this.appliedPhase3Feature;
    }

    private getPhase4CalibrationMode(): Phase4Calibration {
        return this.appliedPhase4Calibration;
    }

    private getPhase5SmoothingMethod(): Phase5Smoothing {
        return this.appliedPhase5Smoothing;
    }

    private getPlotDecimationMethod(): PlotDecimationMethod {
        const method = this.plotDecimationMethodSelect.value;
        if (method === 'none' || method === 'stride' || method === 'minmax' || method === 'mean') {
            return method;
        }
        return 'stride';
    }

    private applyDriverDecimationSettings(): void {
        const method = this.getPlotDecimationMethod();
        const maxPoints = this.getPlotMaxPoints();
        const modeValue = this.getDriverDecimationModeValue(method);

        this.connector.setPlotDecimation(modeValue, maxPoints);
        this.connector.getAdcSize((size) => {
            this.adcRawSize = Math.max(1, Math.round(size));
        });
        this.connector.getDacSize((size) => {
            this.dacRawSize = Math.max(1, Math.round(size));
        });
        this.connector.getAdcDecimationStep((step) => {
            this.adcDecimationStep = Math.max(1, Math.round(step));
        });
        this.connector.getDacDecimationStep((step) => {
            this.dacDecimationStep = Math.max(1, Math.round(step));
        });
    }

    private getDriverDecimationModeValue(method: PlotDecimationMethod): number {
        if (method === 'none') return 0;
        if (method === 'stride') return 1;
        if (method === 'minmax') return 2;
        return 3;
    }

    // ----------------------------
    // Module: Calibration Mapping (Phase 4)
    // ----------------------------
    private usesTare(mode: Phase4Calibration): boolean {
        return mode === 'tare_only' || mode === 'tare_scale';
    }

    private usesScaleFactor(mode: Phase4Calibration): boolean {
        return mode === 'scale_only' || mode === 'tare_scale';
    }

    private applyCalibration(featureUsed: number, mode: Phase4Calibration): number {
        if (mode === 'off') {
            return featureUsed;
        }
        if (mode === 'tare_only') {
            return featureUsed - this.featureTare;
        }
        if (mode === 'scale_only') {
            return featureUsed * this.calibrationFactor;
        }
        return (featureUsed - this.featureTare) * this.calibrationFactor;
    }

    private buildCalibrationEvaluation(featureUsed: number, mode: Phase4Calibration): string {
        if (mode === 'off') {
            return 'Weight = Feature = ' + featureUsed.toFixed(4);
        }
        if (mode === 'tare_only') {
            const result = featureUsed - this.featureTare;
            return 'Weight = ' + featureUsed.toFixed(4) + ' - ' + this.featureTare.toFixed(4) + ' = ' + result.toFixed(4);
        }
        if (mode === 'scale_only') {
            const result = featureUsed * this.calibrationFactor;
            return 'Weight = ' + featureUsed.toFixed(4) + ' * ' + this.calibrationFactor.toFixed(6) + ' = ' + result.toFixed(4);
        }
        const result = (featureUsed - this.featureTare) * this.calibrationFactor;
        return 'Weight = (' + featureUsed.toFixed(4) + ' - ' + this.featureTare.toFixed(4) + ') * ' + this.calibrationFactor.toFixed(6) + ' = ' + result.toFixed(4);
    }

    private updateCalibrationUiState(): void {
        const mode = this.getPhase4CalibrationMode();
        const tareEnabled = this.usesTare(mode);
        const scaleEnabled = this.usesScaleFactor(mode);

        this.tareBtn.disabled = !tareEnabled;
        this.calibrationInput.disabled = !scaleEnabled;
        this.calibrationSaveBtn.disabled = !scaleEnabled;
        this.weightUnitEl.innerText = scaleEnabled ? 'kg' : 'feature';
    }

    // ----------------------------
    // Module: Numeric Parameter Readers
    // ----------------------------
    private getWindowSamples(): number {
        return this.appliedWindowSamples;
    }

    private getSmoothingWindow(): number {
        return this.appliedSmoothingWindow;
    }

    private getSmoothingAlpha(): number {
        return this.appliedSmoothingAlpha;
    }

    private getPlotMaxPoints(): number {
        const parsed = this.parseNumber(this.plotMaxPointsInput.value, 2048);
        return Math.max(128, Math.min(20000, Math.round(parsed)));
    }

    private getDivisionEpsilon(): number {
        return this.appliedDivisionEpsilon;
    }

    private getDivisionClip(): number {
        return this.appliedDivisionClip;
    }

    // ----------------------------
    // Module: Formula Builder + Clamp Rules
    // ----------------------------
    private getPhase2InputFormula(mode: Phase2Input, epsilon: number, clip: number): string {
        if (mode === 'in1') {
            return 'x[i] = IN1_V[i]';
        }
        if (mode === 'in2') {
            return 'x[i] = IN2_V[i]';
        }
        if (mode === 'in1_minus_in2') {
            return 'x[i] = IN1_V[i] - IN2_V[i]';
        }
        return (
            'x[i] = clip(IN1_V[i] / den_safe[i], +/-' +
            clip.toFixed(3) +
            '), den_safe[i] = sign(IN2_V[i]) * max(|IN2_V[i]|, ' +
            epsilon.toFixed(6) +
            ')'
        );
    }

    private clampFrequencyHz(frequencyHz: number): number {
        return Math.max(1.0, Math.min(this.signalSourceMaxFrequencyHz, frequencyHz));
    }

    private clampAmplitudeVpp(amplitudeVpp: number): number {
        return Math.max(0.0, Math.min(this.signalSourceMaxAmplitudeVpp, amplitudeVpp));
    }

    private clampWindowSamples(samples: number): number {
        return Math.max(8000, Math.min(16384, Math.round(samples)));
    }

    private clampSmoothingWindow(samples: number): number {
        return Math.max(1, Math.min(100, Math.round(samples)));
    }

    private clampSmoothingAlpha(alpha: number): number {
        return Math.max(0.01, Math.min(1.0, alpha));
    }

    private clampDivisionEpsilon(epsilon: number): number {
        return Math.max(0.000001, Math.min(5.0, epsilon));
    }

    private clampDivisionClip(clip: number): number {
        return Math.max(0.1, Math.min(1000000.0, clip));
    }

    // ----------------------------
    // Module: Math Helpers
    // ----------------------------
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

    private computeTrueRmsBalanced(values: number[], targetPerSide: number): number {
        if (values.length === 0) {
            return 0;
        }

        const positive: number[] = [];
        const negative: number[] = [];

        for (let i = 0; i < values.length; i++) {
            if (values[i] >= 0 && positive.length < targetPerSide) {
                positive.push(values[i]);
            } else if (values[i] < 0 && negative.length < targetPerSide) {
                negative.push(values[i]);
            }
            if (positive.length >= targetPerSide && negative.length >= targetPerSide) {
                break;
            }
        }

        const merged = positive.concat(negative);
        if (merged.length === 0) {
            return 0;
        }
        let sumSq = 0;
        for (let i = 0; i < merged.length; i++) {
            sumSq += merged[i] * merged[i];
        }
        return Math.sqrt(sumSq / merged.length);
    }

    private buildConstantSeries(length: number, value: number): number[] {
        const n = Math.max(0, length);
        const result: number[] = new Array(n);
        for (let i = 0; i < n; i++) {
            result[i] = value;
        }
        return result;
    }

    private sampleIndexPointsToTimeUs(points: number[][], offsetUs: number = 0): number[][] {
        const out: number[][] = new Array(points.length);
        for (let i = 0; i < points.length; i++) {
            out[i] = [offsetUs + this.sampleIndexToMicroseconds(points[i][0]), points[i][1]];
        }
        return out;
    }

    private extractY(points: number[][]): number[] {
        const values: number[] = new Array(points.length);
        for (let i = 0; i < points.length; i++) {
            values[i] = points[i][1];
        }
        return values;
    }

    private mapSeriesToReferenceX(reference: number[][], values: number[]): number[][] {
        const n = Math.min(reference.length, values.length);
        const points: number[][] = new Array(n);
        for (let i = 0; i < n; i++) {
            points[i] = [reference[i][0], values[i]];
        }
        return points;
    }

    private sampleIndexToMicroseconds(sampleIndex: number): number {
        return (sampleIndex / this.sampleRateHz) * 1e6;
    }

    // ----------------------------
    // Module: Parsing + UI Label Helpers
    // ----------------------------
    private parseNumber(raw: string, fallback: number): number {
        const parsed = this.parseLocalizedNumber(raw);
        if (parsed === null) {
            return fallback;
        }
        return parsed;
    }

    private parseLocalizedNumber(raw: string): number | null {
        const trimmed = (raw || '').trim();
        if (trimmed.length === 0) {
            return null;
        }

        const numberLike = trimmed.replace(/[^0-9,.\-+]/g, '');
        if (numberLike.length === 0) {
            return null;
        }

        const hasComma = numberLike.indexOf(',') >= 0;
        const hasDot = numberLike.indexOf('.') >= 0;
        let normalized = numberLike;

        if (hasComma && hasDot) {
            // Supports formats like 1.234,56 and 1,234.56
            const lastComma = normalized.lastIndexOf(',');
            const lastDot = normalized.lastIndexOf('.');
            if (lastComma > lastDot) {
                normalized = normalized.replace(/\./g, '').replace(',', '.');
            } else {
                normalized = normalized.replace(/,/g, '');
            }
        } else if (hasComma) {
            normalized = normalized.replace(',', '.');
        }

        const parsed = parseFloat(normalized);
        if (isNaN(parsed)) {
            return null;
        }
        return parsed;
    }

    private parseSignalSourceAmplitudeVpp(raw: string, fallback: number): number {
        const parsed = this.parseNumber(raw, fallback);
        const normalized = raw.toLowerCase();
        if (normalized.indexOf('vpp') >= 0) {
            return parsed;
        }
        if (normalized.indexOf('vpk') >= 0) {
            return parsed * 2.0;
        }
        return parsed;
    }

    private parseSignalSourceFrequencyHz(raw: string, fallback: number): number {
        const parsed = this.parseNumber(raw, fallback);
        const normalized = raw.toLowerCase();
        if (normalized.indexOf('khz') >= 0) {
            return parsed * 1000.0;
        }
        if (normalized.indexOf('mhz') >= 0) {
            return parsed * 1000000.0;
        }
        return parsed;
    }

    private formatFrequencyInputValue(frequencyHz: number): string {
        return (frequencyHz / 1000.0).toFixed(3) + ' kHz';
    }

    private formatAmplitudeInputValue(amplitudeVpp: number): string {
        return amplitudeVpp.toFixed(3) + ' Vpp';
    }

    private getFeatureSeriesLabel(): string {
        const method = this.getPhase3FeatureMethod();
        if (method === 'true_rms') return 'True RMS';
        if (method === 'iq_in2') return 'IQ |A|/Aref';
        return 'RMS';
    }

    private getSeriesKeyFromLabel(label: string): string | null {
        if (label === 'IN1') return 'in1';
        if (label === 'IN2') return 'in2';
        if (label === 'OUT1') return 'out1';
        if (label === 'OUT2') return 'out2';
        if (
            label === 'RMS' ||
            label === 'True RMS' ||
            label === 'IQ |A|/Aref' ||
            label.indexOf('RMS (+)') === 0 ||
            label.indexOf('RMS (-)') === 0 ||
            label.indexOf('True RMS (+)') === 0 ||
            label.indexOf('True RMS (-)') === 0 ||
            label.indexOf('IQ |A|/Aref (+)') === 0 ||
            label.indexOf('IQ |A|/Aref (-)') === 0 ||
            label === 'Feature'
        ) return 'feature';
        if (label === 'Weight') return 'weight';
        return null;
    }

    private setCheckboxFromKey(document: Document, key: string, checked: boolean): void {
        const elementMap: {[key: string]: string} = {
            in1: 'curve-in1',
            in2: 'curve-in2',
            out1: 'curve-out1',
            out2: 'curve-out2',
            feature: 'curve-feature',
            weight: 'curve-weight'
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

    private getOutputChannelLabel(outputChannel: number): string {
        if (outputChannel === 0) return 'OUT1';
        if (outputChannel === 1) return 'OUT2';
        return 'OUT1 + OUT2';
    }

    private getPlotDecimationMethodLabel(method: PlotDecimationMethod): string {
        if (method === 'none') return 'Off (1:1)';
        if (method === 'stride') return 'Stride';
        if (method === 'minmax') return 'Min/Max envelope';
        return 'Mean Bucket';
    }

    private getPhase2InputLabel(mode: Phase2Input): string {
        if (mode === 'in1') return 'IN1';
        if (mode === 'in2') return 'IN2';
        if (mode === 'in1_div_in2') return 'IN1 / IN2';
        return 'IN1 - IN2';
    }

}

let app = new App(window, document, location.hostname, $('#plot-placeholder'));
