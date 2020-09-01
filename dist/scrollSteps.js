/*!

scrollSteps.js for essay http://tinlizzie.org/histograms/ is released under the

MIT License

Copyright (c) 2016-2020 Aran Lunzer and Amelia McNamara

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
    ch.datasetsAvailable = 1;
    ch.useDensity = false;
    ch.triangleSetting = { x: 50, y: 50 };

    var baseDatasets = [ "mpg", "nba", "geyser" ];
    var laterDatasets = [ "mpg", "nba", "geyser", "diamonds", "marathons" ];

    var stepDefs = [
        { // draw value pool
        command: "gather data items",
        activate: function(chart) {
            // things that shouldn't survive a restart
            delete chart.highlightPathIndices;
            delete chart.highlightValueIndices;
            delete chart.binsAreDraggable;

            chart.datasetsForSwitching = baseDatasets;
            chart.drawDataSelector({ instant: true });
            chart.drawValueList({ stage: 0 });
            chart.drawDataUnits();
        }
        },

        { // move values across to list
        command: "sort items into list",
        replayable: true,
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            var options = targetStep===thisStep ? undefined : { stage: 1 };
            chart.drawValueList(options);
            }
        },

        { // draw a number line
        command: "draw a number line",
        replayable: true,
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            chart.stopTimer(true);  // force completion of value list
            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.drawColouredNumberLine(options);
            }
        },

        { // fly the values down to stacks on the number line
        label: "firstBalls",
        command: "place items on number line",
        replayable: true,
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            chart.stopTimer(true);  // force completion of number line
            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.flyBalls(options);
            },
        update: function(chart, progress) {
            // only change automatically on the first scroll through.  and once switch has been shown, don't reverse.
            if (progress < 0.25) return;

            if (chart.maximumScrolledIndex===stepIndex("firstBalls")) {
                var dataIndex = baseDatasets.indexOf(chart.dataName);

                if (progress > 0.5) dataIndex = baseDatasets.length-1;
                else if (progress > 0.25 && dataIndex===0) dataIndex = 1; // only increase

                if (chart.datasetsAvailable < dataIndex+1) {
                    chart.stopTimer();
                    chart.datasetsAvailable = dataIndex+1;
                    chart.loadData(baseDatasets[dataIndex]);
                    chart.replaySteps();
                }
            }
        }
        },

        { // drop the balls through to build up bins
        command: "portion items into bins",
        replayable: true,
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            chart.stopTimer(true);  // force completion of ball stacks
            chart.datasetsAvailable = baseDatasets.length;
            chart.drawDataSelector({ instant: true });

            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.drawRDefaultBinning(options);
            }
        },

        { // show the break values
        command: "show bin-break values",
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            chart.stopTimer(true);
            var options = targetStep===thisStep ? undefined : { instant: true };
            chart.drawBreakValues(options);
            }
        },

        { // move the bins through a sweep of offsets (relative to dataMin)
        command: "vary bin offset",
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
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
                chart.drawCyclingScenarios(function(v) { return [
                    { text: "offset = bin width * " },
                    { text: String(-v), highlightOnChange: true },
                    { text: "%" }
                    ] });
            }
            }
        },

        { // move the bins through a sweep of widths (1.0 down to 0.5 of R default)
        command: "vary bin width",
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            chart.stopTimer();
            if (targetStep === thisStep) {
                chart.iterate(
                    lively.lang.arr.range(100,50,-10),
                    function(proportion) {
                        chart.drawRDefaultBinning({ instant: true, showLines: true, noScale: true, shiftProportion: 0, widthProportion: proportion*0.01 });
                        chart.drawBreakValues({ instant: true });
                        }
                    );
                chart.drawCyclingScenarios(function(v)  { return [
                    { text: "bin width = " },
                    { text: String(v), highlightOnChange: true },
                    { text: "% of default" }
                    ] });
            }
            }
        },

        { // bring in the table...
        replayPoint: true,
        label: "firstTable",
        command: "show basic calculation",
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/10, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(25,10,-1).map(function(val) { return (chart.dataRange/val).toFixed(binRounding) })), rounding: binRounding },
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
{ name: "open", main: '"L"', noDisplay: true },
{ name: "leftTests", main: 'i===0 ? "≥" : ">"', noDisplay: true },
{ name: "rightTests", main: '"≤" || i', noDisplay: true }, // hack: mention i to get an array
                    { name: "bins", main: "FILTER(data, lefts, rights, leftTests, rightTests, open)", reduce: true, rounding: binRounding,
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
                chart.clearMousetraps(["list", "flight", "ball"]);
                chart.highlightPathIndices([]);
                chart.highlightValueIndices([]);
                chart.clearDemoBins();
                chart.clearFixedCanvas();
                chart.clearEphemeralCanvas();
                // if we're landing here, keep the balls for now
                if (targetStep !== thisStep) chart.clearDemoBalls();
            } else { // no previous drawing, so fill in the elements that we need to be there
                chart.datasetsForSwitching = baseDatasets;
                chart.datasetsAvailable = baseDatasets.length;
                chart.drawDataSelector({ instant: true });
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
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            chart.stopTimer(true);  // make sure dataGroup reaches its target location

            if (targetStep !== thisStep) return;

            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/10, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(25,10,-1).map(function(val) { return (chart.dataRange/val).toFixed(binRounding) })), rounding: binRounding },
                    { name: "offset", main: "0.0", extra: lively.lang.arr.range(-1,0.001,0.1).map(function(n) { return n.toFixed(1)}), rounding: 1 },
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
{ name: "open", main: '"L"', noDisplay: true },
{ name: "leftTests", main: 'i===0 ? "≥" : ">"', noDisplay: true },
{ name: "rightTests", main: '"≤" || i', noDisplay: true }, // hack: mention i to get an array
                        { name: "bins", main: "FILTER(data, lefts, rights, leftTests, rightTests, open)", reduce: true, rounding: binRounding,
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
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            if (targetStep !== thisStep) return;
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/10, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(25,10,-1).map(function(val) { return (chart.dataRange/val).toFixed(binRounding)})), rounding: binRounding },
                    { name: "offset", main: "0.0", extra: lively.lang.arr.range(-1,0.001,0.1).map(function(n) { return n.toFixed(1) }), rounding: 1 },
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
                    { name: "open", main: '"L"', extra: ['"L"', '"R"'] },
                    { name: "leftTests", main: 'open=="L" && i!=0 ? ">" : "≥"', styled: [
                        { style: "italic", text: "if ", colour: "grey" },
                        { style: "normal", text: "open" },
                        { style: "normal", text: " = " },
                        { style: "normal", text: '"L"' },
                        { style: "italic", text: " and ", colour: "grey" },
                        { style: "italic", text: "not first bin" },
                        { style: "italic", text: " then ", colour: "grey" },
                        { style: "normal", text: '">"' },
                        { style: "italic", text: " else ", colour: "grey" },
                        { style: "normal", text: '"≥"' }
                        ] },
                    { name: "rightTests", main: 'open=="R" && i!=iMax ? "<" : "≤"', styled: [
                        { style: "italic", text: "if ", colour: "grey" },
                        { style: "normal", text: "open" },
                        { style: "normal", text: " = " },
                        { style: "normal", text: '"R"' },
                        { style: "italic", text: " and ", colour: "grey" },
                        { style: "italic", text: "not last bin" },
                        { style: "italic", text: " then ", colour: "grey" },
                        { style: "normal", text: '"<"' },
                        { style: "italic", text: " else ", colour: "grey" },
                        { style: "normal", text: '"≤"' }
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
        activate: function(chart, originStep, prevRendered, targetStep, thisStep) {
            function definitions() {
                var binRounding = chart.dataBinDecimals;
                return [
                    { name: "width", main: lively.lang.num.roundTo(chart.dataRange/chart.minBinsOverRange, chart.dataBinQuantum).toFixed(binRounding), extra: lively.lang.arr.uniq(lively.lang.arr.range(chart.maxBinsOverRange,1,-1).map(function(bins) { return (bins===1 ? Math.ceil(chart.dataRange/chart.dataBinQuantum)*chart.dataBinQuantum : lively.lang.num.roundTo(chart.dataRange/bins, chart.dataBinQuantum)).toFixed(binRounding) })), rounding: binRounding },
                    { name: "offset", main: "0.0", extra: lively.lang.arr.range(-1,0.001,0.1).map(function(n) { return n.toFixed(1) }), rounding: 1 },
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
{ name: "leftTests", main: 'i===0 ? "≥" : ">"', noDisplay: true },
{ name: "rightTests", main: '"≤" || i', noDisplay: true }, // hack: mention i to get an array
                    { name: "bins", main: "FILTER(data, lefts, rights, leftTests, rightTests)", reduce: true, rounding: binRounding,
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

            chart.datasetsForSwitching = laterDatasets;
            chart.datasetsAvailable = laterDatasets.length;
            chart.drawDataSelector({ instant: prevRendered===null });

            chart.binsAreDraggable = true;
            chart.initNakedHistogram({ instant: prevRendered===null || originStep<stepIndex("firstTable") });
            chart.buildTable(definitions(), { noVisibleTable: true, noDensity: true, widthControl: true, sweepControl: true, extraAxisValues: true });
            }
        }

        ];

    function stepIndex(label) { return stepDefs.findIndex(function(def) { return def.label===label }) || 0 }

    return stepDefs;
}
