interface CalibrationSample {
    id: number;
    timestamp: string;
    realWeightG: number;
    measuredWeightG: number;
    adcRaw: number;
    deltaCounts: number;
    signalFeatureValue: number;
    signalFeatureKey: string;
    referenceCapacityPf: number;
    predictedCapacityPf: number;
    predictedWeightG: number;
    tareAtMeasurement: number;
    calibrationAtMeasurement: number;
    calibrationOffsetAtMeasurement: number;
    modelSelectionAtMeasurement: string;
}

interface CalibrationModel {
    key: ModelKey;
    label: string;
    inverse: boolean;
    factor: number;
    offset: number;
    coefficients: number[];
    usedSamples: number;
    totalSamples: number;
    maxAbsError: number;
    r2: number;
    referenceDeltaCounts: number;
    mae: number;
    rmse: number;
}

type ModelKey = 'linear' | 'quadratic' | 'exponential';
type ModelSelection = ModelKey;
type ModelCriterion = 'rmse' | 'mae' | 'maxerr' | 'r2';
type SampleScope = 'all' | 'active_model';

class App {

    private imports: Imports;
    private plotBasics: PlotBasics;
    public connector: Connector;

    private signalModeSelect: HTMLSelectElement;
    private frequencySlider: HTMLInputElement;
    private frequencyValueEl: HTMLElement;

    private tareOffset = 0;
    private calibrationFactor = 0.0005;
    private calibrationOffset = 0;
    private runtimeModel: CalibrationModel | null = null;

    private adc0ValueEl: HTMLElement;
    private adc1ValueEl: HTMLElement;
    private dac0ValueEl: HTMLElement;
    private dac1ValueEl: HTMLElement;
    private weightEl: HTMLElement;

    private rmsIn1El: HTMLElement;
    private rmsIn2El: HTMLElement;
    private rmsOut1El: HTMLElement;
    private rmsOut2El: HTMLElement;
    private out1Cache: number[] = [];
    private out2Cache: number[] = [];

    private mlRealWeightInput: HTMLInputElement;
    private mlMeasureAddBtn: HTMLButtonElement;
    private mlLastMeasuredWeightEl: HTMLElement;
    private mlLastAdcEl: HTMLElement;
    private mlSamplesBodyEl: HTMLElement;
    private mlResetValuesBtn: HTMLButtonElement;
    private mlRecommendedFactorEl: HTMLElement;
    private mlRecommendedOffsetEl: HTMLElement;
    private mlRecommendedModelEl: HTMLElement;
    private mlRecommendedUsedSamplesEl: HTMLElement;
    private mlRecommendedMaeEl: HTMLElement;
    private mlRecommendedRmseEl: HTMLElement;
    private mlRecommendedMaxErrorEl: HTMLElement;
    private mlRecommendedR2El: HTMLElement;
    private mlApplyRecommendedBtn: HTMLButtonElement;
    private mlSampleSelectEl: HTMLSelectElement;
    private mlSelectedDetailsEl: HTMLElement;
    private mlPlotPlaceholder: JQuery;
    private mlModelSelectEl: HTMLSelectElement;
    private mlCriterionSelectEl: HTMLSelectElement;
    private mlSampleScopeSelectEl: HTMLSelectElement;
    private mlOutlierSigmaInput: HTMLInputElement;
    private mlRidgeLambdaInput: HTMLInputElement;
    private mlReferenceDeltaInput: HTMLInputElement;
    private mlAvgCountInput: HTMLInputElement;
    private mlInverseModeEl: HTMLInputElement;
    private mlSignalFeatureSelectEl: HTMLSelectElement;
    private mlRefAInput: HTMLInputElement;
    private mlRefBInput: HTMLInputElement;
    private mlRefC0Input: HTMLInputElement;
    private mlLiveCapacityEl: HTMLElement;
    private mlLiveWeightFromCapacityEl: HTMLElement;

    private mlSamples: CalibrationSample[] = [];
    private mlSelectedSampleId: number | null = null;
    private mlModel: CalibrationModel | null = null;
    private nextSampleId = 1;
    private mlWorkflowEnabled = false;

    private readonly sampleRateHz = 125000000;
    private lastPlotRangeUs: jquery.flot.range = {from: 0, to: 0};

    private curveVisible: {[key: string]: boolean} = {
        in1: true,
        in2: true,
        out1: true,
        out2: true,
        weight: false
    };

    constructor(window: Window, document: Document, ip: string, plot_placeholder: JQuery) {

        const client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init(() => {
                this.injectInstrumentTabs(window, document);
                this.imports = new Imports(document);
                this.connector = new Connector(client);

                this.plotBasics = new PlotBasics(document, plot_placeholder, 4096, 0, 4096, -11, 11, this.connector, '', '');
                this.bindControls(document);
                this.bindLegendToggle(document, plot_placeholder);
                this.bindPlotActions(document);
                this.bindScaleTools(document);

                this.updateDiagnosticsPlot();
                this.updateScaleLoop();
            });
        }, false);

        window.onbeforeunload = () => {
            client.exit();
        };
    }

    private injectInstrumentTabs(window: Window, document: Document): void {
        const main = document.getElementById('main');
        if (!main || document.getElementById('scale-ml-tabs')) {
            return;
        }

        const pathname = (window.location.pathname || '').toLowerCase();
        const page = pathname.substring(pathname.lastIndexOf('/') + 1);
        const isMlPage = page === 'ml.html';

        const tabs = document.createElement('ul');
        tabs.id = 'scale-ml-tabs';
        tabs.className = 'nav nav-tabs';
        tabs.style.marginBottom = '12px';

        const scaleTab = document.createElement('li');
        if (!isMlPage) {
            scaleTab.className = 'active';
        }
        const scaleLink = document.createElement('a');
        scaleLink.href = 'scale.html';
        scaleLink.textContent = 'Scale';
        scaleTab.appendChild(scaleLink);

        const mlTab = document.createElement('li');
        if (isMlPage) {
            mlTab.className = 'active';
        }
        const mlLink = document.createElement('a');
        mlLink.href = 'ml.html';
        mlLink.textContent = 'ML';
        mlTab.appendChild(mlLink);

        tabs.appendChild(scaleTab);
        tabs.appendChild(mlTab);

        main.insertBefore(tabs, main.firstChild);
    }

    private bindControls(document: Document): void {
        this.signalModeSelect = <HTMLSelectElement>document.getElementById('signal-mode');
        this.frequencySlider = <HTMLInputElement>document.getElementById('slider1');
        this.frequencyValueEl = <HTMLElement>document.getElementById('freq-value');

        const applySignal = () => {
            const signalType = Number(this.signalModeSelect.value);
            const freq = Number(this.frequencySlider.value);
            this.connector.setFunction(signalType, freq);
            this.frequencyValueEl.innerText = freq.toString();
        };

        this.signalModeSelect.addEventListener('change', () => applySignal());
        this.frequencySlider.addEventListener('input', () => applySignal());

        this.bindCurveToggle(document, 'curve-in1', 'in1');
        this.bindCurveToggle(document, 'curve-in2', 'in2');
        this.bindCurveToggle(document, 'curve-out1', 'out1');
        this.bindCurveToggle(document, 'curve-out2', 'out2');
        this.bindCurveToggle(document, 'curve-weight', 'weight');

        applySignal();
    }

    private bindCurveToggle(document: Document, elementId: string, key: string): void {
        const checkbox = <HTMLInputElement>document.getElementById(elementId);
        checkbox.checked = this.curveVisible[key];
        checkbox.addEventListener('change', () => {
            this.curveVisible[key] = checkbox.checked;
        });
    }

    private bindLegendToggle(document: Document, plotPlaceholder: JQuery): void {
        plotPlaceholder.on('click', '.legendLabel', (event: JQueryEventObject) => {
            const label = ($(event.currentTarget).text() || '').trim();
            const key = this.getSeriesKeyFromLabel(label);

            if (!key) {
                return;
            }

            this.curveVisible[key] = !this.curveVisible[key];
            this.setCheckboxFromKey(document, key, this.curveVisible[key]);
        });
    }

    private bindPlotActions(document: Document): void {
        const resetBtn = <HTMLButtonElement>document.getElementById('btn-plot-reset-view');
        if (!resetBtn) {
            return;
        }

        resetBtn.addEventListener('click', () => {
            this.plotBasics.resetView(this.lastPlotRangeUs.from, this.lastPlotRangeUs.to);
        });
    }

    private getSeriesKeyFromLabel(label: string): string | null {
        if (label === 'IN1') return 'in1';
        if (label === 'IN2') return 'in2';
        if (label === 'OUT1') return 'out1';
        if (label === 'OUT2') return 'out2';
        if (label === 'Weight (kg)') return 'weight';
        return null;
    }

    private setCheckboxFromKey(document: Document, key: string, checked: boolean): void {
        const elementMap: {[key: string]: string} = {
            in1: 'curve-in1',
            in2: 'curve-in2',
            out1: 'curve-out1',
            out2: 'curve-out2',
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

    private bindScaleTools(document: Document): void {
        this.adc0ValueEl = <HTMLElement>document.getElementById('adc0-value');
        this.adc1ValueEl = <HTMLElement>document.getElementById('adc1-value');
        this.dac0ValueEl = <HTMLElement>document.getElementById('dac0-value');
        this.dac1ValueEl = <HTMLElement>document.getElementById('dac1-value');
        this.weightEl = <HTMLElement>document.getElementById('weight-value');

        this.rmsIn1El = <HTMLElement>document.getElementById('rms-in1');
        this.rmsIn2El = <HTMLElement>document.getElementById('rms-in2');
        this.rmsOut1El = <HTMLElement>document.getElementById('rms-out1');
        this.rmsOut2El = <HTMLElement>document.getElementById('rms-out2');

        const calibrationInput = <HTMLInputElement>document.getElementById('input-calibration');
        const calibrationOffsetInput = <HTMLInputElement>document.getElementById('input-calibration-offset');
        const saveScaleBtn = <HTMLButtonElement>document.getElementById('btn-save-scale');
        const tareBtn = <HTMLButtonElement>document.getElementById('btn-tare');

        this.calibrationFactor = this.parseNumber(calibrationInput.value, this.calibrationFactor);
        if (calibrationOffsetInput) {
            this.calibrationOffset = this.parseNumber(calibrationOffsetInput.value, this.calibrationOffset);
        }

        saveScaleBtn.onclick = () => {
            this.calibrationFactor = this.parseNumber(calibrationInput.value, this.calibrationFactor);
            if (calibrationOffsetInput) {
                this.calibrationOffset = this.parseNumber(calibrationOffsetInput.value, this.calibrationOffset);
            }
            this.runtimeModel = null;
        };

        tareBtn.onclick = () => {
            this.connector.getAdcRawData(16, (adc0, _) => {
                this.tareOffset = adc0;
            });
        };

        const mlRealWeightInputEl = <HTMLInputElement>document.getElementById('input-ml-real-weight');
        const mlMeasureAddBtnEl = <HTMLButtonElement>document.getElementById('btn-ml-measure-add');
        if (!mlRealWeightInputEl || !mlMeasureAddBtnEl) {
            this.mlWorkflowEnabled = false;
            return;
        }

        this.mlRealWeightInput = mlRealWeightInputEl;
        this.mlMeasureAddBtn = mlMeasureAddBtnEl;
        this.mlLastMeasuredWeightEl = <HTMLElement>document.getElementById('ml-last-measured-weight');
        this.mlLastAdcEl = <HTMLElement>document.getElementById('ml-last-adc');
        this.mlSamplesBodyEl = <HTMLElement>document.getElementById('ml-samples-body');
        this.mlResetValuesBtn = <HTMLButtonElement>document.getElementById('btn-ml-reset-values');
        this.mlRecommendedFactorEl = <HTMLElement>document.getElementById('ml-recommended-factor');
        this.mlRecommendedOffsetEl = <HTMLElement>document.getElementById('ml-recommended-offset');
        this.mlRecommendedModelEl = <HTMLElement>document.getElementById('ml-recommended-model');
        this.mlRecommendedUsedSamplesEl = <HTMLElement>document.getElementById('ml-recommended-used-samples');
        this.mlRecommendedMaeEl = <HTMLElement>document.getElementById('ml-recommended-mae');
        this.mlRecommendedRmseEl = <HTMLElement>document.getElementById('ml-recommended-rmse');
        this.mlRecommendedMaxErrorEl = <HTMLElement>document.getElementById('ml-recommended-max-error');
        this.mlRecommendedR2El = <HTMLElement>document.getElementById('ml-recommended-r2');
        this.mlApplyRecommendedBtn = <HTMLButtonElement>document.getElementById('btn-ml-apply-recommended');
        this.mlSampleSelectEl = <HTMLSelectElement>document.getElementById('ml-sample-select');
        this.mlSelectedDetailsEl = <HTMLElement>document.getElementById('ml-selected-details');
        this.mlPlotPlaceholder = $('#ml-plot-placeholder');
        this.mlModelSelectEl = <HTMLSelectElement>document.getElementById('ml-model-select');
        this.mlCriterionSelectEl = <HTMLSelectElement>document.getElementById('ml-criterion-select');
        this.mlSampleScopeSelectEl = <HTMLSelectElement>document.getElementById('ml-fit-sample-scope');
        this.mlOutlierSigmaInput = <HTMLInputElement>document.getElementById('ml-outlier-sigma');
        this.mlRidgeLambdaInput = <HTMLInputElement>document.getElementById('ml-ridge-lambda');
        this.mlReferenceDeltaInput = <HTMLInputElement>document.getElementById('ml-factor-ref-delta');
        this.mlAvgCountInput = <HTMLInputElement>document.getElementById('ml-avg-count');
        this.mlInverseModeEl = <HTMLInputElement>document.getElementById('ml-inverse-mode');
        this.mlSignalFeatureSelectEl = <HTMLSelectElement>document.getElementById('ml-signal-feature');
        this.mlRefAInput = <HTMLInputElement>document.getElementById('ml-ref-a');
        this.mlRefBInput = <HTMLInputElement>document.getElementById('ml-ref-b');
        this.mlRefC0Input = <HTMLInputElement>document.getElementById('ml-ref-c0');
        this.mlLiveCapacityEl = <HTMLElement>document.getElementById('ml-live-capacity');
        this.mlLiveWeightFromCapacityEl = <HTMLElement>document.getElementById('ml-live-weight-from-capacity');

        if (!this.mlLastMeasuredWeightEl || !this.mlLastAdcEl || !this.mlSamplesBodyEl || !this.mlResetValuesBtn ||
            !this.mlRecommendedFactorEl || !this.mlRecommendedOffsetEl || !this.mlRecommendedModelEl ||
            !this.mlRecommendedUsedSamplesEl || !this.mlRecommendedMaeEl || !this.mlRecommendedRmseEl ||
            !this.mlRecommendedMaxErrorEl || !this.mlRecommendedR2El || !this.mlApplyRecommendedBtn ||
            !this.mlSampleSelectEl || !this.mlSelectedDetailsEl || this.mlPlotPlaceholder.length === 0 ||
            !this.mlModelSelectEl || !this.mlCriterionSelectEl || !this.mlSampleScopeSelectEl ||
            !this.mlOutlierSigmaInput || !this.mlRidgeLambdaInput || !this.mlReferenceDeltaInput ||
            !this.mlAvgCountInput || !this.mlInverseModeEl || !this.mlSignalFeatureSelectEl ||
            !this.mlRefAInput || !this.mlRefBInput || !this.mlRefC0Input || !this.mlLiveCapacityEl ||
            !this.mlLiveWeightFromCapacityEl) {
            this.mlWorkflowEnabled = false;
            return;
        }
        this.mlWorkflowEnabled = true;

        const retrain = () => {
            this.recomputeMlModel();
            this.renderMlTable();
            this.renderMlDetails();
            this.renderMlPlot();
        };

        this.mlModelSelectEl.onchange = retrain;
        this.mlCriterionSelectEl.onchange = retrain;
        this.mlSampleScopeSelectEl.onchange = retrain;
        this.mlOutlierSigmaInput.onchange = retrain;
        this.mlRidgeLambdaInput.onchange = retrain;
        this.mlReferenceDeltaInput.onchange = retrain;
        this.mlInverseModeEl.onchange = retrain;
        this.mlSignalFeatureSelectEl.onchange = retrain;
        this.mlRefAInput.onchange = retrain;
        this.mlRefBInput.onchange = retrain;
        this.mlRefC0Input.onchange = retrain;

        this.mlMeasureAddBtn.onclick = () => {
            const realWeightG = this.parseNumber(this.mlRealWeightInput.value, NaN);
            if (!isFinite(realWeightG) || realWeightG < 0) {
                return;
            }

            const avgCount = this.getMlAverageCount();
            this.connector.getAdcRawData(avgCount, (adc0, _) => {
                const deltaCounts = adc0 - this.tareOffset;
                const signalFeatureValue = this.extractSignalFeatureValue(adc0, deltaCounts);
                const referenceCapacityPf = this.capacityFromReferenceModel(realWeightG);
                const predictedCapacityPf = this.predictCapacityFromRuntime(adc0, deltaCounts);
                const measuredWeightG = this.weightFromReferenceCapacity(predictedCapacityPf);

                const sample: CalibrationSample = {
                    id: this.nextSampleId++,
                    timestamp: new Date().toISOString(),
                    realWeightG,
                    measuredWeightG,
                    adcRaw: adc0,
                    deltaCounts,
                    signalFeatureValue,
                    signalFeatureKey: this.getSelectedSignalFeature(),
                    referenceCapacityPf,
                    predictedCapacityPf,
                    predictedWeightG: measuredWeightG,
                    tareAtMeasurement: this.tareOffset,
                    calibrationAtMeasurement: this.calibrationFactor,
                    calibrationOffsetAtMeasurement: this.calibrationOffset,
                    modelSelectionAtMeasurement: this.getCurrentModelTag()
                };

                this.mlSamples.push(sample);
                this.mlSelectedSampleId = sample.id;

                this.mlLastMeasuredWeightEl.innerText = measuredWeightG.toFixed(3);
                this.mlLastAdcEl.innerText = adc0.toString();
                this.mlLiveCapacityEl.innerText = predictedCapacityPf.toFixed(4);
                this.mlLiveWeightFromCapacityEl.innerText = measuredWeightG.toFixed(3);

                this.recomputeMlModel();
                this.renderMlTable();
                this.renderMlSampleSelect();
                this.renderMlDetails();
                this.renderMlPlot();
            });
        };

        this.mlResetValuesBtn.onclick = () => {
            this.mlSamples = [];
            this.mlSelectedSampleId = null;
            this.mlModel = null;
            this.nextSampleId = 1;

            this.mlLastMeasuredWeightEl.innerText = '-';
            this.mlLastAdcEl.innerText = '-';
            this.mlLiveCapacityEl.innerText = '-';
            this.mlLiveWeightFromCapacityEl.innerText = '-';

            this.renderMlTable();
            this.renderMlSampleSelect();
            this.renderMlModel();
            this.renderMlDetails();
            this.renderMlPlot();
        };

        this.mlApplyRecommendedBtn.onclick = () => {
            if (!this.mlModel) {
                return;
            }
            this.runtimeModel = this.cloneModel(this.mlModel);
        };

        this.mlSampleSelectEl.onchange = () => {
            const selected = this.parseNumber(this.mlSampleSelectEl.value, NaN);
            this.mlSelectedSampleId = isFinite(selected) ? selected : null;
            this.renderMlDetails();
            this.renderMlPlot();
            this.highlightSelectedTableRow();
        };

        this.renderMlTable();
        this.renderMlSampleSelect();
        this.renderMlModel();
        this.renderMlDetails();
        this.renderMlPlot();
    }

    private recomputeMlModel(): void {
        this.mlModel = this.trainSelectedModel();
        this.renderMlModel();
    }

    private trainSelectedModel(): CalibrationModel | null {
        const selection = this.getSelectedModelSelection();
        const criterion = this.getSelectedCriterion();
        const inverse = this.isInverseModeEnabled();
        const trainingSamples = this.getTrainingSamples(selection);

        if (trainingSamples.length === 0) {
            return null;
        }

        const candidates: CalibrationModel[] = [];
        const modelKeys: ModelKey[] = [selection];

        for (let i = 0; i < modelKeys.length; i++) {
            const candidate = this.fitModel(modelKeys[i], trainingSamples, this.mlSamples.length, inverse);
            if (candidate) {
                candidates.push(candidate);
            }
        }

        if (candidates.length === 0) {
            return null;
        }

        let best = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
            if (this.isBetterModel(candidates[i], best, criterion)) {
                best = candidates[i];
            }
        }

        return best;
    }

    private fitModel(modelKey: ModelKey, samples: CalibrationSample[], totalSamples: number, inverse: boolean): CalibrationModel | null {
        const coeffs = this.solveCoefficients(modelKey, samples, inverse);
        if (!coeffs) {
            return null;
        }

        const sigma = this.getOutlierSigma();
        let usedSamples = samples.slice();
        if (sigma > 0 && samples.length >= 4) {
            const filtered = this.filterOutliers(modelKey, coeffs, samples, sigma, inverse);
            if (filtered.length >= this.minSamplesForModel(modelKey)) {
                usedSamples = filtered;
                const refit = this.solveCoefficients(modelKey, usedSamples, inverse);
                if (refit) {
                    return this.evaluateModel(modelKey, refit, usedSamples, totalSamples, inverse);
                }
            }
        }

        return this.evaluateModel(modelKey, coeffs, usedSamples, totalSamples, inverse);
    }

    private solveCoefficients(modelKey: ModelKey, samples: CalibrationSample[], inverse: boolean): number[] | null {
        if (modelKey === 'exponential') {
            return this.fitNonlinearModel(modelKey, samples, inverse);
        }

        const design = this.getModelDesign(modelKey);
        if (samples.length < design.length) {
            return null;
        }

        const lambda = this.getRidgeLambda();
        const normal: number[][] = [];
        const rhs: number[] = [];

        for (let i = 0; i < design.length; i++) {
            normal.push(new Array<number>(design.length).fill(0));
            rhs.push(0);
        }

        for (let n = 0; n < samples.length; n++) {
            const x = this.transformInput(samples[n].signalFeatureValue, inverse);
            const row = this.buildFeatures(x, modelKey);
            const y = samples[n].referenceCapacityPf;

            for (let i = 0; i < design.length; i++) {
                rhs[i] += row[i] * y;
                for (let j = 0; j < design.length; j++) {
                    normal[i][j] += row[i] * row[j];
                }
            }
        }

        for (let i = 0; i < design.length; i++) {
            normal[i][i] += lambda;
        }

        return this.solveLinearSystem(normal, rhs);
    }

    private evaluateModel(modelKey: ModelKey, coeffs: number[], samples: CalibrationSample[], totalSamples: number, inverse: boolean): CalibrationModel {
        let mae = 0;
        let mse = 0;
        let maxAbsError = 0;
        let sumY = 0;

        for (let i = 0; i < samples.length; i++) {
            sumY += samples[i].referenceCapacityPf;
        }

        const yMean = samples.length > 0 ? sumY / samples.length : 0;
        let tss = 0;

        for (let i = 0; i < samples.length; i++) {
            const predicted = this.predictByModel(modelKey, coeffs, samples[i].signalFeatureValue, inverse);
            const err = predicted - samples[i].referenceCapacityPf;
            const absErr = Math.abs(err);
            mae += absErr;
            mse += err * err;
            maxAbsError = Math.max(maxAbsError, absErr);

            const dy = samples[i].referenceCapacityPf - yMean;
            tss += dy * dy;
        }

        mae /= samples.length;
        const rmse = Math.sqrt(mse / samples.length);
        const r2 = tss > 1e-12 ? (1 - (mse / tss)) : (mse <= 1e-12 ? 1 : 0);
        const ref = this.getReferenceDeltaCounts();
        const factor = this.localFactorAt(modelKey, coeffs, ref, inverse);
        const offset = this.predictByModel(modelKey, coeffs, 0, inverse);

        return {
            key: modelKey,
            label: this.getModelLabel(modelKey) + (inverse ? ' + Inverse' : ''),
            inverse,
            factor,
            offset,
            coefficients: coeffs.slice(),
            usedSamples: samples.length,
            totalSamples,
            maxAbsError,
            r2,
            referenceDeltaCounts: ref,
            mae,
            rmse
        };
    }

    private renderMlModel(): void {
        if (!this.mlModel) {
            this.mlRecommendedModelEl.innerText = '-';
            this.mlRecommendedUsedSamplesEl.innerText = '-';
            this.mlRecommendedFactorEl.innerText = '-';
            this.mlRecommendedOffsetEl.innerText = '-';
            this.mlRecommendedMaeEl.innerText = '-';
            this.mlRecommendedRmseEl.innerText = '-';
            this.mlRecommendedMaxErrorEl.innerText = '-';
            this.mlRecommendedR2El.innerText = '-';
            return;
        }

        this.mlRecommendedModelEl.innerText = this.mlModel.label;
        this.mlRecommendedUsedSamplesEl.innerText = this.mlModel.usedSamples.toString() + ' / ' + this.mlModel.totalSamples.toString();
        this.mlRecommendedFactorEl.innerText = this.mlModel.factor.toFixed(8);
        this.mlRecommendedOffsetEl.innerText = this.mlModel.offset.toFixed(6);
        this.mlRecommendedMaeEl.innerText = this.mlModel.mae.toFixed(6);
        this.mlRecommendedRmseEl.innerText = this.mlModel.rmse.toFixed(6);
        this.mlRecommendedMaxErrorEl.innerText = this.mlModel.maxAbsError.toFixed(6);
        this.mlRecommendedR2El.innerText = this.mlModel.r2.toFixed(6);
    }

    private renderMlTable(): void {
        this.mlSamplesBodyEl.innerHTML = '';

        for (let i = 0; i < this.mlSamples.length; i++) {
            const sample = this.mlSamples[i];
            const activeCapacity = this.mlModel
                ? this.predictByModel(this.mlModel.key, this.mlModel.coefficients, sample.signalFeatureValue, this.mlModel.inverse)
                : sample.predictedCapacityPf;
            const activeWeight = this.weightFromReferenceCapacity(activeCapacity);
            const capacityError = activeCapacity - sample.referenceCapacityPf;
            const weightError = activeWeight - sample.realWeightG;

            const tr = document.createElement('tr');
            tr.dataset.sampleId = sample.id.toString();
            tr.style.cursor = 'pointer';
            tr.innerHTML =
                '<td>' + (i + 1).toString() + '</td>' +
                '<td>' + sample.realWeightG.toFixed(1) + '</td>' +
                '<td>' + sample.referenceCapacityPf.toFixed(4) + '</td>' +
                '<td>' + activeCapacity.toFixed(4) + '</td>' +
                '<td>' + activeWeight.toFixed(1) + '</td>' +
                '<td>' + sample.adcRaw.toString() + '</td>' +
                '<td>' + sample.deltaCounts.toString() + '</td>' +
                '<td>' + sample.signalFeatureValue.toFixed(4) + '</td>' +
                '<td>' + this.getModelDisplayForSelection(sample.modelSelectionAtMeasurement) + '</td>' +
                '<td>' + capacityError.toFixed(4) + '</td>' +
                '<td>' + weightError.toFixed(1) + '</td>';

            tr.onclick = () => {
                this.mlSelectedSampleId = sample.id;
                this.mlSampleSelectEl.value = sample.id.toString();
                this.renderMlDetails();
                this.renderMlPlot();
                this.highlightSelectedTableRow();
            };

            this.mlSamplesBodyEl.appendChild(tr);
        }

        this.highlightSelectedTableRow();
    }

    private highlightSelectedTableRow(): void {
        const rows = this.mlSamplesBodyEl.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            const row = <HTMLTableRowElement>rows.item(i);
            if (!row || !row.dataset.sampleId) {
                continue;
            }

            const isSelected = this.mlSelectedSampleId !== null && row.dataset.sampleId === this.mlSelectedSampleId.toString();
            row.style.backgroundColor = isSelected ? '#d9edf7' : '';
        }
    }

    private renderMlSampleSelect(): void {
        const selectedValue = this.mlSelectedSampleId !== null ? this.mlSelectedSampleId.toString() : '';

        this.mlSampleSelectEl.innerHTML = '<option value="">Keine Messung ausgewählt</option>';
        for (let i = 0; i < this.mlSamples.length; i++) {
            const sample = this.mlSamples[i];
            const opt = document.createElement('option');
            opt.value = sample.id.toString();
            opt.text = '#' + (i + 1).toString() + ' | Real ' + sample.realWeightG.toFixed(1) + ' g | Cref ' + sample.referenceCapacityPf.toFixed(3) + ' pF';
            this.mlSampleSelectEl.appendChild(opt);
        }

        if (selectedValue && this.mlSampleSelectEl.querySelector('option[value="' + selectedValue + '"]')) {
            this.mlSampleSelectEl.value = selectedValue;
        } else {
            this.mlSampleSelectEl.value = '';
        }
    }

    private renderMlDetails(): void {
        if (this.mlSelectedSampleId === null) {
            this.mlSelectedDetailsEl.innerText = 'Keine Messung ausgewählt.';
            return;
        }

        const sample = this.mlSamples.find((s) => s.id === this.mlSelectedSampleId);
        if (!sample) {
            this.mlSelectedDetailsEl.innerText = 'Keine Messung ausgewählt.';
            return;
        }

        const predicted = this.mlModel
            ? this.predictByModel(this.mlModel.key, this.mlModel.coefficients, sample.signalFeatureValue, this.mlModel.inverse)
            : NaN;
        const predictedWeightG = isFinite(predicted) ? this.weightFromReferenceCapacity(predicted) : NaN;
        const lines: string[] = [
            'Messung #' + sample.id.toString(),
            'Zeit: ' + sample.timestamp,
            'Referenzgewicht: ' + sample.realWeightG.toFixed(3) + ' g',
            'Referenzkapazität (aus C(m)): ' + sample.referenceCapacityPf.toFixed(6) + ' pF',
            'Gespeicherte C-Vorhersage: ' + sample.predictedCapacityPf.toFixed(6) + ' pF',
            'Gespeicherte m-Vorhersage: ' + sample.predictedWeightG.toFixed(3) + ' g',
            'ADC Rohwert: ' + sample.adcRaw.toString(),
            'ADC Delta (zu Tara): ' + sample.deltaCounts.toString(),
            'Signal-Feature [' + sample.signalFeatureKey + ']: ' + sample.signalFeatureValue.toFixed(6),
            'Tara bei Messung: ' + sample.tareAtMeasurement.toString(),
            'Kalibrierfaktor bei Messung: ' + sample.calibrationAtMeasurement.toFixed(8),
            'Kalibrieroffset bei Messung: ' + sample.calibrationOffsetAtMeasurement.toFixed(8),
            'Modellwahl bei Messung: ' + this.getModelDisplayForSelection(sample.modelSelectionAtMeasurement)
        ];

        if (isFinite(predicted)) {
            lines.push('Aktive C-Vorhersage: ' + predicted.toFixed(6) + ' pF');
            lines.push('Aktiver C-Fehler: ' + (predicted - sample.referenceCapacityPf).toFixed(6) + ' pF');
            lines.push('Aktive m-Vorhersage aus C: ' + predictedWeightG.toFixed(3) + ' g');
            lines.push('Aktiver m-Fehler: ' + (predictedWeightG - sample.realWeightG).toFixed(3) + ' g');
        }

        this.mlSelectedDetailsEl.innerHTML = lines.join('<br>');
    }

    private renderMlPlot(): void {
        const groupedBySelection: {[key: string]: number[][]} = {};
        let xMin = 0;
        let xMax = 0;

        for (let i = 0; i < this.mlSamples.length; i++) {
            const x = this.mlSamples[i].signalFeatureValue;
            const y = this.mlSamples[i].referenceCapacityPf;
            const selection = this.mlSamples[i].modelSelectionAtMeasurement;
            if (!groupedBySelection[selection]) {
                groupedBySelection[selection] = [];
            }
            groupedBySelection[selection].push([x, y]);

            if (i === 0) {
                xMin = x;
                xMax = x;
            } else {
                xMin = Math.min(xMin, x);
                xMax = Math.max(xMax, x);
            }
        }

        const series: jquery.flot.dataSeries[] = [];
        const selectionKeys = Object.keys(groupedBySelection);
        const palette = ['#1f77b4', '#2ca02c', '#ff7f0e', '#8c564b', '#17becf', '#9467bd'];
        for (let i = 0; i < selectionKeys.length; i++) {
            const key = selectionKeys[i];
            series.push({
                label: 'Messpunkte [' + this.getModelDisplayForSelection(key) + ']',
                data: groupedBySelection[key],
                points: { show: true, radius: 4 },
                lines: { show: false },
                color: palette[i % palette.length]
            });
        }

        if (this.mlModel && this.mlSamples.length >= 1) {
            if (xMin === xMax) {
                xMin -= 1;
                xMax += 1;
            }

            series.push({
                label: 'ML Fit [' + this.mlModel.label + ']',
                data: [
                    [xMin, this.predictByModel(this.mlModel.key, this.mlModel.coefficients, xMin, this.mlModel.inverse)],
                    [xMax, this.predictByModel(this.mlModel.key, this.mlModel.coefficients, xMax, this.mlModel.inverse)]
                ],
                points: { show: false },
                lines: { show: true, lineWidth: 2 },
                color: '#d62728'
            });
        }

        if (this.mlSelectedSampleId !== null) {
            const selected = this.mlSamples.find((s) => s.id === this.mlSelectedSampleId);
            if (selected) {
                series.push({
                    label: 'Ausgewählte Messung',
                    data: [[selected.signalFeatureValue, selected.referenceCapacityPf]],
                    points: { show: true, radius: 7 },
                    lines: { show: false },
                    color: '#2ca02c'
                });
            }
        }

        $.plot(this.mlPlotPlaceholder, series, {
            grid: {
                hoverable: true,
                clickable: true,
                borderWidth: 1
            },
            legend: {
                position: 'nw'
            },
            xaxis: { axisLabel: 'Signal-Feature x' },
            yaxis: { axisLabel: 'Kapazität C [pF]' }
        });
    }

    private getSelectedModelSelection(): ModelSelection {
        const value = this.mlModelSelectEl ? this.mlModelSelectEl.value : 'linear';
        if (value === 'linear' || value === 'quadratic' || value === 'exponential') {
            return value;
        }
        return 'linear';
    }

    private isInverseModeEnabled(): boolean {
        return !!(this.mlInverseModeEl && this.mlInverseModeEl.checked);
    }

    private getCurrentModelTag(): string {
        return this.makeModelTag(this.getSelectedModelSelection(), this.isInverseModeEnabled(), this.getSelectedSignalFeature());
    }

    private makeModelTag(selection: ModelSelection, inverse: boolean, feature: string): string {
        return selection + '|inv=' + (inverse ? '1' : '0') + '|feat=' + feature;
    }

    private getSelectedCriterion(): ModelCriterion {
        const value = this.mlCriterionSelectEl ? this.mlCriterionSelectEl.value : 'rmse';
        if (value === 'rmse' || value === 'mae' || value === 'maxerr' || value === 'r2') {
            return value;
        }
        return 'rmse';
    }

    private getSelectedSampleScope(): SampleScope {
        const value = this.mlSampleScopeSelectEl ? this.mlSampleScopeSelectEl.value : 'all';
        if (value === 'all' || value === 'active_model') {
            return value;
        }
        return 'all';
    }

    private getReferenceDeltaCounts(): number {
        return this.parseNumber(this.mlReferenceDeltaInput ? this.mlReferenceDeltaInput.value : '0', 0);
    }

    private getOutlierSigma(): number {
        const sigma = this.parseNumber(this.mlOutlierSigmaInput ? this.mlOutlierSigmaInput.value : '0', 0);
        return Math.max(0, sigma);
    }

    private getRidgeLambda(): number {
        const lambda = this.parseNumber(this.mlRidgeLambdaInput ? this.mlRidgeLambdaInput.value : '0', 0);
        return Math.max(0, lambda);
    }

    private getMlAverageCount(): number {
        const parsed = this.parseNumber(this.mlAvgCountInput ? this.mlAvgCountInput.value : '16', 16);
        const rounded = Math.round(parsed);
        return Math.max(1, rounded);
    }

    private getSelectedSignalFeature(): string {
        const value = this.mlSignalFeatureSelectEl ? this.mlSignalFeatureSelectEl.value : 'delta';
        if (value === 'delta' || value === 'abs_delta' || value === 'adc_raw' || value === 'log_abs_delta') {
            return value;
        }
        return 'delta';
    }

    private extractSignalFeatureValue(adcRaw: number, deltaCounts: number): number {
        const key = this.getSelectedSignalFeature();
        if (key === 'adc_raw') {
            return adcRaw;
        }
        if (key === 'abs_delta') {
            return Math.abs(deltaCounts);
        }
        if (key === 'log_abs_delta') {
            return Math.log(Math.abs(deltaCounts) + 1);
        }
        return deltaCounts;
    }

    private getReferenceA(): number {
        return this.parseNumber(this.mlRefAInput ? this.mlRefAInput.value : '2.95', 2.95);
    }

    private getReferenceB(): number {
        return this.parseNumber(this.mlRefBInput ? this.mlRefBInput.value : '0.00162', 0.00162);
    }

    private getReferenceC0(): number {
        return this.parseNumber(this.mlRefC0Input ? this.mlRefC0Input.value : '14.59', 14.59);
    }

    private capacityFromReferenceModel(weightG: number): number {
        const a = this.getReferenceA();
        const b = this.getReferenceB();
        const c0 = this.getReferenceC0();
        return (a * Math.exp(b * weightG)) + c0;
    }

    private weightFromReferenceCapacity(capacityPf: number): number {
        const a = this.getReferenceA();
        const b = this.getReferenceB();
        const c0 = this.getReferenceC0();
        const eps = 1e-12;
        const arg = (capacityPf - c0) / (Math.abs(a) > eps ? a : eps);
        return Math.log(Math.abs(arg) + eps) / (Math.abs(b) > eps ? b : eps);
    }

    private getModelLabel(key: ModelKey): string {
        if (key === 'linear') return 'Linear';
        if (key === 'quadratic') return 'Quadratisch';
        if (key === 'exponential') return 'Exponentiell';
        return key;
    }

    private getModelDisplayForSelection(selection: string): string {
        if (selection.indexOf('|inv=') >= 0) {
            const parts = selection.split('|');
            const base = parts.length > 0 ? parts[0] : '';
            const invPart = parts.find(p => p.indexOf('inv=') === 0) || 'inv=0';
            const featPart = parts.find(p => p.indexOf('feat=') === 0) || 'feat=delta';
            const inv = invPart === 'inv=1';
            const feat = featPart.replace('feat=', '');
            if (base === 'linear' || base === 'quadratic' || base === 'exponential') {
                return this.getModelLabel(base) + (inv ? ' + Inverse' : '') + ' [' + feat + ']';
            }
        }
        if (selection === 'linear' || selection === 'quadratic' || selection === 'exponential') {
            return this.getModelLabel(selection);
        }
        return selection;
    }

    private getTrainingSamples(selection: ModelSelection): CalibrationSample[] {
        const scope = this.getSelectedSampleScope();
        if (scope !== 'active_model') {
            return this.mlSamples.slice();
        }
        const currentTag = this.makeModelTag(selection, this.isInverseModeEnabled(), this.getSelectedSignalFeature());
        return this.mlSamples.filter(sample => sample.modelSelectionAtMeasurement === currentTag);
    }

    private minSamplesForModel(modelKey: ModelKey): number {
        return this.getModelDesign(modelKey).length;
    }

    private getModelDesign(modelKey: ModelKey): string[] {
        if (modelKey === 'linear') return ['x'];
        if (modelKey === 'quadratic') return ['x2', 'x'];
        if (modelKey === 'exponential') return ['a', 'b'];
        return ['x'];
    }

    private buildFeatures(x: number, modelKey: ModelKey): number[] {
        if (modelKey === 'linear') return [x];
        if (modelKey === 'quadratic') return [x * x, x];
        return [x];
    }

    private solveLinearSystem(aIn: number[][], bIn: number[]): number[] | null {
        const n = aIn.length;
        const a = aIn.map(row => row.slice());
        const b = bIn.slice();

        for (let i = 0; i < n; i++) {
            let pivot = i;
            let pivotAbs = Math.abs(a[i][i]);
            for (let r = i + 1; r < n; r++) {
                const v = Math.abs(a[r][i]);
                if (v > pivotAbs) {
                    pivotAbs = v;
                    pivot = r;
                }
            }

            if (pivotAbs < 1e-12) {
                return null;
            }

            if (pivot !== i) {
                const tmpRow = a[i];
                a[i] = a[pivot];
                a[pivot] = tmpRow;
                const tmpB = b[i];
                b[i] = b[pivot];
                b[pivot] = tmpB;
            }

            const diag = a[i][i];
            for (let c = i; c < n; c++) {
                a[i][c] /= diag;
            }
            b[i] /= diag;

            for (let r = 0; r < n; r++) {
                if (r === i) {
                    continue;
                }
                const factor = a[r][i];
                for (let c = i; c < n; c++) {
                    a[r][c] -= factor * a[i][c];
                }
                b[r] -= factor * b[i];
            }
        }

        return b;
    }

    private fitNonlinearModel(modelKey: ModelKey, samples: CalibrationSample[], inverse: boolean): number[] | null {
        if (samples.length < 3) {
            return null;
        }

        let minX = this.transformInput(samples[0].signalFeatureValue, inverse);
        let maxX = this.transformInput(samples[0].signalFeatureValue, inverse);
        let minY = samples[0].referenceCapacityPf;
        let maxY = samples[0].referenceCapacityPf;

        for (let i = 0; i < samples.length; i++) {
            const x = this.transformInput(samples[i].signalFeatureValue, inverse);
            const y = samples[i].referenceCapacityPf;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        const spanX = Math.max(1e-6, maxX - minX);
        const spanY = Math.max(1e-6, maxY - minY);
        let params: number[] = [Math.max(spanY, 1e-3), 1 / spanX];

        let learningRate = 1e-3;
        let bestParams = params.slice();
        let bestLoss = this.nonlinearLoss(modelKey, bestParams, samples, inverse);

        for (let iter = 0; iter < 1200; iter++) {
            const grad = this.numericalGradient(modelKey, params, samples, inverse);
            const candidate = params.map((p, i) => p - learningRate * grad[i]);
            const candidateLoss = this.nonlinearLoss(modelKey, candidate, samples, inverse);

            if (isFinite(candidateLoss) && candidateLoss <= bestLoss) {
                params = candidate;
                bestLoss = candidateLoss;
                bestParams = candidate.slice();
                learningRate = Math.min(1e-1, learningRate * 1.03);
            } else {
                learningRate *= 0.5;
                if (learningRate < 1e-10) {
                    break;
                }
            }
        }

        if (!isFinite(bestLoss)) {
            return null;
        }

        return bestParams;
    }

    private nonlinearLoss(modelKey: ModelKey, params: number[], samples: CalibrationSample[], inverse: boolean): number {
        let mse = 0;
        for (let i = 0; i < samples.length; i++) {
            const yHat = this.predictByModel(modelKey, params, samples[i].signalFeatureValue, inverse);
            if (!isFinite(yHat)) {
                return 1e30;
            }
            const err = yHat - samples[i].referenceCapacityPf;
            mse += err * err;
        }
        return mse / samples.length;
    }

    private numericalGradient(modelKey: ModelKey, params: number[], samples: CalibrationSample[], inverse: boolean): number[] {
        const grad: number[] = new Array<number>(params.length).fill(0);
        const baseLoss = this.nonlinearLoss(modelKey, params, samples, inverse);

        for (let i = 0; i < params.length; i++) {
            const step = Math.abs(params[i]) * 1e-4 + 1e-7;
            const pPlus = params.slice();
            const pMinus = params.slice();
            pPlus[i] += step;
            pMinus[i] -= step;

            const lossPlus = this.nonlinearLoss(modelKey, pPlus, samples, inverse);
            const lossMinus = this.nonlinearLoss(modelKey, pMinus, samples, inverse);

            if (isFinite(lossPlus) && isFinite(lossMinus)) {
                grad[i] = (lossPlus - lossMinus) / (2 * step);
            } else if (isFinite(lossPlus)) {
                grad[i] = (lossPlus - baseLoss) / step;
            } else if (isFinite(lossMinus)) {
                grad[i] = (baseLoss - lossMinus) / step;
            } else {
                grad[i] = 0;
            }
        }

        return grad;
    }

    private filterOutliers(modelKey: ModelKey, coeffs: number[], samples: CalibrationSample[], sigma: number, inverse: boolean): CalibrationSample[] {
        const residuals: number[] = [];
        let mean = 0;
        for (let i = 0; i < samples.length; i++) {
            const err = this.predictByModel(modelKey, coeffs, samples[i].signalFeatureValue, inverse) - samples[i].referenceCapacityPf;
            residuals.push(err);
            mean += err;
        }
        mean /= residuals.length;

        let variance = 0;
        for (let i = 0; i < residuals.length; i++) {
            const d = residuals[i] - mean;
            variance += d * d;
        }
        variance /= residuals.length;
        const std = Math.sqrt(variance);
        if (std < 1e-12) {
            return samples.slice();
        }

        const threshold = sigma * std;
        return samples.filter((_, idx) => Math.abs(residuals[idx] - mean) <= threshold);
    }

    private isBetterModel(candidate: CalibrationModel, current: CalibrationModel, criterion: ModelCriterion): boolean {
        if (criterion === 'mae') {
            return candidate.mae < current.mae;
        }
        if (criterion === 'maxerr') {
            return candidate.maxAbsError < current.maxAbsError;
        }
        if (criterion === 'r2') {
            return candidate.r2 > current.r2;
        }
        return candidate.rmse < current.rmse;
    }

    private transformInput(x: number, inverse: boolean): number {
        if (!inverse) {
            return x;
        }
        const eps = 1e-12;
        const sign = x >= 0 ? 1 : -1;
        return sign / (Math.abs(x) + eps);
    }

    private predictByModel(modelKey: ModelKey, coeffs: number[], x: number, inverse: boolean): number {
        const u = this.transformInput(x, inverse);
        if (modelKey === 'linear') {
            return coeffs[0] * u;
        }
        if (modelKey === 'quadratic') {
            return coeffs[0] * u * u + coeffs[1] * u;
        }
        if (modelKey === 'exponential') {
            return coeffs[0] * Math.exp(coeffs[1] * u);
        }
        return 0;
    }

    private localFactorAt(modelKey: ModelKey, coeffs: number[], x: number, inverse: boolean): number {
        if (inverse) {
            const h = Math.max(1e-6, Math.abs(x) * 1e-3);
            const y1 = this.predictByModel(modelKey, coeffs, x + h, true);
            const y0 = this.predictByModel(modelKey, coeffs, x - h, true);
            return (y1 - y0) / (2 * h);
        }
        if (modelKey === 'linear') {
            return coeffs[0];
        }
        if (modelKey === 'exponential') {
            return coeffs[0] * coeffs[1] * Math.exp(coeffs[1] * x);
        }
        return (2 * coeffs[0] * x) + coeffs[1];
    }

    private predictCapacityFromRuntime(adcRaw: number, deltaCounts: number): number {
        if (this.runtimeModel) {
            const feature = this.extractSignalFeatureValue(adcRaw, deltaCounts);
            return this.predictByModel(this.runtimeModel.key, this.runtimeModel.coefficients, feature, this.runtimeModel.inverse);
        }
        const fallbackWeightG = deltaCounts * this.calibrationFactor + this.calibrationOffset;
        return this.capacityFromReferenceModel(fallbackWeightG);
    }

    private predictWeightFromRuntime(adcRaw: number, deltaCounts: number): number {
        const capPf = this.predictCapacityFromRuntime(adcRaw, deltaCounts);
        return this.weightFromReferenceCapacity(capPf);
    }

    private cloneModel(model: CalibrationModel): CalibrationModel {
        return {
            key: model.key,
            label: model.label,
            inverse: model.inverse,
            factor: model.factor,
            offset: model.offset,
            coefficients: model.coefficients.slice(),
            usedSamples: model.usedSamples,
            totalSamples: model.totalSamples,
            maxAbsError: model.maxAbsError,
            r2: model.r2,
            referenceDeltaCounts: model.referenceDeltaCounts,
            mae: model.mae,
            rmse: model.rmse
        };
    }

    private updateDiagnosticsPlot(): void {
        this.connector.getDecimatedDataChannel(0, (in1) => {
            this.connector.getDecimatedDataChannel(1, (in2) => {
                const out1 = this.out1Cache;
                const out2 = this.out2Cache;
                const in1Counts = in1.map(v => Math.round(v * 819.2));
                const in2Counts = in2.map(v => Math.round(v * 819.2));
                const weightSeries = this.countsToKg(in1Counts);

                const range: jquery.flot.range = {
                    from: 0,
                    to: this.sampleIndexToMicroseconds(Math.max(1, in1.length - 1))
                };
                this.lastPlotRangeUs = range;

                const allSeries: {[key: string]: jquery.flot.dataSeries} = {
                    in1: { label: 'IN1', data: this.toPlotData(in1), color: '#1f77b4' },
                    in2: { label: 'IN2', data: this.toPlotData(in2), color: '#ff7f0e' },
                    out1: { label: 'OUT1', data: this.toPlotData(out1), color: '#2ca02c' },
                    out2: { label: 'OUT2', data: this.toPlotData(out2), color: '#d62728' },
                    weight: { label: 'Weight (kg)', data: this.toPlotData(weightSeries), color: '#9467bd' }
                };

                const series: jquery.flot.dataSeries[] = [];
                for (const key in allSeries) {
                    if (this.curveVisible[key]) {
                        series.push(allSeries[key]);
                    }
                }

                this.plotBasics.redrawSeries(series, range, () => {
                    requestAnimationFrame(() => this.updateDiagnosticsPlot());
                });

                if (in1.length > 0) {
                    this.adc0ValueEl.innerText = in1Counts[in1Counts.length - 1].toString();
                    this.adc1ValueEl.innerText = in2Counts[in2Counts.length - 1].toString();
                    this.rmsIn1El.innerText = this.computeRms(in1).toFixed(3);
                    this.rmsIn2El.innerText = this.computeRms(in2).toFixed(3);
                }

                if (out1.length > 0 && out2.length > 0) {
                    this.dac0ValueEl.innerText = out1[out1.length - 1].toFixed(3);
                    this.dac1ValueEl.innerText = out2[out2.length - 1].toFixed(3);
                    this.rmsOut1El.innerText = this.computeRms(out1).toFixed(3);
                    this.rmsOut2El.innerText = this.computeRms(out2).toFixed(3);
                } else {
                    this.dac0ValueEl.innerText = 'n/a';
                    this.dac1ValueEl.innerText = 'n/a';
                    this.rmsOut1El.innerText = 'n/a';
                    this.rmsOut2El.innerText = 'n/a';
                }

                // Refresh DAC caches independently so plot/UI keeps running even if DAC command lags.
                this.connector.getDecimatedDacDataChannel(0, (newOut1) => {
                    this.connector.getDecimatedDacDataChannel(1, (newOut2) => {
                        this.out1Cache = newOut1;
                        this.out2Cache = newOut2;
                    });
                });
            });
        });
    }

    private updateScaleLoop(): void {
        this.connector.getAdcRawData(this.getMlAverageCount(), (adc0, _) => {
            if (this.mlWorkflowEnabled) {
                const delta = adc0 - this.tareOffset;
                const weightG = this.predictWeightFromRuntime(adc0, delta);
                this.weightEl.innerText = (weightG / 1000).toFixed(3);
                if (this.mlLiveCapacityEl) {
                    this.mlLiveCapacityEl.innerText = this.predictCapacityFromRuntime(adc0, delta).toFixed(4);
                }
                if (this.mlLiveWeightFromCapacityEl) {
                    this.mlLiveWeightFromCapacityEl.innerText = weightG.toFixed(3);
                }
            } else {
                const weightKg = (adc0 - this.tareOffset) * this.calibrationFactor;
                this.weightEl.innerText = weightKg.toFixed(3);
            }

            setTimeout(() => {
                this.updateScaleLoop();
            }, 100);
        });
    }

    private countsToKg(values: number[]): number[] {
        if (this.mlWorkflowEnabled) {
            return values.map(v => this.predictWeightFromRuntime(v, v - this.tareOffset) / 1000);
        }
        return values.map(v => (v - this.tareOffset) * this.calibrationFactor);
    }

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

    private toPlotData(values: number[]): number[][] {
        const targetPts = 2048;
        const step = Math.max(1, Math.ceil(values.length / targetPts));
        const points: number[][] = [];

        for (let i = 0; i < values.length; i += step) {
            points.push([this.sampleIndexToMicroseconds(i), values[i]]);
        }

        return points;
    }

    private sampleIndexToMicroseconds(sampleIndex: number): number {
        return (sampleIndex / this.sampleRateHz) * 1e6;
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
