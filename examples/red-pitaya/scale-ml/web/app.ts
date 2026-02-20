interface CalibrationSample {
    id: number;
    timestamp: string;
    realWeightKg: number;
    measuredWeightKg: number;
    adcRaw: number;
    deltaCounts: number;
    tareAtMeasurement: number;
    calibrationAtMeasurement: number;
}

interface CalibrationModel {
    factor: number;
    offset: number;
    mae: number;
    rmse: number;
}

class App {

    private imports: Imports;
    private plotBasics: PlotBasics;
    public connector: Connector;

    private signalModeSelect: HTMLSelectElement;
    private frequencySlider: HTMLInputElement;
    private frequencyValueEl: HTMLElement;

    private tareOffset = 0;
    private calibrationFactor = 0.0005;

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
    private mlRecommendedMaeEl: HTMLElement;
    private mlRecommendedRmseEl: HTMLElement;
    private mlApplyRecommendedBtn: HTMLButtonElement;
    private mlSampleSelectEl: HTMLSelectElement;
    private mlSelectedDetailsEl: HTMLElement;
    private mlPlotPlaceholder: JQuery;

    private mlSamples: CalibrationSample[] = [];
    private mlSelectedSampleId: number | null = null;
    private mlModel: CalibrationModel | null = null;
    private nextSampleId = 1;

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

        this.mlRealWeightInput = <HTMLInputElement>document.getElementById('input-ml-real-weight');
        this.mlMeasureAddBtn = <HTMLButtonElement>document.getElementById('btn-ml-measure-add');
        this.mlLastMeasuredWeightEl = <HTMLElement>document.getElementById('ml-last-measured-weight');
        this.mlLastAdcEl = <HTMLElement>document.getElementById('ml-last-adc');
        this.mlSamplesBodyEl = <HTMLElement>document.getElementById('ml-samples-body');
        this.mlResetValuesBtn = <HTMLButtonElement>document.getElementById('btn-ml-reset-values');
        this.mlRecommendedFactorEl = <HTMLElement>document.getElementById('ml-recommended-factor');
        this.mlRecommendedOffsetEl = <HTMLElement>document.getElementById('ml-recommended-offset');
        this.mlRecommendedMaeEl = <HTMLElement>document.getElementById('ml-recommended-mae');
        this.mlRecommendedRmseEl = <HTMLElement>document.getElementById('ml-recommended-rmse');
        this.mlApplyRecommendedBtn = <HTMLButtonElement>document.getElementById('btn-ml-apply-recommended');
        this.mlSampleSelectEl = <HTMLSelectElement>document.getElementById('ml-sample-select');
        this.mlSelectedDetailsEl = <HTMLElement>document.getElementById('ml-selected-details');
        this.mlPlotPlaceholder = $('#ml-plot-placeholder');

        this.mlMeasureAddBtn.onclick = () => {
            const realWeight = this.parseNumber(this.mlRealWeightInput.value, NaN);
            if (!isFinite(realWeight) || realWeight < 0) {
                return;
            }

            this.connector.getAdcRawData(16, (adc0, _) => {
                const deltaCounts = adc0 - this.tareOffset;
                const measuredWeight = deltaCounts * this.calibrationFactor;

                const sample: CalibrationSample = {
                    id: this.nextSampleId++,
                    timestamp: new Date().toISOString(),
                    realWeightKg: realWeight,
                    measuredWeightKg: measuredWeight,
                    adcRaw: adc0,
                    deltaCounts,
                    tareAtMeasurement: this.tareOffset,
                    calibrationAtMeasurement: this.calibrationFactor
                };

                this.mlSamples.push(sample);
                this.mlSelectedSampleId = sample.id;

                this.mlLastMeasuredWeightEl.innerText = measuredWeight.toFixed(6);
                this.mlLastAdcEl.innerText = adc0.toString();

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
            this.calibrationFactor = this.mlModel.factor;
            calibrationInput.value = this.calibrationFactor.toFixed(8);
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
        this.mlModel = this.trainLinearModel(this.mlSamples);
        this.renderMlModel();
    }

    private trainLinearModel(samples: CalibrationSample[]): CalibrationModel | null {
        if (samples.length === 0) {
            return null;
        }

        if (samples.length === 1) {
            const x = samples[0].deltaCounts;
            const y = samples[0].realWeightKg;
            const factor = Math.abs(x) > 1e-12 ? y / x : this.calibrationFactor;
            const offset = 0;
            return this.evaluateModel(samples, factor, offset);
        }

        let sumX = 0;
        let sumY = 0;
        let sumXX = 0;
        let sumXY = 0;

        for (let i = 0; i < samples.length; i++) {
            const x = samples[i].deltaCounts;
            const y = samples[i].realWeightKg;
            sumX += x;
            sumY += y;
            sumXX += x * x;
            sumXY += x * y;
        }

        const n = samples.length;
        const denom = n * sumXX - sumX * sumX;

        let factor = this.calibrationFactor;
        let offset = 0;

        if (Math.abs(denom) > 1e-12) {
            factor = (n * sumXY - sumX * sumY) / denom;
            offset = (sumY - factor * sumX) / n;
        } else {
            const refX = samples[n - 1].deltaCounts;
            const refY = samples[n - 1].realWeightKg;
            factor = Math.abs(refX) > 1e-12 ? refY / refX : this.calibrationFactor;
            offset = 0;
        }

        return this.evaluateModel(samples, factor, offset);
    }

    private evaluateModel(samples: CalibrationSample[], factor: number, offset: number): CalibrationModel {
        let mae = 0;
        let mse = 0;

        for (let i = 0; i < samples.length; i++) {
            const predicted = factor * samples[i].deltaCounts + offset;
            const err = predicted - samples[i].realWeightKg;
            mae += Math.abs(err);
            mse += err * err;
        }

        mae /= samples.length;
        const rmse = Math.sqrt(mse / samples.length);

        return { factor, offset, mae, rmse };
    }

    private renderMlModel(): void {
        if (!this.mlModel) {
            this.mlRecommendedFactorEl.innerText = '-';
            this.mlRecommendedOffsetEl.innerText = '-';
            this.mlRecommendedMaeEl.innerText = '-';
            this.mlRecommendedRmseEl.innerText = '-';
            return;
        }

        this.mlRecommendedFactorEl.innerText = this.mlModel.factor.toFixed(8);
        this.mlRecommendedOffsetEl.innerText = this.mlModel.offset.toFixed(6);
        this.mlRecommendedMaeEl.innerText = this.mlModel.mae.toFixed(6);
        this.mlRecommendedRmseEl.innerText = this.mlModel.rmse.toFixed(6);
    }

    private renderMlTable(): void {
        this.mlSamplesBodyEl.innerHTML = '';

        for (let i = 0; i < this.mlSamples.length; i++) {
            const sample = this.mlSamples[i];
            const error = sample.measuredWeightKg - sample.realWeightKg;

            const tr = document.createElement('tr');
            tr.dataset.sampleId = sample.id.toString();
            tr.style.cursor = 'pointer';
            tr.innerHTML =
                '<td>' + (i + 1).toString() + '</td>' +
                '<td>' + sample.realWeightKg.toFixed(4) + '</td>' +
                '<td>' + sample.measuredWeightKg.toFixed(4) + '</td>' +
                '<td>' + sample.adcRaw.toString() + '</td>' +
                '<td>' + error.toFixed(4) + '</td>';

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
            opt.text = '#' + (i + 1).toString() + ' | Real ' + sample.realWeightKg.toFixed(3) + ' kg | ADC ' + sample.adcRaw.toString();
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

        const predicted = this.mlModel ? (this.mlModel.factor * sample.deltaCounts + this.mlModel.offset) : NaN;
        const lines: string[] = [
            'Messung #' + sample.id.toString(),
            'Zeit: ' + sample.timestamp,
            'Real: ' + sample.realWeightKg.toFixed(6) + ' kg',
            'Gemessen (akt. Faktor): ' + sample.measuredWeightKg.toFixed(6) + ' kg',
            'ADC Rohwert: ' + sample.adcRaw.toString(),
            'ADC Delta (zu Tara): ' + sample.deltaCounts.toString(),
            'Tara bei Messung: ' + sample.tareAtMeasurement.toString(),
            'Kalibrierfaktor bei Messung: ' + sample.calibrationAtMeasurement.toFixed(8)
        ];

        if (isFinite(predicted)) {
            lines.push('ML Vorhersage: ' + predicted.toFixed(6) + ' kg');
            lines.push('ML Fehler: ' + (predicted - sample.realWeightKg).toFixed(6) + ' kg');
        }

        this.mlSelectedDetailsEl.innerHTML = lines.join('<br>');
    }

    private renderMlPlot(): void {
        const points: number[][] = [];
        let xMin = 0;
        let xMax = 0;

        for (let i = 0; i < this.mlSamples.length; i++) {
            const x = this.mlSamples[i].deltaCounts;
            const y = this.mlSamples[i].realWeightKg;
            points.push([x, y]);

            if (i === 0) {
                xMin = x;
                xMax = x;
            } else {
                xMin = Math.min(xMin, x);
                xMax = Math.max(xMax, x);
            }
        }

        const series: jquery.flot.dataSeries[] = [
            {
                label: 'Messpunkte',
                data: points,
                points: { show: true, radius: 4 },
                lines: { show: false },
                color: '#1f77b4'
            }
        ];

        if (this.mlModel && this.mlSamples.length >= 1) {
            if (xMin === xMax) {
                xMin -= 1;
                xMax += 1;
            }

            series.push({
                label: 'ML Fit',
                data: [
                    [xMin, this.mlModel.factor * xMin + this.mlModel.offset],
                    [xMax, this.mlModel.factor * xMax + this.mlModel.offset]
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
                    data: [[selected.deltaCounts, selected.realWeightKg]],
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
            xaxis: {},
            yaxis: {}
        });
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
        this.connector.getAdcRawData(8, (adc0, _) => {
            const weight = (adc0 - this.tareOffset) * this.calibrationFactor;
            this.weightEl.innerText = weight.toFixed(3);

            setTimeout(() => {
                this.updateScaleLoop();
            }, 100);
        });
    }

    private countsToKg(values: number[]): number[] {
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
