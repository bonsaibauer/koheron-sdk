// ----------------------------
// Module: Workflow Type System
// ----------------------------
type Phase2Input = 'in1' | 'in2' | 'in1_minus_in2' | 'in1_div_in2';
type Phase3Feature = 'rms' | 'true_rms';
type Phase4Calibration = 'off' | 'tare_only' | 'scale_only' | 'tare_scale';
type Phase5Smoothing = 'none' | 'moving_average' | 'ema';
type DriverAction =
    'rms' |
    'true_rms';
type DriverRefreshMode = 'off' | '1hz' | '5hz';
type PlotMode = 'signals' | 'module_pipeline';
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
    private signalModeSelect: HTMLSelectElement;
    private outputChannelSelect: HTMLSelectElement;
    private amplitudeInput: HTMLInputElement;
    private frequencyInput: HTMLInputElement;

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

    // ----------------------------
    // State: Formula Output Fields
    // ----------------------------
    private formulaSourceEl: HTMLElement;
    private formulaInputEl: HTMLElement;
    private formulaFeatureEl: HTMLElement;
    private formulaCalibrationEl: HTMLElement;
    private formulaSmoothingEl: HTMLElement;
    private formulaPlotEl: HTMLElement;

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

    // ----------------------------
    // State: Plot Runtime
    // ----------------------------
    private lastPlotRangeUs: jquery.flot.range = {from: 0, to: 0};
    private adcRawSize = 16384;
    private dacRawSize = 16384;
    private adcDecimationStep = 1;
    private dacDecimationStep = 1;
    private plotModeSelect: HTMLSelectElement;
    private plotDecimationMethodSelect: HTMLSelectElement;

    private curveVisible: {[key: string]: boolean} = {
        in1: true,
        in2: true,
        out1: true,
        out2: false,
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

                this.updateFormulaAndParameterVisibility();
                this.applySignalSourceSettings();

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
        this.plotModeSelect = <HTMLSelectElement>document.getElementById('plot-mode');
        this.plotDecimationMethodSelect = <HTMLSelectElement>document.getElementById('plot-decimation-method');

        const onPlotSettingsChanged = () => {
            this.updateCurveControlUiState(document);
            this.updateFormulaAndParameterVisibility();
        };

        this.plotModeSelect.addEventListener('change', onPlotSettingsChanged);
        this.plotDecimationMethodSelect.addEventListener('change', onPlotSettingsChanged);

        const plotPlaceholder = $('#plot-placeholder');
        plotPlaceholder.on('click', '.legendLabel', (event: JQueryEventObject) => {
            if (this.getPlotMode() !== 'signals') {
                return;
            }

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

        this.updateCurveControlUiState(document);
    }

    private updateCurveControlUiState(document: Document): void {
        const curveControlsEnabled = this.getPlotMode() === 'signals';
        const curveIds = ['curve-in1', 'curve-in2', 'curve-out1', 'curve-out2', 'curve-feature', 'curve-weight'];

        for (let i = 0; i < curveIds.length; i++) {
            const checkbox = <HTMLInputElement>document.getElementById(curveIds[i]);
            if (!checkbox) {
                continue;
            }
            checkbox.disabled = !curveControlsEnabled;
            checkbox.title = curveControlsEnabled ? '' : 'Only active in plot mode "Signals".';
        }
    }

    // ----------------------------
    // Module: Source + Driver Panel UI
    // ----------------------------
    private bindSignalSource(document: Document): void {
        this.signalModeSelect = <HTMLSelectElement>document.getElementById('signal-mode');
        this.outputChannelSelect = <HTMLSelectElement>document.getElementById('output-channel');
        this.amplitudeInput = <HTMLInputElement>document.getElementById('signal-amplitude');
        this.frequencyInput = <HTMLInputElement>document.getElementById('signal-frequency');

        const onChange = () => this.applySignalSourceSettings();

        this.signalModeSelect.addEventListener('change', onChange);
        this.outputChannelSelect.addEventListener('change', onChange);
        this.amplitudeInput.addEventListener('change', onChange);
        this.frequencyInput.addEventListener('change', onChange);
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

        this.formulaSourceEl = <HTMLElement>document.getElementById('formula-source');
        this.formulaInputEl = <HTMLElement>document.getElementById('formula-input');
        this.formulaFeatureEl = <HTMLElement>document.getElementById('formula-feature');
        this.formulaCalibrationEl = <HTMLElement>document.getElementById('formula-calibration');
        this.formulaSmoothingEl = <HTMLElement>document.getElementById('formula-smoothing');
        this.formulaPlotEl = <HTMLElement>document.getElementById('formula-plot');

        const onWorkflowChanged = () => {
            this.resetSmoothingState();
            this.updateFormulaAndParameterVisibility();
        };

        this.phase2InputSelect.addEventListener('change', onWorkflowChanged);
        this.phase3FeatureSelect.addEventListener('change', onWorkflowChanged);
        this.phase4CalibrationSelect.addEventListener('change', onWorkflowChanged);
        this.phase5SmoothingSelect.addEventListener('change', onWorkflowChanged);
        this.rmsWindowSamplesInput.addEventListener('change', onWorkflowChanged);
        this.smoothingWindowInput.addEventListener('change', onWorkflowChanged);
        this.smoothingAlphaInput.addEventListener('change', onWorkflowChanged);
        this.divisionEpsilonInput.addEventListener('change', onWorkflowChanged);
        this.divisionClipInput.addEventListener('change', onWorkflowChanged);
        this.plotMaxPointsInput.addEventListener('change', onWorkflowChanged);
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
    private applySignalSourceSettings(): void {
        const signalType = Number(this.signalModeSelect.value);
        const frequencyCmd = this.parseSignalSourceFrequencyHz(this.frequencyInput.value, 10000);
        const outputChannel = Number(this.outputChannelSelect.value);
        const amplitudeCmd = this.parseSignalSourceAmplitudeVpk(this.amplitudeInput.value, 1.0);
        const frequencyEff = this.clampFrequencyHz(frequencyCmd);
        const amplitudeEff = this.clampAmplitudeVpk(amplitudeCmd);

        this.connector.setFunction(signalType, frequencyEff);
        this.connector.setOutputChannel(outputChannel);
        this.connector.setAmplitude(amplitudeEff);

        this.liveSourceEl.innerText = this.getSignalMethodLabel(signalType) + ' -> ' + this.getOutputChannelLabel(outputChannel);
        this.liveSourceClampEl.innerText =
            'f_cmd=' + frequencyCmd.toFixed(1) +
            ' -> f_eff=' + frequencyEff.toFixed(1) +
            ' Hz, A_cmd=' + amplitudeCmd.toFixed(3) +
            ' -> A_eff=' + amplitudeEff.toFixed(3) + ' Vpk';
        this.liveDacFormulaEl.innerText =
            'sample14 = round(norm * (2^14/2.1) * (A_eff/10)), A_eff=' +
            amplitudeEff.toFixed(3) + ' Vpk';
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
        const plotMode = this.getPlotMode();
        const plotDecimation = this.getPlotDecimationMethod();

        this.formulaSourceEl.innerText = 'f_eff = clamp(f_cmd, 1, fs/2), A_eff = clamp(A_cmd, 0, 10), fs = 125e6';
        this.formulaPlotEl.innerText =
            'Mode=' + this.getPlotModeLabel(plotMode) +
            ', Method=' + this.getPlotDecimationMethodLabel(plotDecimation) +
            ', N_plot_max=' + plotMaxPoints.toString() +
            ', X=exact sample index (driver)';
        this.livePlotDecimationEl.innerText =
            'Mode=' + this.getPlotModeLabel(plotMode) +
            ', Method=' + this.getPlotDecimationMethodLabel(plotDecimation) +
            ', X=index exact';

        const inputFormula = this.getPhase2InputFormula(inputMode, divisionEpsilon, divisionClip);
        this.formulaInputEl.innerText = inputFormula;
        this.liveAdcFormulaEl.innerText = 'IN_V = ADC_code / 819.2 (14-bit signed, approx +/-10 V)';
        this.liveInputFormulaEl.innerText = inputFormula;
        if (inputMode === 'in1_div_in2') {
            this.liveInputGuardEl.innerText =
                'den_safe = sign(IN2_V) * max(|IN2_V|, ' +
                divisionEpsilon.toFixed(6) +
                '), clip = +/-' +
                divisionClip.toFixed(3);
        } else {
            this.liveInputGuardEl.innerText = 'Off';
        }

        const featureFormula = featureMethod === 'true_rms'
            ? 'True RMS = sqrt((sum(x_pos^2) + sum(x_neg^2)) / (N_pos + N_neg)), N_pos=4000, N_neg=4000'
            : 'RMS = sqrt((1/N) * sum(x^2)), x from Phase-2 input';
        this.formulaFeatureEl.innerText = featureFormula;
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
        this.formulaCalibrationEl.innerText = calibrationFormula;
        this.liveCalibrationFormulaEl.innerText = calibrationFormula;
        this.updateCalibrationUiState();

        this.smoothingWindowGroup.style.display = 'none';
        this.smoothingAlphaGroup.style.display = 'none';
        this.divisionEpsilonGroup.style.display = 'none';
        this.divisionClipGroup.style.display = 'none';

        if (inputMode === 'in1_div_in2') {
            this.divisionEpsilonGroup.style.display = 'block';
            this.divisionClipGroup.style.display = 'block';
        }

        this.liveLockinParamsEl.innerText = featureMethod === 'true_rms' ? 'N+=4000, N-=4000 around zero crossing' : 'Off';

        if (smoothingMethod === 'none') {
            this.formulaSmoothingEl.innerText = 'Off';
            this.liveSmoothingFormulaEl.innerText = 'Off';
        } else if (smoothingMethod === 'moving_average') {
            this.formulaSmoothingEl.innerText = 'y[n] = (1/M) * sum_{k=0..M-1}(x[n-k])';
            this.liveSmoothingFormulaEl.innerText = this.formulaSmoothingEl.innerText;
            this.smoothingWindowGroup.style.display = 'block';
        } else {
            this.formulaSmoothingEl.innerText = 'y[n] = alpha * x[n] + (1 - alpha) * y[n-1]';
            this.liveSmoothingFormulaEl.innerText = this.formulaSmoothingEl.innerText;
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
                const in1 = this.sampleIndexPointsToTimeUs(in1Indexed);
                const in2 = this.sampleIndexPointsToTimeUs(in2Indexed);

                this.latestIn1Plot = in1;
                this.latestIn2Plot = in2;
                this.latestIn1 = this.extractY(in1);
                this.latestIn2 = this.extractY(in2);

                const result = this.runPipeline(this.latestIn1, this.latestIn2, this.out1Cache, this.out2Cache);
                this.featureTraceValue = result.featureUsed;
                this.weightTraceValue = result.weightUsed;

                const featureSeries = this.buildConstantSeries(this.latestIn1.length, this.featureTraceValue);
                const featureRawSeries = this.buildConstantSeries(this.latestIn1.length, result.featureRaw);
                const weightSeries = this.buildConstantSeries(this.latestIn1.length, this.weightTraceValue);
                const weightRawSeries = this.buildConstantSeries(this.latestIn1.length, result.weightRaw);
                const phase2InputSeries = this.buildInputSeriesForMode(this.latestIn1, this.latestIn2, this.getPhase2InputMode());
                const phase2InputPlot = this.mapSeriesToReferenceX(this.latestIn1Plot, phase2InputSeries);
                const featurePlot = this.mapSeriesToReferenceX(this.latestIn1Plot, featureSeries);
                const featureRawPlot = this.mapSeriesToReferenceX(this.latestIn1Plot, featureRawSeries);
                const weightPlot = this.mapSeriesToReferenceX(this.latestIn1Plot, weightSeries);
                const weightRawPlot = this.mapSeriesToReferenceX(this.latestIn1Plot, weightRawSeries);
                const adcStep = Math.max(1, this.adcDecimationStep);
                const dacStep = Math.max(1, this.dacDecimationStep);

                const range: jquery.flot.range = {
                    from: 0,
                    to: this.sampleIndexToMicroseconds(Math.max(1, this.adcRawSize - 1))
                };
                this.lastPlotRangeUs = range;

                const plotMaxPoints = this.getPlotMaxPoints();
                const plotDecimation = this.getPlotDecimationMethod();
                const plotMode = this.getPlotMode();
                let nPlotEstimate = this.latestIn1Plot.length;
                let series: jquery.flot.dataSeries[] = [];

                if (plotMode === 'signals') {
                    const allSeries: {[key: string]: jquery.flot.dataSeries} = {
                        in1: { label: 'IN1', data: this.latestIn1Plot, color: '#1f77b4' },
                        in2: { label: 'IN2', data: this.latestIn2Plot, color: '#ff7f0e' },
                        out1: { label: 'OUT1', data: this.out1Plot, color: '#2ca02c' },
                        out2: { label: 'OUT2', data: this.out2Plot, color: '#d62728' },
                        feature: { label: 'Feature', data: featurePlot, color: '#9467bd' },
                        weight: { label: 'Weight', data: weightPlot, color: '#8c564b' }
                    };

                    for (const key in allSeries) {
                        if (!this.curveVisible[key]) {
                            continue;
                        }
                        series.push(allSeries[key]);
                    }
                } else {
                    const moduleSeries: jquery.flot.dataSeries[] = [
                        { label: 'x[i] (Phase 2)', data: phase2InputPlot, color: '#1f77b4' },
                        { label: 'Feature (Phase 3)', data: featureRawPlot, color: '#9467bd' },
                        { label: 'Weight raw (Phase 4)', data: weightRawPlot, color: '#17becf' },
                        { label: 'Weight final (Phase 5)', data: weightPlot, color: '#8c564b' }
                    ];
                    series = moduleSeries;
                    nPlotEstimate = phase2InputPlot.length;
                }

                this.livePlotDecimationEl.innerText =
                    'Mode=' + this.getPlotModeLabel(plotMode) +
                    ', Method=' + this.getPlotDecimationMethodLabel(plotDecimation) +
                    ', N_raw=' + this.adcRawSize.toString() +
                    ', step_drv=' + adcStep.toString() +
                    ', step_dac=' + dacStep.toString() +
                    ', N_plot_max=' + plotMaxPoints.toString() +
                    ', N_plot=' + nPlotEstimate.toString() +
                    ', X=index exact';

                this.plotBasics.redrawSeries(series, range, () => {
                    requestAnimationFrame(() => this.updateDiagnosticsPlot());
                });

                this.liveRmsIn12El.innerText = result.rmsIn1.toFixed(4) + ' / ' + result.rmsIn2.toFixed(4);
                this.liveRmsOut12El.innerText = result.rmsOut1.toFixed(4) + ' / ' + result.rmsOut2.toFixed(4);

                this.connector.getDecimatedDacDataChannel(0, (out1Indexed) => {
                    this.connector.getDecimatedDacDataChannel(1, (out2Indexed) => {
                        this.out1Plot = this.sampleIndexPointsToTimeUs(out1Indexed);
                        this.out2Plot = this.sampleIndexPointsToTimeUs(out2Indexed);
                        this.out1Cache = this.extractY(this.out1Plot);
                        this.out2Cache = this.extractY(this.out2Plot);
                    });
                });
            });
        });
    }

    private updateScaleLoop(): void {
        if (this.latestIn1.length > 0 && this.latestIn2.length > 0) {
            const result = this.runPipeline(this.latestIn1, this.latestIn2, this.out1Cache, this.out2Cache);

            this.featureTraceValue = result.featureUsed;
            this.weightTraceValue = result.weightUsed;

            this.weightEl.innerText = result.weightUsed.toFixed(3);
            this.scaleTareFeatureEl.innerText = this.featureTare.toFixed(4);

            this.liveInputEl.innerText = this.getPhase2InputLabel(this.getPhase2InputMode());
            this.liveFeatureRawEl.innerText = result.featureRaw.toFixed(4);
            this.liveFeatureUsedEl.innerText = result.featureUsed.toFixed(4);
            this.liveFeatureTareEl.innerText = this.featureTare.toFixed(4);
            this.liveKFactorEl.innerText = this.calibrationFactor.toFixed(6);
            this.liveWeightRawEl.innerText = result.weightRaw.toFixed(4);
            this.liveWeightUsedEl.innerText = result.weightUsed.toFixed(4);
            this.liveCalibrationEvalEl.innerText = this.buildCalibrationEvaluation(result.featureUsed, this.getPhase4CalibrationMode());
            this.liveSmoothingEvalEl.innerText = this.lastSmoothingEvaluationText;
        }

        setTimeout(() => {
            this.updateScaleLoop();
        }, 100);
    }

    // ----------------------------
    // Module: Signal Processing Core
    // ----------------------------
    private runPipeline(in1: number[], in2: number[], out1: number[], out2: number[]): PipelineResult {
        const rmsIn1 = this.computeRms(in1);
        const rmsIn2 = this.computeRms(in2);
        const rmsOut1 = this.computeRms(out1);
        const rmsOut2 = this.computeRms(out2);

        const featureRaw = this.computeFeature(in1, in2);
        const featureUsed = featureRaw;

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
            rmsOut2
        };
    }

    private computeFeature(in1: number[], in2: number[]): number {
        const n = Math.min(in1.length, in2.length);
        if (n <= 0) {
            return 0;
        }

        const count = Math.max(1, Math.min(this.getWindowSamples(), n));
        const start = n - count;
        const method = this.getPhase3FeatureMethod();

        const x = this.getInputSeriesForWindow(in1, in2, start, count, this.getPhase2InputMode());

        if (method === 'true_rms') {
            return this.computeTrueRmsBalanced(x, 4000);
        }
        return this.computeRms(x);
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
        const mode = this.phase2InputSelect.value;
        if (mode === 'in1' || mode === 'in2' || mode === 'in1_minus_in2' || mode === 'in1_div_in2') {
            return mode;
        }
        return 'in1';
    }

    private getPhase3FeatureMethod(): Phase3Feature {
        const mode = this.phase3FeatureSelect.value;
        if (mode === 'rms' || mode === 'true_rms') {
            return mode;
        }
        return 'rms';
    }

    private getPhase4CalibrationMode(): Phase4Calibration {
        const mode = this.phase4CalibrationSelect.value;
        if (mode === 'off' || mode === 'tare_only' || mode === 'scale_only' || mode === 'tare_scale') {
            return mode;
        }
        return 'tare_scale';
    }

    private getPhase5SmoothingMethod(): Phase5Smoothing {
        const mode = this.phase5SmoothingSelect.value;
        if (mode === 'none' || mode === 'moving_average' || mode === 'ema') {
            return mode;
        }
        return 'none';
    }

    private getPlotMode(): PlotMode {
        const mode = this.plotModeSelect.value;
        if (mode === 'signals' || mode === 'module_pipeline') {
            return mode;
        }
        return 'signals';
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
        const parsed = this.parseNumber(this.rmsWindowSamplesInput.value, 8000);
        return Math.max(8000, Math.min(16384, Math.round(parsed)));
    }

    private getSmoothingWindow(): number {
        const parsed = this.parseNumber(this.smoothingWindowInput.value, 5);
        return Math.max(1, Math.min(100, Math.round(parsed)));
    }

    private getSmoothingAlpha(): number {
        const parsed = this.parseNumber(this.smoothingAlphaInput.value, 0.2);
        return Math.max(0.01, Math.min(1.0, parsed));
    }

    private getPlotMaxPoints(): number {
        const parsed = this.parseNumber(this.plotMaxPointsInput.value, 2048);
        return Math.max(128, Math.min(20000, Math.round(parsed)));
    }

    private getDivisionEpsilon(): number {
        const parsed = this.parseNumber(this.divisionEpsilonInput.value, 0.01);
        return Math.max(0.000001, Math.min(5.0, parsed));
    }

    private getDivisionClip(): number {
        const parsed = this.parseNumber(this.divisionClipInput.value, 100.0);
        return Math.max(0.1, Math.min(1000000.0, parsed));
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
        return Math.max(1.0, Math.min(this.sampleRateHz / 2.0, frequencyHz));
    }

    private clampAmplitudeVpk(amplitudeVpk: number): number {
        return Math.max(0.0, Math.min(10.0, amplitudeVpk));
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

    private sampleIndexPointsToTimeUs(points: number[][]): number[][] {
        const out: number[][] = new Array(points.length);
        for (let i = 0; i < points.length; i++) {
            out[i] = [this.sampleIndexToMicroseconds(points[i][0]), points[i][1]];
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

    private parseSignalSourceAmplitudeVpk(raw: string, fallback: number): number {
        const parsed = this.parseNumber(raw, fallback);
        const normalized = raw.toLowerCase();
        if (normalized.indexOf('vpp') >= 0) {
            return parsed / 2.0;
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

    private getSeriesKeyFromLabel(label: string): string | null {
        if (label === 'IN1') return 'in1';
        if (label === 'IN2') return 'in2';
        if (label === 'OUT1') return 'out1';
        if (label === 'OUT2') return 'out2';
        if (label === 'Feature') return 'feature';
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

    private getSignalMethodLabel(signalType: number): string {
        if (signalType === 0) return 'BRAM Ramp';
        if (signalType === 1) return 'Sine';
        if (signalType === 2) return 'Sawtooth';
        if (signalType === 3) return 'Triangle';
        return 'Unknown';
    }

    private getOutputChannelLabel(outputChannel: number): string {
        if (outputChannel === 0) return 'OUT1';
        if (outputChannel === 1) return 'OUT2';
        return 'OUT1 + OUT2';
    }

    private getPlotModeLabel(mode: PlotMode): string {
        if (mode === 'module_pipeline') {
            return 'Module pipeline';
        }
        return 'Signals';
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
