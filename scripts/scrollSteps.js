/*!

scrollSteps.js for essay http://tinlizzie.org/histograms/ is released under the
 
MIT License

Copyright (c) 2016-2017 Aran Lunzer and Amelia McNamara

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

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
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            var options = targetStep===thisStep ? undefined : { stage: 1 };
            chart.drawValueList(options);
            }
        },
        
        { // draw a number line
        command: "draw a number line",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            chart.stopTimer(true);  // force completion of value list
            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.drawColouredNumberLine(options);
            }
        },
        
        { // fly the values down to stacks on the number line
        command: "place items on number line",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            chart.stopTimer(true);  // force completion of number line
            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.flyBalls(options);
            },
        update: (chart, progress)=>{
            if (progress > 0.25 && !chart.dataSwitchShown) {
                chart.drawDataSwitch();
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
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            if (!chart.dataSwitchShown) {  // force showing of data switch if user scrolled too quickly
                chart.drawDataSwitch();
            }
            chart.stopTimer(true);  // force completion of ball stacks
            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.drawRDefaultBinning(options);
            }
        },

        { // show the break values
        command: "show bin-break values",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            chart.stopTimer(true);
            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.drawBreakValues(options);
            }
        },

        { // move the bins through a sweep of offsets (relative to dataMin)
        command: "fiddle with bin alignment",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            chart.stopTimer(true);
            chart.scenarioRecords = [];
            if (targetStep === thisStep) {
                chart.iterate(
                    lively.lang.arr.range(-100,0,20),
                    function(proportion) {
                        chart.drawRDefaultBinning({ instant: true, showLines: true, noScale: true, shiftProportion: proportion*0.01 });
                        chart.drawBreakValues({ instant: true });
                    }
                    );
                chart.drawCyclingScenarios(v=>"offset = bin width * "+(-v)+"%");
            }
            }
        },
        
        { // move the bins through a sweep of widths (1.0 down to 0.5 of R default)
        command: "fiddle with bin width",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            chart.stopTimer();
            chart.clearScenarioZone();
            if (targetStep === thisStep) {
                chart.iterate(
                    lively.lang.arr.range(100,50,-10),
                    function(proportion) {
                        chart.drawRDefaultBinning({ instant: true, showLines: true, noScale: true, shiftProportion: 0, widthProportion: proportion*0.01 });
                        chart.drawBreakValues({ instant: true });
                        }
                    );
                chart.drawCyclingScenarios(v=>"bin width = "+v+"% of default");
            }
            }
        },
        
        { // bring in the table...
        replayPoint: true,
        command: "show basic calculation",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/10, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "breaks", main: "RANGE(dataMin, dataMax+width, width)", rounding: binRounding, styled: [
                        { style: "italic", text: "from ", colour: "grey" },
                        { style: "normal", text: "dataMin" },
                        { style: "italic", text: " to ", colour: "grey" },
                        { style: "normal", text: "dataMax+width" },
                        { style: "italic", text: " by ", colour: "grey" },
                        { style: "normal", text: "width" }
                        ] },
                    { name: "lefts", main: "ALL_BUT_LAST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but last of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "rights", main: "ALL_BUT_FIRST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but first of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "bins", main: "FILTER(data, lefts, rights)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "portion items based on ", colour: "grey" },
                            { style: "normal", text: "lefts, rights" }
                        ]},
                    { name: "counts", main: "COUNT(bins)",
                        styled: [
                            { style: "italic", text: "count items in ", colour: "grey" },
                            { style: "normal", text: "bins" }
                        ]}
//,{ name: "check", main: "SUM(counts)==data.length", reduce: true }
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
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/10, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "offset", main: "0.0", extra: lively.lang.arr.range(-1,0.001,0.1).map(n=>n.toFixed(1)), rounding: 1 },
                    { name: "breaks", main: "RANGE(dataMin+offset*width, dataMax+width, width)", rounding: binRounding, styled: [
                        { style: "italic", text: "from ", colour: "grey" },
                        { style: "normal", text: "dataMin+width*offset" },
                        { style: "italic", text: " to ", colour: "grey" },
                        { style: "normal", text: "dataMax+width" },
                        { style: "italic", text: " by ", colour: "grey" },
                        { style: "normal", text: "width" }
                        ] },
                    { name: "lefts", main: "ALL_BUT_LAST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but last of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "rights", main: "ALL_BUT_FIRST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but first of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "bins", main: "FILTER(data, lefts, rights)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "portion items based on ", colour: "grey" },
                            { style: "normal", text: "lefts, rights" }
                        ]},
                    { name: "counts", main: "COUNT(bins)",
                        styled: [
                            { style: "italic", text: "count items in ", colour: "grey" },
                            { style: "normal", text: "bins" }
                        ]}
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
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/10, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "offset", main: "0.0", extra: lively.lang.arr.range(-1,0.001,0.1).map(n=>n.toFixed(1)), rounding: 1 },
                    { name: "breaks", main: "RANGE(dataMin+offset*width, dataMax+width, width)", rounding: binRounding, styled: [
                        { style: "italic", text: "from ", colour: "grey" },
                        { style: "normal", text: "dataMin+width*offset" },
                        { style: "italic", text: " to ", colour: "grey" },
                        { style: "normal", text: "dataMax+width" },
                        { style: "italic", text: " by ", colour: "grey" },
                        { style: "normal", text: "width" }
                        ] },
                    { name: "lefts", main: "ALL_BUT_LAST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but last of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "rights", main: "ALL_BUT_FIRST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but first of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "open", main: '"R"', extra: ['"L"', '"R"'] },
                    { name: "leftTests", main: 'open=="L" && i!=0 ? ">" : ">="', styled: [
                        { style: "italic", text: "if ", colour: "grey" },
                        { style: "normal", text: "open" },
                        { style: "normal", text: " = " },
                        { style: "normal", text: '"L"' },
                        { style: "italic", text: " and ", colour: "grey" },
                        { style: "italic", text: "not first bin" },
                        { style: "italic", text: " then ", colour: "grey" },
                        { style: "normal", text: '">"' },
                        { style: "italic", text: " else ", colour: "grey" },
                        { style: "normal", text: '">="' }
                        ] },
                    { name: "rightTests", main: 'open=="R" && i!=iMax ? "<" : "<="', styled: [
                        { style: "italic", text: "if ", colour: "grey" },
                        { style: "normal", text: "open" },
                        { style: "normal", text: " = " },
                        { style: "normal", text: '"R"' },
                        { style: "italic", text: " and ", colour: "grey" },
                        { style: "italic", text: "not last bin" },
                        { style: "italic", text: " then ", colour: "grey" },
                        { style: "normal", text: '"<"' },
                        { style: "italic", text: " else ", colour: "grey" },
                        { style: "normal", text: '"<="' }
                        ] },
                    { name: "bins", main: "FILTER(data, lefts, rights, leftTests, rightTests, open)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "portion items based on ", colour: "grey" },
                            { style: "normal", text: "lefts, rights, leftTests, rightTests" }
                        ]},
                    { name: "counts", main: "COUNT(bins)",
                        styled: [
                            { style: "italic", text: "count items in ", colour: "grey" },
                            { style: "normal", text: "bins" }
                        ]}
                    ];
            }
    
            chart.binsAreDraggable = true;
            chart.initHistogramArea({ instant: true });
            chart.buildTable(definitions(), {});
            }
        },

        { // have a histogram without the table
        replayPoint: true,
        command: "just the histogram",
        activate: (chart, prevRendered, targetStep, thisStep)=>{
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/10, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(25,10,-1).map(val=>(chart.dataRange/val).toFixed(binRounding))), rounding: binRounding },
                    { name: "offset", main: "0.0", extra: lively.lang.arr.range(-1,0.001,0.1).map(n=>n.toFixed(1)), rounding: 1 },
                    { name: "breaks", main: "RANGE(dataMin+offset*width, dataMax+width, width)", rounding: binRounding, styled: [
                        { style: "italic", text: "from ", colour: "grey" },
                        { style: "normal", text: "dataMin+width*offset" },
                        { style: "italic", text: " to ", colour: "grey" },
                        { style: "normal", text: "dataMax+width" },
                        { style: "italic", text: " by ", colour: "grey" },
                        { style: "normal", text: "width" }
                        ] },
                    { name: "lefts", main: "ALL_BUT_LAST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but last of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "rights", main: "ALL_BUT_FIRST(breaks)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "all but first of ", colour: "grey" },
                            { style: "normal", text: "breaks" }
                        ] },
                    { name: "bins", main: "FILTER(data, lefts, rights)", reduce: true, rounding: binRounding,
                        styled: [
                            { style: "italic", text: "portion items based on ", colour: "grey" },
                            { style: "normal", text: "lefts, rights" }
                        ]},
                    { name: "counts", main: "COUNT(bins)",
                        styled: [
                            { style: "italic", text: "count items in ", colour: "grey" },
                            { style: "normal", text: "bins" }
                        ]}
                    ];
            }

            if (prevRendered === null) { // fill in the elements that we need to be there
                chart.drawDataName();
                chart.drawDataSwitch();
            }
    
            chart.binsAreDraggable = true;
            chart.initNakedHistogram({ instant: prevRendered===null });
            chart.buildTable(definitions(), { noVisibleTable: true, noTriangle: true, widthControl: true, sweepControl: true });
            }
        }

        ];
        
    function stepIndex(label) { return stepDefs.findIndex(def=>def.label===label) || 0 }
    
    return stepDefs;
}