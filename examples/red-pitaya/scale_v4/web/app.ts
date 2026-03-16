// ----------------------------
// Module: Workflow Type System
// ----------------------------
type Phase2Input = 'in1' | 'in2' | 'in1_minus_in2' | 'in1_div_in2' | 'iq_pair';
type Phase3Feature = 'rms' | 'true_rms' | 'iq_in2';
type Phase4Calibration = 'off' | 'tare_only' | 'scale_only' | 'tare_scale';
type Phase5Smoothing = 'none' | 'moving_average' | 'rms_window' | 'true_rms_window' | 'ema';
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

interface CalibrationMeasurementSample {
    timestampMs: number;
    featureRaw: number;
    featureUsed: number;
    featureForScale: number;
    activeOffset: number;
    calibrationFactor: number;
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
    iqI0: number;
    iqQ0: number;
}

interface CalibrationMeasurementRecord {
    id: number;
    startedAtIso: string;
    completedAtIso: string;
    countdownSeconds: number;
    measurementSeconds: number;
    sampleCount: number;
    realWeightKg: number | null;
    suggestedCalibrationFactor: number | null;
    featureRawAvg: number;
    featureUsedAvg: number;
    featureForScaleAvg: number;
    activeOffsetAvg: number;
    calibrationFactorAtMeasurement: number;
    weightRawAvg: number;
    weightUsedAvg: number;
    rmsIn1Avg: number;
    rmsIn2Avg: number;
    rmsOut1Avg: number;
    rmsOut2Avg: number;
    iqIAvg: number;
    iqQAvg: number;
    iqAAvg: number;
    iqARefAvg: number;
    iqANormAvg: number;
    iqRefPhaseDegAvg: number;
    iqI0Avg: number;
    iqQ0Avg: number;
    outputChannel: number;
    frequencyHz: number;
    amplitudeVpp: number;
    phase2Input: Phase2Input;
    phase3Feature: Phase3Feature;
    phase4Calibration: Phase4Calibration;
    phase5Smoothing: Phase5Smoothing;
    windowSamples: number;
    iqRefGate: number;
    smoothingWindow: number;
    smoothingAlpha: number;
    divisionEpsilon: number;
    divisionClip: number;
    plotDecimationMethod: PlotDecimationMethod;
    plotMaxPoints: number;
    driverAction: DriverAction;
    driverRefreshMode: DriverRefreshMode;
    samples: CalibrationMeasurementSample[];
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
    private iqRefGateInput: HTMLInputElement;
    private smoothingWindowInput: HTMLInputElement;
    private smoothingAlphaInput: HTMLInputElement;
    private divisionEpsilonInput: HTMLInputElement;
    private divisionClipInput: HTMLInputElement;
    private plotMaxPointsInput: HTMLInputElement;
    private iqRefGateGroup: HTMLElement;
    private smoothingWindowGroup: HTMLElement;
    private smoothingAlphaGroup: HTMLElement;
    private divisionEpsilonGroup: HTMLElement;
    private divisionClipGroup: HTMLElement;
    private appliedPhase2Input: Phase2Input = 'in1';
    private lastManualPhase2Input: Phase2Input = 'in1';
    private appliedPhase3Feature: Phase3Feature = 'iq_in2';
    private appliedPhase4Calibration: Phase4Calibration = 'tare_scale';
    private appliedPhase5Smoothing: Phase5Smoothing = 'ema';
    private appliedWindowSamples = 8000;
    private readonly iqReferenceMinAmplitudeDefault = 0.05;
    private appliedIqReferenceMinAmplitude = this.iqReferenceMinAmplitudeDefault;
    private appliedSmoothingWindow = 5;
    private appliedSmoothingAlpha = 0.10;
    private appliedDivisionEpsilon = 0.01;
    private appliedDivisionClip = 100.0;

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
    private liveInputMappingSourceEl: HTMLElement;
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
    private liveOffsetDefinitionEl: HTMLElement;
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
    private liveIqI0El: HTMLElement;
    private liveIqQ0El: HTMLElement;

    // ----------------------------
    // State: Scale Panel Fields
    // ----------------------------
    private scaleTareFeatureEl: HTMLElement;
    private weightEl: HTMLElement;
    private weightUnitEl: HTMLElement;

    private tareBtn: HTMLButtonElement;
    private readonly expCalibrationA = 5.5777;
    private readonly expCalibrationBgPerGram = 0.001142;
    private readonly expCalibrationBkg = this.expCalibrationBgPerGram * 1000.0;
    private readonly expCalibrationC = -5.9575;
    private readonly linCalibrationFeaturePerGram = 0.006771;
    private readonly linCalibrationFeatureOffset = 6.0657;
    private readonly hybridCalibrationSwitchGram = 1000.0;
    private readonly expCalibrationArgumentEpsilon = 1e-9;
    private featureTare = 0;
    private calibrationAddMeasurementBtn: HTMLButtonElement;
    private calibrationDownloadCsvBtn: HTMLButtonElement;
    private calibrationToolStatusEl: HTMLElement;
    private calibrationToolAvgKEl: HTMLElement;
    private calibrationToolBodyEl: HTMLElement;
    private readonly calibrationToolStorageKey = 'scale_v4_calibration_tool_measurements_v1';
    private calibrationMeasurements: CalibrationMeasurementRecord[] = [];
    private nextCalibrationMeasurementId = 1;
    private calibrationMeasurementRunning = false;

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
    private lastActiveCalibrationOffset = 0;
    private lastPipelineResult: PipelineResult = {
        featureRaw: 0,
        featureUsed: 0,
        weightRaw: 0,
        weightUsed: 0,
        rmsIn1: 0,
        rmsIn2: 0,
        rmsOut1: 0,
        rmsOut2: 0,
        iqI: 0,
        iqQ: 0,
        iqA: 0,
        iqARef: 0,
        iqANorm: 0,
        iqRefPhaseDeg: 0
    };

    // ----------------------------
    // State: Smoothing Runtime
    // ----------------------------
    private smoothingHistory: number[] = [];
    private emaWeight = 0;
    private emaInitialized = false;
    private lastSmoothingEvaluationText = 'Off';
    private readonly iqNormalizationEpsilon = 0.000001;
    private iqProjectionBaseI = 0;
    private iqProjectionBaseQ = 0;
    private iqProjectionBaseInitialized = false;
    private iqSProjHold = 0;
    private iqSProjHoldInitialized = false;
    private lastIqI = 0;
    private lastIqQ = 0;

    // ----------------------------
    // State: Plot Runtime
    // ----------------------------
    private lastPlotRangeUs: jquery.flot.range = {from: 0, to: 0};
    private runningPlotFrameStartUs = 0;
    private adcRawSize = 16384;
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
        this.iqRefGateInput = <HTMLInputElement>document.getElementById('iq-ref-gate');
        this.smoothingWindowInput = <HTMLInputElement>document.getElementById('smoothing-window');
        this.smoothingAlphaInput = <HTMLInputElement>document.getElementById('smoothing-alpha');
        this.divisionEpsilonInput = <HTMLInputElement>document.getElementById('division-epsilon');
        this.divisionClipInput = <HTMLInputElement>document.getElementById('division-clip');
        this.plotMaxPointsInput = <HTMLInputElement>document.getElementById('plot-max-points');
        this.iqRefGateGroup = <HTMLElement>document.getElementById('iq-ref-gate-group');
        this.smoothingWindowGroup = <HTMLElement>document.getElementById('smoothing-window-group');
        this.smoothingAlphaGroup = <HTMLElement>document.getElementById('smoothing-alpha-group');
        this.divisionEpsilonGroup = <HTMLElement>document.getElementById('division-epsilon-group');
        this.divisionClipGroup = <HTMLElement>document.getElementById('division-clip-group');

        this.phase2SaveBtn.addEventListener('click', () => this.applyPhase2Settings());
        this.phase3SaveBtn.addEventListener('click', () => this.applyPhase3Settings());
        this.phase4SaveBtn.addEventListener('click', () => this.applyPhase4Settings());
        this.phase5SaveBtn.addEventListener('click', () => this.applyPhase5Settings());
        this.plotMaxPointsInput.addEventListener('change', () => this.updateFormulaAndParameterVisibility());
    }

    private applyPhase2Settings(): void {
        const featureMethod = this.getPhase3FeatureMethod();
        const mode = this.phase2InputSelect.value;
        if (featureMethod === 'iq_in2') {
            this.appliedPhase2Input = 'iq_pair';
        } else if (mode === 'in1' || mode === 'in2' || mode === 'in1_minus_in2' || mode === 'in1_div_in2') {
            this.appliedPhase2Input = mode;
            this.lastManualPhase2Input = mode;
        }

        this.appliedDivisionEpsilon = this.clampDivisionEpsilon(this.parseNumber(this.divisionEpsilonInput.value, this.appliedDivisionEpsilon));
        this.appliedDivisionClip = this.clampDivisionClip(this.parseNumber(this.divisionClipInput.value, this.appliedDivisionClip));

        this.enforcePhase2MappingForFeatureMethod();
        this.divisionEpsilonInput.value = this.appliedDivisionEpsilon.toFixed(6);
        this.divisionClipInput.value = this.appliedDivisionClip.toFixed(3);

        this.updateFormulaAndParameterVisibility();
    }

    private applyPhase3Settings(): void {
        const previousMode = this.appliedPhase3Feature;
        const wasIq = previousMode === 'iq_in2';
        const mode = this.phase3FeatureSelect.value;
        if (mode === 'rms' || mode === 'true_rms' || mode === 'iq_in2') {
            this.appliedPhase3Feature = mode;
        }
        const isIq = this.appliedPhase3Feature === 'iq_in2';

        this.appliedWindowSamples = this.clampWindowSamples(this.parseNumber(this.rmsWindowSamplesInput.value, this.appliedWindowSamples));
        this.appliedIqReferenceMinAmplitude = this.clampIqReferenceMinAmplitude(
            this.parseNumber(this.iqRefGateInput.value, this.appliedIqReferenceMinAmplitude)
        );
        this.phase3FeatureSelect.value = this.appliedPhase3Feature;
        this.rmsWindowSamplesInput.value = this.appliedWindowSamples.toString();
        this.iqRefGateInput.value = this.appliedIqReferenceMinAmplitude.toFixed(3);
        if (!wasIq && isIq) {
            this.iqProjectionBaseInitialized = false;
            this.iqSProjHoldInitialized = false;
        }
        this.enforcePhase2MappingForFeatureMethod();

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
        if (mode === 'none' || mode === 'moving_average' || mode === 'rms_window' || mode === 'true_rms_window' || mode === 'ema') {
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

    private enforcePhase2MappingForFeatureMethod(): void {
        const isIq = this.getPhase3FeatureMethod() === 'iq_in2';
        const iqPairOption = <HTMLOptionElement | null>this.phase2InputSelect.querySelector('option[value="iq_pair"]');
        if (iqPairOption) {
            iqPairOption.disabled = !isIq;
        }

        if (isIq) {
            if (this.appliedPhase2Input !== 'iq_pair') {
                this.lastManualPhase2Input = this.appliedPhase2Input;
                this.appliedPhase2Input = 'iq_pair';
            }
            this.phase2InputSelect.value = 'iq_pair';
            this.phase2InputSelect.disabled = true;
            return;
        }

        this.phase2InputSelect.disabled = false;
        if (this.appliedPhase2Input === 'iq_pair') {
            this.appliedPhase2Input = this.lastManualPhase2Input;
        }
        this.phase2InputSelect.value = this.appliedPhase2Input;
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
        this.liveInputMappingSourceEl = <HTMLElement>document.getElementById('live-input-mapping-source');
        this.liveLockinParamsEl = <HTMLElement>document.getElementById('live-lockin-params');
        this.liveSmoothingFormulaEl = <HTMLElement>document.getElementById('live-smoothing-formula');
        this.liveSmoothingEvalEl = <HTMLElement>document.getElementById('live-smoothing-eval');
        this.livePlotDecimationEl = <HTMLElement>document.getElementById('live-plot-decimation');
        this.liveFeatureRawEl = <HTMLElement>document.getElementById('live-feature-raw');
        this.liveFeatureUsedEl = <HTMLElement>document.getElementById('live-feature-used');
        this.liveFeatureTareEl = <HTMLElement>document.getElementById('live-feature-tare');
        this.liveOffsetDefinitionEl = <HTMLElement>document.getElementById('live-offset-definition');
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
        this.liveIqI0El = <HTMLElement>document.getElementById('live-iq-i0');
        this.liveIqQ0El = <HTMLElement>document.getElementById('live-iq-q0');

        this.calibrationAddMeasurementBtn = <HTMLButtonElement>document.getElementById('btn-calibration-add-measurement');
        this.calibrationDownloadCsvBtn = <HTMLButtonElement>document.getElementById('btn-calibration-download-csv');
        this.calibrationToolStatusEl = <HTMLElement>document.getElementById('calibration-tool-status');
        this.calibrationToolAvgKEl = <HTMLElement>document.getElementById('calibration-tool-k-avg');
        this.calibrationToolBodyEl = <HTMLElement>document.getElementById('calibration-tool-body');

        this.calibrationAddMeasurementBtn.addEventListener('click', () => this.runCalibrationMeasurementSequence());
        this.calibrationDownloadCsvBtn.addEventListener('click', () => this.downloadCalibrationCsv());

        this.tareBtn = <HTMLButtonElement>document.getElementById('btn-tare');
        this.tareBtn.addEventListener('click', () => {
            const mode = this.getPhase4CalibrationMode();
            if (!this.usesTare(mode)) {
                return;
            }
            if (this.getPhase3FeatureMethod() === 'iq_in2') {
                // In IQ signed projection mode, tare defines the projection origin in I/Q space.
                this.iqProjectionBaseI = this.lastIqI;
                this.iqProjectionBaseQ = this.lastIqQ;
                this.iqProjectionBaseInitialized = true;
                this.iqSProjHold = 0;
                this.iqSProjHoldInitialized = true;
                this.featureTare = 0;
            } else {
                this.featureTare = this.featureTraceValue;
            }
            this.scaleTareFeatureEl.innerText = this.featureTare.toFixed(4);
            this.liveFeatureTareEl.innerText = this.getActiveCalibrationOffset().toFixed(4);
            this.liveIqI0El.innerText = this.iqProjectionBaseI.toFixed(4);
            this.liveIqQ0El.innerText = this.iqProjectionBaseQ.toFixed(4);
        });

        this.scaleTareFeatureEl.innerText = this.featureTare.toFixed(4);
        this.loadCalibrationMeasurements();
        this.renderCalibrationMeasurements();
        this.updateCalibrationUiState();
        this.liveDriverActionEl.innerText = this.getDriverAction();
        this.liveDriverResultEl.innerText = this.driverOutputEl ? this.driverOutputEl.innerText : 'Ready.';
    }

    private runCalibrationMeasurementSequence(): void {
        if (this.calibrationMeasurementRunning) {
            return;
        }

        const countdownSeconds = 3;
        const measurementSeconds = 5;
        const startedAtIso = new Date().toISOString();

        this.calibrationMeasurementRunning = true;
        this.updateCalibrationToolButtonsState();

        let countdownRemaining = countdownSeconds;
        this.setCalibrationToolStatus('Measurement starts in ' + countdownRemaining.toString() + ' s');

        const countdownTimer = window.setInterval(() => {
            countdownRemaining -= 1;
            if (countdownRemaining > 0) {
                this.setCalibrationToolStatus('Measurement starts in ' + countdownRemaining.toString() + ' s');
                return;
            }

            window.clearInterval(countdownTimer);
            this.collectCalibrationSamples(measurementSeconds, (samples: CalibrationMeasurementSample[]) => {
                const completedAtIso = new Date().toISOString();
                const record = this.buildCalibrationMeasurementRecord(
                    startedAtIso,
                    completedAtIso,
                    countdownSeconds,
                    measurementSeconds,
                    samples
                );
                this.calibrationMeasurements.push(record);
                this.saveCalibrationMeasurements();
                this.renderCalibrationMeasurements();
                this.setCalibrationToolStatus('Measurement #' + record.id.toString() + ' saved.');
                this.calibrationMeasurementRunning = false;
                this.updateCalibrationToolButtonsState();
            });
        }, 1000);
    }

    private collectCalibrationSamples(durationSeconds: number, callback: (samples: CalibrationMeasurementSample[]) => void): void {
        const durationMs = Math.max(1, Math.round(durationSeconds * 1000));
        const samplePeriodMs = 100;
        const samples: CalibrationMeasurementSample[] = [];
        let remainingSeconds = durationSeconds;

        this.setCalibrationToolStatus('Measuring... ' + remainingSeconds.toString() + ' s left');
        samples.push(this.captureCalibrationSample());

        const samplingTimer = window.setInterval(() => {
            samples.push(this.captureCalibrationSample());
        }, samplePeriodMs);

        const statusTimer = window.setInterval(() => {
            remainingSeconds -= 1;
            if (remainingSeconds > 0) {
                this.setCalibrationToolStatus('Measuring... ' + remainingSeconds.toString() + ' s left');
            }
        }, 1000);

        window.setTimeout(() => {
            window.clearInterval(samplingTimer);
            window.clearInterval(statusTimer);
            callback(samples);
        }, durationMs);
    }

    private captureCalibrationSample(): CalibrationMeasurementSample {
        const p = this.lastPipelineResult;
        const activeOffset = this.lastActiveCalibrationOffset;
        return {
            timestampMs: Date.now(),
            featureRaw: this.sanitizeFinite(p.featureRaw),
            featureUsed: this.sanitizeFinite(p.featureUsed),
            featureForScale: this.sanitizeFinite(p.featureUsed - activeOffset),
            activeOffset: this.sanitizeFinite(activeOffset),
            calibrationFactor: 0,
            weightRaw: this.sanitizeFinite(p.weightRaw),
            weightUsed: this.sanitizeFinite(p.weightUsed),
            rmsIn1: this.sanitizeFinite(p.rmsIn1),
            rmsIn2: this.sanitizeFinite(p.rmsIn2),
            rmsOut1: this.sanitizeFinite(p.rmsOut1),
            rmsOut2: this.sanitizeFinite(p.rmsOut2),
            iqI: this.sanitizeFinite(p.iqI),
            iqQ: this.sanitizeFinite(p.iqQ),
            iqA: this.sanitizeFinite(p.iqA),
            iqARef: this.sanitizeFinite(p.iqARef),
            iqANorm: this.sanitizeFinite(p.iqANorm),
            iqRefPhaseDeg: this.sanitizeFinite(p.iqRefPhaseDeg),
            iqI0: this.sanitizeFinite(this.iqProjectionBaseI),
            iqQ0: this.sanitizeFinite(this.iqProjectionBaseQ)
        };
    }

    private buildCalibrationMeasurementRecord(
        startedAtIso: string,
        completedAtIso: string,
        countdownSeconds: number,
        measurementSeconds: number,
        samples: CalibrationMeasurementSample[]
    ): CalibrationMeasurementRecord {
        const safeSamples = samples.length > 0 ? samples : [this.captureCalibrationSample()];
        const avg = (selector: (sample: CalibrationMeasurementSample) => number): number => {
            return this.getMeasurementAverage(safeSamples, selector);
        };

        return {
            id: this.nextCalibrationMeasurementId++,
            startedAtIso,
            completedAtIso,
            countdownSeconds,
            measurementSeconds,
            sampleCount: safeSamples.length,
            realWeightKg: null,
            suggestedCalibrationFactor: null,
            featureRawAvg: avg((sample) => sample.featureRaw),
            featureUsedAvg: avg((sample) => sample.featureUsed),
            featureForScaleAvg: avg((sample) => sample.featureForScale),
            activeOffsetAvg: avg((sample) => sample.activeOffset),
            calibrationFactorAtMeasurement: 0,
            weightRawAvg: avg((sample) => sample.weightRaw),
            weightUsedAvg: avg((sample) => sample.weightUsed),
            rmsIn1Avg: avg((sample) => sample.rmsIn1),
            rmsIn2Avg: avg((sample) => sample.rmsIn2),
            rmsOut1Avg: avg((sample) => sample.rmsOut1),
            rmsOut2Avg: avg((sample) => sample.rmsOut2),
            iqIAvg: avg((sample) => sample.iqI),
            iqQAvg: avg((sample) => sample.iqQ),
            iqAAvg: avg((sample) => sample.iqA),
            iqARefAvg: avg((sample) => sample.iqARef),
            iqANormAvg: avg((sample) => sample.iqANorm),
            iqRefPhaseDegAvg: avg((sample) => sample.iqRefPhaseDeg),
            iqI0Avg: avg((sample) => sample.iqI0),
            iqQ0Avg: avg((sample) => sample.iqQ0),
            outputChannel: this.appliedOutputChannel,
            frequencyHz: this.appliedFrequencyHz,
            amplitudeVpp: this.appliedAmplitudeVpp,
            phase2Input: this.getPhase2InputMode(),
            phase3Feature: this.getPhase3FeatureMethod(),
            phase4Calibration: this.getPhase4CalibrationMode(),
            phase5Smoothing: this.getPhase5SmoothingMethod(),
            windowSamples: this.getWindowSamples(),
            iqRefGate: this.appliedIqReferenceMinAmplitude,
            smoothingWindow: this.getSmoothingWindow(),
            smoothingAlpha: this.getSmoothingAlpha(),
            divisionEpsilon: this.getDivisionEpsilon(),
            divisionClip: this.getDivisionClip(),
            plotDecimationMethod: this.getPlotDecimationMethod(),
            plotMaxPoints: this.getPlotMaxPoints(),
            driverAction: this.getDriverAction(),
            driverRefreshMode: this.getDriverRefreshMode(),
            samples: safeSamples.map((sample) => ({ ...sample }))
        };
    }

    private getMeasurementAverage(
        samples: CalibrationMeasurementSample[],
        selector: (sample: CalibrationMeasurementSample) => number
    ): number {
        if (samples.length === 0) {
            return 0;
        }
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += selector(samples[i]);
        }
        return sum / samples.length;
    }

    private computeHybridWeightFromFeature(featureUsed: number): {
        weightKg: number;
        clamped: boolean;
        branch: 'exp' | 'lin';
        ratio: number;
        expWeightKg: number;
        linWeightKg: number;
    } {
        const feature = this.sanitizeFinite(featureUsed);
        const ratio = (feature - this.expCalibrationC) / this.expCalibrationA;
        const ratioSafe = Math.max(ratio, this.expCalibrationArgumentEpsilon);
        const expWeightKg = Math.log(ratioSafe) / this.expCalibrationBkg;
        const expValid = Number.isFinite(expWeightKg) && ratio > 0;

        const linWeightGram = (feature - this.linCalibrationFeatureOffset) / this.linCalibrationFeaturePerGram;
        const linWeightKg = linWeightGram / 1000.0;
        const linValid = Number.isFinite(linWeightKg);

        const useExpBranch = expValid && (expWeightKg * 1000.0) <= this.hybridCalibrationSwitchGram;
        const branch: 'exp' | 'lin' = useExpBranch || !linValid ? 'exp' : 'lin';
        const weightRaw = branch === 'exp' ? expWeightKg : linWeightKg;

        if (!Number.isFinite(weightRaw) || weightRaw <= 0) {
            return { weightKg: 0, clamped: true, branch, ratio, expWeightKg, linWeightKg };
        }
        return { weightKg: weightRaw, clamped: false, branch, ratio, expWeightKg, linWeightKg };
    }

    private renderCalibrationMeasurements(): void {
        if (!this.calibrationToolBodyEl) {
            return;
        }

        if (this.calibrationMeasurements.length <= 0) {
            this.calibrationToolBodyEl.innerHTML = '<tr><td colspan="8">No measurements yet.</td></tr>';
            this.calibrationToolAvgKEl.innerText = '-';
            this.updateCalibrationToolButtonsState();
            return;
        }

        const rows = this.calibrationMeasurements.slice().sort((a, b) => b.id - a.id);
        const absErrorsKg: number[] = [];
        let html = '';
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const realWeightText = row.realWeightKg === null ? '' : row.realWeightKg.toString();
            const featureDisplay = row.phase3Feature === 'iq_in2'
                ? this.sanitizeFinite(row.featureUsedAvg)
                : this.sanitizeFinite(row.featureForScaleAvg);
            const predicted = this.computeHybridWeightFromFeature(featureDisplay).weightKg;
            const predictedText = predicted.toFixed(4);
            let errorText = '-';
            let errorPctText = '-';
            if (row.realWeightKg !== null) {
                const errorKg = predicted - row.realWeightKg;
                errorText = errorKg.toFixed(4);
                absErrorsKg.push(Math.abs(errorKg));
                if (Math.abs(row.realWeightKg) > 1e-12) {
                    errorPctText = (100.0 * errorKg / row.realWeightKg).toFixed(2);
                } else {
                    errorPctText = predicted === 0 ? '0.00' : '-';
                }
            }
            html +=
                '<tr>' +
                '<td>' + row.id.toString() + '</td>' +
                '<td>' + this.formatMeasurementTime(row.completedAtIso) + '</td>' +
                '<td>' + featureDisplay.toFixed(6) + '</td>' +
                '<td><input type="text" class="form-control input-sm calibration-realweight-input" data-measurement-id="' + row.id.toString() + '" value="' + realWeightText + '" placeholder="kg"></td>' +
                '<td><strong>' + predictedText + '</strong></td>' +
                '<td>' + errorText + '</td>' +
                '<td>' + errorPctText + '</td>' +
                '<td>' +
                '<button class="btn btn-xs btn-danger calibration-delete-measurement-btn" data-measurement-id="' + row.id.toString() + '">Delete</button>' +
                '</td>' +
                '</tr>';
        }

        this.calibrationToolBodyEl.innerHTML = html;

        const inputs = this.calibrationToolBodyEl.querySelectorAll('.calibration-realweight-input');
        for (let i = 0; i < inputs.length; i++) {
            const input = <HTMLInputElement>inputs[i];
            const idAttr = input.getAttribute('data-measurement-id');
            if (!idAttr) {
                continue;
            }
            const measurementId = parseInt(idAttr, 10);
            input.addEventListener('change', () => this.onCalibrationRealWeightChanged(measurementId, input.value));
            input.addEventListener('blur', () => this.onCalibrationRealWeightChanged(measurementId, input.value));
        }

        const deleteButtons = this.calibrationToolBodyEl.querySelectorAll('.calibration-delete-measurement-btn');
        for (let i = 0; i < deleteButtons.length; i++) {
            const button = <HTMLButtonElement>deleteButtons[i];
            const idAttr = button.getAttribute('data-measurement-id');
            if (!idAttr) {
                continue;
            }
            const measurementId = parseInt(idAttr, 10);
            button.addEventListener('click', () => this.deleteCalibrationMeasurement(measurementId));
        }

        if (absErrorsKg.length <= 0) {
            this.calibrationToolAvgKEl.innerText = '-';
        } else {
            let sumAbsError = 0;
            for (let i = 0; i < absErrorsKg.length; i++) {
                sumAbsError += absErrorsKg[i];
            }
            this.calibrationToolAvgKEl.innerText = (sumAbsError / absErrorsKg.length).toFixed(4);
        }

        this.updateCalibrationToolButtonsState();
    }

    private onCalibrationRealWeightChanged(measurementId: number, raw: string): void {
        const record = this.calibrationMeasurements.find((item) => item.id === measurementId);
        if (!record) {
            return;
        }
        const parsed = this.parseLocalizedNumber(raw);
        record.realWeightKg = parsed === null ? null : parsed;
        this.saveCalibrationMeasurements();
        this.renderCalibrationMeasurements();
    }

    private deleteCalibrationMeasurement(measurementId: number): void {
        const index = this.calibrationMeasurements.findIndex((item) => item.id === measurementId);
        if (index < 0) {
            return;
        }
        const confirmed = window.confirm('Delete measurement #' + measurementId.toString() + '?');
        if (!confirmed) {
            return;
        }
        this.calibrationMeasurements.splice(index, 1);
        this.saveCalibrationMeasurements();
        this.renderCalibrationMeasurements();
        this.setCalibrationToolStatus('Measurement #' + measurementId.toString() + ' deleted.');
    }

    private setCalibrationToolStatus(text: string): void {
        if (this.calibrationToolStatusEl) {
            this.calibrationToolStatusEl.innerText = text;
        }
    }

    private updateCalibrationToolButtonsState(): void {
        if (this.calibrationAddMeasurementBtn) {
            this.calibrationAddMeasurementBtn.disabled = this.calibrationMeasurementRunning;
        }
        if (this.calibrationDownloadCsvBtn) {
            this.calibrationDownloadCsvBtn.disabled = this.calibrationMeasurements.length <= 0;
        }
    }

    private formatMeasurementTime(iso: string): string {
        const date = new Date(iso);
        if (isNaN(date.getTime())) {
            return iso;
        }
        return date.toLocaleTimeString();
    }

    private saveCalibrationMeasurements(): void {
        try {
            window.localStorage.setItem(this.calibrationToolStorageKey, JSON.stringify(this.calibrationMeasurements));
        } catch (error) {
            void error;
            this.setCalibrationToolStatus('Saving failed (localStorage unavailable).');
        }
    }

    private loadCalibrationMeasurements(): void {
        this.calibrationMeasurements = [];
        this.nextCalibrationMeasurementId = 1;
        try {
            const raw = window.localStorage.getItem(this.calibrationToolStorageKey);
            if (!raw) {
                this.updateCalibrationToolButtonsState();
                return;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                this.updateCalibrationToolButtonsState();
                return;
            }

            for (let i = 0; i < parsed.length; i++) {
                const hydrated = this.hydrateCalibrationMeasurementRecord(parsed[i]);
                if (hydrated === null) {
                    continue;
                }
                hydrated.suggestedCalibrationFactor = null;
                this.calibrationMeasurements.push(hydrated);
                if (hydrated.id >= this.nextCalibrationMeasurementId) {
                    this.nextCalibrationMeasurementId = hydrated.id + 1;
                }
            }
        } catch (error) {
            void error;
            this.calibrationMeasurements = [];
            this.nextCalibrationMeasurementId = 1;
            this.setCalibrationToolStatus('Temporary measurement data could not be loaded.');
        }
        this.updateCalibrationToolButtonsState();
    }

    private hydrateCalibrationMeasurementRecord(raw: any): CalibrationMeasurementRecord | null {
        if (!raw || typeof raw !== 'object') {
            return null;
        }

        const rawSamples: any[] = Array.isArray(raw.samples) ? raw.samples : [];
        const samples: CalibrationMeasurementSample[] = rawSamples.map((sampleRaw: any) => ({
            timestampMs: this.toFiniteNumber(sampleRaw.timestampMs),
            featureRaw: this.toFiniteNumber(sampleRaw.featureRaw),
            featureUsed: this.toFiniteNumber(sampleRaw.featureUsed),
            featureForScale: this.toFiniteNumber(sampleRaw.featureForScale),
            activeOffset: this.toFiniteNumber(sampleRaw.activeOffset),
            calibrationFactor: this.toFiniteNumber(sampleRaw.calibrationFactor),
            weightRaw: this.toFiniteNumber(sampleRaw.weightRaw),
            weightUsed: this.toFiniteNumber(sampleRaw.weightUsed),
            rmsIn1: this.toFiniteNumber(sampleRaw.rmsIn1),
            rmsIn2: this.toFiniteNumber(sampleRaw.rmsIn2),
            rmsOut1: this.toFiniteNumber(sampleRaw.rmsOut1),
            rmsOut2: this.toFiniteNumber(sampleRaw.rmsOut2),
            iqI: this.toFiniteNumber(sampleRaw.iqI),
            iqQ: this.toFiniteNumber(sampleRaw.iqQ),
            iqA: this.toFiniteNumber(sampleRaw.iqA),
            iqARef: this.toFiniteNumber(sampleRaw.iqARef),
            iqANorm: this.toFiniteNumber(sampleRaw.iqANorm),
            iqRefPhaseDeg: this.toFiniteNumber(sampleRaw.iqRefPhaseDeg),
            iqI0: this.toFiniteNumber(sampleRaw.iqI0),
            iqQ0: this.toFiniteNumber(sampleRaw.iqQ0)
        }));

        const featureForScaleAvgFallback = this.toFiniteNumber(raw.featureUsedAvg) - this.toFiniteNumber(raw.activeOffsetAvg);
        const realWeightKg = this.toNullableFiniteNumber(raw.realWeightKg);
        const id = Math.max(1, Math.round(this.toFiniteNumber(raw.id, 0)));
        const phase2Input = raw.phase2Input === 'in2' ||
            raw.phase2Input === 'in1_minus_in2' ||
            raw.phase2Input === 'in1_div_in2' ||
            raw.phase2Input === 'iq_pair'
            ? raw.phase2Input
            : 'in1';
        const phase3Feature = raw.phase3Feature === 'true_rms' || raw.phase3Feature === 'iq_in2'
            ? raw.phase3Feature
            : 'rms';
        const phase4Calibration = raw.phase4Calibration === 'off' ||
            raw.phase4Calibration === 'tare_only' ||
            raw.phase4Calibration === 'scale_only'
            ? raw.phase4Calibration
            : 'tare_scale';
        const phase5Smoothing = raw.phase5Smoothing === 'none' ||
            raw.phase5Smoothing === 'moving_average' ||
            raw.phase5Smoothing === 'rms_window' ||
            raw.phase5Smoothing === 'true_rms_window'
            ? raw.phase5Smoothing
            : 'ema';
        const plotDecimationMethod = raw.plotDecimationMethod === 'none' ||
            raw.plotDecimationMethod === 'minmax' ||
            raw.plotDecimationMethod === 'mean'
            ? raw.plotDecimationMethod
            : 'stride';
        const driverAction = raw.driverAction === 'true_rms' ? 'true_rms' : 'rms';
        const driverRefreshMode = raw.driverRefreshMode === '1hz' || raw.driverRefreshMode === '5hz'
            ? raw.driverRefreshMode
            : 'off';

        return {
            id,
            startedAtIso: String(raw.startedAtIso || raw.completedAtIso || ''),
            completedAtIso: String(raw.completedAtIso || raw.startedAtIso || ''),
            countdownSeconds: Math.max(0, Math.round(this.toFiniteNumber(raw.countdownSeconds, 3))),
            measurementSeconds: Math.max(0, Math.round(this.toFiniteNumber(raw.measurementSeconds, 5))),
            sampleCount: Math.max(0, Math.round(this.toFiniteNumber(raw.sampleCount, samples.length))),
            realWeightKg,
            suggestedCalibrationFactor: this.toNullableFiniteNumber(raw.suggestedCalibrationFactor),
            featureRawAvg: this.toFiniteNumber(raw.featureRawAvg),
            featureUsedAvg: this.toFiniteNumber(raw.featureUsedAvg),
            featureForScaleAvg: this.toFiniteNumber(raw.featureForScaleAvg, featureForScaleAvgFallback),
            activeOffsetAvg: this.toFiniteNumber(raw.activeOffsetAvg),
            calibrationFactorAtMeasurement: this.toFiniteNumber(raw.calibrationFactorAtMeasurement),
            weightRawAvg: this.toFiniteNumber(raw.weightRawAvg),
            weightUsedAvg: this.toFiniteNumber(raw.weightUsedAvg),
            rmsIn1Avg: this.toFiniteNumber(raw.rmsIn1Avg),
            rmsIn2Avg: this.toFiniteNumber(raw.rmsIn2Avg),
            rmsOut1Avg: this.toFiniteNumber(raw.rmsOut1Avg),
            rmsOut2Avg: this.toFiniteNumber(raw.rmsOut2Avg),
            iqIAvg: this.toFiniteNumber(raw.iqIAvg),
            iqQAvg: this.toFiniteNumber(raw.iqQAvg),
            iqAAvg: this.toFiniteNumber(raw.iqAAvg),
            iqARefAvg: this.toFiniteNumber(raw.iqARefAvg),
            iqANormAvg: this.toFiniteNumber(raw.iqANormAvg),
            iqRefPhaseDegAvg: this.toFiniteNumber(raw.iqRefPhaseDegAvg),
            iqI0Avg: this.toFiniteNumber(raw.iqI0Avg),
            iqQ0Avg: this.toFiniteNumber(raw.iqQ0Avg),
            outputChannel: Math.max(0, Math.min(2, Math.round(this.toFiniteNumber(raw.outputChannel, 2)))),
            frequencyHz: this.toFiniteNumber(raw.frequencyHz, this.signalSourceDefaultFrequencyHz),
            amplitudeVpp: this.toFiniteNumber(raw.amplitudeVpp, this.signalSourceDefaultAmplitudeVpp),
            phase2Input,
            phase3Feature,
            phase4Calibration,
            phase5Smoothing,
            windowSamples: Math.max(1, Math.round(this.toFiniteNumber(raw.windowSamples, 8000))),
            iqRefGate: this.toFiniteNumber(raw.iqRefGate, this.iqReferenceMinAmplitudeDefault),
            smoothingWindow: Math.max(1, Math.round(this.toFiniteNumber(raw.smoothingWindow, 5))),
            smoothingAlpha: this.toFiniteNumber(raw.smoothingAlpha, 0.1),
            divisionEpsilon: this.toFiniteNumber(raw.divisionEpsilon, 0.01),
            divisionClip: this.toFiniteNumber(raw.divisionClip, 100.0),
            plotDecimationMethod,
            plotMaxPoints: Math.max(1, Math.round(this.toFiniteNumber(raw.plotMaxPoints, 2048))),
            driverAction,
            driverRefreshMode,
            samples
        };
    }

    private toFiniteNumber(value: any, fallback: number = 0): number {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
        return fallback;
    }

    private toNullableFiniteNumber(value: any): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
        return null;
    }

    private downloadCalibrationCsv(): void {
        if (this.calibrationMeasurements.length <= 0) {
            this.setCalibrationToolStatus('No measurements available for CSV.');
            return;
        }
        const csv = this.buildCalibrationCsv();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.buildCalibrationCsvFilename();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
        this.setCalibrationToolStatus('CSV exported.');
    }

    private buildCalibrationCsv(): string {
        const headers = [
            'measurement_id',
            'completed_at_iso',
            'real_weight_kg',
            'feature_used_avg',
            'predicted_weight_kg',
            'error_kg',
            'error_percent',
            'calibration_exp_a',
            'calibration_exp_b_kg',
            'calibration_exp_c',
            'calibration_lin_m_feature_per_g',
            'calibration_lin_n',
            'calibration_switch_g',
            'prediction_branch',
            'frequency_hz',
            'amplitude_vpp',
            'iq_ref_gate',
            'output_channel',
            'phase3_feature',
            'phase4_calibration',
            'window_samples'
        ];

        const lines: string[] = [headers.join(',')];

        for (let i = 0; i < this.calibrationMeasurements.length; i++) {
            const measurement = this.calibrationMeasurements[i];
            const featureForPrediction = this.sanitizeFinite(measurement.featureForScaleAvg);
            const prediction = this.computeHybridWeightFromFeature(featureForPrediction);
            const predictedWeight = prediction.weightKg;
            let errorKg: number | null = null;
            let errorPercent: number | null = null;
            if (measurement.realWeightKg !== null) {
                errorKg = predictedWeight - measurement.realWeightKg;
                if (Math.abs(measurement.realWeightKg) > 1e-12) {
                    errorPercent = 100.0 * errorKg / measurement.realWeightKg;
                }
            }
            const row = [
                measurement.id,
                measurement.completedAtIso,
                measurement.realWeightKg,
                measurement.featureUsedAvg,
                predictedWeight,
                errorKg,
                errorPercent,
                this.expCalibrationA,
                this.expCalibrationBkg,
                this.expCalibrationC,
                this.linCalibrationFeaturePerGram,
                this.linCalibrationFeatureOffset,
                this.hybridCalibrationSwitchGram,
                prediction.branch,
                measurement.frequencyHz,
                measurement.amplitudeVpp,
                measurement.iqRefGate,
                measurement.outputChannel,
                measurement.phase3Feature,
                measurement.phase4Calibration,
                measurement.windowSamples
            ];
            lines.push(row.map((value) => this.csvEscape(value)).join(','));
        }

        return lines.join('\n');
    }

    private csvEscape(value: any): string {
        if (value === null || value === undefined) {
            return '';
        }
        let text = '';
        if (typeof value === 'number' && Number.isFinite(value)) {
            text = this.formatCsvNumber(value);
        } else {
            text = String(value);
        }
        if (text.indexOf('"') >= 0 || text.indexOf(',') >= 0 || text.indexOf('\n') >= 0) {
            return '"' + text.replace(/"/g, '""') + '"';
        }
        return text;
    }

    private formatCsvNumber(value: number): string {
        const rounded = Math.round(value * 10000) / 10000;
        const normalized = Math.abs(rounded) < 1e-12 ? 0 : rounded;
        return normalized.toString();
    }

    private buildCalibrationCsvFilename(): string {
        const now = new Date();
        const yyyy = now.getFullYear().toString();
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const hh = now.getHours().toString().padStart(2, '0');
        const mi = now.getMinutes().toString().padStart(2, '0');
        const ss = now.getSeconds().toString().padStart(2, '0');
        return 'scale_v4_calibration_' + yyyy + mm + dd + '_' + hh + mi + ss + '.csv';
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
            'sample14 = round(sin(2*pi*phase) * (2^14/2.1) * (A_vpk/1.0)), A_vpk=' +
            amplitudeEffVpk.toFixed(3) + ' Vpk';

        // Frequency changes invalidate IQ lock reference and held feature.
        this.iqProjectionBaseInitialized = false;
        this.iqSProjHoldInitialized = false;
    }

    private updateFormulaAndParameterVisibility(): void {
        this.applyDriverDecimationSettings();

        const featureMethod = this.getPhase3FeatureMethod();
        const calibrationMode = this.getPhase4CalibrationMode();
        const smoothingMethod = this.getPhase5SmoothingMethod();
        const divisionEpsilon = this.getDivisionEpsilon();
        const divisionClip = this.getDivisionClip();
        const plotMaxPoints = this.getPlotMaxPoints();
        const plotDecimation = this.getPlotDecimationMethod();
        const isIq = featureMethod === 'iq_in2';

        this.enforcePhase2MappingForFeatureMethod();
        const inputMode = this.getPhase2InputMode();

        this.livePlotDecimationEl.innerText =
            'Method=' + this.getPlotDecimationMethodLabel(plotDecimation) +
            ', X=running time';

        const inputFormula = isIq
            ? 'x[i] = IN1_V[i] - mean(IN1), r[i] = IN2_V[i] - mean(IN2), Z = X / R'
            : this.getPhase2InputFormula(inputMode, divisionEpsilon, divisionClip);
        this.liveAdcFormulaEl.innerText = 'IN_V = ADC_code / 819.2 (14-bit signed, approx +/-10 V)';
        this.liveInputFormulaEl.innerText = inputFormula;
        if (isIq) {
            this.liveInputGuardEl.innerText = 'Forced mapping for IQ: IN1 signal + IN2 reference';
        } else if (inputMode === 'in1_div_in2') {
            this.liveInputGuardEl.innerText =
                'den_safe = sign(IN2_V) * max(|IN2_V|, ' +
                divisionEpsilon.toFixed(6) +
                '), clip = +/-' +
                divisionClip.toFixed(3);
        } else {
            this.liveInputGuardEl.innerText = 'Off';
        }
        this.liveInputMappingSourceEl.innerText = isIq
            ? 'Forced by IQ method (IN1 signal, IN2 reference)'
            : 'Manual (Phase 2)';

        let featureFormula = 'RMS = sqrt((1/N) * sum(x^2)), x from Phase-2 input';
        if (featureMethod === 'true_rms') {
            featureFormula = 'True RMS = sqrt((sum(x_pos^2) + sum(x_neg^2)) / (N_pos + N_neg)), N_pos=4000, N_neg=4000';
        } else if (isIq) {
            featureFormula =
                'X=(Ix+jQx), R=(Ir+jQr), Z=X/R, ' +
                'S_proj=-(dot((Re(Z)-I0,Im(Z)-Q0),u0)), u0=(I0,Q0)/|I0,Q0|';
        }
        this.liveFeatureFormulaEl.innerText = featureFormula;

        let calibrationFormula = 'Weight = Feature';
        if (calibrationMode === 'off') {
            calibrationFormula = 'Weight = Feature';
        } else if (calibrationMode === 'tare_only') {
            calibrationFormula = isIq
                ? 'Weight = Feature - Offset(Zero from IQ I0/Q0, active=0)'
                : 'Weight = Feature - Offset(Feature)';
        } else if (calibrationMode === 'scale_only') {
            calibrationFormula =
                'Hybrid: if Exp(Feature)<=1000g then Weight_kg=ln((Feature-C)/A)/B_kg else Weight_kg=((Feature-N)/M)/1000, A=' +
                this.expCalibrationA.toFixed(4) +
                ', B_kg=' +
                this.expCalibrationBkg.toFixed(6) +
                ', C=' +
                this.expCalibrationC.toFixed(4) +
                ', M=' +
                this.linCalibrationFeaturePerGram.toFixed(6) +
                ', N=' +
                this.linCalibrationFeatureOffset.toFixed(4);
        } else {
            calibrationFormula =
                'Hybrid: if Exp(Feature-Offset)<=1000g then Weight_kg=ln((((Feature-Offset)-C)/A))/B_kg else Weight_kg=((((Feature-Offset)-N)/M))/1000, A=' +
                this.expCalibrationA.toFixed(4) +
                ', B_kg=' +
                this.expCalibrationBkg.toFixed(6) +
                ', C=' +
                this.expCalibrationC.toFixed(4) +
                ', M=' +
                this.linCalibrationFeaturePerGram.toFixed(6) +
                ', N=' +
                this.linCalibrationFeatureOffset.toFixed(4);
        }
        this.liveCalibrationFormulaEl.innerText = calibrationFormula;
        this.liveOffsetDefinitionEl.innerText = isIq ? 'Offset (IQ I0/Q0)' : 'Offset (Feature)';
        this.liveFeatureTareEl.innerText = this.getActiveCalibrationOffset().toFixed(4);
        this.liveIqI0El.innerText = this.iqProjectionBaseI.toFixed(4);
        this.liveIqQ0El.innerText = this.iqProjectionBaseQ.toFixed(4);
        this.updateCalibrationUiState();

        this.smoothingWindowGroup.style.display = 'none';
        this.smoothingAlphaGroup.style.display = 'none';
        this.divisionEpsilonGroup.style.display = 'none';
        this.divisionClipGroup.style.display = 'none';
        this.iqRefGateGroup.style.display = 'none';

        if (!isIq && inputMode === 'in1_div_in2') {
            this.divisionEpsilonGroup.style.display = 'block';
            this.divisionClipGroup.style.display = 'block';
        }
        if (isIq) {
            this.iqRefGateGroup.style.display = 'block';
        }

        if (featureMethod === 'true_rms') {
            this.liveLockinParamsEl.innerText = 'N+=4000, N-=4000 around zero crossing';
        } else if (isIq) {
            this.liveLockinParamsEl.innerText =
                'f_ref=' + this.appliedFrequencyHz.toFixed(1) +
                ' Hz, complex ratio X/R, signed projection, den_eps=' + this.iqNormalizationEpsilon.toFixed(6) +
                ', ref_gate=' + this.appliedIqReferenceMinAmplitude.toFixed(3);
        } else {
            this.liveLockinParamsEl.innerText = 'Off';
        }

        if (smoothingMethod === 'none') {
            const smoothingFormula = 'Off';
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
        } else if (smoothingMethod === 'moving_average') {
            const smoothingFormula = 'y[n] = (1/M) * sum_{k=0..M-1}(x[n-k])';
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
            this.smoothingWindowGroup.style.display = 'block';
        } else if (smoothingMethod === 'rms_window') {
            const smoothingFormula = 'y[n] = sign(mu) * sqrt((1/M) * sum_{k=0..M-1}(x[n-k]^2)), mu=(1/M)sum(x)';
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
            this.smoothingWindowGroup.style.display = 'block';
        } else if (smoothingMethod === 'true_rms_window') {
            const smoothingFormula = 'y[n] = sign(mu) * true_rms(x), mu=(1/M)sum(x)';
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
            this.smoothingWindowGroup.style.display = 'block';
        } else {
            const smoothingFormula = 'y[n] = alpha * x[n] + (1 - alpha) * y[n-1]';
            this.liveSmoothingFormulaEl.innerText = smoothingFormula;
            this.smoothingAlphaGroup.style.display = 'block';
        }
        this.liveSmoothingEvalEl.innerText = this.lastSmoothingEvaluationText;
    }

    // ----------------------------
    // Module: Runtime Loops
    // ----------------------------
    private updateDiagnosticsPlot(): void {
        this.connector.getAdcDualData((in1Raw, in2Raw) => {
            this.connector.getDecimatedDacDataChannel(0, (out1Indexed) => {
                this.connector.getDecimatedDacDataChannel(1, (out2Indexed) => {
                    const nRaw = Math.max(0, Math.min(in1Raw.length, in2Raw.length));
                    const frameStartUs = this.runningPlotFrameStartUs;
                    const frameSpanUs = this.sampleIndexToMicroseconds(Math.max(1, nRaw - 1));
                    const frameEndUs = frameStartUs + frameSpanUs;

                    const plotMaxPoints = this.getPlotMaxPoints();
                    const plotDecimation = this.getPlotDecimationMethod();
                    const decimated = this.buildDecimatedDualIndexedSeries(in1Raw, in2Raw, plotDecimation, plotMaxPoints);
                    const in1 = this.sampleIndexPointsToTimeUs(decimated.in1, frameStartUs);
                    const in2 = this.sampleIndexPointsToTimeUs(decimated.in2, frameStartUs);

                    this.adcRawSize = Math.max(1, nRaw);
                    this.latestIn1Plot = in1;
                    this.latestIn2Plot = in2;
                    this.latestIn1 = in1Raw.slice(0, nRaw);
                    this.latestIn2 = in2Raw.slice(0, nRaw);

                    this.out1Plot = this.sampleIndexPointsToTimeUs(out1Indexed, frameStartUs);
                    this.out2Plot = this.sampleIndexPointsToTimeUs(out2Indexed, frameStartUs);
                    this.out1Cache = this.extractY(this.out1Plot);
                    this.out2Cache = this.extractY(this.out2Plot);

                    const result = this.runPipeline(this.latestIn1, this.latestIn2, this.out1Cache, this.out2Cache);
                    this.featureTraceValue = this.sanitizeFinite(result.featureUsed);
                    this.weightTraceValue = this.sanitizeFinite(result.weightUsed);
                    const activeOffset = this.getActiveCalibrationOffset();
                    this.lastPipelineResult = result;
                    this.lastActiveCalibrationOffset = activeOffset;

                    this.weightEl.innerText = result.weightUsed.toFixed(3);
                    this.scaleTareFeatureEl.innerText = this.featureTare.toFixed(4);

                    this.liveInputEl.innerText = this.getPhase2InputLabel(this.getPhase2InputMode());
                    this.liveFeatureRawEl.innerText = result.featureRaw.toFixed(4);
                    this.liveFeatureUsedEl.innerText = result.featureUsed.toFixed(4);
                    this.liveFeatureTareEl.innerText = activeOffset.toFixed(4);
                    this.liveKFactorEl.innerText =
                        'Exp(A,B_kg,C)=(' +
                        this.expCalibrationA.toFixed(4) + ', ' +
                        this.expCalibrationBkg.toFixed(6) + ', ' +
                        this.expCalibrationC.toFixed(4) + '), Lin(M,N)=(' +
                        this.linCalibrationFeaturePerGram.toFixed(6) + ', ' +
                        this.linCalibrationFeatureOffset.toFixed(4) + '), Switch=' +
                        this.hybridCalibrationSwitchGram.toFixed(0) + 'g';
                    this.liveWeightRawEl.innerText = result.weightRaw.toFixed(4);
                    this.liveWeightUsedEl.innerText = result.weightUsed.toFixed(4);
                    this.liveIqIEl.innerText = result.iqI.toFixed(4);
                    this.liveIqQEl.innerText = result.iqQ.toFixed(4);
                    this.lastIqI = result.iqI;
                    this.lastIqQ = result.iqQ;
                    this.liveIqAEl.innerText = result.iqA.toFixed(4);
                    this.liveIqARefEl.innerText = result.iqARef.toFixed(4);
                    this.liveIqANormEl.innerText = result.iqANorm.toFixed(4);
                    this.liveIqRefPhaseEl.innerText = result.iqRefPhaseDeg.toFixed(2) + ' deg';
                    this.liveIqI0El.innerText = this.iqProjectionBaseI.toFixed(4);
                    this.liveIqQ0El.innerText = this.iqProjectionBaseQ.toFixed(4);
                    this.liveCalibrationEvalEl.innerText = this.buildCalibrationEvaluation(result.featureUsed, this.getPhase4CalibrationMode());
                    this.liveSmoothingEvalEl.innerText = this.lastSmoothingEvaluationText;

                    const featureSeries = this.buildConstantSeries(this.latestIn1Plot.length, this.featureTraceValue);
                    const featureSeriesNeg = this.buildConstantSeries(this.latestIn1Plot.length, -this.featureTraceValue);
                    const weightSeries = this.buildConstantSeries(this.latestIn1Plot.length, this.weightTraceValue);
                    const featurePlot = this.mapSeriesToReferenceX(this.latestIn1Plot, featureSeries);
                    const featurePlotNeg = this.mapSeriesToReferenceX(this.latestIn1Plot, featureSeriesNeg);
                    const weightPlot = this.mapSeriesToReferenceX(this.latestIn1Plot, weightSeries);
                    const adcStep = Math.max(1, decimated.step);
                    const dacStep = Math.max(1, this.dacDecimationStep);

                    const range: jquery.flot.range = {
                        from: frameStartUs,
                        to: frameEndUs
                    };
                    this.lastPlotRangeUs = range;

                    const nPlotEstimate = this.latestIn1Plot.length;
                    let series: jquery.flot.dataSeries[] = [];
                    const featureLabel = this.getFeatureSeriesLabel();
                    const featureLegend = 'Feature (' + featureLabel + ')';
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
                        series.push({ label: featureLegend + ' (+)', data: featurePlot, color: '#9467bd' });
                        series.push({ label: featureLegend + ' (-)', data: featurePlotNeg, color: '#9467bd' });
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
                        result.rmsIn1.toFixed(4) + ' / ' + result.rmsIn2.toFixed(4);
                    this.liveRmsOut12El.innerText =
                        result.rmsOut1.toFixed(4) + ' / ' + result.rmsOut2.toFixed(4);
                    this.runningPlotFrameStartUs = frameEndUs;
                });
            });
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

        let count = Math.max(1, Math.min(this.getWindowSamples(), n));
        const method = this.getPhase3FeatureMethod();

        if (method === 'iq_in2') {
            // IQ demodulation is much more stable when the window spans an
            // integer number of reference periods.
            count = this.getIqCoherentWindowSamples(count, n);
            const start = n - count;
            return this.computeIqFeatureIn2(in1, in2, start, count);
        }

        const start = n - count;
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
        const scale = 2.0 / Math.max(1, count);

        let accXSin = 0;
        let accXCos = 0;
        let accRSin = 0;
        let accRCos = 0;
        for (let i = 0; i < count; i++) {
            const idx = start + i;
            const theta = twoPiFOverFs * i;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            const x = in1[idx] - meanIn1;
            const r = in2[idx] - meanIn2;

            accXSin += x * sinTheta;
            accXCos += x * cosTheta;
            accRSin += r * sinTheta;
            accRCos += r * cosTheta;
        }

        const xI = scale * accXSin;
        const xQ = scale * accXCos;
        const rI = scale * accRSin;
        const rQ = scale * accRCos;
        const refPhase = Math.atan2(rQ, rI);

        // Complex lock-in ratio: Z = X / R
        const den = rI * rI + rQ * rQ;
        const denSafe = Math.max(den, this.iqNormalizationEpsilon * this.iqNormalizationEpsilon);
        const iqI = (xI * rI + xQ * rQ) / denSafe;
        const iqQ = (xQ * rI - xI * rQ) / denSafe;
        const iqA = Math.sqrt(iqI * iqI + iqQ * iqQ);
        const iqARef = Math.sqrt(rI * rI + rQ * rQ);
        const iqANorm = iqA;
        if (!this.iqProjectionBaseInitialized) {
            this.iqProjectionBaseI = iqI;
            this.iqProjectionBaseQ = iqQ;
            this.iqProjectionBaseInitialized = true;
        }

        const baseI = this.iqProjectionBaseI;
        const baseQ = this.iqProjectionBaseQ;
        const baseMag = Math.sqrt(baseI * baseI + baseQ * baseQ);
        const uI = baseI / Math.max(baseMag, this.iqNormalizationEpsilon);
        const uQ = baseQ / Math.max(baseMag, this.iqNormalizationEpsilon);
        const deltaI = iqI - baseI;
        const deltaQ = iqQ - baseQ;
        const iqSProjRaw = -(deltaI * uI + deltaQ * uQ);
        let iqSProjUsed = iqSProjRaw;

        // Guard against unstable X/R updates when the reference is too weak.
        if (iqARef < this.appliedIqReferenceMinAmplitude) {
            iqSProjUsed = this.iqSProjHoldInitialized ? this.iqSProjHold : 0;
        } else {
            this.iqSProjHold = iqSProjRaw;
            this.iqSProjHoldInitialized = true;
        }

        return {
            feature: iqSProjUsed,
            iqI,
            iqQ,
            iqA,
            iqARef,
            iqANorm,
            iqRefPhaseDeg: refPhase * 180.0 / Math.PI
        };
    }

    private getIqCoherentWindowSamples(requested: number, available: number): number {
        const nAvail = Math.max(1, available);
        const fRef = Math.max(1.0, this.appliedFrequencyHz);
        const samplesPerPeriod = this.sampleRateHz / fRef;
        const requestedSamples = Math.max(1, Math.min(requested, nAvail));

        const requestedCycles = Math.max(1, Math.round(requestedSamples / samplesPerPeriod));
        const maxCycles = Math.max(1, Math.floor(nAvail / samplesPerPeriod));
        const cycles = Math.max(1, Math.min(requestedCycles, maxCycles));
        const coherentSamples = Math.max(1, Math.round(cycles * samplesPerPeriod));

        return Math.max(1, Math.min(coherentSamples, nAvail));
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
            if (mode === 'in1' || mode === 'iq_pair') {
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

        if (method === 'rms_window') {
            const m = this.getSmoothingWindow();
            this.smoothingHistory.push(weightRaw);
            while (this.smoothingHistory.length > m) {
                this.smoothingHistory.shift();
            }

            let sumSq = 0;
            let sum = 0;
            for (let i = 0; i < this.smoothingHistory.length; i++) {
                const v = this.smoothingHistory[i];
                sumSq += v * v;
                sum += v;
            }
            const count = Math.max(1, this.smoothingHistory.length);
            const mu = sum / count;
            const rms = Math.sqrt(sumSq / count);
            const y = mu > 0 ? rms : (mu < 0 ? -rms : 0);
            this.lastSmoothingEvaluationText =
                'y = sign(mu=' +
                mu.toFixed(4) +
                ') * rms = ' +
                y.toFixed(4);
            return y;
        }

        if (method === 'true_rms_window') {
            const m = this.getSmoothingWindow();
            this.smoothingHistory.push(weightRaw);
            while (this.smoothingHistory.length > m) {
                this.smoothingHistory.shift();
            }

            const targetPerSide = Math.max(1, Math.floor(this.smoothingHistory.length / 2));
            let sum = 0;
            for (let i = 0; i < this.smoothingHistory.length; i++) {
                sum += this.smoothingHistory[i];
            }
            const count = Math.max(1, this.smoothingHistory.length);
            const mu = sum / count;
            const trms = this.computeTrueRmsBalanced(this.smoothingHistory, targetPerSide);
            const y = mu > 0 ? trms : (mu < 0 ? -trms : 0);
            this.lastSmoothingEvaluationText =
                'y = sign(mu=' +
                mu.toFixed(4) +
                ') * true_rms(M=' +
                this.smoothingHistory.length.toString() +
                ', N_side=' +
                targetPerSide.toString() +
                ') = ' +
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

    private getActiveCalibrationOffset(): number {
        if (this.getPhase3FeatureMethod() === 'iq_in2') {
            // In IQ mode the zero offset is embedded in I0/Q0, feature-domain offset is 0.
            return 0;
        }
        return this.featureTare;
    }

    private applyCalibration(featureUsed: number, mode: Phase4Calibration): number {
        const offset = this.getActiveCalibrationOffset();
        if (mode === 'off') {
            return featureUsed;
        }
        if (mode === 'tare_only') {
            return featureUsed - offset;
        }
        if (mode === 'scale_only') {
            return this.computeHybridWeightFromFeature(featureUsed).weightKg;
        }
        const featureForScale = featureUsed - offset;
        return this.computeHybridWeightFromFeature(featureForScale).weightKg;
    }

    private buildCalibrationEvaluation(featureUsed: number, mode: Phase4Calibration): string {
        const offset = this.getActiveCalibrationOffset();
        if (mode === 'off') {
            return 'Weight = Feature = ' + featureUsed.toFixed(4);
        }
        if (mode === 'tare_only') {
            const result = featureUsed - offset;
            return 'Weight = ' + featureUsed.toFixed(4) + ' - ' + offset.toFixed(4) + ' = ' + result.toFixed(4);
        }
        if (mode === 'scale_only') {
            const hybrid = this.computeHybridWeightFromFeature(featureUsed);
            if (hybrid.branch === 'exp') {
                const ratioText = Math.max(hybrid.ratio, this.expCalibrationArgumentEpsilon).toFixed(6);
                if (hybrid.clamped) {
                    return 'Hybrid[Exp]: Weight_kg = ln(' + ratioText + ') / ' + this.expCalibrationBkg.toFixed(6) + ' -> clamped to 0.0000';
                }
                return 'Hybrid[Exp]: Weight_kg = ln(' + ratioText + ') / ' + this.expCalibrationBkg.toFixed(6) + ' = ' + hybrid.weightKg.toFixed(4);
            }
            const linNumerator = (featureUsed - this.linCalibrationFeatureOffset).toFixed(6);
            if (hybrid.clamped) {
                return 'Hybrid[Lin]: Weight_kg = (' + linNumerator + ' / ' + this.linCalibrationFeaturePerGram.toFixed(6) + ') / 1000 -> clamped to 0.0000';
            }
            return 'Hybrid[Lin]: Weight_kg = (' + linNumerator + ' / ' + this.linCalibrationFeaturePerGram.toFixed(6) + ') / 1000 = ' + hybrid.weightKg.toFixed(4);
        }
        const featureForScale = featureUsed - offset;
        const hybrid = this.computeHybridWeightFromFeature(featureForScale);
        if (hybrid.branch === 'exp') {
            const ratioText = Math.max(hybrid.ratio, this.expCalibrationArgumentEpsilon).toFixed(6);
            if (hybrid.clamped) {
                return 'Hybrid[Exp]: Weight_kg = ln(' + ratioText + ') / ' + this.expCalibrationBkg.toFixed(6) + ' (from Feature-Offset) -> clamped to 0.0000';
            }
            return 'Hybrid[Exp]: Weight_kg = ln(' + ratioText + ') / ' + this.expCalibrationBkg.toFixed(6) + ' (from Feature-Offset) = ' + hybrid.weightKg.toFixed(4);
        }
        const linNumerator = (featureForScale - this.linCalibrationFeatureOffset).toFixed(6);
        if (hybrid.clamped) {
            return 'Hybrid[Lin]: Weight_kg = (' + linNumerator + ' / ' + this.linCalibrationFeaturePerGram.toFixed(6) + ') / 1000 (from Feature-Offset) -> clamped to 0.0000';
        }
        return 'Hybrid[Lin]: Weight_kg = (' + linNumerator + ' / ' + this.linCalibrationFeaturePerGram.toFixed(6) + ') / 1000 (from Feature-Offset) = ' + hybrid.weightKg.toFixed(4);
    }

    private updateCalibrationUiState(): void {
        const mode = this.getPhase4CalibrationMode();
        const tareEnabled = this.usesTare(mode);
        const scaleEnabled = this.usesScaleFactor(mode);

        this.tareBtn.disabled = !tareEnabled;
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
        if (mode === 'iq_pair') {
            return 'x[i] = IN1_V[i], r[i] = IN2_V[i] (IQ pair)';
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

    private clampIqReferenceMinAmplitude(amplitude: number): number {
        return Math.max(0.0, Math.min(5.0, amplitude));
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

    private sanitizeFinite(value: number): number {
        if (Number.isFinite(value)) {
            return value;
        }
        return 0;
    }

    private buildDecimatedDualIndexedSeries(
        in1: number[],
        in2: number[],
        method: PlotDecimationMethod,
        maxPoints: number
    ): {in1: number[][]; in2: number[][]; step: number} {
        const n = Math.max(0, Math.min(in1.length, in2.length));
        const out1: number[][] = [];
        const out2: number[][] = [];
        if (n <= 0) {
            return { in1: out1, in2: out2, step: 1 };
        }

        const clampedMax = Math.max(1, maxPoints);
        const pushAtIndex = (idx: number) => {
            out1.push([idx, in1[idx]]);
            out2.push([idx, in2[idx]]);
        };

        if (method === 'none') {
            for (let i = 0; i < n; i++) {
                pushAtIndex(i);
            }
            return { in1: out1, in2: out2, step: 1 };
        }

        if (method === 'stride') {
            const step = Math.max(1, Math.ceil(n / clampedMax));
            for (let i = 0; i < n; i += step) {
                pushAtIndex(i);
            }
            return { in1: out1, in2: out2, step };
        }

        if (method === 'mean') {
            const step = Math.max(1, Math.ceil(n / clampedMax));
            for (let start = 0; start < n; start += step) {
                const end = Math.min(n, start + step);
                let sum1 = 0;
                let sum2 = 0;
                for (let i = start; i < end; i++) {
                    sum1 += in1[i];
                    sum2 += in2[i];
                }
                const denom = Math.max(1, end - start);
                out1.push([start, sum1 / denom]);
                out2.push([start, sum2 / denom]);
            }
            return { in1: out1, in2: out2, step };
        }

        const targetBuckets = Math.max(1, Math.floor(clampedMax / 2));
        const step = Math.max(1, Math.ceil(n / targetBuckets));
        for (let start = 0; start < n; start += step) {
            const end = Math.min(n, start + step);
            let minIdx = start;
            let maxIdx = start;
            let minVal = in1[start];
            let maxVal = in1[start];

            for (let i = start + 1; i < end; i++) {
                if (in1[i] < minVal) {
                    minVal = in1[i];
                    minIdx = i;
                }
                if (in1[i] > maxVal) {
                    maxVal = in1[i];
                    maxIdx = i;
                }
            }

            if (minIdx === maxIdx) {
                pushAtIndex(minIdx);
            } else if (minIdx < maxIdx) {
                pushAtIndex(minIdx);
                pushAtIndex(maxIdx);
            } else {
                pushAtIndex(maxIdx);
                pushAtIndex(minIdx);
            }
        }
        return { in1: out1, in2: out2, step };
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
        if (method === 'iq_in2') return 'IQ Sproj';
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
            label === 'IQ Sproj' ||
            label.indexOf('RMS (+)') === 0 ||
            label.indexOf('RMS (-)') === 0 ||
            label.indexOf('True RMS (+)') === 0 ||
            label.indexOf('True RMS (-)') === 0 ||
            label.indexOf('IQ Sproj (+)') === 0 ||
            label.indexOf('IQ Sproj (-)') === 0 ||
            label === 'Feature' ||
            label.indexOf('Feature (') === 0
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
        if (mode === 'iq_pair') return 'IQ pair (IN1 signal + IN2 ref)';
        if (mode === 'in1_div_in2') return 'IN1 / IN2';
        return 'IN1 - IN2';
    }

}

let app = new App(window, document, location.hostname, $('#plot-placeholder'));
