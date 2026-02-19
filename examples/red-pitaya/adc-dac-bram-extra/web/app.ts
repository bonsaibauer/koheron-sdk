class App {

    private imports: Imports;
    private plotBasics: PlotBasics;
    public connector: Connector;
    private sw: HTMLInputElement;
    private slider: HTMLInputElement;

    
    constructor(window: Window, document: Document,ip: string, plot_placeholder: JQuery) {
        
        let client = new Client(ip, 5);

        window.addEventListener('HTMLImportsLoaded', () => {
            client.init( () => {
                this.imports = new Imports(document);
                this.connector = new Connector(client);

                let n_pts:number = 12192;
                let x_min:number = 0;
                let x_max:number = 62.5;
                let y_min:number = -11;
                let y_max:number = 11;

                this.plotBasics = new PlotBasics(document, plot_placeholder, n_pts, x_min, x_max, y_min, y_max, this.connector, "setRange", "Datenpunkt");
                
	        let xLabelSpan: HTMLSpanElement = <HTMLSpanElement>document.getElementById("plot-title");
	        xLabelSpan.innerHTML = "Zeit";
                this.updatePlot();
                
                
		this.sw = <HTMLInputElement>document.getElementById("switch1");
		this.sw.addEventListener('change', (event) => {
			const target = event.target as HTMLInputElement;
			if(target.checked) this.connector.setFunction(1,Number(this.slider.value));
			else this.connector.setFunction(0,Number(this.slider.value));			
		})
		let sw2: HTMLInputElement = <HTMLInputElement>document.getElementById("switch2");
		sw2.addEventListener('change', (event) => {
			const target = event.target as HTMLInputElement;
			if(target.checked) this.connector.setChannel(1);
			else this.connector.setChannel(0);			
		})            });
        }, false);

        this.slider = document.getElementById('slider1') as HTMLInputElement;
        this.slider.addEventListener('input', (event) => {
            const value = (event.target as HTMLInputElement).value;
			if(this.sw.checked) this.connector.setFunction(1,Number(this.slider.value));
			else this.connector.setFunction(0,Number(this.slider.value));			

        });
        

        window.onbeforeunload = () => { client.exit(); };

    }
    
    
    updatePlot(): void {
	    this.connector.getDecimatedData( (plot_data: number[][], range_x: jquery.flot.range) => {
		this.plotBasics.redrawRange(plot_data, range_x, "Spannung", () => {
		    requestAnimationFrame( () => { this.updatePlot(); });
		});

	    });
    }
    
}

let app = new App(window, document, location.hostname, $('#plot-placeholder'));
