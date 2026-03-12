// ----------------------------
// Module: Workflow Type System
// ----------------------------
type Phase4Calibration = 'off' | 'tare_only' | 'scale_only' | 'tare_scale';
type DriverRefreshMode = 'off' | '1hz' | '5hz';

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
    private amplitudeInput: HTMLInputElement;
    private frequencyInput: HTMLInputElement;
    private phase1SaveBtn: HTMLButtonElement;
    private appliedOutputChannel = 2;
    private appliedFrequencyHz = this.signalSourceDefaultFrequencyHz;
    private appliedAmplitudeVpp = this.signalSourceDefaultAmplitudeVpp;

    // ----------------------------
    // State: Driver Panel Controls
    // ----------------------------
    private driverRefreshModeSelect: HTMLSelectElement;
    private driverSamplesInput: HTMLInputElement;
    private driverRunBtn: HTMLButtonElement;
    private driverOutputEl: HTMLElement;
    private driverAutoTimer: number | null = null;
    private driverRequestInFlight = false;

    // ----------------------------
    // State: Workflow Controls
    // ----------------------------
    private phase4CalibrationSelect: HTMLSelectElement;
    private phase3SaveBtn: HTMLButtonElement;
    private phase4SaveBtn: HTMLButtonElement;
    private phase5SaveBtn: HTMLButtonElement;

    private rmsWindowSamplesInput: HTMLInputElement;
    private iqRefGateInput: HTMLInputElement;
    private smoothingAlphaInput: HTMLInputElement;
    private plotMaxPointsInput: HTMLInputElement;
    private iqRefGateGroup: HTMLElement;
    private smoothingAlphaGroup: HTMLElement;
    private appliedPhase4Calibration: Phase4Calibration = 'tare_scale';
    private appliedWindowSamples = 8000;
    private readonly iqReferenceMinAmplitudeDefault = 0.05;
    private appliedIqReferenceMinAmplitude = this.iqReferenceMinAmplitudeDefault;
    private appliedSmoothingAlpha = 0.10;

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
        this.driverRefreshModeSelect = <HTMLSelectElement>document.getElementById('driver-refresh-mode');
        this.driverSamplesInput = <HTMLInputElement>document.getElementById('driver-samples');
        this.driverRunBtn = <HTMLButtonElement>document.getElementById('btn-driver-run');
        this.driverOutputEl = <HTMLElement>document.getElementById('driver-output');

        this.driverRefreshModeSelect.addEventListener('change', () => this.updateDriverAutoRun());
        this.driverSamplesInput.addEventListener('change', () => this.clampDriverSamplesInput());
        this.driverRunBtn.addEventListener('click', () => this.executeDriverAction());

        this.driverOutputEl.innerText = 'Ready.';
        if (this.liveDriverActionEl) {
            this.liveDriverActionEl.innerText = 'rms';
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

    private clampDriverSamplesInput(): void {
        this.driverSamplesInput.value = '8000';
    }

    private writeDriverOutput(text: string): void {
        const ts = new Date().toLocaleTimeString();
        this.driverOutputEl.innerText = '[' + ts + '] ' + text;
        if (this.liveDriverResultEl) {
            this.liveDriverResultEl.innerText = text;
        }
    }

    private executeDriverAction(): void {
        if (this.liveDriverActionEl) {
            this.liveDriverActionEl.innerText = 'rms';
        }
        if (this.driverRequestInFlight) {
            return;
        }

        const n = 8000;
        this.driverRequestInFlight = true;
        const finalize = () => {
            this.driverRequestInFlight = false;
        };

        this.connector.getAdcRmsData(n, (rms0, rms1) => {
            this.writeDriverOutput(
                'RMS (' + n.toString() + ' samples): IN1=' + rms0.toFixed(4) +
                ', IN2=' + rms1.toFixed(4) +
                ' counts'
            );
            finalize();
        });
    }

    // ----------------------------
    // Module: Workflow Panel UI
    // ----------------------------
    private bindWorkflowControls(document: Document): void {
        this.phase4CalibrationSelect = <HTMLSelectElement>document.getElementById('phase4-calibration');
        this.phase3SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase3-save');
        this.phase4SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase4-save');
        this.phase5SaveBtn = <HTMLButtonElement>document.getElementById('btn-phase5-save');

        this.rmsWindowSamplesInput = <HTMLInputElement>document.getElementById('rms-window-samples');
        this.iqRefGateInput = <HTMLInputElement>document.getElementById('iq-ref-gate');
        this.smoothingAlphaInput = <HTMLInputElement>document.getElementById('smoothing-alpha');
        this.plotMaxPointsInput = <HTMLInputElement>document.getElementById('plot-max-points');
        this.iqRefGateGroup = <HTMLElement>document.getElementById('iq-ref-gate-group');
        this.smoothingAlphaGroup = <HTMLElement>document.getElementById('smoothing-alpha-group');

        this.phase3SaveBtn.addEventListener('click', () => this.applyPhase3Settings());
        this.phase4SaveBtn.addEventListener('click', () => this.applyPhase4Settings());
        this.phase5SaveBtn.addEventListener('click', () => this.applyPhase5Settings());
        this.plotMaxPointsInput.addEventListener('change', () => this.updateFormulaAndParameterVisibility());
    }

    private applyPhase3Settings(): void {
        this.appliedWindowSamples = this.clampWindowSamples(this.parseNumber(this.rmsWindowSamplesInput.value, this.appliedWindowSamples));
        this.appliedIqReferenceMinAmplitude = this.clampIqReferenceMinAmplitude(
            this.parseNumber(this.iqRefGateInput.value, this.appliedIqReferenceMinAmplitude)
        );
        this.rmsWindowSamplesInput.value = this.appliedWindowSamples.toString();
        this.iqRefGateInput.value = this.appliedIqReferenceMinAmplitude.toFixed(3);
        this.iqProjectionBaseInitialized = false;
        this.iqSProjHoldInitialized = false;

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
        this.appliedSmoothingAlpha = this.clampSmoothingAlpha(this.parseNumber(this.smoothingAlphaInput.value, this.appliedSmoothingAlpha));

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

        this.tareBtn = <HTMLButtonElement>document.getElementById('btn-tare');
        this.tareBtn.addEventListener('click', () => {
            const mode = this.getPhase4CalibrationMode();
            if (!(mode === 'tare_only' || mode === 'tare_scale')) {
                return;
            }
            // In IQ signed projection mode, tare defines the projection origin in I/Q space.
            this.iqProjectionBaseI = this.lastIqI;
            this.iqProjectionBaseQ = this.lastIqQ;
            this.iqProjectionBaseInitialized = true;
            this.iqSProjHold = 0;
            this.iqSProjHoldInitialized = true;
            this.scaleTareFeatureEl.innerText = '0.0000';
            this.liveFeatureTareEl.innerText = '0.0000';
            this.liveIqI0El.innerText = this.iqProjectionBaseI.toFixed(4);
            this.liveIqQ0El.innerText = this.iqProjectionBaseQ.toFixed(4);
        });

        this.scaleTareFeatureEl.innerText = '0.0000';
        this.updateCalibrationUiState();
        this.liveDriverActionEl.innerText = 'rms';
        this.liveDriverResultEl.innerText = this.driverOutputEl ? this.driverOutputEl.innerText : 'Ready.';
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


    // ----------------------------
    // Module: Formula + Live Trace
    // ----------------------------
    private applyPhase1Settings(): void {
        const signalType = 1; // Sine only
        const frequencyCmd = this.parseSignalSourceFrequencyHz(this.frequencyInput.value, this.signalSourceDefaultFrequencyHz);
        const amplitudeCmdVpp = this.parseSignalSourceAmplitudeVpp(this.amplitudeInput.value, this.signalSourceDefaultAmplitudeVpp);
        const frequencyEff = this.clampFrequencyHz(frequencyCmd);
        const amplitudeEffVpp = this.clampAmplitudeVpp(amplitudeCmdVpp);
        const amplitudeEffVpk = amplitudeEffVpp / 2.0;

        this.appliedOutputChannel = 2; // Fixed: OUT1 + OUT2
        this.appliedFrequencyHz = frequencyEff;
        this.appliedAmplitudeVpp = amplitudeEffVpp;

        this.connector.setFunction(signalType, this.appliedFrequencyHz);
        this.connector.setOutputChannel(this.appliedOutputChannel);
        this.connector.setAmplitude(amplitudeEffVpk);

        this.frequencyInput.value = this.formatFrequencyInputValue(this.appliedFrequencyHz);
        this.amplitudeInput.value = this.formatAmplitudeInputValue(this.appliedAmplitudeVpp);

        this.liveSourceEl.innerText = 'Sine -> OUT1 + OUT2';
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

        const calibrationMode = this.getPhase4CalibrationMode();
        const plotMaxPoints = this.getPlotMaxPoints();

        this.livePlotDecimationEl.innerText =
            'Method=Stride' +
            ', X=running time';

        this.liveAdcFormulaEl.innerText = 'IN_V = ADC_code / 819.2 (14-bit signed, approx +/-10 V)';
        this.liveInputFormulaEl.innerText = 'x[i] = IN1_V[i] - mean(IN1), r[i] = IN2_V[i] - mean(IN2), Z = X / R';
        this.liveInputGuardEl.innerText = 'Forced mapping for IQ: IN1 signal + IN2 reference';
        this.liveInputMappingSourceEl.innerText = 'Forced by IQ method (IN1 signal, IN2 reference)';
        this.liveFeatureFormulaEl.innerText =
            'X=(Ix+jQx), R=(Ir+jQr), Z=X/R, ' +
            'S_proj=-(dot((Re(Z)-I0,Im(Z)-Q0),u0)), u0=(I0,Q0)/|I0,Q0|';

        let calibrationFormula = 'Weight = Feature';
        if (calibrationMode === 'off') {
            calibrationFormula = 'Weight = Feature';
        } else if (calibrationMode === 'tare_only') {
            calibrationFormula = 'Weight = Feature - Offset(Zero from IQ I0/Q0, active=0)';
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
        this.liveOffsetDefinitionEl.innerText = 'Offset (IQ I0/Q0)';
        this.liveFeatureTareEl.innerText = '0.0000';
        this.liveIqI0El.innerText = this.iqProjectionBaseI.toFixed(4);
        this.liveIqQ0El.innerText = this.iqProjectionBaseQ.toFixed(4);
        this.updateCalibrationUiState();

        this.smoothingAlphaGroup.style.display = 'none';
        this.iqRefGateGroup.style.display = 'block';
        this.liveLockinParamsEl.innerText =
            'f_ref=' + this.appliedFrequencyHz.toFixed(1) +
            ' Hz, complex ratio X/R, signed projection, den_eps=' + this.iqNormalizationEpsilon.toFixed(6) +
            ', ref_gate=' + this.appliedIqReferenceMinAmplitude.toFixed(3);
        this.liveSmoothingFormulaEl.innerText = 'y[n] = alpha * x[n] + (1 - alpha) * y[n-1]';
        this.smoothingAlphaGroup.style.display = 'block';
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
                    const decimated = this.buildDecimatedDualIndexedSeries(in1Raw, in2Raw, plotMaxPoints);
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
                    const activeOffset = 0;
                    this.lastPipelineResult = result;

                    this.weightEl.innerText = result.weightUsed.toFixed(3);
                    this.scaleTareFeatureEl.innerText = '0.0000';

                    this.liveInputEl.innerText = 'IQ pair (IN1 signal + IN2 ref)';
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
                    const featureLabel = 'IQ Sproj';
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
                        'Method=Stride' +
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
        // IQ demodulation is much more stable when the window spans an
        // integer number of reference periods.
        count = this.getIqCoherentWindowSamples(count, n);
        const start = n - count;
        return this.computeIqFeatureIn2(in1, in2, start, count);
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

    // ----------------------------
    // Module: Post-Processing (Phase 5)
    // ----------------------------
    private applySmoothing(weightRaw: number): number {
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
        this.emaWeight = 0;
        this.emaInitialized = false;
        this.lastSmoothingEvaluationText = 'Off';
    }

    // ----------------------------
    // Module: Workflow Selection + Parameters
    // ----------------------------
    private getPhase4CalibrationMode(): Phase4Calibration {
        return this.appliedPhase4Calibration;
    }

    private applyDriverDecimationSettings(): void {
        const maxPoints = this.getPlotMaxPoints();
        const modeValue = 1;

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

    // ----------------------------
    // Module: Calibration Mapping (Phase 4)
    // ----------------------------
    private applyCalibration(featureUsed: number, mode: Phase4Calibration): number {
        const offset = 0;
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
        const offset = 0;
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
        const tareEnabled = mode === 'tare_only' || mode === 'tare_scale';
        const scaleEnabled = mode === 'scale_only' || mode === 'tare_scale';

        this.tareBtn.disabled = !tareEnabled;
        this.weightUnitEl.innerText = scaleEnabled ? 'kg' : 'feature';
    }

    // ----------------------------
    // Module: Numeric Parameter Readers
    // ----------------------------
    private getWindowSamples(): number {
        return this.appliedWindowSamples;
    }

    private getSmoothingAlpha(): number {
        return this.appliedSmoothingAlpha;
    }

    private getPlotMaxPoints(): number {
        const parsed = this.parseNumber(this.plotMaxPointsInput.value, 2048);
        return Math.max(128, Math.min(20000, Math.round(parsed)));
    }

    // ----------------------------
    // Module: Formula Builder + Clamp Rules
    // ----------------------------

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

    private clampSmoothingAlpha(alpha: number): number {
        return Math.max(0.01, Math.min(1.0, alpha));
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

        const step = Math.max(1, Math.ceil(n / clampedMax));
        for (let i = 0; i < n; i += step) {
            pushAtIndex(i);
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

    private getSeriesKeyFromLabel(label: string): string | null {
        if (label === 'IN1') return 'in1';
        if (label === 'IN2') return 'in2';
        if (label === 'OUT1') return 'out1';
        if (label === 'OUT2') return 'out2';
        if (
            label === 'IQ Sproj' ||
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

}

let app = new App(window, document, location.hostname, $('#plot-placeholder'));
