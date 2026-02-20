class Connector {

    private driver: Driver;
    private cmds: Commands;
    private channel: number;

 
    constructor(private client: Client) {

        this.driver = this.client.getDriver('AdcDacBram');
        this.cmds = this.driver.getCmds();

        this.client.send(Command(this.driver.id, this.cmds['set_dac_function'],0,1000.0));
        this.channel=0;
            
    }
    
    setRange(rangeVal: jquery.flot.range):void{
    
    }
    
    setChannel(chn:number):void{
    	this.channel=chn;
    }
    
    setFunction(data: number, freq: number):void{
    	this.client.send(Command(this.driver.id, this.cmds['set_dac_function'],data,freq))
    }

    
    getDecimatedData(callback: (data: number[][], range: jquery.flot.range) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_decimated_data'],this.channel), (array) => {
                let data: number[][] = [];
                let range: jquery.flot.range;

		    data = new Array(array.length );

		    for (let i: number = 0; i < array.length; i++) {
		        data[i] = [i, array[i]];
		    }

		    range = {
		        from: 0 ,
		        to:  (array.length-1)
		    };
                callback(data, range);
        });
    }

    getDecimatedDataChannel(channel: number, callback: (values: number[]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_decimated_data'], channel),
            (array: Float32Array) => callback(Array.prototype.slice.call(array))
        );
    }

    getDecimatedDacDataChannel(channel: number, callback: (values: number[]) => void): void {
        this.client.readFloat32Vector(
            Command(this.driver.id, this.cmds['get_decimated_dac_data'], channel),
            (array: Float32Array) => callback(Array.prototype.slice.call(array))
        );
    }

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
    
   
}
