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

        this.client.send(Command(this.driver.id, this.cmds['set_dac_function'], 1, 100000.0));
        this.client.send(Command(this.driver.id, this.cmds['set_output_channel'], 2));
        this.client.send(Command(this.driver.id, this.cmds['set_dac_amplitude'], 0.5));
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

    setLeds(mask: number): void {
        this.client.send(Command(this.driver.id, this.cmds['set_leds'], mask >>> 0));
    }

    getLeds(callback: (mask: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_leds']),
            (x: number) => callback(x)
        );
    }

    setPlotDecimation(mode: number, maxPoints: number): void {
        this.client.send(Command(this.driver.id, this.cmds['set_plot_decimation'], mode, maxPoints));
    }

    // ----------------------------
    // Module: Driver Measurement Reads
    // ----------------------------
    getAdcRmsData(nSamples: number, callback: (rms0: number, rms1: number) => void): void {
        this.client.readTuple(
            Command(this.driver.id, this.cmds['get_adc_rms_data'], nSamples),
            'ff',
            (tup: [number, number]) => callback(tup[0], tup[1])
        );
    }

    getAdcTrueRmsData(callback: (rms0: number, rms1: number, nPos: number, nNeg: number) => void): void {
        this.client.readTuple(
            Command(this.driver.id, this.cmds['get_adc_true_rms_data']),
            'ffii',
            (tup: [number, number, number, number]) => callback(tup[0], tup[1], tup[2], tup[3])
        );
    }

    // ----------------------------
    // Module: Driver Metadata Reads
    // ----------------------------
    getAdcSize(callback: (size: number) => void): void {
        this.client.readUint32(
            Command(this.driver.id, this.cmds['get_adc_size']),
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
    getAdcDualData(callback: (in1: number[], in2: number[]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_adc_dual_data']),
            (array: Float32Array) => {
                const pair = this.parseInterleavedPairSeries(array);
                callback(pair[0], pair[1]);
            }
        );
    }

    getDecimatedDacDataChannel(channel: number, callback: (points: number[][]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_decimated_dac_data_xy'], channel),
            (array: Float32Array) => callback(this.parseInterleavedXY(array))
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

    private parseInterleavedPairSeries(array: Float32Array): [number[], number[]] {
        const n = Math.floor(array.length / 2);
        const in1: number[] = new Array(n);
        const in2: number[] = new Array(n);

        for (let i = 0; i < n; i++) {
            in1[i] = array[2 * i];
            in2[i] = array[2 * i + 1];
        }

        return [in1, in2];
    }

}
