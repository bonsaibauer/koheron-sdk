class PlotBasics {

    // ----------------------------
    // Module: Plot State
    // ----------------------------
    private options: jquery.flot.plotOptions;

    // ----------------------------
    // Module: Initialization
    // ----------------------------
    // Plot configuration:
    // - Axis labels: time/us and voltage/V
    // - Legend always enabled
    // - No interactive selection plugin
    constructor(
        private plotPlaceholder: JQuery,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number
    ) {
        this.options = {
            canvas: true,
            series: { shadowSize: 0 },
            yaxis: { min: yMin, max: yMax },
            xaxis: { min: xMin, max: xMax, show: true },
            grid: {
                borderColor: '#d5d5d5',
                borderWidth: 1,
                clickable: false,
                hoverable: false,
                autoHighlight: false
            },
            legend: { show: true, noColumns: 0, margin: 0, position: 'ne' }
        };

        (<any>this.options.yaxis).axisLabel = 'Spannung [V]';
        (<any>this.options.xaxis).axisLabel = 'Zeit [us]';
    }

    // ----------------------------
    // Module: Rendering
    // ----------------------------
    redrawSeries(series: jquery.flot.dataSeries[], rangeX: jquery.flot.range): void {
        this.options.xaxis.min = rangeX.from;
        this.options.xaxis.max = rangeX.to;
        $.plot(this.plotPlaceholder, series, this.options);
    }

}
