class Connector {

    // ----------------------------
    // Module: Driver Handles
    // ----------------------------
    private driver: Driver;
    private cmds: Commands;

    // ----------------------------
    // Module: Initialization
    // ----------------------------
    constructor(private client: Client) {
        this.driver = this.client.getDriver('ScaleSine');
        this.cmds = this.driver.getCmds();

        // LED configuration.
        this.setLeds(0);
    }

    // ----------------------------
    // Module: Write Commands
    // ----------------------------
    setLeds(mask: number): void {
        this.client.send(Command(this.driver.id, this.cmds['set_leds'], mask));
    }

    // ----------------------------
    // Module: Read Commands
    // ----------------------------
    getAdcDualData(callback: (in1: number[], in2: number[]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_adc_dual_data']),
            (array: Float32Array) => {
                const n = Math.floor(array.length / 2);
                const in1: number[] = new Array(n);
                const in2: number[] = new Array(n);

                for (let i = 0; i < n; i++) {
                    in1[i] = array[2 * i];
                    in2[i] = array[2 * i + 1];
                }

                callback(in1, in2);
            }
        );
    }

    getDecimatedDacData(callback: (points: number[][]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_decimated_dac_data_xy']),
            (array: Float32Array) => {
                const n = Math.floor(array.length / 2);
                const points: number[][] = new Array(n);

                for (let i = 0; i < n; i++) {
                    points[i] = [array[2 * i], array[2 * i + 1]];
                }

                callback(points);
            }
        );
    }

}
