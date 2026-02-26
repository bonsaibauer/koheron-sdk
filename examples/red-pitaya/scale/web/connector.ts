// ----------------------------
// Module: Frontend Driver Connector
// ----------------------------
class Connector {

    // ----------------------------
    // State: Driver Handle + Command Table
    // ----------------------------
    private driver: Driver;
    private cmds: Commands;

    // ----------------------------
    // Module: Initialization
    // ----------------------------
    constructor(private client: Client) {

        this.driver = this.client.getDriver('AdcDacBram');
        this.cmds = this.driver.getCmds();

        this.client.send(Command(this.driver.id, this.cmds['set_dac_function'], 1, 10000.0));
        this.client.send(Command(this.driver.id, this.cmds['set_output_channel'], 0));
        this.client.send(Command(this.driver.id, this.cmds['set_dac_amplitude'], 10.0));

    }

    // ----------------------------
    // Module: Generic Connector Interface
    // ----------------------------
    setRange(rangeVal: jquery.flot.range): void {
        // Intentionally unused for this instrument.
    }

    // ----------------------------
    // Module: DAC Control Commands
    // ----------------------------
    setFunction(data: number, freq: number): void {
        this.client.send(Command(this.driver.id, this.cmds['set_dac_function'], data, freq));
    }

    setOutputChannel(channel: number): void {
        this.client.send(Command(this.driver.id, this.cmds['set_output_channel'], channel));
    }

    setAmplitude(amplitudeVpk: number): void {
        this.client.send(Command(this.driver.id, this.cmds['set_dac_amplitude'], amplitudeVpk));
    }

    setPlotDecimation(mode: number, maxPoints: number): void {
        this.client.send(Command(this.driver.id, this.cmds['set_plot_decimation'], mode, maxPoints));
    }

    // ----------------------------
    // Module: Driver Metadata Reads
    // ----------------------------
    getConfigAsText(callback: (text: string) => void): void {
        this.client.readString(
            Command(this.driver.id, this.cmds['get_config_as_text']),
            (str: string) => callback(str)
        );
    }

    getAdcRmsData(nSamples: number, callback: (rms0: number, rms1: number) => void): void {
        this.client.readTuple(
            Command(this.driver.id, this.cmds['get_adc_rms_data'], nSamples),
            'ff',
            (tup: [number, number]) => callback(tup[0], tup[1])
        );
    }

    getAdcSize(callback: (size: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_adc_size']),
            (x: number) => callback(x)
        );
    }

    getDacSize(callback: (size: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_dac_size']),
            (x: number) => callback(x)
        );
    }

    getWaveformLength(callback: (len: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['getlen']),
            (x: number) => callback(x)
        );
    }

    getOutputChannel(callback: (channel: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_output_channel']),
            (x: number) => callback(x)
        );
    }

    getDacAmplitude(callback: (amplitudeVpk: number) => void): void {
        this.client.readFloat64(
            Command(this.driver.id, this.cmds['get_dac_amplitude']),
            (x: number) => callback(x)
        );
    }

    getPlotDecimationMode(callback: (mode: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_plot_decimation_mode']),
            (x: number) => callback(x)
        );
    }

    getPlotDecimationMaxPoints(callback: (maxPoints: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_plot_decimation_max_points']),
            (x: number) => callback(x)
        );
    }

    getAdcDecimationStep(callback: (step: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_adc_decimation_step']),
            (x: number) => callback(x)
        );
    }

    getDacDecimationStep(callback: (step: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_dac_decimation_step']),
            (x: number) => callback(x)
        );
    }

    // ----------------------------
    // Module: ADC/DAC Waveform Reads for Plotting
    // ----------------------------
    getDecimatedDataChannel(channel: number, callback: (points: number[][]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_decimated_data_xy'], channel),
            (array: Float32Array) => callback(this.parseInterleavedXY(array))
        );
    }

    getDecimatedDacDataChannel(channel: number, callback: (points: number[][]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_decimated_dac_data_xy'], channel),
            (array: Float32Array) => callback(this.parseInterleavedXY(array))
        );
    }

    // ----------------------------
    // Module: Driver Diagnostics Readouts
    // ----------------------------
    getAdcRawData(nAvg: number, callback: (adc0: number, adc1: number) => void): void {
        this.client.readTuple(
            Command(this.driver.id, this.cmds['get_adc_raw_data'], nAvg), 'ii',
            (tup: [number, number]) => {
                callback(tup[0], tup[1]);
            }
        );
    }

    getAdcSnapshot(callback: (array: Uint32Array) => void): void {
        this.client.readUint32Vector(
            Command(this.driver.id, this.cmds['get_adc_snapshot']),
            (array: Uint32Array) => callback(array)
        );
    }

    getDacSnapshot(callback: (array: Uint32Array) => void): void {
        this.client.readUint32Vector(
            Command(this.driver.id, this.cmds['get_dac_snapshot']),
            (array: Uint32Array) => callback(array)
        );
    }

    private parseInterleavedXY(array: Float32Array): number[][] {
        const n = Math.floor(array.length / 2);
        const points: number[][] = new Array(n);
        for (let i = 0; i < n; i++) {
            points[i] = [array[2 * i], array[2 * i + 1]];
        }
        return points;
    }

}
