class AdcDac {
    private driver: Driver;
    private id: number;
    private cmds: Commands;

    constructor(private client: Client) {
        this.driver = this.client.getDriver('AdcDac');
        this.id = this.driver.id;
        this.cmds = this.driver.getCmds();
    }

    setDac(channel: number, value: number): void {
        const boundedChannel = channel % 2;
        const boundedValue = Math.max(0, Math.min(16383, Math.round(value)));
        this.client.send(Command(this.id, this.cmds['set_dac'], boundedValue, boundedChannel));
    }

    setDac0(value: number): void {
        const boundedValue = Math.max(0, Math.min(16383, Math.round(value)));
        this.client.send(Command(this.id, this.cmds['set_dac_0'], boundedValue));
    }

    setDac1(value: number): void {
        const boundedValue = Math.max(0, Math.min(16383, Math.round(value)));
        this.client.send(Command(this.id, this.cmds['set_dac_1'], boundedValue));
    }

    getAdc(cb: (adc0: number, adc1: number) => void): void {
        this.client.readTuple(Command(this.id, this.cmds['get_adc']), 'ii', (tup: [number, number]) => {
            cb(tup[0], tup[1]);
        });
    }
}
