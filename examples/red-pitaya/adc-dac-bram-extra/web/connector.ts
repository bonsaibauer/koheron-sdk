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
    
   
}
