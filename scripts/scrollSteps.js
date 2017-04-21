function scrollStepDefs(ch) {

    // one-time establishment of default settings
    ch.dataSwitchShown = false;
    ch.useDensity = false;
    ch.triangleSetting = { x: 50, y: 50 };
    
    var stepDefs = [
        { // draw value pool
        command: "gather data items",
        activate: chart=>{
            // things that shouldn't survive a restart
            delete chart.highlightPathIndices;
            delete chart.highlightValueIndices;
            delete chart.binsAreDraggable;
            
            chart.drawDataName();
            if (chart.dataSwitchShown) chart.drawDataSwitch();
            chart.drawValueList({ stage: 0 });
        }
        },
    
        { // move values across to list
        command: "sort items into list",
        activate: chart=>{
            chart.drawValueList();
            }
        },
        
        { // draw a number line
        command: "draw a number line",
        activate: chart=>{
            chart.stopTimer(true);  // force completion of value list
            chart.drawColouredNumberLine();
            }
        },
        
        { // fly the values down to stacks on the number line
        command: "place items on number line",
        activate: chart=>{
            chart.stopTimer(true);  // force completion of number line
            chart.flyBalls();
            },
        update: (chart, progress)=>{
            if (progress > 0.25 && !chart.dataSwitchShown) {
                chart.drawDataSwitch();
                chart.dataSwitchShown = true;
            }
            if (progress > 0.25 && chart.maximumScrolledIndex===3) { // @@ HACK
                var dataName = chart.dataName;
                if (progress > 0.5) dataName="faithful";
                else dataName = "nba";
                if (dataName !== chart.dataName) {
                    chart.stopTimer();
                    chart.loadData(dataName);
                    chart.drawDataSwitch();
                    chart.clearDemoBalls();
                    chart.clearEphemeralCanvas();
                    chart.clearFixedCanvas();
                    chart.drawDataName();
                    // force everything through to this point
                    chart.replaySteps();
                }
            }
        } 
        },

        { // drop the balls through to build up bins
        command: "portion items into bins",
        activate: chart=>{
            if (!chart.dataSwitchShown) {  // force showing of data switch if user scrolled too quickly
                chart.drawDataSwitch();
                chart.dataSwitchShown = true;
            }
            chart.stopTimer(true);  // force completion of ball stacks
            chart.drawRDefaultBinning();
            }
        },

        { // show the break values
        command: "show bin-break values",
        activate: chart=>{
            chart.stopTimer(true);
            chart.drawBreakValues();
            }
        },

        { // move the bins through a sweep of offsets (relative to dataMin)
        command: "fiddle with bin alignment",
        activate: chart=>{
            chart.stopTimer(true);
            chart.scenarioRecords = [];
            chart.iterate(
                Array.range(-100,0,20),
                function(proportion) {
                    chart.drawRDefaultBinning({ instant: true, showLines: true, shiftProportion: proportion*0.01 });
                    chart.drawBreakValues(true);
                }
                );
            chart.drawCyclingScenarios(v=>"offset = bin width * "+(-v)+"%");
            }
        },
        
        { // move the bins through a sweep of widths (1.0 down to 0.5 of R default)
        command: "fiddle with bin width",
        activate: chart=>{
            chart.stopTimer();
            chart.clearScenarioZone();
            chart.iterate(
                Array.range(100,50,-10),
                function(proportion) {
                    chart.drawRDefaultBinning({ instant: true, showLines: true, shiftProportion: 0, widthProportion: proportion*0.01 });
                    chart.drawBreakValues(true);
                }
                );
            chart.drawCyclingScenarios(v=>"bin width = "+v+"% of default");
            }
        },
        
        { // bring in the table...
        replayPoint: true,
        command: "show basic calculation",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: (chart.dataRange/10).roundTo(chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(Array.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "breaks", main: "RANGE(dataMin, dataMax+width, width)", rounding: binRounding },
                    { name: "intervals", main: "PAIRS(breaks)", reduce: true },
{ name: "left", main: "intervals[0]", noDisplay: true },  // hack
                    { name: "bins", main: "INTERVAL_FILTER(data, intervals)", reduce: true },
                    { name: "counts", main: "COUNT(bins)" }
//{ name: "check", main: "SUM(counts)==data.length", reduce: true }
                    ];
            }

            // if previous steps have been given a chance to draw elements, clear them away
            if (prevRendered !== null) {
                chart.stopTimer();
                chart.clearScenarioZone();
                chart.clearMousetraps(["list", "flight", "ball"]);
                chart.highlightPathIndices([]);
                chart.highlightValueIndices([]);
                chart.clearDemoBins();
                chart.clearFixedCanvas();
                chart.clearEphemeralCanvas();
            } else { // if not, fill in the elements that we need to be there
                chart.drawDataName();
                chart.drawDataSwitch();
            }
            
            if (targetStep === thisStep) {
                chart.binsAreDraggable = false;
                chart.initHistogramArea({ instant: prevRendered===null }); // instant if no balls to shift
                chart.buildTable(definitions(), { noRanges: true });
            }
            }
        },
        
        { // more detail...
        command: "add bin offset",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            chart.stopTimer(true);  // make sure dataGroup reaches its target location

            if (targetStep !== thisStep) return;

            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: (chart.dataRange/10).roundTo(chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(Array.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "offset", main: "0.00", extra: Array.range(-1,0.001,0.05).map(n=>n.toFixed(2)), rounding: 2 },
                    { name: "breaks", main: "RANGE(dataMin+offset*width, dataMax+width, width)", rounding: binRounding },
                    { name: "intervals", main: "PAIRS(breaks)", reduce: true },
{ name: "left", main: "intervals[0]", noDisplay: true },  // hack
                    { name: "bins", main: "INTERVAL_FILTER(data, intervals)", reduce: true },
                    { name: "counts", main: "COUNT(bins)" }
//{ name: "check", main: "SUM(counts)==data.length", reduce: true }
                    ];
            }

            chart.binsAreDraggable = true;
            chart.initHistogramArea({ instant: true });
            chart.buildTable(definitions(), { noRanges: true });
            }
        },
        
        { // and open/closed...
        command: "add bin openness",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            if (targetStep !== thisStep) return;
/*
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: (chart.dataRange/10).roundTo(chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(Array.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "offset", main: "0.00", extra: Array.range(-1,0.001,0.05).map(n=>n.toFixed(2)), rounding: 2 },
                    { name: "breaks", main: "RANGE(dataMin+offset*width, dataMax+width, width)", rounding: binRounding },
                    { name: "intervals", main: "PAIRS(breaks)", reduce: true },
{ name: "left", main: "intervals[0]", noDisplay: true },  // hack
                    { name: "openRight", main: "true", extra: ["false", "true"] },
                    { name: "leftTests", main: 'openRight || i==0 ? ">=" : ">"' },
                    { name: "rightTests", main: 'openRight && i!=iMax ? "<" : "<="' },
                    { name: "bins", main: "INTERVAL_FILTER(data, intervals, leftTests, rightTests)", reduce: true },
                    { name: "counts", main: "COUNT(bins)" }
                    ];
            }
*/
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: (chart.dataRange/10).roundTo(chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(Array.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "offset", main: "0.00", extra: Array.range(-1,0.001,0.05).map(n=>n.toFixed(2)), rounding: 2 },
                    { name: "breaks", main: "RANGE(dataMin+offset*width, dataMax+width, width)", rounding: binRounding },
                    { name: "left", main: "ALL_BUT_LAST(breaks)", reduce: true, rounding: binRounding },
                    { name: "right", main: "ALL_BUT_FIRST(breaks)", reduce: true, rounding: binRounding },
                    { name: "open", main: '"R"', extra: ['"L"', '"R"'] },
                    { name: "leftTest", main: 'open=="L" && i!=0 ? ">" : ">="' },
                    { name: "rightTest", main: 'open=="R" && i!=iMax ? "<" : "<="' },
                    { name: "bins", main: "FILTER(data, v=>v{leftTest}left && v{rightTest}right)" },
                    { name: "counts", main: "COUNT(bins)" }
                    ];
            }
    
            chart.binsAreDraggable = true;
            chart.initHistogramArea({ instant: true });
            chart.buildTable(definitions(), {});
            }
        }

        ];
        
    function stepIndex(label) { return stepDefs.findIndex(def=>def.label===label) || 0 }
    
    return stepDefs;
}