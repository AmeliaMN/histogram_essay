/*!

chartObject.js for essay http://tinlizzie.org/histograms/ is released under the

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

window.createChartObject = function createChartObject() {
var chartObject = {};

chartObject.bifocalScale=function bifocalScale(availableWidth, totalWidth, focalFactor, itemWidth) {
    // basic structure copied from https://bost.ocks.org/mike/fisheye/fisheye.js

    // in a row of items, we want the centre of the first item and the centre of the last item not to move when focus is changed.  therefore these are treated as the anchors for the rescaling: we map a totalWidth less the width of one item to a field width less the same.  the client should request transforms ranging from 0 [centre of first] to (itemWidth * (numItems-1)) [centre of last]
    var scale = d3.scaleIdentity(), available = availableWidth-itemWidth, total = totalWidth-itemWidth, fw = available/focalFactor;

    // snarfed from d3 v3: https://github.com/d3/d3/blob/v3.5.17/src/core/rebind.js
    // Copies a variable number of methods from source to target.
    function d3_rebind(target, source) {
      var i = 1, n = arguments.length, method;
      while (++i < n) target[method = arguments[i]] = d3_rebind_inner(target, source, source[method]);
      return target;
    };

    // Method is assumed to be a standard D3 getter-setter:
    // If passed with no arguments, gets the value.
    // If passed with arguments, sets the value and returns the target.
    function d3_rebind_inner(target, source, method) {
      return function() {
        var value = method.apply(source, arguments);
        return value === source ? target : value;
      };
    }

    function rescale(_) {
      var x = scale(_), pivots = rescale.pivots, maxIn = pivots[pivots.length-1].x;
      if (x <= 0) return 0;
      if (x >= total) return available;
      var pi=1;
      while (pi<pivots.length && pivots[pi].x < x) pi++;
      var xMin = pivots[pi-1].x, yMin = pivots[pi-1].y, xMax = pivots[pi].x, yMax = pivots[pi].y;
      return yMin + (yMax-yMin)*(x-xMin)/(xMax-xMin);
    }

    rescale.setup = function(f, focusInOutput) {
        // focusInOutput = true means that the focus is specified in the compressed space that will be displayed, rather than the input range of totalWidth
        rescale.pivots = [{ x: 0, y: 0 }];
        if (total > available) {
            // x represents input values, y the corresponding compressed output
            var xRemainder = total-fw, // how much we need to fit in
                yRemainder = available-fw,      // how much space we have
                compressedScale = yRemainder/xRemainder;
            if (focusInOutput) {
                var focusMin = Math.min(available-fw, Math.max(0, f-fw/2)), focusMax = focusMin+fw;
                if (focusMin > 0) rescale.pivots.push({ y: focusMin, x: focusMin/compressedScale });
                if (focusMax < available) rescale.pivots.push({ y: focusMax, x: total-(available-focusMax)/compressedScale });
            } else {
                var focusMin = Math.min(total-fw, Math.max(0, f-fw/2)), focusMax = focusMin+fw;
                if (focusMin > 0) rescale.pivots.push({ x: focusMin, y: focusMin*compressedScale });
                if (focusMax < total) rescale.pivots.push({ x: focusMax, y: available-(total-focusMax)*compressedScale });
            }
        }
        rescale.pivots.push({ x: total, y: available });
//if (totalWidth>400 && !focusInOutput) console.log(f, focusMin, focusMax, rescale.pivots);
    }

    rescale.findItem = function(y) {
        /* approximate method (twitchy because we estimate based on focussing at the arbitrary mouse point, whereas we then update the display by focussing at the middle of the nearest item).
            i suspect there's no analytical way to do this properly.
        */
        rescale.focus(y, true);
        var x = rescale.invert(y);

//console.log(Math.round(y)+"=>"+Math.round(x)+"=>"+Math.round(rescale(x)));
//console.log(Math.round(y)+"=>"+Math.round(x)+"=>"+(x/itemWidth).toFixed(1));
        // x is a value in the scale's totalWidth space, which runs from half-way through the first item to half-way through the last.
        return Math.floor(x/itemWidth+0.5);
    }

    rescale.invert = function(y) {
        var pivots = rescale.pivots;
        var x;
        if (y <= 0) return 0;
        if (y >= available) return total;
        var pi=1;
        while (pi<pivots.length && pivots[pi].y < y) pi++;
        var xMin = pivots[pi-1].x, yMin = pivots[pi-1].y, xMax = pivots[pi].x, yMax = pivots[pi].y;
        return xMin + (xMax-xMin)*(y-yMin)/(yMax-yMin);
    }

    rescale.focus = function(f, focusInOutput) {
      rescale.setup(f, focusInOutput);
      return rescale;
    };

    rescale.nice = scale.nice;
    rescale.ticks = scale.ticks;
    rescale.tickFormat = scale.tickFormat;

    rescale.setup(0);

    return d3_rebind(rescale, scale, "domain", "range");

};

chartObject.binData=function binData(data, ranges) {
    // behind-the-scenes version, for use in estimating max bin count/density
    var bins = [];
    function testValue(range, v) {
      return (range.minOpen ? v>range.min : v>=range.min) && (range.maxOpen ? v<range.max : v<= range.max);
    }
    for (var ri=0; ri<ranges.length; ri++) {
    var range = ranges[ri]
    bins.push({ min: range.min, max: range.max, values: data.filter(function(v) { return testValue(range, v) }) } );
    }
    return bins;
};

chartObject.buildTable=function buildTable(definitions, tableOptions) {
//console.log("buildtable", definitions)
    var chart = this;
    var data = this.data, dataMin = this.dataMin, dataMax = this.dataMax, dataRange = this.dataRange, dataQuantum = this.dataQuantum;

    this.clearTable = function() { this.tableGroup.selectAll("*").remove() }
    // clear everything to do with the histogram - including all bins
    this.clearHistogram = function() { this.histGroup.selectAll("*").remove() }

    this.clearTable();

    delete chart.estimatedBinMax;   // if tableOptions.widthControl is true, this will be given a value each time the width setting changes
    delete chart.countScaleMax;     // and this will be used to decide when the scale has changed
    var binMax = this.estimateMaxBinSize(), binMaxDensity = this.estimateMaxBinDensity();
    var varDefs = {}, orderedVarNames = [], choiceGroups = {}, chosen = {};
    definitions.forEach(def=>{
        var n=def.name;
        orderedVarNames.push(n);
        varDefs[n]=def;
        // ugh.  javascript...
        // if any context value has turned out as "-0", "-0.0" etc, remove the "-".
        if (def.extra) def.extra.forEach((str,i)=>{ if (parseFloat(str)===0 && str[0]==="-") def.extra[i]=str.slice(1) });
        if (def.choiceGroup) {
            var group = choiceGroups[def.choiceGroup];
            if (!group) group = choiceGroups[def.choiceGroup] = { choices: [] };
            group.choices.push(n);
            if (def.default) group.chosen = n;
        }
        });
    var resultCache = {};
    function resultHash(varExpressions, context) {
        return orderedVarNames.map(function(vn) { return varExpressions[vn] }).join(":")+":"+(Object.keys(chosen).map(k=>chosen[k]).join(":")); //+":"+context;
    }
    var compute = eval(`(function(data, varExpressions, opts) {
        // there are two ways to run this:
        // 1. from scratch
        // 2. with a pre-computed result set, supplied as opts.precomputed

        var varNames = Object.keys(varExpressions);
        // whenever a value is looked up, quantize to some reasonable number of places
        var quantumLevel = 100000;
        function quantize(v) {
            if (typeof v !== "number") return v;
            return Math.round(v*quantumLevel)/quantumLevel;
        }
        function RANGE(start, end, step) {
            if (step===0 || Math.sign(step) !== Math.sign(end-start)) return [];
            // the end value is meant to be non-inclusive.  don't let it get included just through JavaScript imprecision (e.g., 0.89999999 being accepted as less than 0.9).
            var fuzzyEnd = end - step/1000; // close enough
            var vals = [];
            for (var v=start; v<fuzzyEnd; v+=step) vals.push(v);
            return vals;
        }
        function COUNT(arr) { return arr.length }
        function SUM(arr) { var s=0; arr.forEach(function(v) { return s+=v }); return s }
        function FILTER_FN(arr, fn) { return arr.filter(fn) }
        function G(nBins) { return chart.computeG(nBins) }
        function RPrettyBreaks(dataMin, dataMax, n) { return chart.rPretty([dataMin, dataMax], n) }
        function Sturges(data) { return Math.ceil(Math.log(data.length)/Math.log(2))+1 }
        function ALL_BUT_FIRST(array) { return array.slice(1) }
        function ALL_BUT_LAST(array) { return array.slice(0, -1) }
        function PAIRS(array) { return lively.lang.arr.range(1,array.length-1).map(function(i) { return [quantize(array[i-1]), quantize(array[i])] }) }
        function FILTER(data, lefts, rights, leftTests, rightTests, open) {
            var leftFns = { ">": function(left, v) { return v>left }, "≥": function(left, v) { return v>=left } };
            var rightFns = { "<": function(right, v) { return v<right }, "≤": function(right, v) { return v<=right } };
            return lefts.map(function(left, i) {
                var right = rights[i];
                var subset = FILTER_FN(data, function(v) { return leftFns[leftTests[i]](left, v) && rightFns[rightTests[i]](right, v) });
                subset.stringyValueParts = open==="L" ? [ "⋯", right ] : [ left, "⋯" ];
                return subset;
                })
        }
        function iterations(vn) { var val=eval(vn); return lively.lang.arr.isArray(val) ? val.length : 0 }
        var valStore = {};
        function lookup(vn,index) {
            var vals=valStore[vn];
            var oneVal = lively.lang.arr.isArray(vals) ? vals[index] : vals; // assumes all array vars in a given expression have same number of elements
            return quantize(oneVal);
        }
        var iterationsInForce = 0; // the size of the latest array result
        function iterateIfNeeded(exprOrFn, reduce) {
            var expr = typeof exprOrFn === "function" ? exprOrFn(chosen) : exprOrFn;
            // if it's a template, parse it into tokens now
            var replacementTokens = null;
            if (expr.indexOf("{")>=0) {
                // odd-numbered tokens are variable refs
                replacementTokens = (" "+expr).split(/[\{\}]/);
            }
            function contextualEval() {
                return eval(replacementTokens ? replacementTokens.map(function(t,i) { t.length===0 ? "" : (i&1 ? eval(t) : t)}).join("") : expr);
            }
            var varsInvolved = [];
            var iterationsNeeded = 0;
            if (!reduce) {
                var tokens = expr.split(/\\W/); // all contiguous alphanumerics (needs extra slash because of being in a template)
                if (tokens.indexOf("i")>=0) iterationsNeeded = iterationsInForce;
                else {
                    varNames.forEach(function(vn) {
                        if (tokens.indexOf(vn)>=0) {
                            varsInvolved.push(vn);
                            iterationsNeeded = Math.max(iterationsNeeded, iterations(vn));
                        }
                        });
                if (iterationsNeeded) iterationsInForce = iterationsNeeded;
                }
            }
            if (iterationsNeeded) {
                varsInvolved.forEach(function(vn) { valStore[vn] = eval(vn) });
                var result = [], iMax = iterationsNeeded-1;
                for (var i=0; i<iterationsNeeded; i++) {
                    varsInvolved.forEach(function(vn) {
                      var val = lookup(vn, i);
                      eval(vn+"=val");
                      });
                    result.push(contextualEval());
                }
                varsInvolved.forEach(function(vn) { eval(vn+"=valStore."+vn) });
                return result;
            } else {
                var val = contextualEval();
                if (lively.lang.arr.isArray(val)) iterationsInForce = val.length;
                return val;
            }
        }
        ${ orderedVarNames.map(function(vn) { return "var "+vn+";"}).join(" ") };
        var pre, choiceSortedVars = [];
        orderedVarNames.forEach(function(vn) {
            if (choiceSortedVars.indexOf(vn)===-1) { // not added by a choice sibling
                if (varDefs[vn].choiceGroup) {
                    var group = choiceGroups[varDefs[vn].choiceGroup], choices = group.choices, chosen = group.chosen;
                    choiceSortedVars.push(chosen);
                    choices.forEach(function(cn) {
                        if (cn!==chosen) {
                            choiceSortedVars.push(cn);
                            varExpressions[cn] = varDefs[cn].derivedMain;
                        }
                        });
                } else choiceSortedVars.push(vn);
            }
            });
        choiceSortedVars.forEach(function(vn) {
            var val = opts.precomputed && (pre = opts.precomputed[vn]) !== undefined ? pre : iterateIfNeeded(varExpressions[vn], varDefs[vn].reduce);
            eval(vn+"=val");
            });
        var result = { ${ orderedVarNames.map(function(vn) { return vn+": "+vn }).join(", ") } };
        if (opts.measure) result.measure = iterateIfNeeded(opts.measure, true);
        return result;
    })`);

    function runComputation(data, varExpressions, measureExpression) {
        Object.keys(choiceGroups).forEach(groupName=>{
            var choiceState = choiceGroups[groupName];
            chosen[groupName] = choiceState.chosen;
            });
        var hash = resultHash(varExpressions, contextVar);
        var existing = resultCache[hash];
        if (existing) {
            if (!measureExpression || existing.hasOwnProperty("measure"+measureExpression))
                return existing;
        }

        var options = {};
        if (measureExpression) options.measure = measureExpression;
        if (existing) options.precomputed = existing;

        var result = compute(data, varExpressions, options);
        if (!existing) {
            var cacheable = lively.lang.obj.clone(result);
            if (measureExpression) {
                cacheable["measure"+measureExpression] = cacheable.measure;
            }
            orderedVarNames.forEach(vn=>{ if (varDefs[vn].noCache) delete cacheable[vn] });
            resultCache[hash] = cacheable;
        }
        return result;
    }
    this.findClosestResult = function(expr, value, fiddleVar) {
        var baseDef = {};
        orderedVarNames.forEach(function(vn) { baseDef[vn] = varDefs[vn].main });
        var extraResults = [], contextBins = [];
        var extras = varDefs[fiddleVar].extra; // array of stringy expressions
        extras.forEach(function(extraExpr) {
            var extraDef = lively.lang.obj.clone(baseDef);
            extraDef[fiddleVar] = String(extraExpr);
            extraResults.push(runComputation(data, extraDef, expr));
            });
        var diff = 9999, minIndex;
        extraResults.forEach((res, i)=>{
            // in the event of a tie, we'll take the first
            var newDiff = Math.abs(res.measure-value);
            if (newDiff<diff) { diff=newDiff; minIndex=i }
            });
        var desiredValue = extras[minIndex];
        if (varDefs[fiddleVar].main != desiredValue) {
//console.log("change from "+varDefs[fiddleVar].main+" to "+extras[minIndex]);
            varDefs[fiddleVar].main = desiredValue;
            //refreshTable({ force: true }, 0);  // now done by the client
            return desiredValue;  // there was a change
        }
        return null; // no change
    }

    var fixups = [];
    function defer(sel, func) {
        fixups.push(lively.lang.fun.curry(function(s, trans) {
            s
                .transition(trans)
                .call(func)
            }, sel))
    }
    function runDeferred(dur) {
        // does putting in a short delay help ensure that everything's ready to listen to the transition once it gets moving?
        var t = d3.transition().duration(dur); //.delay(150);
        fixups.forEach(function(f) { f(t) });
        fixups = [];
    };

    var contextVar;
    function toggleContextSpec(varName) {
        if (contextVar===varName) contextVar = null;
        else contextVar = varName;
        scheduleEvent("", 0, ()=>refreshTable({ force: true }, 500));  // force refresh
    }

    var edges = [ 10, 90, 450, 840 ], boxSize=10, boxGap=boxSize+8;
    var xInset = 20, yInset = 20, rowHeight = 22, fontHeight = 13, spreadBackground="#eee"; // d3.hsl(126,0.40,0.9);
    var tableGroup = this.tableGroup;
    var transformString = this.transformString;
    function keyString(d) { return d.varName+d.reason }
    function showChange(textSeln) {
        textSeln
            .interrupt()
            .style("fill", "red")
            .transition()
            .ease(d3.easeExpIn)
            .duration(1000)
            .style("fill", d => d.fill || "black")
    }

    function stringyValue(val, varName) {
        if (val===null) return "";

        if (val.stringyValueParts) {
            return val.stringyValueParts.map(vp=>stringyValue(vp, varName)).join("");
        }

        var result = val;
        if (!isNaN(val)) {
            var roundIfAny = varDefs[varName].rounding;
            if (roundIfAny!==undefined) result = Number(val).toFixed(roundIfAny);
        }
        return String(result)
    }

    /*
    timing:
        to reduce flickering as the user probes the interface, we allow interactions to set up delayed effects (e.g., removing a highlight) that can be cancelled if another event is triggered before the delay expires.  events are given a type: scheduling an event of type foo will cancel any previously queued foo event.  when the last specified delay expires (which could be immediately), the entire queue - which might contain non-foo events - will all be executed.

        scheduleEvent(type, delay, f)
        flushEventQueue(type)
    */

    var eventQueue = [];  // a list of { type, fn } objects
    var eventTimeout;

    function scheduleEvent(type, delay, f) {
//console.log((Date.now())+" sched: "+type);
        if (eventTimeout) { clearTimeout(eventTimeout); eventTimeout = null }
        flushEventQueue(type);
        eventQueue.push({type: type, fn: f});
        if (delay) eventTimeout = setTimeout(runEvents, delay);
        else runEvents();
    }

    function flushEventQueue(type) {
        eventQueue = eventQueue.filter(evt=>evt.type!==type);
    }

    function runEvents() {
//console.log((Date.now())+" run "+(eventQueue.length));
        eventQueue.forEach(evt=>evt.fn());
        eventQueue = [];
    }

    function objectsEqual(a, b) {
        var aKeys = Object.keys(a), bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (var ai=0; ai<aKeys.length; ai++) {
            var k = aKeys[ai];
            if (!b.hasOwnProperty(k)) return false;
            if (b[k] !== a[k]) return false;
        }
        return true;
    }

    // states that we want to support include:
    //   a. no context, no focus
    //   b. context, no focus
    //   c. context, focus from within the context (i.e., highlight one scenario)
    //   d. context, focus from another variable's context (change all scenarios; no highlight)
    //   e. focus, no context
    //
    // override is controlled by mouseover (and mouseout) on context values.
    // context state is set by switches.  note that a change in context state won't ever happen in the presence of an override.
    var lastRefresh = {};
    function refreshTable(options, duration) {   // options is an object { force, focusVar, focusIndex, dataFocusIndex }
        options.isDragging = chart.isDragging;
        options.useDensity = chart.useDensity;
        // when we have a binwidth-control widget,
        if (tableOptions.widthControl) {
            if (!chart.estimatedBinMax) {
                chart.estimatedBinMax = chart.estimateMaxBinSize(varDefs.width.main/chart.dataRange*100);
            }
            binMax = options.estimatedBinMax = chart.estimatedBinMax;
        }
        var forced = options.force; delete options.force;
        if (!forced && objectsEqual(options, lastRefresh)) return;
        lastRefresh = options;
//console.log("refresh:", lastRefresh);

        if (contextVar) {
            chart.histGroup.select("g.fader").style("opacity", 1);
        } else {
            chart.histGroup.select("g.fader").style("opacity", 0);

            chart.recordBinState("primary"); // for later highlight
        }

        function deriveBins(result, scenario) {
            var drawableBins = [];

            var bins = result.bins;

            bins.forEach(function(bin, i) {
                function lookup(vName, viaString) {
                    var val = result[vName];
                    if (lively.lang.obj.isArray(val)) val = val[i];
                    return viaString ? Number(stringyValue(val, vName)) : val;
                }
                // NB: if leftTests and rightTests don't exist, they'll both be false.  it's up to the calling code to set noRanges in such a case.
                drawableBins.push({min: lookup("lefts", true), minOpen: lookup("leftTests")==">", max: lookup("rights", true), maxOpen: lookup("rightTests")=="<", values: bin, scenario: scenario, dataIndex: i });
                });
            return drawableBins;
        }

        var baseDef = {};
        var highlighting = !!options.focusVar && options.focusVar===contextVar, highlightIndex = highlighting ? options.focusIndex : null;
        var focusOutwithContext = !!options.focusVar && !highlighting;
        orderedVarNames.forEach(function(vn) { baseDef[vn] = focusOutwithContext && options.focusVar===vn ? varDefs[vn].extra[options.focusIndex] : varDefs[vn].main });
        var mainResult = runComputation(data, baseDef), mainBins = deriveBins(mainResult);
        var maxDataColumns = mainBins.length;
        var extraResults = [], contextBins = [];
        if (contextVar) {
            var extras = varDefs[contextVar].extra; // array of stringy expressions
            extras.forEach(function(extraExpr) {
                var extraDef = lively.lang.obj.clone(baseDef);
                extraDef[contextVar] = String(extraExpr);
                extraResults.push(runComputation(data, extraDef));
                });
            extraResults.forEach(function(ex, i) {
                var bins = deriveBins(ex, i);
                contextBins.push(bins);
                maxDataColumns = Math.max(maxDataColumns, bins.length);
            });
        }

        chart.drawBins(mainBins, contextBins, {
             useDensity: options.useDensity,
             binMax: options.useDensity ? binMaxDensity : binMax,
             highlight: highlightIndex,
             extraAxisAnnotations: !!tableOptions.extraAxisValues,
             scaleToFitAxis: !!tableOptions.widthControl
             });

        if (!contextVar) chart.highlightBinDifferences("primary", !options.isDragging); // true to delete previous (@@ currently ignored by hBD)

        if (!tableOptions.noVisibleTable) {
            if (!tableOptions.noRanges) {
                var rangeSets = { primary: mainBins, context: [] };
                if (highlighting) rangeSets.context = contextBins[highlightIndex];
                chart.drawRanges(rangeSets);
            }

            function padIfNeeded(data) {
                if (lively.lang.obj.isArray(data) && data.length < maxDataColumns) {
                    return data.concat(lively.lang.arr.withN(maxDataColumns-data.length, null))
                }
                return data;
            }
            var primaryIndex = contextVar ? varDefs[contextVar].extra.indexOf(varDefs[contextVar].main) : null; // slightly hacky assumption

            var dataRows = [];
            var affectedByExtra = [];
            var rowsAdded = 0;
            dataRows.push({ varName: "dummy", reason: "rule", rowInDisplay: rowsAdded });
            orderedVarNames.forEach(function(vn, varIndex) {
                var varDef = varDefs[vn];
                if (!varDef.noDisplay) {
                    var mainExpr = varDef.main;
                    if (typeof mainExpr==="function") mainExpr = mainExpr(chosen);
                    var isInChoice = !!varDef.choiceGroup, isChosen = isInChoice && choiceGroups[varDef.choiceGroup].chosen===vn, isLastChoice = isInChoice && lively.lang.arr.last(choiceGroups[varDef.choiceGroup].choices)===vn;

                    // new apr 2017 (expt24): include any extraDefs in the var's main row
                    var extrasHere = varDef.extra; // may be undefined
                    if (extrasHere && !(isInChoice && !isChosen)) {
                        dataRows.push({ varName: vn, baseRow: varIndex, rowInDisplay: rowsAdded++, reason: "main", hasExtras: true, expr: extrasHere, data: padIfNeeded(mainResult[vn]) });
                        if (vn===contextVar) affectedByExtra.push(vn);
                    } else {
                        dataRows.push({ varName: vn, baseRow: varIndex, rowInDisplay: rowsAdded++, reason: "main", expr: isInChoice && !isChosen ? "-" : mainExpr, styledExpr: varDef.styled, data: padIfNeeded(mainResult[vn]) });
                    }

                    // and then any row needed for an extension coming from another var
                    if (contextVar && (contextVar!==vn)) {
                        /* each item in a context array is the value for a named variable in the context-defining execution.  the items may be arrays, and may have different sizes.  for example, for the variable "left" the context array could be:
                                [
                                array of 10 values,
                                array of 11 values,
                                array of 12 values,
                                ...
                                array of 18 values
                                ]
                        */
                        var tokens = mainExpr.split(/\W/);
                        if (affectedByExtra.some(evn => tokens.indexOf(evn)>=0)) {
                            affectedByExtra.push(vn);

                            var extraData = extraResults.map(res=>res[vn]);
                            extraData.isContextArray = true;

                            dataRows.push({ varName: vn, baseRow: varIndex, rowInDisplay: rowsAdded, reason: "extraShadow", expr: "", data: [] });
                            dataRows.push({ varName: vn, baseRow: varIndex, rowInDisplay: rowsAdded, reason: contextVar+"extra", expr: "", data: [], context: extraData });
                            rowsAdded++;
                        }
                    }

                    if (!(isInChoice && !isLastChoice)) dataRows.push({ varName: vn, reason: "rule", rowInDisplay: rowsAdded });
                }
                });
    //console.log(dataRows);
            var rows = tableGroup.selectAll(".row").data(dataRows, keyString);

            rows.exit()
                .attr("class", "defunctRow")
                .call(defer, function(s) {
                    s
                        .style("opacity", 1e-6)
                        .remove();
                    });

            // each rowItem has { varName, baseRow, rowIndisplay, reason, expr, data, context }
            rows.enter().append("g")
                .attr("class", "row")
                .attr("transform", rowItem => transformString(xInset, yInset+rowHeight*rowItem.rowInDisplay+1) )
                .style("opacity", rowItem => rowItem.reason==="main" ? 1 : 0)
                .each(function(rowItem) {
                    var seln = d3.select(this);
                    if (rowItem.reason==="rule") {
                        seln.append("line")
                        .attr("class", "rowSeparator")
                        .attr("x1", 0)
                        .attr("y1", -1)
                        .attr("x2", lively.lang.arr.last(edges))
                        .attr("y2", -1)
                        .style("stroke", "grey")
                        .style("stroke-width", 0.75)
                        .style("opacity", 1)
                        .style("pointer-events", "none");
                    } else {
                        seln.append("rect")
                            .attr("class", "rowBackground")
                            .attr("x", 0)
                            .attr("y", 0)
                            .attr("width", lively.lang.arr.last(edges))
                            .attr("height", rowHeight-2)
                            .style("opacity", 1);

                        if (rowItem.hasExtras) {
                            seln.append("rect")
                                .attr("class", "extraToggle")
                                .attr("id", rowItem.varName+"-extraToggle")
                                .attr("x", edges[1])
                                .attr("y", (rowHeight-boxSize)/2-2)
                                .attr("width", boxSize)
                                .attr("height", boxSize)
                                .style("fill", "green")
                                .style("fill-opacity", 0.3)
                                .style("stroke", "green")
                                .style("stroke-opacity", 0.7)
                                .style("stroke-width", 2)
                                .style("cursor", "pointer")
                                .on("click", ()=>toggleContextSpec(rowItem.varName))
                        }

                        if (rowItem.reason==="main" && varDefs[rowItem.varName].choiceGroup) {
                            seln.append("circle")
                                .attr("class", "choiceToggle")
                                .attr("cx", edges[0]+boxSize/2)
                                .attr("cy", rowHeight/2-2)
                                .attr("r", boxSize/2)
                                .style("fill", "green")
                                .style("fill-opacity", 0.3)
                                .style("stroke", "green")
                                .style("stroke-opacity", 0.7)
                                .style("stroke-width", 2)
                                .on("click", ()=>{
                                    choiceGroups[varDefs[rowItem.varName].choiceGroup].chosen=rowItem.varName;
                                    contextVar = null;
                                    refreshTable({ force: true }, 250);
                                    });
                        }
                    }
                    });

            tableGroup.selectAll(".row").each(function(rowItem) {
                var rowSeln = d3.select(this); // the g element for the row
                var isHighlightContext = highlighting && rowItem.reason===contextVar+"extra";
                var rowVar = rowItem.varName;
                var isContextDef = !!rowItem.hasExtras, isActiveContextDef = isContextDef && rowVar===contextVar;

                // set up the row background
                rowSeln.select("rect.rowBackground").style("fill", (rowItem.reason==="extraShadow" || isActiveContextDef) ? spreadBackground : (rowItem.reason==="main" ? "white" : "none"));

                defer(rowSeln, function(s) {
                    s
                        .attr("transform", transformString(xInset, yInset+rowHeight*rowItem.rowInDisplay))
                        .style("opacity", 1)
                    });

                if (rowItem.reason==="rule") return;

                var isInChoice = !!varDefs[rowVar].choiceGroup, isChosen = isInChoice && choiceGroups[varDefs[rowVar].choiceGroup].chosen===rowVar;

                // set appearance of the "extra values" toggle, if there is one
                rowSeln.select("rect.extraToggle").style("fill-opacity", isActiveContextDef ? 1 : 0);

                // and the choices switch, if any
                if (isInChoice) rowSeln.select("circle.choiceToggle").style("fill-opacity", isChosen ? 1 : 0);

                // the data item associated with each cellItem within a row has { rowSpec, x, width, text, anchor } and optionally { indexInGroup, dataIndex, mouseover, mouseout, click }.  and maybe some other gunk.
                var rowCellGroups = [];

                // label column
                if (rowItem.reason==="main") rowCellGroups.push({ category: "label", xOffset: edges[0], cells: [{ rowSpec: rowItem, text: rowVar, x: isInChoice ? boxGap : 0 }] });

                // expression columns
                if (rowItem.expr !== "") {
                    var cellGroup = [], groupObject = { category: "expr", cells: cellGroup, xOffset: edges[1] };
                    if (rowItem.reason==="extraShadow") cellGroup.push({rowSpec: rowItem, text: rowItem.expr, x: 32, fill: "green"}); // jan 2017: text is empty
                    else if (!lively.lang.obj.isArray(rowItem.expr)) {
                        groupObject.id = rowItem.varName+"-expression";
                        cellGroup.push({rowSpec: rowItem, text: rowItem.expr, x: 0, styledText: rowItem.styledExpr});
                    } else {
                        if (rowItem.hasExtras) {
                            groupObject.id = rowItem.varName+"-extraGroup";

                            if (options.focusVar===rowVar) groupObject.focusIndex = groupObject.indexToHighlight = options.focusIndex;
                            else {
                                var varDef = varDefs[rowVar];
                                groupObject.focusIndex = varDef.extra.indexOf(varDef.main);
    if (groupObject.focusIndex==-1) console.log("can't find focus value in def:",varDef);
                            }
                        }
                        var entryWidth = 32, startOffset = rowItem.hasExtras ? boxGap : 0;
                        lively.lang.obj.extend(groupObject, {
                            isFishy: true,  // use distortion if needed
                            fishWidth: edges[2]-edges[1]-startOffset-32,
                            fishItemWidth: entryWidth
                            });
                        groupObject.xOffset += startOffset;
                        rowItem.expr.forEach(function(e, i) {
                            cellGroup.push({rowSpec: rowItem, indexInGroup: i, width: entryWidth, text: stringyValue(e, rowVar), x: i*entryWidth, anchor: "middle",
                                // add handlers for probing alternative values from the "extra" list
                                mouseover: function(cellItem) {
                                    var vn = cellItem.rowSpec.varName, index = cellItem.indexInGroup;
                                    scheduleEvent("probe", 0, ()=>{
                                        refreshTable({ focusVar: vn, focusIndex: index }, 250);
                                        chart.resetBinHighlight()
                                        });
                                },
                                mouseout: function(cellItem) {
                                    scheduleEvent("probe", 200, ()=>{
                                        refreshTable({}, 250);
                                        chart.resetBinHighlight()
                                        });
                                },
                                click: function(cellItem) {
                                    var vn = cellItem.rowSpec.varName, index = cellItem.indexInGroup;
                                    varDefs[vn].main = varDefs[vn].extra[index];
                                    scheduleEvent("probe", 0, ()=>{
                                        refreshTable({ focusVar: vn, focusIndex: index, force: true }, 250); // force refresh
                                        chart.resetBinHighlight()
                                        });
                                }
                                });
                            });
                    }
                    if (cellGroup.length) rowCellGroups.push(groupObject);
                }

                // data columns
                var entryWidth = 44;
                if (lively.lang.obj.isArray(rowItem.data)) {
                    var cellGroup = [], groupObject = {
                        category: "data",
                        cells: cellGroup,
                        xOffset: edges[2],
                        isFishy: true,
                        fishWidth: edges[3]-edges[2]-xInset,
                        fishItemWidth: entryWidth,
                        focusIndex: (options.dataFocusIndex) || 0,
                        };
                    if (options.isDragging && rowItem.data.length) {
                        var n = rowItem.data.length;
                        if (mainResult.offset != 0) n--; // we have an extra item, so n is one less
                        var scale = d3.scaleLinear().domain([0, (n+1)*entryWidth]).range([entryWidth, groupObject.fishWidth-entryWidth]);
                        groupObject.focusItemOffset = scale((groupObject.focusIndex+mainResult.offset)*entryWidth);
                        groupObject.linearFocusOffset = (mainResult.offset+1)*entryWidth;
                    }
                    rowItem.data.forEach(function(e, i) {
                        var text = lively.lang.obj.isArray(e)
                            ? "{"+(e.length)+"}"
                            : stringyValue(e, rowVar);
                        var cellSpec = {
                            rowSpec: rowItem,
                            text: text,
                            x: i*entryWidth,
                            width: entryWidth,
                            anchor: "middle",
                            dataIndex: i,
                            indexInGroup: i,
                            isContext: isHighlightContext
                            };
                        if (!isHighlightContext) {
                            // for texty values, add mouseover behaviour (which will result in addition of an overlaid rect to do the detection)
                            cellSpec.mouseover = function(cellItem) {
                                scheduleEvent("probe", 0, ()=>{
                                    refreshTable({ dataFocusIndex: cellItem.dataIndex, binHighlight: cellItem.dataIndex }, 0);
                                    });
                                };
                            cellSpec.mouseout = function(cellItem) {
                                scheduleEvent("probe", 200, ()=>{
                                    refreshTable({ binHighlight: null }, 0);
                                    });
                                };
                        }
                        cellGroup.push(cellSpec);
                        });
                    if (cellGroup.length) rowCellGroups.push(groupObject);
                } else {
                    var startOffset = entryWidth/2;
                    var val = stringyValue(rowItem.data, rowVar);
                    rowCellGroups.push({ category: "data", xOffset: edges[2]+startOffset, cells: [{ rowSpec: rowItem, text: val, anchor: "middle", weight: "bold", x: 0, isContext: isHighlightContext }] });
                }

                var cellGroups = rowSeln.selectAll(".cellGroup").data(rowCellGroups, rcg=>rcg.category);
                cellGroups.exit().remove(); // if we ever count on this (rather than just destroying the entire row), it might need a bit of finesse
                cellGroups.enter().append("g")
                    .attr("class", "cellGroup")
                  .merge(cellGroups)
                    .attr("transform", groupObject => transformString(groupObject.xOffset,0))
                    .each(function(groupObject) {
                        var groupSeln = d3.select(this);
                        var cellClass = groupObject.isFishy ? "fishItem" : "cellItem";
                        if (groupObject.id) groupSeln.attr("id", groupObject.id);

                        var cells = groupSeln.selectAll("."+cellClass).data(groupObject.cells, cellItem=>cellItem.indexInGroup);

                        cells.exit()
                            .attr("class", "defunctCell")
                            .interrupt()
                            .each(function(cellItem) {
                                var seln = d3.select(this);
                                seln.select("text").attr("class","defunctText")
                                if (options.isDragging || cellItem.isContext) seln.remove(); // must be instant
                                else defer(seln, function(s) {
                                    s
                                        .style("opacity", 1e-6)
                                        .remove();
                                    });
                                });

                        cells.enter().append("g")
                            .attr("class", cellClass)
                            .each(function(cellItem) {
                                var seln = d3.select(this);
                                if (cellItem.mouseover) {
                                    seln.append("rect")
                                        .attr("class", groupObject.category+"MouseTrap")
                                        .attr("y", 1)
                                        .attr("height", isContextDef ? rowHeight-4 : rowHeight)
                                        .style("fill-opacity", groupObject.isFishy ? 1 : 0)
                                        .style("stroke", "green") // should never be seen
                                        .style("stroke-width", 1)
                                        .style("stroke-opacity", 0)
                                        .style("cursor", cellItem.click ? "pointer" : "crosshair")
                                        .on("mouseover", cellItem=>cellItem.mouseover(cellItem))
                                        .on("mouseout", cellItem=>cellItem.mouseout(cellItem))
                                        .on("click", cellItem=>{ if (cellItem.click) cellItem.click(cellItem); })
                                }
                                seln.append("text")
                                    .attr("class", groupObject.category+"TextCell")
                                    .attr("dy", chart.textOffsets.hanging)
                                    //.style("dominant-baseline", "hanging")
                                    .style("fill", cellItem=>cellItem.fill || "black")
                                    .style("font-size", (isHighlightContext ? fontHeight-4 : fontHeight)+"px")
                                    .style("font-weight", cellItem=>cellItem.weight || "normal")
                                    .style("text-anchor", cellItem.anchor || "start")
                                    .style("opacity", groupObject.isFishy ? 0.2 : 1)
                                    .style("pointer-events", "none")
                                    .style("-webkit-user-select","none");
                                });

                        if (groupObject.isFishy) chart.spaceBifocally(groupSeln, groupObject);

                        d3.select(this).selectAll("."+cellClass)
                            .each(function(cellItem) { // @@ probably some efficiency improvements to be made here
                                var seln = d3.select(this);
                                if (!groupObject.isFishy) seln.attr("transform", transformString(cellItem.x, 0));

                                var textSeln = seln.select("text");
                                textSeln.attr("y", isHighlightContext ? 0 : 4); // now redundant?

                                if (cellItem.styledText) {
                                    textSeln.attr("dy", chart.textOffsets.hanging)
                                    var spans = textSeln.selectAll("tspan").data(cellItem.styledText);
                                    spans.exit().remove();  // shouldn't happen
                                    spans.enter().append("tspan")
                                        //.style("dominant-baseline", "hanging")
                                      .merge(spans)
                                        .style("font-style", d=>d.style)
                                        .style("fill", d=>d.colour || "black")
                                        .text(d=>d.text);
                                } else {
                                    var oldText = textSeln.text();
                                    if (oldText !== cellItem.text) textSeln.call(showChange);

                                    textSeln.text(cellItem.text);
                                }

                                if (groupObject.isFishy) {
                                    var trapSeln = seln.select("rect");
                                    trapSeln
                                        .style("fill", isActiveContextDef ? spreadBackground : "white");

                                    // highlight (if groupObject wants it) by showing a border
                                    if (groupObject.indexToHighlight === cellItem.indexInGroup) {
                                        trapSeln
                                            .style("stroke", isActiveContextDef ? "black" : "blue")
                                            .style("stroke-opacity", 1);
                                    } else trapSeln.style("stroke-opacity", 0);

                                    //var adjustedWidth = trapSeln.attr("width");
                                    var lineLocs = cellItem.text==="" ? [true] : [];
                                    var lines = seln.selectAll("line").data(lineLocs);
                                    lines.exit().remove();
                                    lines.enter().append("line")
                                        .attr("y1", rowHeight/2)
                                        .attr("y2", rowHeight/2)
                                        .style("stroke", "grey")
                                        .style("stroke-width", 1)
                                      .merge(lines)
                                        .attr("x1", -2)
                                        .attr("x2", 2)
                                }
                                });
                        });

                // @@ maybe want to merge this group into the general handling above
                var maxRange = 0, probeFill = "#d8d8d8";
                var pictureCellGroups = [];
                if (rowItem.context) {
                    var rowCells = [];
                    // a context array is arranged by scenario, and if the values are arrays then these arrays might have different lengths.  we unpack them into an array by indices - each array having one value per scenario, with a null if the scenario doesn't have an entry at that index.
                    var maxLen = d3.max(rowItem.context, val=>lively.lang.obj.isArray(val) ? val.length : 1), unpacked = [];
                    for (var ai=0; ai<maxLen; ai++) {
                        var oneArray = unpacked[ai] = [];
                        rowItem.context.forEach(val=>{
                            var v;
                            if (lively.lang.obj.isArray(val)) {
                                v = val.length > ai ? val[ai] : null
                            } else {
                                v = ai===0 ? val : null;
                            }
                            oneArray.push(v);
                            });
                    }
                    var entryWidth = 44;
                    unpacked.forEach(function(vals, i) {
                        rowCells.push({
                            rowSpec: rowItem,
                            dataIndex: i,
                            indexInGroup: i,
                            x: i*entryWidth,
                            width: entryWidth,
                            values: vals,
                            mouseover: function(cellItem) {
    //console.log("over mousetrap "+cellItem.dataIndex)
                                scheduleEvent("probe", 0, ()=>{
                                    refreshTable({ dataFocusIndex: cellItem.dataIndex, calloutVar: cellItem.rowSpec.varName, calloutIndex: cellItem.dataIndex, binHighlight: cellItem.dataIndex }, 0);
                                    //chart.highlightBinNumber(cellItem.dataIndex)
                                    });
                                },
                            mouseout: function(cellItem) {
    //console.log("out of "+cellItem.dataIndex)
                                scheduleEvent("probe", 200, ()=>{
                                    refreshTable({ binHighlight: null }, 0);
                                    //chart.resetBinHighlight();
                                    });
                                }
                            });
                        if (vals.length && vals.some(v=>typeof v === "number")) {
                            var ex = d3.extent(vals), range = ex[1]-ex[0];
                            if (range>maxRange) maxRange=range;
                        }
                        });
                    var groupObj = {
                        cells: rowCells,
                        xOffset: edges[2],
                        isFishy: true,
                        fishWidth: edges[3]-edges[2]-xInset,
                        fishItemWidth: entryWidth,
                        focusIndex: (options.dataFocusIndex) || 0,
                        };

                    if (rowItem.varName===options.calloutVar) {
                        var calloutIndex = options.calloutIndex;
                        groupObj.calloutItem = {
                            isCallout: true,
                            rowSpec: rowItem,
                            dataIndex: calloutIndex,
                            // x: calloutIndex*entryWidth,  never used
                            width: entryWidth*2.5,
                            values: unpacked[calloutIndex]
                        };
                    }

                    pictureCellGroups.push(groupObj);
                }
                var pcGroups = rowSeln.selectAll(".pictureCellGroup").data(pictureCellGroups);
                pcGroups.exit().remove();
                pcGroups.enter().append("g")
                    .attr("class", "pictureCellGroup")
                  .merge(pcGroups)
                    .attr("transform", (groupObject) => transformString(groupObject.xOffset,0))
                    .each(function(groupObject) {
                        var groupSeln = d3.select(this);
                        var cellClass = "fishItem";

                        var callouts = [];
                        if (groupObject.calloutItem) callouts.push(groupObject.calloutItem);

                        var pictureCells = groupSeln.selectAll("."+cellClass+",.callout").data(groupObject.cells.concat(callouts), cellItem=>cellItem.isCallout ? "callout" : cellItem.indexInGroup);

                        // now that fishiness is the norm, disappearing cells shouldn't clutter up the fish zone by taking time to fade out
                        pictureCells.exit().remove();  // just go

                        pictureCells.enter().append("g")
                            .attr("class", cellItem=>cellItem.isCallout ? "callout" : cellClass)
                            .style("opacity", cellItem=>cellItem.isCallout ? 1 : 0) // will be brought up by spaceBifocally
                            .append("rect")
                                .attr("class", "pictureMouseTrap")
                                .attr("x", cellItem=>-cellItem.width/2)
                                .attr("y", 0)
                                .attr("width", (cellItem) => cellItem.width)
                                .attr("height", cellItem=>cellItem.isCallout ? rowHeight*3 : rowHeight)
                                .style("stroke", "none")
                                .style("fill", cellItem=>cellItem.isCallout ? probeFill : "none")
                                .style("cursor", "crosshair") //cellItem=>cellItem.isCallout ? "ew-resize": "crosshair")
                                .style("pointer-events", "all");

                        chart.spaceBifocally(groupSeln, groupObject);

                        // the spaceBifocally call will have set all fishItems' widths instantly; the positions of their enclosing g elements might be changing in a timed transition
                        var trans = d3.transition().duration(300).ease(d3.easeLinear);
                        var immediate = d3.transition().duration(0);
                        groupSeln.selectAll("."+cellClass+",.callout")
                            .each(function(cellItem, i, siblingItems) {
                                var isCallout = cellItem.isCallout;
                                var seln = d3.select(this), rectSeln = seln.select("rect");
                                rectSeln.style("fill", cellItem.rowSpec.varName===options.calloutVar && cellItem.dataIndex===options.calloutIndex ? probeFill : "none");
                                var sizeFactor = isCallout ? 2 : 1;
                                var width = rectSeln.attr("width"),
                                    height = rectSeln.attr("height"),
                                    topMargin = isCallout ? 14 : 3,
                                    bottomMargin = isCallout ? 10 : 3,
                                    innerHeight = height-topMargin-bottomMargin,
                                    leftMargin = isCallout ? 24 : 5,
                                    rightMargin = isCallout ? 16 : 5,
                                    innerWidth = Math.max(1, width-leftMargin-rightMargin),
                                    midX = (leftMargin-rightMargin)/2;

                                // a callout "cell" takes care of its own positioning, and has special mousemove behaviour
                                if (isCallout) {
                                    var baseCellX = 0;
                                    d3.selectAll(siblingItems).each(function(sibling) {
                                        if (sibling.dataIndex===cellItem.dataIndex && d3.select(this).attr("class")==="fishItem") {
                                            // extracting (in this case) the x translation from the transform http://stackoverflow.com/questions/38224875/replacing-d3-transform-in-d3-v4
                                            baseCellX = this.transform.baseVal[0].matrix.e; }
                                        });
                                    seln
                                        .attr("transform", transformString(baseCellX, rowHeight-1));
                                    rectSeln
                                        .on("mouseout", function(cellItem) {
    //console.log("out of callout");
                                            scheduleEvent("probe", 200, ()=>{
                                                refreshTable({}, 0);
                                                chart.resetBinHighlight();
                                                })
                                            })
                                        .on("mousemove", function(cellItem) {
                                            if (!contextVar) return; // e.g., when context has been cancelled, and row is fading away
                                            var x = d3.mouse(this)[0];
                                            scheduleEvent("probe", 0, function() {
                                                var index = xStep === 0 ? 0 : Math.round((x-xStart)/xStep);
                                                index = Math.max(0, Math.min(index, numVerts-1));
                                                var contextIndex = vertices[index].contextIndex;
                                                //chart.resetBinHighlight();
                                                refreshTable({ focusVar: contextVar, focusIndex: contextIndex, dataFocusIndex: cellItem.dataIndex, calloutVar: cellItem.rowSpec.varName, calloutIndex: cellItem.dataIndex, binHighlight: null }, 0);
                                                chart.highlightBinNumber(cellItem.dataIndex, contextIndex);
                                                });
                                            })
                                        .on("click", function(cellItem) {
                                            if (options.focusIndex) {
                                                var vn = contextVar, index = options.focusIndex;
                                                varDefs[vn].main = varDefs[vn].extra[index];
                                                var newOptions = lively.lang.obj.clone(options);
                                                newOptions.force = true;
                                                scheduleEvent("probe", 0, ()=>{
                                                    refreshTable(newOptions, 250);
                                                    });
                                            }
                                            })
                                }

                                var vals = cellItem.values;
                                if (vals.length===0) {
                                    seln.selectAll("*").remove();
                                } else {
                                    var nonNulls = vals.filter(v=>v!==null);
                                    var vertices = [], labels = [];
                                    var yMid=topMargin+innerHeight*0.5;
                                    var isNumeric = nonNulls.some(v=>typeof v === "number");
                                    if (isNumeric) {
                                        var ex = d3.extent(nonNulls), mid=(ex[0]+ex[1])/2;
                                        function yForVal(val) { return yMid-innerHeight*(maxRange==0 ? 0 : (val-mid)/maxRange) }
                                        vals.forEach(function(v, i) {
                                            if (v!==null) vertices.push({ y: yForVal(v), contextIndex: i });
                                            });
                                        if (isCallout) {
                                            var nums = ex[0]==ex[1] ? [ex[0]] : ex;
                                            labels = nums.map(n=>({ text: stringyValue(n, cellItem.rowSpec.varName), y: yForVal(n) }));
                                            if (labels.length===2) {
                                                var yGap = labels[0].y - labels[1].y;
                                                if (yGap<10) {
                                                    var adj = (10-yGap)/2;
                                                    labels[0].y += adj;
                                                    labels[1].y -= adj;
                                                }
                                            }
                                        }
                                    } else if (nonNulls.some(v=>typeof v === "boolean")) {
                                        var yOffset=2;
                                        vals.forEach(function(v, i) {
                                            if (v!==null) vertices.push({ y: yMid+(v ? -yOffset : yOffset), contextIndex: i });
                                            });
                                    } else if (nonNulls.some(v=>typeof v === "string")) {
                                        var allStrings = lively.lang.arr.uniq(nonNulls);
                                        allStrings.sort();
                                        var ex = allStrings.length-1, yFactor=ex===0 ? 0 : Math.min(4, innerHeight/ex);
                                        vals.forEach(function(v, i) {
                                            if (v!==null) {
                                                var si = allStrings.indexOf(v); // we assume tiny collections
                                                vertices.push({ y: yMid+yFactor*(si-ex/2), contextIndex: i });
                                            }
                                            });
                                    } else if (nonNulls.some(v=>v.hasOwnProperty("collection") || lively.lang.obj.isArray(v))) {
                                        var stringyVals = vals.map(arr=>arr===null ? null : JSON.stringify(arr.collection ? arr.collection : arr));
                                        var uniqueStrings = lively.lang.arr.uniq(stringyVals);
                                        var ex = uniqueStrings.length-1, yFactor=ex===0 ? 0 : Math.min(4, innerHeight/ex);
                                        stringyVals.forEach(function(v, i) {
                                            if (v!==null) {
                                                var si = uniqueStrings.indexOf(v); // we assume tiny collections
                                                vertices.push({ y: yMid-yFactor*(si-ex/2), contextIndex: i });
                                            }
                                            });
                                    }
                                    var numVerts = vertices.length, xStep = numVerts <= 1 ? 0 : Math.min(innerWidth/(numVerts-1), 6*sizeFactor);
                                    var xStart = midX - (numVerts-1)*0.5*xStep;
                                    vertices.forEach(function(vert, i) {
                                        vert.x = xStart + i*xStep;
                                        });
                                    var animate = !(isCallout || options.hasOwnProperty("focusIndex"));
                                    if (isNumeric) {
                                        var paths = seln.selectAll("path").data([vertices]);
                                        paths.enter().append("path")
                                            .attr("class", "spark")
                                            .attr("d", d3.line().x(p=>p.x).y(p=>p.y))
                                            .style("stroke", "green") // was highlighting ? "black" : "green"
                                            .style("stroke-width", sizeFactor)
                                            .style("fill", "none")
                                            .style("pointer-events", "none")
                                          .merge(paths)
                                            .interrupt()
                                            .transition(animate ? trans : immediate)
                                            .attr("d", d3.line().x(p=>p.x).y(p=>p.y));
                                    } else seln.selectAll("path").remove();

                                    var dots = isNumeric ? [] : vertices.map(vert=>({ point: vert, reason: "base" }));
                                    var highlightVertex = highlighting && vertices.find(vert=>vert.contextIndex===highlightIndex);;
                                    if (highlightVertex) dots.push({point: highlightVertex, reason: "highlight"});
                                    var primaryVertex = vertices.find(vert=>vert.contextIndex===primaryIndex);
                                    if (primaryVertex) dots.push({point: primaryVertex, reason: "primary"});

                                    var readouts = (isCallout && options.hasOwnProperty("focusIndex")) ? [stringyValue(vals[options.focusIndex], rowVar)] : [];
                                    var texts = seln.selectAll("text.readout").data(readouts);
                                    texts.exit().remove();
                                    texts.enter().append("text")
                                      .merge(texts)
                                        .attr("class", "readout")
                                        .attr("x", 0)
                                        .attr("y", 2)
                                        .attr("dy", chart.textOffsets.hanging)
                                        .style("fill", d3.hcl(73,100,75).darker(0.5))
                                        .style("font-size", (fontHeight)+"px")
                                        .style("font-weight", "bold")
                                        //.style("dominant-baseline", "hanging")
                                        .style("text-anchor", "middle")
                                        .style("pointer-events", "none")
                                        .style('-webkit-user-select','none')
                                        .text(String);

                                    var texts = seln.selectAll("text.sparkLabel").data(labels);
                                    texts.exit().remove();
                                    texts.enter().append("text")
                                      .merge(texts)
                                        .attr("class", "sparkLabel")
                                        .attr("x", 4-width/2)
                                        .attr("y", label=>label.y)
                                        .attr("dy", chart.textOffsets.middle)
                                        .style("font-size", (fontHeight-4)+"px")
                                        //.style("dominant-baseline", "middle")
                                        .style("pointer-events", "none")
                                        .style('-webkit-user-select','none')
                                        .text(label=>label.text);

                                    var circles = seln.selectAll("circle").data(dots);
                                    circles.exit().remove();
                                    circles.enter().append("circle")
                                        .attr("cx", dotItem=>dotItem.point.x)
                                        .attr("cy", dotItem=>dotItem.point.y)
                                      .merge(circles)
                                        .attr("r", dotItem=>dotItem.reason==="base" ? sizeFactor : 1.5*sizeFactor)
                                        .style("fill", dotItem=>dotItem.reason==="highlight" ? "black" : (dotItem.reason==="primary" ? "blue" : "green"))
                                        .style("stroke-width", 0)
                                        .style("pointer-events", "none")
                                        .interrupt()
                                        .transition(animate ? trans : immediate)
                                        .attr("cx", dotItem=>dotItem.point.x)
                                        .attr("cy", dotItem=>dotItem.point.y);

                                }
                                });
                    });

                });

            // somewhat-hack: if there's a cell callout, bring its parent row to the top of all row groups
            tableGroup.select(".callout").each(function(cellItem) {
                var node = this, seln, elemClass;
                while (node=node.parentNode,
                        (elemClass=(seln=d3.select(node)).attr("class")) !=="row"
                            && elemClass !== "defunctRow"
                        ) {}
                if (elemClass!=="defunctRow") seln.raise();
                });
        }
        tableGroup.raise();

        if (options.hasOwnProperty("binHighlight")) {
            if (options.binHighlight===null) chart.resetBinHighlight();
            else chart.highlightBinNumber(options.binHighlight);
        }

        runDeferred(duration || 0);
    }
    this.refreshTable = refreshTable;
    this.scheduleEvent = scheduleEvent;

    var group = this.histGroup;
    var opacityHandler = (xp,yp)=>{
        chart.triangleSetting = { x: xp, y: yp };
        var x = xp*0.01, y = yp*0.01;
        chart.primaryOpacity = y;
        chart.contextOpacity = x*0.8; // fudge
//console.log(xp, yp, chart.primaryOpacity, chart.contextOpacity)
    	group.selectAll("rect.primary").style("opacity", chart.primaryOpacity);
    	group.selectAll("rect.context").style("opacity", chart.contextOpacity);
    }

    if (tableOptions.noFader!==true) {
        this.drawFaderControl(lively.pt(260, tableOptions.noVisibleTable ? 70 : 45), lively.lang.fun.throttle(opacityHandler, 100));
        group.select("g.fader").style("opacity", 0);
    }
    if (tableOptions.noDensity!==true) this.drawDensityControl(lively.pt(480, tableOptions.noVisibleTable ? 55 : 30), ()=>refreshTable({}, 250));
    if (tableOptions.widthControl) {
        var widthValues = varDefs.width.extra; // array of stringy expressions
        var valueIndex = widthValues.indexOf(varDefs.width.main);
        this.drawBinWidthControl(lively.pt(420, 51), widthValues, valueIndex, newValue=>{
            varDefs.width.main = newValue;
            delete chart.estimatedBinMax;
            refreshTable({ force: true }, 0);
            });
    }
    if (tableOptions.sweepControl) {
        this.drawSweepControl(lively.pt(0, 55), ()=>toggleContextSpec("offset"));
    }


    refreshTable({ force: true, binHighlight: null }, 0);  // force refresh
};

chartObject.computeG=function computeG(nBins) {
  // using the algorithm in the appendix of https://scholar.google.com/citations?view_op=view_citation&hl=en&user=7KgmBisAAAAJ&citation_for_view=7KgmBisAAAAJ:d1gkVwhDpl0C
  //  K is nBins
  //  T is anchorPositions - currently set to 100
  //  h is dataRange/nBins
  //  x1 is dataMin
  //  bins m0...m((K+1)/T) are in sliceCounts
  //  bins M0...M(KT) are in windowedCounts
  //  scores S0...ST are in scores
  // their algorithm creates the "mj" bin counts using open left, closed right ranges.  thus all x1 values would land in bin T-1 - i.e., (d0 + (T-1)h/t, d0 + h],  or  (x1 - h/T, x1]
  // in the interests of consistency we re-create this outcome, by finding the difference between x and x1, dividing by the (mini-) bin width, taking the ceiling, and adding T-1.
  var data = this.data, dataMin = this.dataMin, dataMax = this.dataMax, dataRange = dataMax-dataMin, binWidth = dataRange/nBins;
  var anchorPositions = 100; // (offset 0 to 0.99 - calc'd as -1 to -0.01)
  var sliceCounts = [], sliceWidth = binWidth/anchorPositions, firstEdge = dataMin - binWidth;
  data.forEach(function(v) {
    var sliceIndex = Math.ceil((v - dataMin)/sliceWidth) + anchorPositions - 1;
    var c = sliceCounts[sliceIndex];
    if (c === undefined) c = 1; else c++;
    sliceCounts[sliceIndex] = c;
    });
  var windowedCounts = [], nIterations = nBins*anchorPositions, windowDiffs = [], finalBinStart = (nBins-1)*anchorPositions;
  function sliceCount(j) { return sliceCounts[j] || 0 };
  var wCount = sliceCount(anchorPositions-1); // M0
  windowedCounts.push(wCount);
  var scores = lively.lang.arr.withN(anchorPositions, 0);
  scores[0] += wCount*wCount; // first element of S0
  var t=1;
  for (var j=1; j<nIterations; j++) {
    wCount = wCount - sliceCount(j-1) + sliceCount(j+anchorPositions-1);
    windowedCounts.push(wCount);
    if (j>=anchorPositions) {
      var wDiff = wCount-windowedCounts[j-anchorPositions];
      windowDiffs.push(wDiff);
      scores[t] += wDiff*wDiff;
      if (j>=finalBinStart) {
        scores[t] += wCount*wCount;
      }
    }
    if (++t === anchorPositions) t=0;
  }
  var sortedScores = scores.slice();
  sortedScores.sort(function(a,b) { return b-a }); // inverse order
  var sum = 0, weightedSum = 0;
  for (var i=1; i<=anchorPositions; i++) {
    weightedSum += i * sortedScores[i-1];
    sum += scores[i-1];
  }
  var g = (2*weightedSum/sum - 1)/anchorPositions;
  return g;
};

chartObject.drawBalls=function drawBalls(data) {
    // these go into dataGroup
    var chart=this;

    // draw balls based on our bag-like collection
    var staggeredData = [], staggerRatio = 1.5, cutoffData = [], prev = null;
    var maxCount = 0;
    data.valuesAndCountsDo((val,count)=>maxCount = Math.max(maxCount, count));
    var blobUnit = maxCount<=10 ? 1 : Math.floor(maxCount/10);
    // make blobs at least a bit bigger if each represents multiple data points
    var blobRadius = 2+Math.floor(Math.log(blobUnit)/Math.log(10));
    data.valuesAndCountsDo((val,count)=>{
        var numBalls = count/blobUnit; // (logBase**blobUnit);
        for (var i=0;i<Math.ceil(numBalls);i++) staggeredData.push({ value: val, stagger: i*staggerRatio, clipLimit: i+1>numBalls ? numBalls-i : undefined });
        cutoffData.push({ value: val, cutoff: numBalls});
        });
	var xScale = this.xScale;
	var group = this.dataGroup;

	var balls = group.selectAll("circle.ball").data(staggeredData);
	balls.enter()
	    .each(function(d,i) {
	        // clipPath stuff following example in http://www.d3noob.org/2015/07/clipped-paths-in-d3js-aka-clippath.html
	        if (d.clipLimit) {
	            group.append("clipPath")
	                .attr("id", "ballClipper"+i)
	                .append("rect")
            		.attr("x", xScale(d.value)-blobRadius)
            		.attr("y", -blobRadius*(d.clipLimit+2*d.stagger))
            		.attr("width", 2*blobRadius)
            		.attr("height", d.clipLimit*2*blobRadius)
	        }})
		.append("circle")
		.attr("class", "ball")
		.attr("cx", d=>xScale(d.value))
		.attr("cy", d=>-blobRadius*(1+2*d.stagger))
		.attr("r", blobRadius)
		.style("fill", "black")
		.style("stroke-width", 0.5)
		.style("stroke", "black")
		.attr("clip-path", (d, i)=>d.clipLimit ? "url(#ballClipper"+i+")" : "none")

		.on("mouseover", function(d) {
		    })

		.on("mouseout", function(d) {
            //group.selectAll("path.testing").remove()
		    });

/* if we go back to using datasets that need a blob to represent more than one data item

	// no good reason to use a data join for these.  but hey.
	var legendBalls = group.selectAll("circle.legend").data([0]);
	legendBalls.enter()
		.append("circle")
		.attr("class", "legend")
		.attr("cx", xScale.range()[1]+20)
		.attr("cy", -10*blobRadius)
		.attr("r", blobRadius)
		.style("fill", "black");
	var legendLabels = group.selectAll("text.legend").data([0]);
	legendLabels.enter()
		.append("text")
		.attr("class", "legend")
		.attr("x", xScale.range()[1]+23+blobRadius)
		.attr("y", -10*blobRadius+1)
		.style("font-size", "11px")
		.style("dominant-baseline", "middle")
        .style('-webkit-user-select','none')
        .text("= "+blobUnit)
*/
};

chartObject.drawBinAnnotations=function drawBinAnnotations(group, axisOrigin, axisHeight, tickDefs, labelDefs, instant) {
    var chart=this;
    var axisX = axisOrigin.x, axisBase = axisOrigin.y;

    var labels = group.selectAll("text.histLabel").data(labelDefs, def=>def.labelType+def.text);
	labels.exit().remove();
	labels.enter().append("text")
	    .attr("class", "histLabel")
	    .style("font-size", "10px")
	    .style("fill", "grey")
		.style("pointer-events", "none")
        .style("-webkit-user-select","none")
        .each(function(def) {
            var seln = d3.select(this);
            if (!instant) {
                seln
                    .style("opacity", 1e-6)
                    .transition()
                    .duration(500)
                    .style("opacity", 1)
            }
            })
      .merge(labels)
	    .attr("x", d=>d.x)
	    .attr("y", d=>axisBase+d.y)
        .attr("dy", d=>chart.textOffsets[d.baseline || "central"])
        .each(function(def) {
            var seln = d3.select(this);
            var spans = seln.selectAll("tspan");
            var highlight = def.highlightOnChange && (spans.empty() || d3.select(spans.node()).text()!==def.text);
            spans.remove();
            var mainSpan = seln.append("tspan")
                .text(def.text)
        	    .style("text-anchor", d=>d.anchor || "start");
            if (def.suffix) {
                // mildly hacky.  we want to add a suffix (typically a units string) but have the first tspan be anchored as if it were on its own.  so we figure out where the anchoring tspan has been put, then fix it to a "start" anchor and explicit offset before appending a further tspan for the suffix.

            	// var mainLeft = mainSpan.node().getBBox().x; doesn't work on IE
            	var mainLeft = this.getBBox().x;
            	mainSpan
            	    .style("text-anchor", "start")
            	    .attr("dx", mainLeft-def.x);
            	seln.append("tspan").text(def.suffix);
            }

            if (highlight) {
                seln
                    .style("fill", "red")
                    .transition()
                    .duration(1000)
                    .style("fill", "grey")
            }
            });

	var ticks = group.selectAll("line.tick").data(tickDefs);
	ticks.exit().remove();
	ticks.enter().append("line")
	    .attr("class", "tick")
	    .style("stroke", "grey")
	    .style("stroke-width", 1)
      .merge(ticks)
	    .attr("x1", d=>d.x)
	    .attr("x2", d=>d.x+d.dx)
	    .attr("y1", d=>axisBase+d.y)
	    .attr("y2", d=>axisBase+d.y+d.dy);

	var refLines = group.selectAll("line.yscale").data([axisHeight]);
	refLines.enter().append("line")
	    .attr("class", "yscale")
	    .attr("x1", axisX)
	    .attr("x2", axisX)
	    .attr("y1", axisBase)
	    .style("stroke-width", "1px")
	    .style("stroke", "grey")
      .merge(refLines)
	    .attr("y2", d=>axisBase-d);

};

chartObject.drawBins=function drawBins(primaryBins, contextBins, options) {
    // options: useDensity, binMax, scaleToFitAxis, highlight, extraAxisAnnotations

    // bins go into g.binGroup, a child of histGroup; scale goes directly into histGroup

    // primaryBins is a collection of objects { min, max, values }
    // contextBins is a collection of bin collections, where each bin also has a "scenario" property (numbered from 0)
    // highlight is an optional scenario index used to put the highlight onto a context scenario, rather than on the primary

    var chart = this;

    var xScale = this.xScale;
	var rangeMax = options.binMax, useDensity = options.useDensity, highlight = options.highlight, extraAxisAnnotations = options.extraAxisAnnotations;
	// if scaleToFitAxis is true, the height scale will be based on the generated "pretty" count scale
    // draw a zero count as a vanishingly short bin (i.e., a line)
	var scaleValues = this.rPretty([0, rangeMax], 5), lastValue = scaleValues[scaleValues.length-1];
	if (options.scaleToFitAxis) {
	    if (this.countScaleMax !== lastValue) chart.histGroup.selectAll("text.histLabel").filter(def=>def.highlightOnChange).interrupt().remove();
	    rangeMax = this.countScaleMax = lastValue;
	}
	var maxBinHeight = this.maxMainBinHeight;
	// if we're drawing a full axis, no need to fill in zero-height bins with a line
    var heightScale = extraAxisAnnotations ? function(val) { return val/rangeMax*maxBinHeight } : function(val) { return val===0 ? 0.01 : val/rangeMax*maxBinHeight };
	var histGroup = this.histGroup, binGroup = histGroup.select(".binGroup");
    var transformString = this.transformString;

	function showBins(binData, binClass, fillColour) {
	    // binClass is "primary", "context", or "contextOutline"
	    // binData can be empty!
	    var classIndex = ["primary", "context", "contextOutline"].indexOf(binClass);
	    //var isPrimary = binClass==="primary", isContext = binClass==="context";
    	var rects = binGroup.selectAll("rect."+binClass).data(binData, binItem=>binItem.dataIndex);
    	rects.exit().remove();
    	var preWidth;
    	if (binClass==="primary" && rects.size()) preWidth = +(rects.nodes()[0].getAttribute("width"));
    	var rectsE = rects.enter().append("rect")
    	    .attr("class", binClass+" bin");
       	rects = rects.merge(rectsE);
    	rects
		    .attr("x", binItem=>xScale(binItem.min))
			.attr("y", binItem=>-heightScale(useDensity ? binItem.values.length/(chart.data.length*(binItem.max-binItem.min)) : binItem.values.length))
            .attr("width", binItem=>xScale(binItem.max)-xScale(binItem.min))
			.attr("height", binItem=>heightScale(useDensity ? binItem.values.length/(chart.data.length*(binItem.max-binItem.min)) : binItem.values.length))
			.style("fill", fillColour)
    	    .style("stroke", ["blue", "none", "black"][classIndex])
    	    //.style("fill-opacity", isContext ? 0.15 : 1)
    	    .style("stroke-width", [ contextBins.length ? 1 : 0.5, 0, 1 ][classIndex])
    	    .style("stroke-opacity", [ 1, 0, 1 ][classIndex])
            .style("opacity", [ contextBins.length ? chart.primaryOpacity : 0.5, chart.contextOpacity, chart.primaryOpacity ][classIndex])
            .attr("pointer-events", [ "all", "none", "none" ][classIndex])
			.style("cursor", chart.binsAreDraggable ? "ew-resize" : "crosshair")
			.each(function() {
			    if (binClass==="primary" || binClass==="contextOutline") d3.select(this).raise();
    			});
        if (preWidth) {
            // if widths of the primary bins have changed, reset any balls' odd/even annotation (so they can't be used this time around)
            var postWidth = +(rects.nodes()[0].getAttribute("width"));
            if (lively.lang.num.roundTo(postWidth, 0.1)!==lively.lang.num.roundTo(preWidth, 0.1)) {
//console.log("resetting odd/evens", preWidth, postWidth);
                chart.dataGroup.selectAll("circle.ball")
                    .each(function() { delete this.oddEven });
            }
        }
	}

    // @@ experimental
/*
	function showPoles(binData) {
	    var offsets = [];
	    binData.forEach((binItem, i)=>{
	        if (i===0) offsets.push(binItem.min);
	        offsets.push(binItem.max)
	        });
	    var lines = histGroup.selectAll("line.binPole").data(offsets);
    	lines.enter().append("line")
    	    .attr("class", "binPole")
    	   .merge(lines)
		    .attr("x1", off=>xScale(off))
			.attr("y1", -250)
		    .attr("x2", off=>xScale(off))
			.attr("y2", -130)
    	    .style("stroke", "grey")
    	    .style("stroke-width", 0.5)
            .attr("pointer-events", "none")

    	lines.exit().remove();
	}
*/

//showPoles(primaryBins);   @@ probably want to use these when the bins are moved
	var allContext = [];
	contextBins.forEach(function(binCollection) {
	    allContext = allContext.concat(binCollection);
    	});
    var outlineContext = allContext.filter(binItem=>binItem.scenario===highlight);
    var contextColour = this.contextBinFill;
    contextColour.opacity = 0.15;
	showBins(allContext, "context", contextColour.toString());
    showBins(primaryBins, "primary", allContext.length ? "none" : this.restingBinFill);
    showBins(outlineContext, "contextOutline", "none");

	var extraLabelSpacing = 9;
	var legendX = xScale(this.dataMax)+40, lineLegendY = 12;
	var labelDefs = [
        { labelType: "title", x: legendX, anchor: "start", y: -heightScale(lastValue)-15, text: useDensity ? "density" : "count" }
        ];
    var tickLength = 4;
    var tickDefs = [
        { x: legendX, y: 0, dx: -tickLength, dy: 0 }    // a foot for the scale
        ];
	scaleValues.forEach(v=>{
	    labelDefs.push({ labelType: "yAxis", x: legendX+tickLength+3, y: -heightScale(v), text: String(v), highlightOnChange: true });
	    tickDefs.push({ x: legendX, y: -heightScale(v), dx: tickLength, dy: 0 });
	    });
	if (extraAxisAnnotations) {
	    // not just min and max
    	var axisValues = this.rPretty([this.dataMin, this.dataMax], 10);
    	axisValues.forEach(v=>{
    	    labelDefs.push({ labelType: "xAxis", x: xScale(v), anchor: "middle", y: lineLegendY, text: String(v) });
    	    tickDefs.push({ x: xScale(v), y: 0, dx: 0, dy: tickLength });
    	    });
    	labelDefs[labelDefs.length-1].suffix = " "+this.dataUnits;
    	// add a very long "tick" to act as a baseline for the axis
    	var baselineStart = xScale(axisValues[0]), baselineEnd = xScale(axisValues[axisValues.length-1]);
    	tickDefs.push({ x: baselineStart, y: 0, dx: baselineEnd-baselineStart, dy: 0 });
	} else {
	    [ { val: this.dataMin }, { val: this.dataMax, suffix: " "+this.dataUnits } ].forEach(def=>{
	        labelDefs.push({ labelType: "xAxis", x: xScale(def.val), anchor: "middle", y: lineLegendY, text: String(def.val), suffix: def.suffix });
	        tickDefs.push({ x: xScale(def.val), y: 0, dx: 0, dy: tickLength });
    	    });
	}
    this.drawBinAnnotations(histGroup, { x: legendX, y: 0 }, heightScale(lastValue), tickDefs, labelDefs, true);  // instant
};

chartObject.drawBinWidthControl=function drawBinWidthControl(offset, valueArray, initialIndex, handler) {
    // goes into histGroup
    var chart=this;

    var switchW = 50, switchH = 32, rectOffset = 75, dragRegionOffset = { x: offset.x+rectOffset, y: offset.y }, stepSize = 8, switchColour = "#444", readoutColour = "black";
    var switchGroup = this.histGroup.append("g").attr("class", "switchGroup");

    var valueIndex = initialIndex;

    var switchRect = switchGroup
        .append("rect")
        .attr("id", "widthControl")
        .attr("x", dragRegionOffset.x)
        .attr("y", dragRegionOffset.y)
        .attr("width", switchW)
        .attr("height", switchH)
        .style("border-width", 1)
        .style("stroke", switchColour)
        .style("fill", "none")
        .style("pointer-events", "none")
        .attr("stroke-dasharray", "2 4");

    var switchReadout = switchGroup
	    .append("text")
		.attr("class", "readout")
		.attr("x", dragRegionOffset.x+switchW/2)
		.attr("y", dragRegionOffset.y+switchH/3)
		.attr("dy", this.textOffsets.central)
		.style("font-size", "14px")
		.style("text-anchor", "middle")
		//.style("dominant-baseline", "central")
		.style("pointer-events", "none")
        .style("-webkit-user-select","none")
        .style("fill", readoutColour);

    var minMaxIndicator = switchGroup
	    .append("text")
		.attr("class", "minmax")
		.attr("x", dragRegionOffset.x+switchW/2)
		.attr("y", dragRegionOffset.y+switchH*0.75)
		.attr("dy", this.textOffsets.central)
		.style("font-size", "9px")
		.style("text-anchor", "middle")
		//.style("dominant-baseline", "central")
		.style("pointer-events", "none")
        .style("-webkit-user-select","none")
        .style("fill", readoutColour);

    function updateReadout() {
        switchReadout
            .interrupt()
            .text(valueArray[valueIndex])
            .style("fill", "red")
            .transition()
            .duration(1000)
            .style("fill", readoutColour);
        minMaxIndicator
            .text(valueIndex===0 ? "(MIN)" : (valueIndex===valueArray.length-1 ? "(MAX)" : ""))
    }
    updateReadout();

    var dragRect = switchGroup
        .append("rect")
        .attr("class", "draggable")
        .attr("x", dragRegionOffset.x)
        .attr("y", dragRegionOffset.y)
        .attr("width", switchW)
        .attr("height", switchH)
        .style("fill", "none")
        .style("pointer-events", "all")
        .style("cursor", "ew-resize") // "col-resize"
//.style("stroke", "green")
        .on("mousedown", function() {
            // low-rent drag capability, as shown in https://bl.ocks.org/mbostock/4198499
            var startPt = d3.mouse(this), startIndex = valueIndex, dragOffset = { x: startPt[0]-dragRegionOffset.x, y: startPt[1]-dragRegionOffset.y };
              //.classed("active", true);

            var w = d3.select(window)
                .on("mousemove", ()=>{
                    var pt = d3.mouse(switchRect.node());
                    dragRect.attr("x", pt[0]-dragOffset.x).attr("y", pt[1]-dragOffset.y); // every time
                    throttledMove(pt);  // in a controlled manner
                    })
                .on("mouseup", mouseup);

            d3.event.preventDefault(); // maybe not needed.  whatevs.

            function mousemove(pt) {
                var xDelta = pt[0]-startPt[0];
                var newIndex = Math.max(0, Math.min(valueArray.length-1, startIndex + Math.floor(xDelta/stepSize)));
                if (newIndex !== valueIndex) {
                    valueIndex = newIndex;
                    updateReadout();
                    handler(valueArray[valueIndex])
                }
            }
            var throttledMove = lively.lang.fun.throttle(mousemove, 100);

            function mouseup() {
                w.on("mousemove", null).on("mouseup", null);
                dragRect.attr("x", dragRegionOffset.x).attr("y", dragRegionOffset.y);
            }
            });

	switchGroup
	    .append("text")
		.attr("class", "switchLabel")
		.attr("x", offset.x)
		.attr("y", offset.y+switchH/3)
		.attr("dy", this.textOffsets.central)
		.style("font-size", "14px")
		//.style("dominant-baseline", "central")
		.style("pointer-events", "none")
        .style("-webkit-user-select","none")
        .style("fill", switchColour)
        .text("bin width")

	switchGroup
	    .append("text")
		.attr("class", "switchLabel")
		.attr("x", offset.x)
		.attr("y", offset.y+switchH*0.75)
		.attr("dy", this.textOffsets.central)
		.style("font-size", "9px")
		//.style("dominant-baseline", "central")
		.style("pointer-events", "none")
        .style("-webkit-user-select","none")
        .style("fill", switchColour)
        .text("(drag to change)")

};

chartObject.drawBreakValues=function drawBreakValues(options) {
    var chart=this;

    var instant = !!(options && options.instant);

    var stackBase = 0, dropDistance = this.fallIntoBins, binBase = stackBase+dropDistance;
    var xScale = this.xScale;

    var decimals = this.dataBinDecimals;
    var labelDefs = [];

    // the data element for a text.binbreak includes text, value, index
    chart.demoGroup.selectAll("line.binbreak").each(function(def, i) {
        var seln=d3.select(this);
        labelDefs.push({text: def.value.toFixed(decimals), value: def.value, index: i });
        });
    var labels = chart.demoGroup.selectAll("text.binbreak").data(labelDefs, def=>def.index);
    labels.exit().remove();
    labels.enter().append("text")
        .attr("class", "binbreak")
        .attr("y", binBase+10)
        .attr("dy", this.textOffsets.hanging)
        .style("font-size", "12px")
        .style("text-anchor", "middle")
        //.style("dominant-baseline", "hanging")
        .style("pointer-events", "none")
        .style("-webkit-user-select","none")
      .merge(labels)
        .attr("x", def=>xScale(def.value))
        .text(def=>def.text)
        .each(function() {
            var seln = d3.select(this);
            if (instant) seln.style("fill", "grey");
            else {
                seln.style("fill", "red");
                function throb() {
                    seln
                        .transition()
                        .duration(500)
                        .style("fill", "gray")
                        .transition()
                        .duration(500)
                        .style("fill", "red")
                        .on("end", throb);
                }

                throb();
            }
            });

    function clearBreakValues() {
        chart.demoGroup.selectAll("text.binbreak").remove();
    }
    chart.clearBreakValues = clearBreakValues;

    chart.setTimerInfo({
        cleanup: ()=> {
            chart.demoGroup.selectAll("text.binbreak")
                .interrupt()
                .style("fill", "gray")
            }
        });

};

chartObject.drawCommandList=function drawCommandList(current, thenDo) {
    var chart=this;

    var listOrigin = this.commandListOrigin, fontSize = 13, itemHeight = 20, buttonSize = 16, itemColour = "rgb(0, 100, 0)", buttonGap = 6;
    var transformString = this.transformString;

    var commandsToDraw = chart.commandList.slice(0, Math.max(current, chart.maximumScrolledIndex)+1);
    var commandDefs = commandsToDraw.map((def, i)=>({ command: def.command, replayable: def.replayable, index: i }));
    if (commandsToDraw.length < chart.commandList.length) {
        commandDefs.push({ command: "...(keep scrolling)", replayable: false, clickable: false, index: commandsToDraw.length })
    }

    var commandEntries = chart.commandGroup.selectAll("g.command").data(commandDefs, def=>def.index+def.command); // need to ensure the "..." line gets shifted
    commandEntries.exit().remove();
    commandEntries.enter().append("g")
        .attr("class", "command")
        .attr("transform", (def, i)=>transformString(0, itemHeight*i))
        .each(function(def,i) {
            var seln = d3.select(this);
            var text = seln
                .append("text")
                .attr("x", 0)
                .attr("y", itemHeight/2)
        		.attr("dy", chart.textOffsets.middle)
                .style("font-size", fontSize+"px")
                .style("font-weight", 600)
                .style("fill", itemColour)
                .style("fill-opacity", 0.4)
                .style("text-anchor", "start")
                .style("pointer-events", "none")
                .style('-webkit-user-select','none')
                .text(def.command);

            // space out the "normal"-weight text to match the length it'll have when bold
            var boldWidth = text.node().getBBox().width;
            text.style("font-weight", "normal");
            text.node().nonBoldSpacing = (boldWidth - text.node().getBBox().width)/def.command.length;

            if (def.replayable) {
                var centreX = boldWidth + buttonGap + buttonSize/2;

                seln
                    .append("circle")
                    .attr("class", "replay")
                    .attr("cx", centreX)
                    .attr("cy", itemHeight/2)
                    .attr("r", buttonSize/2)
                    .style("fill", "green")
                    .style("stroke", "green")
                    .style("stroke-width", 1)
                    .style("pointer-events", "none");

                seln
                    .append("path")
                    .attr("d", d3.symbol().type(d3.symbolTriangle).size(36))
                    .attr("transform", "translate("+centreX+" 10) rotate(90 0 0)")
                    .style("fill", "white")
                    .style("stroke", "green")
                    .style("stroke-width", 1)
                    .style("pointer-events", "none");
                }

            if (!(def.clickable===false)) {
                seln
                    .append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", boldWidth + (def.replayable ? buttonGap+buttonSize : 0))
                    .attr("height", itemHeight)
                    .style("fill", "none")
                    .style("pointer-events", "all")
                    .style("cursor", "pointer")
                    .on("click", function(def) { chart.jumpToStep(def.index) });
            }
        });

    function decorateList() {
        chart.commandGroup.selectAll("g.command")
            .each(function(def,i) {
                var isCurrent = i===current, isFuture = i > current;

                var buttonSeln = d3.select(this).select(".replay");
                //buttonSeln.style("fill", isCurrent ? "black" : (isFuture ? "green" : "white"));
                buttonSeln.style("fill", isCurrent ? "green" : "white"); // simpler policy

                var textSeln = d3.select(this).select("text");
                textSeln
                    .text(def=>def.command)
                    .interrupt()
                    .style("fill", isCurrent ? "red" : itemColour)
                    .style("fill-opacity", isFuture ? 0.5 : 1)
                    .style("font-weight", isCurrent ? 600 : "normal")
                    .attr("letter-spacing", isCurrent ? "normal" : textSeln.node().nonBoldSpacing+"px");
                if (isCurrent) {
                    textSeln.transition()
                        .duration(2000)
                        .style("fill", itemColour);
                }
                });
    }

    decorateList();
    chart.commandGroup.raise();

    if (thenDo) thenDo();

    var handIndex = this.lastScrolledIndex || 0;
    this.drawHandPointer({ x: listOrigin.x - 4, y: listOrigin.y + (handIndex+0.5)*itemHeight+2 }
    //,decorateList
        );



};

chartObject.drawColouredNumberLine=function drawColouredNumberLine(options) {
    var chart=this;

    var instant = !!(options && options.instant);

    var dataMin = this.dataMin, dataMax = this.dataMax, dataRange = dataMax-dataMin;
    var xScale = this.xScale, colourScale = this.colourScale;
    var bandLeft = this.plotOrigin.x, bandTop = this.plotOrigin.y -this.fallAfterFlight + 5, bandHeight = 10;
    var labelFontSize = 14;
    var fixedCanvas = this.chartFixedCanvas.node(), fixedContext = fixedCanvas.getContext("2d");

    drawNumber(dataMin, "min");

    var step = 0, maxStep = 40, drawTime = 1000;
    if (instant) {
        drawUpToStep(maxStep);
        drawNumber(dataMax, "max");
    } else {
        this.startTimer({
            tick: elapsed=>{
                drawForElapsedTime(elapsed);
                if (step===maxStep) {
                    chart.stopTimer(false);
//console.log("finished");
                }
                },
            forceToEnd: ()=>drawForElapsedTime(drawTime)
            })
    }

    function drawForElapsedTime(elapsed) {
    //console.log("cnl");
        var newStep = Math.min(maxStep, Math.round(elapsed/drawTime*maxStep));
        if (newStep!==step) {
            drawUpToStep(newStep);
            if (step===maxStep) drawNumber(dataMax, "max");
        }
    }

    function drawNumber(number, which) {
        fixedContext.font = labelFontSize+"px Arial";
        fixedContext.fillStyle = colourScale(number);
        fixedContext.textAlign = which==="min" ? "end" : "start";
        var x = bandLeft + xScale(number) + (which==="min" ? -5 : 5);
        fixedContext.fillText(String(number), x, bandTop+bandHeight);
    }

    function drawUpToStep(newStep) {
        for (var s=step+1; s<=newStep; s++) drawLine(s);
        step = newStep;
    }

    function drawLine(latestStep) {
        var perStep = dataRange/maxStep;
        var midValue = dataMin+(latestStep-0.5)*perStep, colour = colourScale(midValue, 1);
        var startX = Math.floor(xScale(dataMin+(latestStep-1)*perStep));
        if (latestStep===1) startX--;
        var width = Math.floor(xScale(dataMin+latestStep*perStep))-startX;
        // since we're using opaque colours, it's ok to overlap by a pixel (and avoids most of the glitchiness that otherwise appears when the canvas has been scaled down)
        //if (latestStep===maxStep) width++;
        width++;  // every time

        fixedContext.fillStyle = colour;
        fixedContext.beginPath();
        fixedContext.rect(bandLeft+startX, bandTop, width, bandHeight);
        fixedContext.fill();
    }

};

chartObject.drawCyclingScenarios=function drawCyclingScenarios(labelFn) {
    // not a pretty piece of code.

    // cycling won't be launched unless the user pauses scrolling at this step.
    // if user doesn't interact with the control strip, the animation will step automatically at a rate defined by pauseTime and changeTime.
    // if user mouses over the strip, the selected scenario will be drawn instantly.  once the mouse leaves the strip, automatic stepping will resume from the selected scenario (and in the direction of the last automatic step).

    var chart=this;

    var scenarioClasses = "rect.demobin,line.binbreak,text.binbreak";
    var numScenarios = this.scenarioRecords.length, changeTime = 400, pauseTime = 750, shifting = false;

    var switchSize = 16, autoStepping = true, abandoned = false, displayStep, cycleDirection;
    var movingGroupSeln = null;

    // NB: going into demoGroup, so coords are relative to plotOrigin
    var controlStripWidth = 150, controlStripHeight = 20, controlStripOrigin = { x: this.commandListOrigin.x-this.plotOrigin.x, y: this.buttonRowOrigin.y-this.plotOrigin.y }, labelOrigin = { x: controlStripOrigin.x, y: controlStripOrigin.y+controlStripHeight+10 };

    var stackBase = 0, dropDistance = this.fallIntoBins, binBase = stackBase+dropDistance;

    var controlGroup = this.demoGroup.append("g").attr("class", "scenariocontrol");
    controlGroup.append("rect")
        .attr("id", "scenarioSwitcher")
        .attr("x", controlStripOrigin.x)
        .attr("y", controlStripOrigin.y)
        .attr("width", controlStripWidth)
        .attr("height", controlStripHeight)
        .style("stroke", "green")
        .style("fill-opacity", 1e-6)
        .style("cursor", "crosshair")
        .on("mouseover", ()=>{
            if (abandoned) return;

            autoStepping = false;
            stopTransition();
            })
        .on("mousemove", function() {
            if (abandoned) return;

            var x = d3.mouse(this.parentNode)[0]-controlStripOrigin.x;
            var desiredStep = Math.max(0, Math.min(Math.floor(numScenarios*x/controlStripWidth), numScenarios-1));
//console.log(desiredStep);
            if (desiredStep!==displayStep) transitionToScenario(desiredStep, true);
            })
        .on("mouseout", ()=>{
            if (abandoned) return;

            autoStepping = true;
            stepAfterDelay(0);
            });

    var delayedStep = null;
    function stepAfterDelay(delay) {
        if (delayedStep) clearTimeout(delayedStep);
        delayedStep = null;

        if (delay) {
            delayedStep = setTimeout(doStep, delay);
        } else {
            doStep();
        }

        function doStep() {
            if (abandoned || !autoStepping) return;  // either user has taken control by mousing over control strip, or we've left this stage of the essay

            // bounce off the ends
            if (displayStep===0) cycleDirection = 1;
            else if (displayStep===numScenarios-1) cycleDirection = -1;

            transitionToScenario(displayStep+cycleDirection, false); // not instant
        }
    }

    function updateTitleText(val) {
        var labelText = controlGroup.selectAll("text.scenarioTitle").data([0]);
        labelText.enter().append("text")
            .attr("class", "scenarioTitle")
            .attr("x", labelOrigin.x)
            .attr("y", labelOrigin.y)
    		.attr("dy", chart.textOffsets.hanging)
            .style("font-size", "14px");
        // for now, we expect labelFn to return an array of objects with props { text, highlightOnChange }
        var basicFill = "grey";
        var labelSpans = controlGroup.select("text.scenarioTitle").selectAll("tspan").data(labelFn(val));
        labelSpans.enter().append("tspan")
            .style("fill", basicFill)
            .style("-webkit-user-select","none")
            .style("pointer-events", "none")
          .merge(labelSpans)
            .each(function(def) {
                var seln = d3.select(this);
                seln.interrupt();
                if (def.highlightOnChange && seln.text()!==def.text) {
                    seln
                        .style("fill", "red")
                        .transition()
                        .duration(1000)
                        .style("fill", basicFill)
                }
                })
            .text(def=>def.text);
    }

    function updateScenarioTexts(current) {
        // current is zero-offset
        var labels = controlGroup.selectAll("text.scenarioNumber").data(lively.lang.arr.range(1, numScenarios));
        labels.enter().append("text")
            .attr("class", "scenarioNumber")
            .attr("x", n=>controlStripOrigin.x+(n-0.5)*controlStripWidth/numScenarios)
            .attr("y", controlStripOrigin.y+controlStripHeight/2)
    		.attr("dy", chart.textOffsets.middle)
    		.style("text-anchor", "middle")
            .style("font-size", "16px")
            .style("-webkit-user-select","none")
            .style("pointer-events", "none")
            //.text(String)
          .merge(labels)
            //.style("font-weight", n=>n===current+1 ? "bold" : "normal")
            //.style("opacity", n=>n===current+1 ? 1 : 0.7)
            .text(n=>n===current+1 ? "●" : "○")

        var highlight = controlGroup.selectAll("rect.scenarioHighlight").data([current]);
        highlight.enter().append("rect")
            .attr("class", "scenarioHighlight")
            .attr("fill", "lightgray")
            .attr("width", controlStripWidth/numScenarios-2)
            .attr("height", controlStripHeight-2)
            .attr("y", controlStripOrigin.y+1)
          .merge(highlight)
            .attr("x", c=>controlStripOrigin.x+c*controlStripWidth/numScenarios+1)
            .lower();
    }

    function transitionToScenario(scenario, instant) {
        var nextGroupSeln = d3.select(chart.scenarioRecords[scenario].bins);

        // we want to move the elements in movingGroup to the positions of the corresponding elements in nextGroup.  we do this by setting up data objects that hold the relevant attributes of the latter.
        var rectDefs = [];
        var nextRects = nextGroupSeln.selectAll("rect");
        nextRects.each(function(def) {
            var seln = d3.select(this);
            rectDefs.push({ binNum: def.binNum, x: +seln.attr("x"), y: +seln.attr("y"), width: +seln.attr("width"), height: +seln.attr("height"), indices: def.indices })
            });
        var sampleRect = nextRects.nodes()[0]; // suitable for cloning
        var yBase = rectDefs[0].y+rectDefs[0].height; // as good as any

        var textDefs = [];
        var nextTexts = nextGroupSeln.selectAll("text");
        nextTexts.each(function(def, i) {
            var seln = d3.select(this);
            textDefs.push({ text: seln.text(), x: +seln.attr("x"), index: i })
            });
        var sampleText = nextTexts.nodes()[0]; // for cloning

        var lineDefs = [];
        var nextLines = nextGroupSeln.selectAll("line");
        nextLines.each(function(def, i) {
            var seln = d3.select(this);
            lineDefs.push({ x: +seln.attr("x1"), index: i })
            });
        var sampleLine = nextLines.nodes()[0]; // for cloning

        shifting = true; // suppress bin hit-testing until the shift finishes
        var trans = d3.transition().duration(instant ? 0 : changeTime);

        var preMoveRects = movingGroupSeln.selectAll("rect.movingclone"), preMoveFirstRect = d3.select(preMoveRects.nodes()[0]), preMoveLastRect = d3.select(preMoveRects.nodes()[preMoveRects.size()-1]), preMoveFirstX = +preMoveFirstRect.attr("x"), preMoveWidth = +preMoveFirstRect.attr("width"), preMoveLastX = +preMoveLastRect.attr("x")+Number(preMoveLastRect.attr("width"));
        var postMoveFirstX = +rectDefs[0].x, postMoveWidth = +rectDefs[0].width, postMoveLastX = postMoveFirstX + postMoveWidth*rectDefs.length;

        // @@ the following is utterly ridonculous
        var rects = movingGroupSeln.selectAll("rect.movingclone").data(rectDefs, def=>def.binNum);

        rects.exit()
            .attr("class", "defunctclone")
            .transition(trans)
            .on("start.defunctrect", function() {
                d3.select(this)
                    .style("stroke-opacity", 1e-6)
                    .style("fill-opacity", 0.15)
                    })
            .attr("x", def=>postMoveFirstX + def.binNum*postMoveWidth)
            .attr("y", yBase)
            .attr("height", 0)
            .style("opacity", 1e-6)
            .style("stroke-opacity", 1e-6)
            .remove();

        rects.enter().append(def=>{
                var node = sampleRect.cloneNode();
                d3.select(node).datum(def)
                return node
                })
            .attr("class", "movingclone")
            .style("opacity", 1e-6)
            .style("stroke-opacity", 1e-6)
            .attr("x", def=>preMoveFirstX + def.binNum*preMoveWidth)
            .attr("y", def=>def.y+def.height)
            .attr("width", def=>def.width)
            .attr("height", 0);

        movingGroupSeln.selectAll("rect.movingclone")
            .each(function(def) {
                var seln = d3.select(this);
                def.preY = +seln.attr("y");
                def.preHeight = +seln.attr("height");
                });

        movingGroupSeln.selectAll("rect.movingclone")
            .transition(trans)

            .on("start.rect", function(def) {
                d3.select(this)
                    .style("stroke-opacity", 1e-6)
                    .attr("y", def=>def.preY-1)
                    .attr("height", def=>def.preHeight+1)
                    })

            .attr("x", def=>def.x)
            .attr("width", def=>def.width)
            .attr("height", def=>def.height+2) // fudge for appearances' sake
            .attr("y", def=>def.y-2)
            .style("opacity", 1)
            .transition()
            .duration(instant ? 0 : 200)
            .attr("y", def=>def.y)
            .attr("height", def=>def.height)
            .style("stroke-opacity", 1);

        var texts = movingGroupSeln.selectAll("text.movingclone").data(textDefs, def=>def.index);

        texts.exit()
            .attr("class", "defunctclone")
            .transition(trans)
            .attr("x", def=>postMoveFirstX + def.index*postMoveWidth)
            .style("opacity", 1e-6)
            .remove();

        texts.enter().append(def=>{
                var node = sampleText.cloneNode(true);  // need true for text
                d3.select(node).datum(def)
                return node
                })
            .attr("class", "movingclone")
            .style("opacity", 1e-6)
            .attr("x", def=>preMoveFirstX + def.index*preMoveWidth)
            .text("-");

        movingGroupSeln.selectAll("text.movingclone")
            .transition(trans)
            .attr("x", def=>def.x)
            .style("opacity", 1)
            .on("end.text", function(def) {
                d3.select(this).text(def.text);
                });

        var lines = movingGroupSeln.selectAll("line.movingclone").data(lineDefs, def=>def.index);

        lines.exit()
            .attr("class", "defunctclone")
            .transition(trans)
            .attr("x1", def=>postMoveFirstX + def.index*postMoveWidth)
            .attr("x2", def=>postMoveFirstX + def.index*postMoveWidth)
            .style("opacity", 1e-6)
            .remove();

        lines.enter().append(def=>{
                var node = sampleLine.cloneNode();
                d3.select(node).datum(def);
                return node
                })
            .attr("class", "movingclone")
            .style("opacity", 1e-6)
            .attr("x1", def=>preMoveFirstX + def.index*preMoveWidth)
            .attr("x2", def=>preMoveFirstX + def.index*preMoveWidth);

        movingGroupSeln.selectAll("line.movingclone")
            .transition(trans)
            .attr("x1", def=>def.x)
            .attr("x2", def=>def.x)
            .style("opacity", 1);

        var baseLine = movingGroupSeln.selectAll("line.base").data([0]);
        baseLine.enter().append("line")
            .attr("class", "base")
            .attr("y1", yBase)
            .attr("y2", yBase)
            .style("stroke-width", 0.5)  // style copied from dropBallsIntoBins
            .style("stroke", "grey")
          .merge(baseLine)
            .attr("x1", preMoveFirstX)
            .attr("x2", preMoveLastX)
            .transition(trans)
            .attr("x1", postMoveFirstX)
            .attr("x2", postMoveLastX);

        trans
            .on("end", function() {
//console.log("end");
                if (abandoned) return;

                shifting = false;
                displayStep = scenario;
                updateTitleText(chart.scenarioRecords[scenario].value);
                updateScenarioTexts(scenario);
                checkForBinHighlight();
                if (autoStepping) stepAfterDelay(pauseTime);
                });

    }

    function stopTransition() {
        if (delayedStep) clearTimeout(delayedStep);
        delayedStep = null;

        if (movingGroupSeln) {
            movingGroupSeln.selectAll("*").interrupt();
            movingGroupSeln.selectAll(".defunctclone").remove();
        }
    }

    movingGroupSeln = d3.select(chart.duplicateObjects(chart.scenarioRecords[0].bins, "rect,text,line")); // NB: not the scenarioClasses, but these with "clone" added

    movingGroupSeln.selectAll("*")
        .attr("class", "movingclone");

    // prepare the moving group's elements.  by default (see dropBallsIntoBins) the bins' fill is lightgray at 0.25 opacity.
    movingGroupSeln.style("opacity", 1);
    movingGroupSeln.selectAll("text,line")
        .style("opacity", 1);
    movingGroupSeln.selectAll("rect")
        .style("fill", "lightgray")
        .style("fill-opacity", 0.5)
        .style("stroke-opacity", 1);

    // hide and de-sensitise the main-scenario elements
    this.demoGroup.selectAll(scenarioClasses)
        .style("opacity", 0)
        .style("cursor", "default")
        .on("mouseover", null)
        .on("mouseout", null);

    // add a mousetrap for highlighting the (changing) bin membership
    var widthExcess = 100;
    var binProbeX = null;
    this.demoGroup.append("rect")
        .attr("class", "demobinMousetrap")
        .attr("x", -widthExcess)
        .attr("y", stackBase)
        .attr("width", this.numberLineWidth+2*widthExcess)
        .attr("height", dropDistance)
        .style("fill", "none")
        .style("pointer-events", "all")
        .style("cursor", "crosshair")
        .on("mousemove", function() {
            binProbeX = d3.mouse(this.parentNode)[0];
            // highlighting waits until bins have settled
            if (!shifting) checkForBinHighlight();
            })
        .on("mouseleave", function() {
            binProbeX = null;
            // clearing is immediate (even while bins are shifting)
            chart.highlightPathIndices([]);
            chart.highlightValueIndices([]);
            });

    function checkForBinHighlight() {
        if (binProbeX!==null) {
            var indexRange = [];
            var binHit = movingGroupSeln.selectAll("rect").select(function() {
                var x = Number(this.getAttribute("x")), w = Number(this.getAttribute("width"));
                return binProbeX>=x && binProbeX<=x+w ? this : null;
                });
            if (binHit.size()) indexRange = binHit.datum().indices;

            chart.highlightPathIndices(indexRange);
            chart.highlightValueIndices(indexRange, true); // gather repeats
        }
    }

    displayStep = 0;
    cycleDirection = 1;

    updateTitleText(chart.scenarioRecords[displayStep].value);
    updateScenarioTexts(displayStep);

    chart.setTimerInfo({
        cleanup: ()=> {
            abandoned = true;
            stopTransition();
            chart.demoGroup.selectAll("tspan").interrupt();
            chart.demoGroup.selectAll("g.scenariocontrol,rect.demoBinMousetrap,g.groupclone").remove();
            chart.scenarioRecords = [];
            movingGroupSeln.remove();

            // unhide main elements (but no need to restore event handlers)
            chart.demoGroup.selectAll(scenarioClasses).style("opacity", 1);
            }
        });

    stepAfterDelay(pauseTime);

// }

};

chartObject.drawDataSelector=function drawDataSelector(options) {
    var instant = !!(options && options.instant);

    var datasets = this.datasetsForSwitching;
    if (datasets.indexOf(this.dataName)===-1) {
        this.loadData(datasets[0]); // ...which needs to be synchronous (as it is, for "mpg")
    }

    this.datasetsAvailable = Math.min(this.datasetsAvailable, datasets.length);

    var chart=this, chartGroup = this.chartGroup, transformString = this.transformString;

    var buttonWidth = 50, buttonSep = 30, buttonHeight = 35, imageWidth = 35, imageHeight = 35, buttonMidY = this.buttonRowOrigin.y + buttonHeight/2;
    var fontSize = 16, dataLabelColour = this.dataLabelColour;

    var labelX = this.buttonRowOrigin.x;
    var firstButtonX = labelX + buttonWidth/2; // centre of button

    // short descriptions are stored under mixed-case keys, to be used as their human-readable names
    function readable(dn) { return Object.keys(chart.datasetShortDescriptions).find(k=>k.toLowerCase()===dn) };

    var dataName = this.dataName, readableName = readable(dataName);
    var descTexts = chartGroup.selectAll("text.datadesc").data([
        { x: labelX-5, anchor: "end", colour: "black", text: "dataset:" },
        { x: labelX, anchor: "start", colour: this.dataLabelColour, text: readableName+"—"+(this.datasetShortDescriptions[readableName].replace(/\<br\/\>/m," ")) }
        ]);
    descTexts.enter().append("text")
        .attr("class", "datadesc")
        .attr("y", buttonMidY+buttonHeight/2+10)
		.attr("dy", chart.textOffsets.hanging)
        .style("font-size", fontSize+"px")
        .style("pointer-events", "none")
        .style('-webkit-user-select','none')
      .merge(descTexts)
        .attr("x", def=>def.x)
		.style("text-anchor", def=>def.anchor)
		.style("fill", def=>def.colour)
        .text(def=>def.text);

    var switchDefs = datasets.slice(0, this.datasetsAvailable).map(dn=>({ dataName: dn, readableName: readable(dn) }));

    var switchEntries = chartGroup.selectAll("g.dataswitch").data(switchDefs, def=>def.dataName);
    switchEntries.exit().remove();
    switchEntries.enter().append("g")
        .attr("class", "dataswitch")
        .attr("transform", (def, i)=>transformString(firstButtonX+i*(buttonWidth+buttonSep), buttonMidY))
        .style("opacity", 1e-6)
        .each(function(def, i) {
            var seln = d3.select(this);
            seln
                .append("rect")
                .attr("x", -buttonWidth/2)
                .attr("y", -buttonHeight/2)
                .attr("width", buttonWidth)
                .attr("height", buttonHeight)
                .style("fill", "#e6830f")
                .style("fill-opacity", 0.2)
                .style("stroke", dataLabelColour)
                .style("stroke-width", 2)
                .style("stroke-opacity", 0)
                .on("click", def=>{
                    if (chart.datasetsAvailable > 1) {
                        hideTip();
                        chart.switchDataset(def.dataName);
                    }
                    })
                .on("mouseover", function(def) {
                    showTip(this, '<b>'+def.readableName + '</b><br/>' + chart.datasetShortDescriptions[def.readableName])
                    })
                .on("mouseout", hideTip);

            seln
                .append("image")
                .attr("width", imageWidth)
                .attr("height", imageHeight)
                .attr("xlink:href", def=>"data:image/svg+xml;base64,"+window.btoa(chart.svgSource(def.dataName)))
                .attr("x", -imageWidth/2)
                .attr("y", -imageHeight/2 + 5)  // fudge
                .style("pointer-events", "none");

            });

    // tooltip code adapted from  http://bl.ocks.org/d3noob/a22c42db65eb00d4e369
    function showTip(elem, text) {
        var box = elem.getBoundingClientRect();
        var tip = d3.select("div.vistooltip"), padding = 8; // NB: tied to scrolly.css
        tip.html(text);
        var tipWidth = Number.parseInt(tip.style("width"))+padding*2, tipHeight = Number.parseInt(tip.style("height"))+padding*2;
        // NB: tooltip position style is "fixed", in case user scrolls
        tip
            .style("left", box.left + box.width/2 - tipWidth/2 + "px")
            .style("top", box.top - tipHeight - 1 + "px");
        tip.transition()
            .duration(200)
            .style("opacity", 1);
    }
    function hideTip() {
        d3.select("div.vistooltip")
            .transition()
            .duration(500)
            .style("opacity", 0);
    };

    function decorateSwitches() {
        var switchingAllowed = chart.datasetsAvailable > 1;
        chartGroup.selectAll("g.dataswitch rect")
            .style("cursor", switchingAllowed ? "pointer" : "default")
            .style("stroke-opacity", def=>switchingAllowed && def.dataName===chart.dataName ? 1 : 0);
    }
    decorateSwitches();

    // now that the switches are decorated, apply the opacity - maybe as a transition
    chartGroup.selectAll("g.dataswitch")
        .transition()
        .duration(instant ? 0 : 1000)
        .style("opacity", 1);

    // NB: method switchDataset, which is triggered from some links in the text, accesses privateSwitchDataset - first calling drawDataSelector to initialise the switches if necessary
    chart.privateSwitchDataset = function(dataName) {
        this.loadData(dataName, ()=>{
            decorateSwitches();
            this.replaySteps();
            });
    }

};

chartObject.drawDataUnits=function drawDataUnits() {

    var chart=this, chartGroup = this.chartGroup;

    var fontSize = 14;
    var plotOrigin = this.plotOrigin;
    var labelX = plotOrigin.x+this.valueListOrigin.x+10; // same as numbers in value list
    var unitLabelMiddle = plotOrigin.y - this.fallAfterFlight + 9;  // same as middle of coloured number line

    var unitLabels = chartGroup.selectAll("text.dataunits").data([
        { x: labelX-5, anchor: "end", colour: "black", text: "unit:" },
        { x: labelX, anchor: "start", colour: this.dataLabelColour, text: this.dataUnits }
        ]);
    unitLabels.enter().append("text")
        .attr("class", "dataunits")
        .attr("y", unitLabelMiddle)
		.attr("dy", chart.textOffsets.middle)
        .style("font-size", fontSize+"px")
        .style("pointer-events", "none")
        .style('-webkit-user-select','none')
      .merge(unitLabels)
        .attr("x", def=>def.x)
		.style("text-anchor", def=>def.anchor)
		.style("fill", def=>def.colour)
        .text(def=>def.text);
};

chartObject.drawDensityControl=function drawDensityControl(offset, handler) {
    // goes into histGroup
    var chart=this;

    var histGroupOrigin = this.histOrigin;

    var switchSize = 12, switchColour = "#444";  // dark grey

    this.histGroup
        .append("rect")
        .attr("class", "switch")
        .attr("id", "densitySwitch")
        .attr("x", offset.x)
        .attr("y", offset.y)
        .attr("width", switchSize)
        .attr("height", switchSize)
        .style("border-width", 1)
        .style("stroke", switchColour)
        .style("fill", switchColour)
        .style("cursor", "pointer")
        .each(function() { showState(this) })
        .on("click", function(d) {
            chart.useDensity = !chart.useDensity;
            showState(this);
            handler();
        });

    function showState(node) {
        d3.select(node).style("fill-opacity", chart.useDensity ? 1 : 0)
    }

	this.histGroup
	    .append("text")
		.attr("class", "switchLabel")
		.attr("x", offset.x+switchSize+8)
		.attr("y", offset.y+switchSize/2)
		.attr("dy", this.textOffsets.middle)
		.style("font-size", "14px")
		//.style("dominant-baseline", "middle")
        .style("-webkit-user-select","none")
        .style("fill", switchColour)
        .text("plot as densities")
};

chartObject.drawFaderControl=function drawFaderControl(offset, handler) {
    // goes into histGroup
    // this replaces the triangle control, which allowed apportioning of percentages for the primary and context scenarios up to a combined total of 100.  removing the second degree of freedom, we now enforce 100 as the total.
    var chart = this;
    var initX = this.triangleSetting.x, initY = this.triangleSetting.y;
    var baseLength = 40;
    var radius = 10;
    var offsetX = offset.x, offsetY = offset.y-radius; // of bottom-left corner rel to bottom-left of histogram area

    var faderGroup = this.histGroup.append("g").attr("class", "fader");

    faderGroup
        .append('path')
        .attr('d', "M0 "+(radius)+" A"+radius+" "+radius+" 0, 0, 1, 0 "+(-radius)+" L"+baseLength+" "+(-radius)+" A"+radius+" "+radius+" 0, 0, 1, "+baseLength+" "+radius+" Z")
		.attr('stroke','gray')
		.attr('stroke-width',1)
		.attr('fill', 'none')
		.attr('transform', "translate("+offsetX+","+offsetY+")");

    function drawKnob(xPercent) {
        var centreX = offsetX+(baseLength*xPercent/100);
        var knobSeln = faderGroup.selectAll("circle.faderKnob").data([0]);
        knobSeln.enter().append("circle")
            .attr("class", "faderKnob")
            .attr("cy", offsetY)
            .attr('r', radius)
    		.style('opacity', 0)
    		.style("pointer-events", "all")
    		.style("cursor", "ew-resize")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
          .merge(knobSeln)
            .attr("cx", centreX);

        // NB: an svg arc can't have coincident start and end points (because there would be an infinite number of full circles matching the parameters).  so here we always keep the end angles a tiny fraction below 2pi.  see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
        var indicatorSeln = faderGroup.selectAll("path.fadeIndicator").data([
            { colour: "green", start: 0, end: xPercent*Math.PI*1.999/100, large: xPercent<50 ? 0 : 1 },
            { colour: "blue", start: xPercent*Math.PI*2/100, end: Math.PI*1.999, large: xPercent<50 ? 1 : 0 }
            ]);
        indicatorSeln.enter().append("path")
            .attr("class", "fadeIndicator")
          .merge(indicatorSeln)
            .attr('transform', "translate("+centreX+","+offsetY+")")
            .attr("d", def=>"M0 0 L"+(radius*Math.sin(def.start))+" "+(-radius*(Math.cos(def.start)))+" A"+radius+" "+radius+" 0, "+def.large+", 1, "+(radius*Math.sin(def.end))+" "+(-radius*(Math.cos(def.end)))+" Z")
    		.style('stroke-width',0)
    		.style('fill', def=>def.colour)
    		.style('opacity', 0.6)
    		.style("pointer-events", "none")
    }

    drawKnob(initX);

    function dragstarted(d) {
        d3.select(this).raise().classed("active", true);  // won't do nuthin', though
    }

    function dragged(d) {
        var x = d3.event.x-offsetX; // requested; may be outside the control
        if (x < 0) x = 0;
        else if (x > baseLength) x = baseLength;

        var xPercent = Math.round(x/baseLength*100), yPercent = 100-xPercent;
        drawKnob(xPercent);
        handler(xPercent, yPercent);
    }

    function dragended(d) {
        d3.select(this).classed("active", false);
    }

    handler(initX, initY);
};

chartObject.drawHandPointer=function drawHandPointer(location, thenDo) {
    // NB: on any replay (in particular, when jumping back in the command sequence), the hand will be erased as part of the reset.  this is why the hand will make a smooth transition into its new position when moving down the essay, but not back up.
    function transformString(x, y, angle) { return "translate("+x+", "+y+") rotate("+angle+")" }
    var desiredTransform = transformString(location.x, location.y, 45);

    var imgGroup = this.chartGroup.select("g.handpointer");
    if (imgGroup.empty()) {
        imgGroup = this.chartGroup.append("g").attr("class", "handpointer");
        imgGroup.append("image")
            .attr("xlink:href", this.pointerImageFlipped)
            .attr("x", -26)
            .attr("y", -2)
            .attr("width", 37)
            .attr("height", 39)
            .style("pointer-events", "none");
        imgGroup.attr("transform", desiredTransform);
        allDone();
    } else {
        var oldTransform = imgGroup.attr("transform");
        if (oldTransform===desiredTransform) allDone();
        else {
            imgGroup
                .transition()
                .duration(400)
                .attrTween("transform", ()=>d3.interpolateTransformSvg(oldTransform, desiredTransform))
                .on("end", allDone);
        }
    }

    function allDone() { if (thenDo) thenDo() }
};

chartObject.drawNumberLine=function drawNumberLine() {
    // the non-coloured one
    var excess = 50;
    this.dataGroup.selectAll(".numberline").remove();
    this.dataGroup.append("line")
        .attr("class", "numberline")
        .attr("x1", -excess)
        .attr("x2", this.numberLineWidth+excess)
        .attr("y1", 0)
        .attr("y2", 0)
        .style("stroke", "grey")
        .style("stroke-width", 0.5);
};

chartObject.drawRanges=function drawRanges(rangeSets) {
    // rangeSets is an object with elements { primary, context } - each being a (possibly empty) bin set.
    // the range markers are text items that go into rangeGroup
    var chart=this;

    // bins should be objects { min, max, minOpen, maxOpen }
    var xScale = this.xScale, group = this.rangeGroup;

    var openMin = { char: "(", offset: -2 }, openMax = { char: ")", offset: -6.5 }, closedMin = { char: "[", offset: -3.5 }, closedMax = { char: "]", offset: -4.5 };

    ["primary", "context"].forEach(category=>{
        var ranges = rangeSets[category], ends = [];
        for (var ri=0; ri<ranges.length; ri++) {
            var range = ranges[ri];
            ends.push(lively.lang.obj.merge({ value: range.min, index: ri }, range.minOpen ? openMin : closedMin) );
            ends.push(lively.lang.obj.merge({ value: range.max, index: ri }, range.maxOpen ? openMax : closedMax) );
        }

        var colour = category==="primary" ? "blue" : "grey", endClass = "end"+category, opacity = category==="primary" && rangeSets.context.length ? 0.2 : 1;

    	var ends = group.selectAll("text."+endClass).data(ends, (d,i)=>i);
    	ends.exit().remove();
    	ends.enter().append("text")
    	    .attr("class", endClass)
      		.style("font-family", "Raleway") //"sans-serif")
      		.style("font-weight", "300")
       		.style("font-size", "32px")
      		.style("pointer-events", "none")
            .style("-webkit-user-select","none")
        .merge(ends)
      		.attr("x", d=>xScale(d.value)+d.offset)
      		.attr("y", 30)
       		.style("fill", colour)
       		.style("opacity", opacity)
       		.text(d=>d.char);

	// for calibrating character offsets
if (false) {
	var calib = group.selectAll("line")
			.data(ends);
	calib.enter().append("line")
  		.style("stroke-width", 0.5)
  		.style("stroke", "black")
  	.merge(calib)
			.attr("x1", function(d) { return xScale(d.value) })
			.attr("x2", function(d) { return xScale(d.value) })
			.attr("y1", -50)
			.attr("y2", 150);
	calib.exit().remove();
}

    })
};

chartObject.drawRDefaultBinning=function drawRDefaultBinning(options) {
    // options (if there) are { instant, synchronised, shiftProportion, widthProportion, showLines }
    var chart = this;

    var shiftProportion = options && options.shiftProportion, widthProportion = options && options.widthProportion;

    function Sturges(data) { return Math.ceil(Math.log(data.length)/Math.log(2))+1 }

    var dataValues = this.data.values, dataMin = this.dataMin, dataMax = this.dataMax, dataBinQuantum = this.dataBinQuantum;
    var nBins = Sturges(this.data), breaks = this.rPretty([dataMin, dataMax], nBins);

    if (shiftProportion!==undefined) {
        // when shift is specified, it's used to set the bins' positions relative to dataMin
        var width = breaks[1]-breaks[0], firstShiftedBreak = dataMin + lively.lang.num.roundTo(width*shiftProportion, dataBinQuantum), shift = firstShiftedBreak-breaks[0];
        var newBreaks = [], breakPoint = firstShiftedBreak;
        while (breakPoint < dataMax) {
            newBreaks.push(breakPoint);
            breakPoint = lively.lang.num.roundTo(breakPoint + width, dataBinQuantum);
        }
        newBreaks.push(breakPoint);  // right-hand end of last bin
        breaks = newBreaks;
    }

    if (widthProportion!==undefined) {
        // when width is specified, it's used to reduce the bins' widths (without changing the first break position)
        var baseWidth = breaks[1]-breaks[0], adjustedWidth = lively.lang.num.roundTo(baseWidth*widthProportion, dataBinQuantum);
        var newBreaks = [], breakPoint = breaks[0];
        while (breakPoint < dataMax) {
            newBreaks.push(breakPoint);
            breakPoint = lively.lang.num.roundTo(breakPoint + adjustedWidth, dataBinQuantum);
        }
        newBreaks.push(breakPoint);  // right-hand end of last bin
        breaks = newBreaks;
    }

//console.log(dataMin, dataMax, breaks);
    function filterValues(binNum) {
        var filterFn = binNum === 0
            ? (v=>v>=breaks[0] && v<=breaks[1])
            : (v=>v>breaks[binNum] && v<=breaks[binNum+1]);
        return dataValues.filter(filterFn);
    }

    var valueSetDefs = [];
    for (var bi=0; bi<breaks.length-1; bi++) {
        valueSetDefs.push({ valueSet: filterValues(bi), left: breaks[bi], right: breaks[bi+1] });
    }

    this.dropBallsIntoBins(valueSetDefs, options);
};

chartObject.drawSweepControl=function drawSweepControl(offset, handler) {
    // goes into histGroup
    var chart=this;

    var histGroupOrigin = this.histOrigin;

    var switchSize = 12, switchColour = "#444";  // dark grey

    var sweepActive = false;

    this.histGroup
        .append("rect")
        .attr("class", "switch")
        .attr("id", "sweepSwitch")
        .attr("x", offset.x)
        .attr("y", offset.y)
        .attr("width", switchSize)
        .attr("height", switchSize)
        .style("border-width", 1)
        .style("stroke", switchColour)
        .style("fill", switchColour)
        .style("cursor", "pointer")
        .each(function() { showState(this) })
        .on("click", function(d) {
            sweepActive = !sweepActive;
            showState(this);
            handler(sweepActive);
        });

    function showState(node) {
        d3.select(node).style("fill-opacity", sweepActive ? 1 : 0)
    }

	this.histGroup
	    .append("text")
		.attr("class", "switchLabel")
		.attr("x", offset.x+switchSize+8)
		.attr("y", offset.y+switchSize/2)
		.attr("dy", this.textOffsets.middle)
		.style("font-size", "14px")
		//.style("dominant-baseline", "middle")
		.style("pointer-events", "none")
        .style("-webkit-user-select","none")
        .style("fill", switchColour)
        .text("sweep bin offsets")
};

chartObject.drawValueList=function drawValueList(options) {
    // this.drawValueList({ stage: 0 });
    // draw list onto the fixed canvas, with a mousetrap that creates a callout of separated items.
    // valueListHeight is the distance between the mid-levels of the first and last items.

    var chart=this, values = [];
    chart.data.forEach(v=>values.push(v));
    var numEntries = values.length;

    var stage = options && options.stage; // iff undefined, start timed flight

    // list and pool locations are (now) relative to plotOrigin, not canvas absolute
    var plotOrigin = this.plotOrigin;
    var listHeight = this.valueListHeight, valueListX = plotOrigin.x+this.valueListOrigin.x, valueListTop = plotOrigin.y+this.valueListOrigin.y, listEntryHeight = this.valueListEntryHeight, focusEntryHeight = listEntryHeight;
    var listWidth = this.valueListWidth, fontSize=this.valueListFontSize;
    var focusAreaTop = valueListTop, focusAreaLeft = valueListX+listWidth;
    var listScale = d3.scaleLinear().domain([0, numEntries-1]).range([valueListTop, valueListTop+listHeight]);
    var colourScale = this.colourScale;
    var maxOpacity = 0.8, minOpacity = 0.2, itemsFittingList = Math.floor(listHeight/listEntryHeight), baseOpacity = Math.max(minOpacity, maxOpacity - (maxOpacity-minOpacity)*numEntries/itemsFittingList/4);

    var chartGroup = this.chartGroup;
    chartGroup.selectAll(".focusGroup").remove();
    chartGroup.selectAll(".listMousetrap").remove();

    var valueEntries = this.poolValueEntries;

    if (!valueEntries) {
        valueEntries = [];
        var poolCentreX = valueListX-plotOrigin.x-380,
            poolCentreY = valueListTop-plotOrigin.y+listHeight/2+60, // minor fudge
            poolRadius = Math.sqrt(numEntries*100);

        var pi = Math.PI;
        chart.data.forEach((v, i)=>{
            // to avoid clumping at the centre, use squared random distance and an offset
            var distanceRand = Math.random(),
                fromCentre = (1.1-distanceRand*distanceRand),
                offsetAngle = 2*pi*Math.random(),
                textAngle = pi*(Math.random()-0.5),
                x = poolCentreX+fromCentre*poolRadius*Math.sin(offsetAngle),
                y = poolCentreY+fromCentre*poolRadius*Math.cos(offsetAngle),
                diffX = valueListX-plotOrigin.x+listWidth/2-x,
                diffY = listScale(i)-plotOrigin.y+fontSize/2-1-y;
            valueEntries.push({
                value: v,
                text: v.toFixed(chart.dataDecimals),
                x: x, y: y,
                diffX: diffX, diffY: diffY,
                angle: textAngle
                });
            });
        this.poolValueEntries = valueEntries;
    }

    var moveTime = 1000, timeSpread = 2000;

    var fixedCanvas = this.chartFixedCanvas.node(), fixedContext = fixedCanvas.getContext("2d");

    var transformString = this.transformString;

    var totalTime = moveTime+timeSpread;
    if (stage !== undefined) {
        flyAll(stage*totalTime);
        if (stage===1) createListMousetrap();
    } else {
        this.startTimer({
            tick: elapsed=>{
                flyAll(elapsed);
                if (elapsed > moveTime+timeSpread) {
                    chart.stopTimer(false);
                    createListMousetrap();
//console.log("finished");
                }
                },
            forceToEnd: ()=>{
                flyAll(totalTime);
                createListMousetrap();
                }
            });
    }

    function flyAll(elapsed) {
        chart.clearFixedCanvas();
        fixedContext.textAlign = "start";
        valueEntries.forEach((valueObj, i)=>{
            var delay = i/numEntries * timeSpread, flightStage = (elapsed - delay)/moveTime;
            if (flightStage < 0) flightStage = 0;
            else if (flightStage > 1) flightStage = 1;

            var x = plotOrigin.x+valueObj.x+flightStage*valueObj.diffX, y = plotOrigin.y+valueObj.y+flightStage*valueObj.diffY, angle = valueObj.angle*(1-flightStage);
            fixedContext.fillStyle = colourScale(valueObj.value, flightStage > 0 ? 1-flightStage*(1-baseOpacity) : 0.7);

            fixedContext.save();
            fixedContext.font = fontSize+"px Arial";  // seems to be necessary
            fixedContext.textAlign = "center";
            fixedContext.translate(x, y);
            fixedContext.rotate(angle);
            fixedContext.fillText(valueObj.text, 0, 0);
            fixedContext.restore();
            });
    }

    function createListMousetrap() {
        var focusGroup = chartGroup.append("g")
            .attr("class", "focusGroup")
            .attr("transform", transformString(focusAreaLeft, focusAreaTop));

        chartGroup.append("rect")
            .attr("class", "listMousetrap")
            .attr("x", valueListX)
            .attr("y", valueListTop-listEntryHeight/2) // detector covers all of top and bottom values
            .attr("width", listWidth)
            .attr("height", listHeight+listEntryHeight)
    //.style("stroke-width", 1)
    //.style("stroke", "black")
            .style("fill", "none")
            .style("pointer-events", "all")
            .style("cursor", "crosshair")

            .on("mousemove", function() {
                // focus list is also measured from middle of first item to middle of last
                var positionFromTop = d3.mouse(this.parentNode)[1]-valueListTop;
                var numToShow = 10;
                var firstInFocus = Math.max(0, Math.min(numEntries-numToShow, Math.round(listScale.invert(positionFromTop+valueListTop))-Math.floor(numToShow/2))), lastInFocus = Math.min(numEntries-1, firstInFocus+numToShow-1);
                var indexRange = lively.lang.arr.range(firstInFocus, lastInFocus);

                if (chart.highlightPathIndices) chart.highlightPathIndices(indexRange);
                chart.highlightValueIndices(indexRange);
                })
            .on("mouseleave", function() {
                if (chart.highlightPathIndices) chart.highlightPathIndices([]);
                chart.highlightValueIndices([]);
                });

        function highlightValueIndices(indexRange, gatherRepeats) {
            var focusLineYs = [], items = [];
            if (indexRange.length) {
                var firstInFocus = indexRange[0], lastInFocus = indexRange[indexRange.length-1];
                if (gatherRepeats) {
                    var lastValue = values[indexRange[0]], valCount = 0;
                    function addItem(value, count) {
                        var str = value.toFixed(chart.dataDecimals);
                        items.push({ value: value, text: str, multiplier: count===1 ? null : " x "+count })
                        }
                    indexRange.forEach(vi=>{
                        var val = values[vi];
                        if (val===lastValue) valCount++;
                        else {
                            addItem(lastValue, valCount);
                            valCount = 1;
                            lastValue = val;
                        }
                        });
                    addItem(lastValue, valCount);
                } else {
                    items = indexRange.map(vi=>({ value: values[vi], text: values[vi].toFixed(chart.dataDecimals) }));
                }
                var numItems = items.length;
                var focusListHeight = (numItems-1)*focusEntryHeight,
                    focusListTop = Math.max(0, Math.min(listHeight-focusListHeight, (listScale(firstInFocus)+listScale(lastInFocus))/2-focusAreaTop-focusListHeight/2));
                focusLineYs = [listScale(firstInFocus)-focusAreaTop, listScale(lastInFocus)-focusAreaTop];
            }
            var focusTexts = focusGroup.selectAll("text.focusItem").data(items);
            focusTexts.exit().remove();
            focusTexts.enter().append("text")
                .attr("class", "focusItem")
                .attr("x", 4)
                .attr("y", (d, i)=>focusListTop+focusEntryHeight*i)
        		.attr("dy", chart.textOffsets.central)
                //.style("dominant-baseline", "central") // numbers are tall, so not "middle"
                .style("font-size", fontSize+"px")
                .style("-webkit-user-select","none")
              .merge(focusTexts)
                .attr("y", (d, i)=>focusListTop+focusEntryHeight*i)
                .each(function(d) {
                    var seln = d3.select(this);
                    if (d.multiplier) {
                        seln.text(""); // use only tspans
                        seln.attr("dy", chart.textOffsets.central)
                        var spans = seln.selectAll("tspan").data([d.text, d.multiplier]);
                        spans.exit().remove();  // shouldn't happen
                        spans.enter().append("tspan")
                            //.style("dominant-baseline", "central")
                            .style("font-size", (str, i)=>(i===0 ? fontSize : fontSize-1)+"px")
                            .style("fill", (str, i)=>i===0 ? colourScale(d.value, 1) : "grey")
                          .merge(spans)
                            .text(String)
                    } else {
                        seln.selectAll("tspan").remove();
                        seln
                            .style("fill", d=>colourScale(d.value, 1))
                            .text(d=>d.text);
                    }
                });

            var focusLines = focusGroup.selectAll("line.focusItem").data(focusLineYs);
            focusLines.exit().remove();
            focusLines.enter().append("line")
                .attr("class", "focusItem")
                .attr("x1", -listWidth).attr("x2", 0)
              .merge(focusLines)
                .attr("y1", d=>d).attr("y2", d=>d)
                .style("stroke-width", 1)
                .style("stroke", "black");
        }
        chart.highlightValueIndices = highlightValueIndices;
    }
};

chartObject.dropBallsIntoBins=function dropBallsIntoBins(valueSetDefs, options) {
    var chart = this;
    var instant = !!(options && options.instant),
        synchronised = !!(options && options.synchronised),
        showLines = !!(options && options.showLines) || !instant,
        showScale = !(options && options.noScale);

    function clearDemoBins() {
        chart.chartGroup.selectAll("rect.demobin,line.binbreak,text.binbreak,text.democounter,circle.movingBall,g.annotation,rect.demobinMousetrap,text.dataunits").interrupt().remove();
    }
    chart.clearDemoBins = clearDemoBins;

    var demoGroup = chart.demoGroup;
    var annotationGroup = demoGroup.select("g.annotation");
    if (annotationGroup.empty()) annotationGroup = demoGroup.append("g").attr("class", "annotation").attr("transform", "translate(0,0)");

    // the first time this is called (for a given dataset), all the balls are "settled".  but when we run through an iteration of bin offsets or widths for the "fiddle" stages, we need to reuse the balls that are now "dropped".
    var balls = chart.dataGroup.selectAll("circle.settled,circle.dropped");

    var xScale = this.xScale, plotOrigin = this.plotOrigin, stackBase = 0, dropDistance = this.fallIntoBins, binBase = stackBase+dropDistance, maxBinHeight = dropDistance-20;
    var colourScale = this.colourScale;

    // shuffle from stackoverflow (!): http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    function shuffle(array) {
      var currentIndex = array.length, temporaryValue, randomIndex;

      // While there remain elements to shuffle...
      while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
      }
      // return array;  ael - no need
    }

    var breakDefs = [];
    valueSetDefs.forEach((valueSetDef, i)=>{
        breakDefs.push({ value: valueSetDef.left, index: i });
        if (i===valueSetDefs.length-1) breakDefs.push({ value: valueSetDef.right, index: i+1 });
        });

    // the data element for a break includes value, index
    var lines = demoGroup.selectAll("line.binbreak").data(breakDefs);
    lines.exit().remove();
    lines.enter().append("line")
        .attr("class", "binbreak")
        .attr("stroke-dasharray", "2 6")
        .attr("y1", stackBase)
        .attr("y2", binBase)
        .style("stroke-width", 1)
        .style("stroke", "grey")
      .merge(lines)
        .attr("x1", def=>xScale(def.value))
        .attr("x2", def=>xScale(def.value))
        .style("opacity", showLines ? 1 : 0);

    var delayBetweenBins = 200, delayBetweenPiles = 50, delayBetweenDots = 50, dropTime = 750;

    // the data element for a bin includes binNum, left, right, valueSet etc
    var binDefs = [], maxBinCount = 0;
    valueSetDefs.forEach((valueSetDef, i)=>{
        var valueSet = valueSetDef.valueSet;
        var binCount=0;
        valueSet.forEach(value=>binCount+=chart.data.counts[String(value)]);
        if (binCount > maxBinCount) maxBinCount = binCount;

        var binBalls = balls.filter(d=>valueSet.indexOf(d.value)>=0);
        binDefs.push({ binNum: i, valueSet: valueSet, balls: binBalls, dropDelay: binDropDelay, indices: [], totalCount: binBalls.size(), left: valueSetDef.left, right: valueSetDef.right, colour: colourScale((valueSetDef.left+valueSetDef.right)/2) });
        });

    // we use a shuffled set of bin indices to decide the order of bin filling
    var binIndices = lively.lang.arr.range(0, binDefs.length-1);
    shuffle(binIndices);

    // draw a zero count as a vanishingly tall bin (i.e., a line)
    function heightScale(count) { return count===0 ? 0.01 : maxBinHeight*count/maxBinCount }

    // settings for the count scale, which we build incrementally as needed
	var scaleValues = this.rPretty([0, maxBinCount], 5, true), lastValue = scaleValues[scaleValues.length-1];
    var countPlottedSoFar = 0;

    var bins = demoGroup.selectAll("rect.demobin").data(binDefs, def=>def.binNum);
    bins.exit().remove();
    var binsE = bins.enter().append("rect")
        .attr("class", "demobin")
        .style("cursor", "crosshair")
        .on("mouseover", function(def) {
            if (chart.highlightPathIndices) chart.highlightPathIndices(def.indices);
            if (chart.highlightValueIndices) chart.highlightValueIndices(def.indices, true);
            })
        .on("mouseleave", function() {
            if (chart.highlightPathIndices) chart.highlightPathIndices([]);
            if (chart.highlightValueIndices) chart.highlightValueIndices([]);
            });
    bins = bins.merge(binsE);
    bins
        .attr("x", def=>xScale(def.left))
        .attr("width", def=>xScale(def.right) - xScale(def.left))
        .style("fill", def=>def.colour)
        .style("fill-opacity", 1)
        .style("stroke-width", 0.5)
        .style("stroke", "grey")
        .style("stroke-opacity", 1e-6);

    if (instant) {
        balls.call(showBallAsOutline);
        finishBins();
        return;
    }

    var counters = demoGroup.selectAll("text.democounter").data(binDefs, def=>def.binNum);
    counters.exit().remove();
    var countersE = counters.enter().append("text")
        .attr("class", "democounter")
        .attr("y", binBase+8)
		.attr("dy", this.textOffsets.hanging)
        .style("fill", "grey")
        .style("font-size", "11px")
        //.style("dominant-baseline", "hanging")
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .style("-webkit-user-select","none");

    counters = counters.merge(countersE);
    counters
        .attr("x", def=>xScale((def.left+def.right)/2));

    chart.setTimerInfo({
        cleanup: ()=>{
            interrupted=true;
            chart.dataGroup.selectAll("circle.movingBall").interrupt().remove();
            demoGroup.selectAll("text.democounter").interrupt().remove();
            },
        forceToEnd: ()=>{
            balls.call(showBallAsOutline);
            finishBins();
            }
        });

    var binDropDelay = 0, binsToFill = binDefs.length;
    var interrupted = false;
    binIndices.forEach(function(bi) {
        var def = binDefs[bi];
        var eezer = t=>d3.easePolyIn(t,2);
        d3.transition().delay(synchronised ? 0 : binDropDelay).on("start", ()=>{

            if (interrupted) return;  // while we were waiting to start, events overtook us

            var values = def.valueSet.slice();
            shuffle(values);
            values.forEach(function(value, vi) {
                def.balls.filter(d=>d.value===value).each(function(d, i) {
                    if (!this.parentNode) return;  // somewhat-hack in case ball has been removed

                    var clone = this.cloneNode();
                    var seln = d3.select(this);
                    showBallAsOutline(seln);

                    this.parentNode.appendChild(clone);
                    var cloneSeln = d3.select(clone), yStart = +cloneSeln.attr("cy");
                    cloneSeln.datum(d)
                        .attr("class", "movingBall")
                        //.style("fill", newBinColour)
                        .style("stroke", "none")
                        .transition()
                        .delay(vi*delayBetweenPiles+i*delayBetweenDots)
                        .ease(eezer).duration(dropTime)
                        .attr("cy", yStart+dropDistance-5)
                        .remove()
                        //.on("interrupt", function() { d3.select(this).remove() })
                        .on("end", d=>addToBin(bi, d.valueIndex));
                    });
                });
            });
            binDropDelay += def.valueSet.length*delayBetweenPiles + delayBetweenBins;
        });

    function showBallAsOutline(seln) {
        // use fill of "none", rather than fillOpacity, so we can always highlight by setting fill colour
        seln
            .attr("class", "dropped")
            .style("fill", "none")
            .style("stroke-width", 0.5)
            .style("stroke", d=>colourScale(d.value, 1))
            .style("stroke-opacity", 1);
    }

    function finishBins() {
        bins.each(function(def) {
            var seln = d3.select(this);
            if (interrupted) seln.interrupt();

            var indices = [];
            def.balls.each(d=>indices.push(d.valueIndex));
            indices.sort(d3.ascending);
            def.indices = indices;

            seln
                .attr("y", binBase-heightScale(indices.length))
                .attr("height", heightScale(indices.length))
                .style("fill", "lightgray")
                .style("fill-opacity", 0.5)
                .style("stroke-opacity", 1);
            });
        allDone();
    }

    function addToBin(binIndex, valueIndex) {
        var finishDuration = 1000;
        var binDef = binDefs[binIndex];
        binDef.indices.push(valueIndex);
        var binNode = bins.nodes()[binIndex], binSeln = d3.select(binNode);
        binSeln
            .attr("y", def=>binBase-heightScale(def.indices.length))
            .attr("height", def=>heightScale(def.indices.length));

        var counterNode = counters.nodes()[binIndex], counterSeln = d3.select(counterNode);
        counterSeln
            .style("opacity", 1)
            .text(String(binDef.indices.length));

        var binCount = binDef.indices.length;
        if (binCount > countPlottedSoFar) addAxisAnnotations(binCount);

        if (binCount===binDef.totalCount) {
            binDef.indices.sort(d3.ascending);
            binSeln
                .transition()
                .duration(finishDuration)
                .style("fill", "lightgray")
                .style("fill-opacity", 0.5)
                .style("stroke-opacity", 1);

            counterSeln
                .transition()
                .duration(finishDuration)
                .style("opacity", 1e-6)
                .remove();

            if (--binsToFill===0) allDone();
        }
    }

    function addAxisAnnotations(count) {
        if (!showScale) return;
        if (count <= countPlottedSoFar) return;

        var numOfScaleValues = d3.bisect(scaleValues, count);

    	var legendX = xScale(chart.dataMax)+85;  // try to steer clear of moving bins
    	var labelDefs = [
            { labelType: "title", x: legendX, anchor: "start", y: -heightScale(Math.max(lastValue, maxBinCount))-15, text: "count" },
    	    ];
        var tickLength = 4;
        var tickDefs = [
            { x: legendX, y: 0, dx: -tickLength, dy: 0 }
            ];
    	scaleValues.slice(0, numOfScaleValues).forEach(v=>{
        	    labelDefs.push({ labelType: "yAxis", x: legendX+tickLength+3, y: -heightScale(v), text: String(v) });
        	    tickDefs.push({ x: legendX, y: -heightScale(v), dx: tickLength, dy: 0 });
    	    });
        chart.drawBinAnnotations(annotationGroup, { x: legendX, y: binBase }, heightScale(count), tickDefs, labelDefs, instant);
        countPlottedSoFar = count;
    }

    function allDone() {
        addAxisAnnotations(Math.max(lastValue, maxBinCount));

        if (!instant) {
            demoGroup.selectAll("line.binbreak")
                .transition()
                .duration(1000)
                .style("opacity", 1e-6)
                //.remove();        don't remove; we can use them to draw the values
        }
    }

};

chartObject.duplicateBins=function duplicateBins() {
    // take a copy of the bins, and put it in the scenario records

    var chart=this;

    var scenarioClasses = "rect.demobin,line.binbreak,text.binbreak";

    var presentGroupNode = this.demoGroup.node();
    var groupNodeClone = this.duplicateObjects(presentGroupNode, scenarioClasses);
    d3.select(groupNodeClone).style("opacity", 1e-6)
    return groupNodeClone;
};

chartObject.duplicateObjects=function duplicateObjects(oldGroupNode, classes) {
    var newGroupNode = oldGroupNode.cloneNode(); // shallow.  we decide what goes in.
    oldGroupNode.parentNode.appendChild(newGroupNode);
    d3.select(newGroupNode).attr("class", "groupclone");
    d3.select(oldGroupNode).selectAll(classes).each(function(d) {
        var oldClass = d3.select(this).attr("class");
        var newObj = this.cloneNode(true);
        newGroupNode.appendChild(newObj);
        d3.select(newObj)
            .attr("class", oldClass+"clone")
            .style("pointer-events", "none")
            .datum(d);
        });

    return newGroupNode;

/* TEST

    function transformString(x, y) { return "translate("+x+", "+y+")" }

    // extracting (in this case) the x and y translations from the transform http://stackoverflow.com/questions/38224875/replacing-d3-transform-in-d3-v4
    var matrix = oldGroupNode.transform.baseVal[0].matrix, oldGroupX = matrix.e, oldGroupY = matrix.f;
    var oldTrans = transformString(oldGroupX, oldGroupY), newTrans = transformString(oldGroupX+100, oldGroupY-200);
    d3.select(newGroupNode)
        .transition()
        .duration(5000)
        .attrTween("transform", ()=>d3.interpolateTransformSvg(oldTrans, newTrans));
*/
};

chartObject.estimateMaxBinDensity=function estimateMaxBinDensity() {
    var data = this.data, guess = 0;
    // rather arbitrarily, we assume that 30 bins over the range is fine enough, and we slide the binning through ten positions.
    var numBins = 30;
    var refDensity = data.length * this.dataRange / numBins;
    for (var off=0; off<100; off+=10) {
        var ranges = this.generateRanges(100/numBins, -off);
        var bins = this.binData(data, ranges);
        var max = d3.max(bins, b=>b.values.length)/refDensity;
        if (max>guess) guess=max;
    }
    return guess;
};

chartObject.estimateMaxBinSize=function estimateMaxBinSize(optionalWidthPercent) {
    // if optionalWidthPercent is specified, it is a percentage of the data range
    var data = this.data, guess = 0;
    // if width is not specified, we assume that binning in tenths of the range is coarse enough.
    // we slide the binning through ten positions, and return the maximum of all.
    var widthPercent = optionalWidthPercent || 10;
    for (var off=0; off<100; off+=10) {
        var ranges = this.generateRanges(widthPercent, -off);
        var bins = this.binData(data, ranges);
        var max = d3.max(bins, b=>b.values.length);
        if (max>guess) guess=max;
    }
    return guess;
};

chartObject.flyBalls=function flyBalls(options) {
//console.log("fly")

    var chart = this;
    var instant = !!(options && options.instant);

    this.clearDemoBalls = function() {
        this.dataGroup.selectAll("circle.settled,circle.dropped,line.numberline").interrupt().remove();
    }
    this.clearDemoBalls();

    var fixedCanvas = this.chartFixedCanvas.node(), fixedContext = fixedCanvas.getContext("2d");

    //fixedContext.clearRect(0, 0, fixedCanvas.width, fixedCanvas.height);
    // this.drawValueList(); @@ DEBUG

    var maxCount = d3.max(lively.lang.obj.values(this.data.counts));
    var values = [];
    chart.data.forEach(v=>values.push(v)); // all values, including repeats
    var numValues = values.length;

    // tFlight is the time of flight of the first instance of the first value.  other values are offset, so their first dots land together
    var maxDelay = 2000, tFlight = 4000, tFall = 1000, spreadDelay = tFlight/Math.max(40, maxCount), maxSpread = maxCount*spreadDelay;
    var canvas = this.chartCanvas.node(), context = canvas.getContext("2d");
    var xScale = this.xScale, plotOrigin = this.plotOrigin;

    var valueListHeight = this.valueListHeight;
    var fontSize=this.valueListFontSize;
    var originX = plotOrigin.x+this.valueListOrigin.x, valueListTop = plotOrigin.y+this.valueListOrigin.y;
    var fallHeight = this.fallAfterFlight, flightTargetY = plotOrigin.y-fallHeight;

    var colourScale = chart.colourScale;

    var originYScale = d3.scaleLinear()
        .domain([0, numValues-1])
        .range([valueListTop, valueListTop+valueListHeight]);
    var originYIncrement = originYScale(1)-originYScale(0);

    function delayScale(valIndex) { return maxDelay*valIndex/numValues }

    var fillLineWidth = 0.5;
    fixedContext.lineWidth = fillLineWidth;

    // for each value, set up a definition of how to draw its path(s) from number list to number line
    var valIndex = 0, uniqueValues = [], pathDefs = {};
    chart.data.valuesAndCountsDo((val, count)=>{
        uniqueValues.push(val);
        var colour = colourScale(val, 1);
        var pathColour = count===1 ? colour : colourScale(val, 0.2);
        var targetX = Math.round(plotOrigin.x+xScale(val)), xDiff = targetX-originX;
        var firstOriginY = originYScale(valIndex);
        pathDefs[String(val)] = { firstIndex: valIndex, count: count, colour: colour, pathColour: pathColour, targetX: targetX, xDiff: xDiff, firstOriginY: firstOriginY };
        valIndex += count;
        });

    chart.chartGroup.selectAll(".flightMousetrap").remove();
    chart.chartGroup.append("rect")
        .attr("class", "flightMousetrap")
        .attr("x", plotOrigin.x)
        .attr("y", valueListTop)
        .attr("width", originX-plotOrigin.x)
        .attr("height", flightTargetY - valueListTop)
        .style("fill", "none")
        .style("pointer-events", "all")
        .style("cursor", "crosshair")
        .on("mousemove", function() {
            var evtPoint = d3.mouse(this.parentNode);
            var point = lively.pt(evtPoint[0], evtPoint[1]);
            chart.clearEphemeralCanvas();
            context.lineWidth = 1;
            context.strokeStyle = "green";
            var numToHighlight = 10;
            var firstHighlightIndex;
            var found = false, valueListIndex = 0;
            // find the first value (if any) whose first path doesn't enclose the probe point.
            while (!found && valueListIndex<uniqueValues.length) {
                var pathDef = pathDefs[String(uniqueValues[valueListIndex])];
                if (!isPointInsidePath(point, pathDef.firstOriginY, pathDef.xDiff)) found = true;
                else valueListIndex++;
            }
            var indexRange = [];
            // if not even the first value encloses the probe point, there's nothing to highlight;
            if (valueListIndex > 0) {
                // narrow down onto the individual paths for the last value that *does* enclose the probe.
                var lastEnclosingIndex = valueListIndex-1, pathDef = pathDefs[String(uniqueValues[lastEnclosingIndex])];
                found = false;
                var pathWithinValue = 1;
                while (!found && pathWithinValue<pathDef.count) {
                    if (!isPointInsidePath(point, pathDef.firstOriginY+originYIncrement*pathWithinValue, pathDef.xDiff)) found = true;
                    else pathWithinValue++;
                }
                // if the probe point is enclosed by even the last path, again don't highlight anything
                if (!(lastEnclosingIndex===uniqueValues.length-1 && !found)) {
                    var midHighlight = pathDef.firstIndex+pathWithinValue-1;
                    firstHighlightIndex = Math.max(0, Math.min(numValues-numToHighlight, midHighlight-numToHighlight/2));
                    var indexRange = lively.lang.arr.range(firstHighlightIndex, firstHighlightIndex   +numToHighlight-1);
                }
            }
            chart.highlightPathIndices(indexRange);
            chart.highlightValueIndices(indexRange);
            })
        .on("mouseleave", function() {
            chart.highlightPathIndices([]);
            chart.highlightValueIndices([]);
            });

    function isPointInsidePath(point, pathStartY, pathXDiff) {
        if (pathStartY > point.y) return false;

        var xDiff = originX-point.x;
        var pathYDiff = flightTargetY - pathStartY;
        var queryDiff = point.y - pathStartY; // = wholeDiff * (1-cos(theta))
        var theta = Math.acos(1 - queryDiff/pathYDiff);
        return originX + pathXDiff * Math.sin(theta) < point.x;
    }

    function highlightPathIndices(indexList) {
        chart.clearEphemeralCanvas();
        context.lineWidth = 1;
        var pathHighlightColour = "rgba(0, 0, 0, 0.5)", ballHighlightColour = "black";
        context.strokeStyle = pathHighlightColour;
        indexList.forEach(index=>{
            //context.strokeStyle = colourScale(values[index], 1);
            drawPath(index, context)
            });
        chart.dataGroup.selectAll("circle.settled,circle.dropped").each(function(d) {
            var hilited = indexList.indexOf(d.valueIndex)>=0;
            var seln = d3.select(this), ballClass = seln.attr("class");
            if (hilited) seln.raise();
            seln
                .style("stroke-opacity", hilited ? 0 : 1)
                .style("fill", hilited ? ballHighlightColour : (ballClass==="dropped" ? "none" : colourScale(d.value))) });
    }
    chart.highlightPathIndices = highlightPathIndices;

    function drawPaths(val) {
        var ctx = fixedContext;

        var def = pathDefs[String(val)];
        var firstIndex = def.firstIndex, count = def.count;

        if (!instant) {
            var textSeln = chart.chartGroup.select("text.valueLabel");
            if (textSeln.empty()) {
                textSeln = chart.chartGroup.append("text")
                    .attr("class", "valueLabel")
            		.attr("dy", chart.textOffsets.central)
                    .style("font-size", fontSize+"px")
                    .style("text-anchor", "middle")
                    .attr("x", originX+chart.valueListWidth/2)
            }

            textSeln
                .interrupt()
                .datum(def)
                .text(val.toFixed(chart.dataDecimals))
                .style("fill", def=>def.colour)
                .style("opacity", 1)
                .attr("y", originYScale(firstIndex+Math.floor((count-1)/2)))
                .transition()
                .delay(500)
                .duration(1000)
                .style("opacity", 1e-6)
                .remove();
        }

        ctx.strokeStyle = colourScale(val, 1);
        ctx.lineWidth = 0.5;
        for (var i=0; i<count; i++) {
            if (i===1) ctx.strokeStyle = colourScale(val, 0.5);
            drawPath(firstIndex+i, ctx);
        }
    }

    // while we're waiting for canvas ellipse() to be supported more widely, here's a circle-scaling approach from http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas
    function drawPath(valueIndex, context) {
        // caller has to set the lineWidth and strokeStyle
        var pi = Math.PI;
        context.save(); // save state
        context.beginPath();

        context.translate(originX, flightTargetY);
        context.scale(originX-Math.round(plotOrigin.x+xScale(values[valueIndex])), flightTargetY-originYScale(valueIndex));
        context.arc(0, 0, 1, -pi/2, -pi, true);

        context.restore(); // restore to original state before stroking (to avoid scaling the stroke)
        context.stroke();
    }

    // simpler call, but not yet widely supported
    function drawPathWithEllipse(valueIndex, context) {
        // caller has to set the lineWidth and strokeStyle
        var pi = Math.PI;
        context.beginPath();
        context.ellipse(originX, flightTargetY, originX-Math.round(plotOrigin.x+xScale(values[valueIndex])), flightTargetY-originYScale(valueIndex), 0, pi, pi*1.5, false);
        context.stroke();
    }

    // precompute tables of sines and cosines
    var sines = [], cosines = [], piBy2000 = Math.PI/2000;
    for (var i=0; i<1000; i++) { sines.push(Math.sin(i*piBy2000)); cosines.push(Math.cos(i*piBy2000)) }

    var plottableValues = [];
    var valIndex = 0;
    chart.data.valuesAndCountsDo((val, count)=>{
        var valueDelay = delayScale(valIndex), valueTFlight = tFlight-valueDelay;
        var firstY = originYScale(valIndex);
        var targetX = plotOrigin.x+xScale(val);

        plottableValues.push({ value: val, count: count, valueDelay: valueDelay, valueTFlight: valueTFlight, allLanded: valueDelay+valueTFlight+spreadDelay*count+tFall, xTarget: targetX, xDiff: targetX-originX, firstY: firstY, cumulativeIndex: valIndex, lastSettled: -1 })
        valIndex += count;
        });

    var settledBalls = [], lastPathDrawn = this.dataMin-1; // something less than the min
    var radius = 2, staggerRatio = 1.5;
    var shownNumberLine = false;

    var oneShot = 100000;
    if (instant) {
        flyAll(oneShot);
    } else {
        this.startTimer({
            tick: elapsed=>{
                chart.clearEphemeralCanvas();
                if (settledBalls.length === numValues) {
                    chart.stopTimer(false);
//console.log("finished");
                } else flyAll(elapsed);
                },
            cleanup: ()=>chart.clearEphemeralCanvas(),
            forceToEnd: ()=>flyAll(oneShot)
            });
    }

    function flyAll(elapsed) {
        context.fillStyle = "black";
        var twoPi = Math.PI*2; // performance.
        var nextPlottable = [];
        plottableValues.forEach(valObj=>{
            context.fillStyle = colourScale(valObj.value, 1);
            if (elapsed === oneShot || elapsed < valObj.allLanded) {
                nextPlottable.push(valObj);
                var sinceFirstTakeoff = elapsed-valObj.valueDelay; // launch of first for this value
                if (sinceFirstTakeoff > 0) {
                    var val = valObj.value, count = valObj.count, valueTFlight = valObj.valueTFlight, xDiff = valObj.xDiff, useCircles = count < 20, valIndex = valObj.cumulativeIndex, firstY = valObj.firstY, fallX = valObj.xTarget;

                    if (lastPathDrawn < val) {
                        drawPaths(val);
                        lastPathDrawn = val;
                    }

                    // launched is the index of the last instance to have taken off.  it maxes out at count-1
                    var launched = (sinceFirstTakeoff/spreadDelay) | 0;
                    if (launched > count-1) launched = count-1;
                    // firstStillFlying is the index of the first instance still on the flight path.  it maxes out at count.
                    var firstStillFlying = ((sinceFirstTakeoff - valueTFlight) / spreadDelay) | 0;
                    if (firstStillFlying < 0) firstStillFlying = 0;
                    else if (firstStillFlying > count) firstStillFlying = count;
                    // firstStillFalling is the index of the first instance still tumbling to the number line.  when all have landed, it maxes out at count.
                    var firstStillFalling = ((sinceFirstTakeoff - valueTFlight - tFall) / spreadDelay) | 0;
                    if (firstStillFalling < 0) firstStillFalling = 0;
                    else if (firstStillFalling > count) firstStillFalling = count;

                    var sinceTakeoff = sinceFirstTakeoff - spreadDelay*firstStillFlying;
                    for (var i=firstStillFlying; i<=launched; i++) {
                        var originY = firstY+originYIncrement*i, yDiff = flightTargetY-originY;

                        var flightPoint = (1000*/*eezer*/(sinceTakeoff / valueTFlight)) | 0;
                        var centreX = originX+xDiff*sines[flightPoint], centreY = flightTargetY-yDiff*cosines[flightPoint];

                        context.beginPath();
                        if (useCircles) context.arc(centreX, centreY, 2, 0, twoPi);
                        else context.rect(centreX-2, centreY-2, 4, 4);
                        context.fill();

                        sinceTakeoff -= spreadDelay;
                    }

                    if (firstStillFalling===count) { // maxed out
                        settleBalls(valObj, count-1); // make sure everything has settled
                    } else {
                        var sinceFall = sinceFirstTakeoff - valueTFlight - spreadDelay*firstStillFalling;
                        var initialSpeed = fallHeight/tFall, lastFalling=Math.min(count-1, firstStillFlying);
                        for (var i=firstStillFalling; i<=lastFalling; i++) {
                            if (sinceFall > 0) {
                                var fallPoint = initialSpeed*sinceFall + 0.0005*sinceFall*sinceFall;
                                var finalY = flightTargetY+fallHeight-radius*(1+2*staggerRatio*i);
                                var fallY = flightTargetY+fallPoint;
                                if (fallY >= finalY) settleBalls(valObj, i);
                                else {
                                    context.beginPath();
                                    context.arc(fallX, fallY, 2, 0, twoPi);
                                    context.fill();
                                }
                            }
                            sinceFall -= spreadDelay;
                        }
                    }
                }
            }
            });
        plottableValues = nextPlottable;
        var balls = chart.dataGroup.selectAll("circle.settled").data(settledBalls, d=>d.valueIndex);
        balls.enter().append("circle")
            .attr("class", "settled")
            .attr("cx", d=>d.x)
            .attr("cy", d=>d.y)
            .attr("r", radius)
            .style("fill", d=>colourScale(d.value,1))
            .style("pointer-events", "none");
    }

    function settleBalls(valObj, last) {
        if (!shownNumberLine) {
            chart.drawNumberLine();
            shownNumberLine = true;
        }
        if (last > valObj.lastSettled) {
            var fallX = valObj.xTarget, baseIndex = valObj.cumulativeIndex;
            for (var i=++valObj.lastSettled; i<=last; i++) {
                settledBalls.push({ x: fallX-plotOrigin.x, y: flightTargetY+fallHeight-radius*(1+2*staggerRatio*i)-plotOrigin.y, valueIndex: baseIndex+i, value: valObj.value });
            }
            valObj.lastSettled = last;
        }
    }

    chart.dataGroup.selectAll(".ballMousetrap").remove();
    chart.dataGroup.append("rect")
        .attr("class", "ballMousetrap")
        .attr("x", -5)
        .attr("y", 5-fallHeight)
        .attr("width", xScale(chart.dataMax)-xScale(chart.dataMin)+10)
        .attr("height", fallHeight)
        .style("fill", "none")
        .style("pointer-events", "all")
        .style("cursor", "crosshair")
        .on("mousemove", function() {
            var evtX = d3.mouse(this.parentNode)[0];
            var probeValue = xScale.invert(evtX);
            var nearest = d3.scan(uniqueValues, (a, b)=>(Math.abs(a-probeValue)-Math.abs(b-probeValue)));
            var def = pathDefs[String(uniqueValues[nearest])];
            var indexRange = lively.lang.arr.range(def.firstIndex, def.firstIndex+def.count-1);
            chart.highlightPathIndices(indexRange);
            chart.highlightValueIndices(indexRange, true);
            })
        .on("mouseleave", function() {
            chart.highlightPathIndices([]);
            chart.highlightValueIndices([]);
            });


};

chartObject.generateRanges=function generateRanges(binWidthPct, binOffsetPct) {
  // binWidth and binOffset are expressed as percentages
  var dataMin = this.dataMin, dataMax = this.dataMax, dataRange = dataMax-dataMin, snapRange = dataRange/1000;

  // if a range end is within one thousandth of the range of data min or max, snap to that value
  function snapTo(v, dataVal) { return Math.abs(v-dataVal) < snapRange ? dataVal : v }
  var ranges = [];
  var binWidth = binWidthPct * dataRange / 100, binOffset = binOffsetPct / 100;
  var binStart = binOffset === 0 ? dataMin : snapTo(dataMin + (binOffset-1) * binWidth, dataMin);
  var firstBin = true;
  while (binStart < dataMax) {
    var binEnd = snapTo(binStart + binWidth, dataMax);
    ranges.push({ min: binStart, max: binEnd, minOpen: !firstBin, maxOpen: false});
    binStart = binEnd;
    firstBin = false;
  }

  return ranges;
};

chartObject.hoverOver=function hoverOver(path) {
    var hoveredElem = d3.select(path);
    if (hoveredElem.size()===0) return; // if replay has been done independently of scroll, the visualisation might not have that element right now

    var elemRect = hoveredElem.node().getBoundingClientRect(), outset = 4;
    var svgRect = this.chartSVG.node().getBoundingClientRect();
    var ratio = this.sizeRatio;
    var fullSizeLeft = (elemRect.left-svgRect.left)/ratio, fullSizeTop = (elemRect.top-svgRect.top)/ratio, fullSizeWidth = elemRect.width/ratio, fullSizeHeight = elemRect.height/ratio;
    this.chartSVG.select("rect.highlighter").remove();
    this.chartSVG.append("rect")
        .attr("class", "highlighter")
        .attr("x", fullSizeLeft-outset)
        .attr("y", fullSizeTop-outset)
        .attr("width", fullSizeWidth+2*outset)
        .attr("height", fullSizeHeight+2*outset)
        .style("fill", "none")
        .style("pointer-events", "none")
        .style("stroke-width", outset-2)
        .style("stroke", "red");
};

chartObject.hoverOut=function hoverOut() {
    this.chartSVG.select("rect.highlighter").remove();
};

chartObject.init=function init(options) {
    var tableOptions = {};
    if (options.hasOwnProperty("noDensity")) tableOptions.noDensity = options.noDensity;
    this.initChartInElement(options.element, options.extent);
    if (true || options.showHist) this.initHistogramArea(); // @@ until we get organised
    this.loadData(options.dataset, ()=>this.buildTable(options.definitions, tableOptions));
};

chartObject.initBinBehaviour=function initBinBehaviour() {
    var chart = this;
    var binsAreDraggable = chart.binsAreDraggable;

    this.histGroup.selectAll("*").remove();

    // set up a nested group just for bins
    var pointerOverBin = false;
	this.histGroup
		.append("g")
        .attr("class", "binGroup")
        .call(seln=>{
            if (binsAreDraggable) {
                (d3.drag()
                    .on("start", dragStarted)
                    .on("drag", dragged)
                    .on("end", dragEnded))(seln)
            }
            })
        // note: if pointer leaves and then re-enters the bins during a drag, we get a mouseleave but not a mousemove
        .on('mouseenter', function() { pointerOverBin = true })
        .on('mousemove', function() {  // not arrow, because we need "this"
            pointerOverBin = true;
            if (!chart.isDragging) {
                var binNumber = findBinAround(chart.xScale.invert(d3.mouse(this)[0]));
                chart.scheduleEvent("probe", 0, ()=>{
                    chart.refreshTable({ dataFocusIndex: binNumber, binHighlight: binNumber }, 0);
                    //highlightBinNumber(binNumber);
                    });
            };
            })
        // mouseout would be sent for each sub-object; mouseleave is only sent when mouse leaves the entire group
        .on('mouseleave', function() {
            pointerOverBin = false;
            if (!chart.isDragging) {
                chart.scheduleEvent("probe", 200, ()=>{
                    chart.refreshTable({ binHighlight: null }, 0)
                    });
            };
            });

    var highlightedBinNode = null;
    chart.highlightBinNumber = highlightBinNumber;
    function highlightBinNumber(binNum, scenarioOrNull) {
        if (scenarioOrNull===undefined) scenarioOrNull = null;
        if (binNum === null) { resetBinHighlight(); return };

        var binClass = scenarioOrNull === null ? "primary" : "context";
        var binNode = findBin(binClass, function(binItem) {
            // make sure we hit at most one bin.  doesn't matter that mousing on the boundary won't hit any.
//console.log(d.min, d.max, value)
            return (scenarioOrNull===null || scenarioOrNull===binItem.scenario) && binItem.dataIndex===binNum;
            });

        applyBinHighlights(binNode, binClass);
    }

    function findBinAround(value, scenarioOrNull) {
        if (scenarioOrNull===undefined) scenarioOrNull = null;
        if (value === null) return null;

        var binClass = scenarioOrNull === null ? "primary" : "context";
        var binNode = findBin(binClass, function(binItem, i) {
            // make sure we hit at most one bin.  doesn't matter that mousing on the boundary won't hit any.
            return (scenarioOrNull===null || scenarioOrNull===binItem.scenario) && binItem.min<value && binItem.max>value
            });
        return binNode ? binNode.__data__.dataIndex : null;
    }

    // return the first bin node object for which the bound data object satisfies the supplied dataTest
    function findBin(binClass, dataTest) {
        var found = null;
        chart.histGroup.selectAll("rect."+binClass).each(function(d, i) {
            if (!found && dataTest(d, i)) found=this;
            });
        return found;
    }

    var contextBaseColour = this.contextBinFill, contextBaseOpacity = 0.15;
    var primaryHighlightColour = d3.hcl(274,100,75), contextHighlightColour = d3.hcl(73,100,75), primaryTextColour = primaryHighlightColour.darker(), contextTextColour = contextHighlightColour; /*.darker(0.25);*/

    function applyBinHighlights(binNode, binClass) {
        if (binNode === highlightedBinNode) return;

        if (highlightedBinNode) resetBinHighlight(); // cancel previous
        if (binNode === null) return; // nothing more to do
        highlightedBinNode = binNode;

        var isContext = binClass === "context";
        var highlightColour = isContext ? contextHighlightColour : primaryHighlightColour;
        var binHighlight = d3.color(highlightColour.darker());
        //binHighlight.opacity = 0.5;
        var binSeln = d3.select(binNode);
        var highlightIndex, valueSet;
        binSeln
            .style("fill", binHighlight.toString())
            .raise();
        var binItem = binNode.__data__;
        highlightIndex = binItem.dataIndex;
        valueSet = binItem.values.collection;
        chart.dataGroup.selectAll("circle.ball").each(function(dataItem) {
            if (valueSet.indexOf(dataItem.value)>=0) {
                var seln = d3.select(this);
                seln
                    .raise()
                    .style("fill", highlightColour)
                    .style("stroke", highlightColour); // @@ now that we're not using striping

            }
            });
        highlightColour = isContext ? contextTextColour : primaryTextColour;
        chart.chartGroup.selectAll("text.dataTextCell").each(function(cellItem) {
            //d3.select(this).style("fill", (cellItem.isContext===isContext && cellItem.dataIndex === highlightIndex) ? highlightColour : "black");
            if (cellItem.isContext===isContext && cellItem.dataIndex === highlightIndex) d3.select(this).interrupt().style("fill", highlightColour);
            });

        var descFontSize = 12;
        chart.histGroup.selectAll("g.binDescriptor").remove();
        var descGroup = chart.histGroup.append("g")
            .attr("class", "binDescriptor")
            .attr("transform", "translate("+(Number(binSeln.attr("x"))+Number(binSeln.attr("width"))/2)+","+(Number(binSeln.attr("y"))+Number(binSeln.attr("height"))+6+descFontSize/2)+")");
        var text = [
            String(binItem.min),
            binItem.minOpen ? "<" : "≤",
            "x",
            binItem.maxOpen ? "<" : "≤",
            String(binItem.max),
            "("+binItem.values.length+")"
            ].join(" ");
        var descText = descGroup.append("text")
            .attr("x", 0)
            .attr("y", 0)
    		.attr("dy", chart.textOffsets.central)
            .style("fill", "blue")
            .style("pointer-events", "none")
            .style("text-anchor", "middle")
            //.style("dominant-baseline", "central")
            .style("font-size", descFontSize+"px")
            .text(text);
        var textWidth = descText.node().getComputedTextLength();
        var descRect = descGroup.append("rect")
            .attr("width", textWidth+12)
            .attr("height", descFontSize+11)
            .attr("x", -textWidth/2-6)
            .attr("y", -descFontSize/2-5)
            .style("fill", chart.chartSVG.style("background-color"))
            .style("opacity", 1);
        descText.raise();
    }

    chart.resetBinHighlight = resetBinHighlight;
    function resetBinHighlight() {
        //if (highlightedBinNode === null) return;  nope - always do this (cost be damned)
//console.log("reset");
        chart.histGroup.selectAll("g.binDescriptor").remove();

        var oddBinValues = {};
        chart.histGroup.selectAll("rect.primary").each(function(binItem, i) {
            if ((binItem.dataIndex + chart.stripeOffset) & 1) {
                binItem.values.collection.forEach(v=>oddBinValues[String(v)]=true);
            }
            });

        // a ball that was previously marked as being in an odd or even bin, and now finds itself in one of the opposite persuasion, will jump a few pixels in the air.  this marking gets reset if the bin widths are changed.
        var trans = d3.transition().duration(250), filling = "black";
        chart.dataGroup.selectAll("circle.ball").each(function(dataItem) {
            var seln = d3.select(this);
            seln.style("fill", filling).style("stroke", filling);
            var oddEven = oddBinValues[String(dataItem.value)] ? 1 : 0;
            if (this.hasOwnProperty("oddEven") && this.oddEven!==oddEven) {
                if (!this.originalY) this.originalY = +seln.attr("cy");
                seln
                    .attr("cy", this.originalY-4)
                    .transition(trans)
                    .attr("cy", this.originalY)
            }
            this.oddEven = oddEven;
            });

        var primaryBins = chart.histGroup.selectAll("rect.primary");
        var contextBins = chart.histGroup.selectAll("rect.context");
        if (!contextBins.empty()) {
            var contextColour = d3.color(contextBaseColour);
            contextColour.opacity = contextBaseOpacity;
            contextBins.style("fill", contextColour.toString());
            primaryBins.style("fill", "none");
        } else primaryBins.style("fill", chart.restingBinFill);

        if (highlightedBinNode !== null) chart.chartGroup.selectAll("text.dataTextCell").style("fill", "black");  // only do this bit if there was a highlight

        highlightedBinNode = null;
    }

    var dragStartUnscaledX, dragStartMinBinX, draggableBinWidth, dragOffsetToCentre, dragBinIndex;
    chart.isDragging = false;
    function dragStarted(d) {
        // during dragging, we're going to specify what value we desire for the left edge of the leftmost bin.
        chart.isDragging = true;
        dragStartMinBinX = d3.min(chart.chartGroup.selectAll("rect.primary").nodes(), o=>o.__data__.min);
        var someBin = chart.chartGroup.selectAll("rect.primary").nodes()[0];
        draggableBinWidth = someBin.__data__.max - someBin.__data__.min;
        chart.dragPoint = dragStartUnscaledX = chart.xScale.invert(d3.mouse(this)[0]);
        // if user starts dragging in the middle of a bin, there's no problem figuring out which bin to highlight, even when the bins jump.  in case the user happens to start dragging near a bin boundary, we therefore figure out an offset to apply when hit-testing so that the test value is always near the middle.
        var binMultiple = (chart.dragPoint - dragStartMinBinX) / draggableBinWidth;
        dragOffsetToCentre = (0.5 - (binMultiple - Math.floor(binMultiple)))*draggableBinWidth;
        dragBinIndex = Math.floor((dragStartUnscaledX+dragOffsetToCentre-dragStartMinBinX)/draggableBinWidth);
    }
    function dragged(d, i) {
        chart.dragPoint = chart.xScale.invert(d3.mouse(this)[0]);
        if (chart.dragPoint <= chart.dataMin - draggableBinWidth*1.5 || chart.dragPoint >= chart.dataMax+draggableBinWidth*1.5) return;

        // first, figure out where the original left edge would have been dragged to
        var shiftedMinBinX = dragStartMinBinX + chart.dragPoint - dragStartUnscaledX;
        // then normalise to the region a single bin-width to the left of the data minimum
        var normalisedMinBinX = shiftedMinBinX - (draggableBinWidth*(1+Math.floor((shiftedMinBinX-chart.dataMin)/draggableBinWidth)));

        var newOffset = chart.findClosestResult("lefts[0]", normalisedMinBinX, "offset");

        if (newOffset!==null) {
            var oldBinIndex = dragBinIndex;
            dragBinIndex = Math.floor((chart.dragPoint+dragOffsetToCentre-(chart.dataMin+newOffset*draggableBinWidth))/draggableBinWidth);
            // if the index being dragged has changed, the stripes need to be re-aligned
            if (oldBinIndex!==dragBinIndex) chart.stripeOffset = 1-chart.stripeOffset;
        }

        chart.refreshTable({ dataFocusIndex: dragBinIndex, force: newOffset!==null, binHighlight: null }, 0);  // null highlight to force re-highlighting, maybe after a shift
        //resetBinHighlight();
        highlightBinNumber(dragBinIndex);
    }
    function dragEnded(d) {
        chart.isDragging = false;
        if (pointerOverBin) {
            //resetBinHighlight();
            chart.refreshTable({ force: true, binHighlight: null }, 0);
            var binNumber = findBinAround(chart.xScale.invert(d3.mouse(this)[0]));
            chart.refreshTable({ dataFocusIndex: binNumber, binHighlight: binNumber }, 0);
            //highlightBinNumber(binNumber);
        } else {
            chart.refreshTable({ force: true, binHighlight: null }, 0);
            //resetBinHighlight();
        }
    }

    var recordedBinState;
    chart.recordBinState = recordBinState;
    function recordBinState(binClass) {
        binClass = binClass || "primary";
        recordedBinState = [];
        chart.histGroup.selectAll("rect."+binClass).each(function() {
            var seln = d3.select(this);
            if (binClass==="context" && +seln.style("stroke-opacity")===0) return;

            recordedBinState.push({ left: +seln.attr("x"), width: +seln.attr("width"), y: +seln.attr("y"), height: +seln.attr("height"), stroke: seln.style("stroke") });
            });
        recordedBinState.sort((a, b)=>a.left-b.left);
    }

    chart.highlightBinDifferences = highlightBinDifferences;
    function highlightBinDifferences(binClass, deletePrevious) {
        // @@ we currently ignore deletePrevious.  let stuff fade away.
        //if (deletePrevious) chart.histGroup.selectAll("g.phosphor").interrupt().remove();
        if (!recordedBinState || recordedBinState.length===0) return;

        binClass = binClass || "primary";
        var yBase = recordedBinState[0].y+recordedBinState[0].height; // as good as any
        var phosphorGroup = chart.histGroup.append("g").attr("class", "phosphor");
        phosphorGroup.lower();

        // check (in a somewhat inefficient way) if anything has changed visually
        var anyChanges = false;
        chart.histGroup.selectAll("rect."+binClass).each(function() {
            var seln = d3.select(this);
            if (binClass==="context" && +seln.style("stroke-opacity")===0) return;

            var left = +seln.attr("x"), width = +seln.attr("width"), y = +seln.attr("y"), height = +seln.attr("height");
            var centreX = left+width/2;
            var prevBin = recordedBinState.find(def=>def.left<=centreX && def.left+def.width>=centreX);
            if (!prevBin || prevBin.left!==left || prevBin.width!==width || prevBin.y!==y) anyChanges = true;
            });

        if (anyChanges) {
            var firstDur = 200, delay = 1000, secondDur = 1000;
            phosphorGroup.selectAll("rect").data(recordedBinState).enter().append("rect")
                .attr("x", def=>def.left)
                .attr("y", def=>def.y)
                .attr("width", def=>def.width)
                .attr("height", def=>def.height)
                .style("fill", "lightgrey")
                .style("fill-opacity", 0.5)
                //.style("stroke", "lightgrey")
                //.style("stroke-opacity", 0.5)
                .style("pointer-events", "none")
/*
                .transition()
                .duration(firstDur)
                .ease(d3.easeLinear)
                .style("stroke-opacity", 1e-6)
                .style("fill-opacity", 0.25)
                .on("end", ()=>phosphorGroup.lower())
*/
                .transition()
                .delay(delay)
                .duration(secondDur)
                .ease(d3.easeLinear)  // easeQuadOut another possibility
                .style("fill-opacity", 1e-6) // attempting to reduce flicker, as per bost.ocks.org/mike/transition/
                .remove();
        }

        recordedBinState=null;

    }

};

chartObject.initChartSubgroups=function initChartSubgroups() {

    this.stopTimer();
    this.chartGroup.selectAll("*").remove();

    this.dataLabelColour = "chocolate";

    var commandListOrigin = this.commandListOrigin = lively.pt(45, 10);
    this.buttonRowOrigin = lively.pt(290, this.visMaxExtent.y - 70);

    var plotOrigin = this.plotOrigin = lively.pt(185, this.visMaxExtent.y - 210);

    // during "demo" phase
    this.numberLineWidth = 550;  // between dataMin and dataMax
    this.fallAfterFlight = 115;  // bottom of flight arcs to number line
    this.fallIntoBins = 100;     // number line to histogram base line

    // definition of valueListOrigin is relative to plotOrigin
    var valueListHeight = this.valueListHeight = 310, valueListBottomGap = 60;
    this.valueListOrigin = lively.pt(620, -valueListHeight-valueListBottomGap-this.fallAfterFlight);
    this.valueListWidth = 40;
    this.valueListFontSize = 12;
    this.valueListEntryHeight = 15;

    // once we've presented the code table
    var dataOrigin = this.dataOrigin = lively.pt(270, 110);
    var histOrigin = this.histOrigin = lively.pt(270, 265);
    var tableOrigin = this.tableOrigin = lively.pt(10, 305);
    this.maxMainBinHeight = 90;

    var binFill = d3.color("blue");
    binFill.opacity = 0.8;
    this.restingBinFill = binFill.toString();
    this.contextBinFill = d3.color("darkgreen");

    // final stages - no table
    this.nakedHistOrigin = lively.pt(200, 400);

    var transformString = this.transformString;

    // the order of these will become significant if their glyphs start to overlap
    this.commandGroup = this.chartGroup.append('g')
		.attr("transform", transformString(commandListOrigin.x, commandListOrigin.y));

	this.demoGroup = this.chartGroup.append('g')
		.attr("transform", transformString(plotOrigin.x, plotOrigin.y));

	this.histGroup = this.chartGroup.append('g')
		.attr("transform", transformString(histOrigin.x, histOrigin.y));

	// data balls along number line.  starts at plotOrigin; later gets shifted to dataOrigin
	this.dataGroup = this.chartGroup.append('g')
		.attr("transform", transformString(plotOrigin.x, plotOrigin.y));
    this.resetDataGroup = function() { this.dataGroup.attr("transform",  transformString(plotOrigin.x, plotOrigin.y)) }

    this.rangeGroup = this.chartGroup.append('g')
		.attr("transform", transformString(dataOrigin.x, dataOrigin.y));

    this.tableGroup = this.chartGroup.append('g')
		.attr("transform", transformString(tableOrigin.x, tableOrigin.y));

	this.clearFixedCanvas();
	this.clearEphemeralCanvas();

};

chartObject.initChartSubstrates=function initChartSubstrates(divSeln, extent) {

    var width = extent.x, height = extent.y;

    var transformString = this.transformString = function(x, y) { return "translate("+x+", "+y+")" }
    this.textOffsets = {
        hanging: "0.75em",
        central: "0.4em",
        middle: "0.35em"
    }
//console.log(this.textOffsets);

    this.chartSVG = divSeln.append("svg")
        .attr("tabindex", -1)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", "rgb(255,248,230)")
        .attr("width", width)
        .attr("height", extent.y)
        .attr("viewBox", "0 0 "+extent.x+" "+extent.y);

    this.chartGroup = this.chartSVG.append('g')
        .attr("transform", transformString(0,0));

    this.chartFixedCanvas = divSeln.append("canvas");
    var context = this.chartFixedCanvas.node().getContext("2d");

    this.chartFixedCanvas
        .attr("class", "fixed")
        .attr("width", width)
        .attr("height", height)
        .style("position", "absolute")
        .style("left", "0px")
        .style("top", "0px")
        //.style("width", width+"px")
        //.style("height", height+"px")
        .style("pointer-events", "none");

    this.chartCanvas = divSeln.append("canvas")
        .attr("class", "ephemeral")
        .attr("width", width)
        .attr("height", height)
        .style("position", "absolute")
        .style("left", "0px")
        .style("top", "0px")
        //.style("width", width+"px")
        //.style("height", height+"px")
        .style("pointer-events", "none");

    function clearCanvas(canvSeln) {
        var canvas = canvSeln.node(), context = canvas.getContext("2d");
        context.clearRect(0, 0, width, height);
    }
    this.clearEphemeralCanvas = function() { clearCanvas(this.chartCanvas) }
    this.clearFixedCanvas = function() { clearCanvas(this.chartFixedCanvas) }

    this.clearMousetraps = function(trapNames) {
        trapNames.forEach(name=>this.chartGroup.selectAll("."+name+"Mousetrap").remove())
        }

    this.initChartSubgroups();

    // Define a div to act as a tooltip within the visualisation
    d3.selectAll("div.vistooltip").remove();
    d3.select("body").append("div")
        .attr("class", "vistooltip")
        .style("opacity", 0);

};

chartObject.initHistogramArea=function initHistogramArea(options) {
    // (plus lots of other highlighting experiments in unusedBinDiffHighlightFns)
    var chart=this;
    var instant = !!(options && options.instant);

    chart.clearDataRanges = function() { chart.rangeGroup.selectAll("text").remove() }
    chart.clearDataBalls = function() { chart.dataGroup.selectAll("circle.ball").remove() }

    chart.clearDataRanges();
    chart.clearDataBalls();

    this.stripeOffset = 0;

    var transformString = this.transformString;
    var colourScale = this.colourScale;

    // see if the dataGroup needs to be shifted
    var dataGroup = this.dataGroup, dataGroupNode = dataGroup.node(), dataOrigin = this.dataOrigin, desiredLoc = dataOrigin;
    // NB: this code assumes we're using the same transformString format everywhere
    var oldTrans = dataGroup.attr("transform"), newTrans = transformString(desiredLoc.x, desiredLoc.y);
    if (oldTrans===newTrans) instant = true; // @@ even if caller didn't think so
    var eezer = d3.easeQuadInOut, interpolator = d3.interpolateTransformSvg(oldTrans, newTrans), easedTransform = t=>interpolator(eezer(t));

    var tableGroup = this.tableGroup;
    tableGroup.style("opacity", 1e-6);

    var histGroup = this.histGroup;
    histGroup.style("opacity", 1e-6);

    this.drawNumberLine();  // make sure it's there
    this.drawBalls(this.data);
    var newBalls = dataGroup.selectAll("circle.ball");
    newBalls.style("opacity", 1e-6);

    var oldBalls = dataGroup.selectAll("circle.settled,circle.dropped");
    oldBalls.style("fill", def=>colourScale(def.value, 1));

    var moveTime = 1000, fadeTime = 1000, totalTime = moveTime+fadeTime;
    if (instant) {
        drawForElapsedTime(totalTime);
    } else {
        this.startTimer({
            tick: elapsed=>{
                drawForElapsedTime(elapsed);
                if (elapsed >= totalTime) {
                    chart.stopTimer(false);
//console.log("finished");
                }
                },
            forceToEnd: ()=>drawForElapsedTime(totalTime)
            })
    }

    function drawForElapsedTime(elapsed) {
        // update transform even after moveTime, because we might only be called once
        var moveRatio = Math.min(1, elapsed/moveTime);
        dataGroup.attr("transform", easedTransform(moveRatio));

        if (elapsed > moveTime) {
            var fadeRatio = Math.min(1, (elapsed-moveTime)/fadeTime);
            tableGroup.style("opacity", fadeRatio);
            newBalls.style("opacity", fadeRatio);
            histGroup.style("opacity", fadeRatio);
            oldBalls.style("opacity", 1-fadeRatio);
        }
    }

    this.initBinBehaviour();
};

chartObject.initNakedHistogram=function initNakedHistogram(options) {
    var chart=this;
    var instant = !!(options && options.instant);

    chart.rangeGroup.selectAll("text").remove();
    chart.dataGroup.selectAll("circle.ball,line.numberline").remove()

    var transformString = this.transformString;

    // see if the histGroup needs to be shifted
    var histGroup = this.histGroup, histGroupNode = histGroup.node(), desiredLoc = this.nakedHistOrigin;
    // NB: this code assumes we're using the same transformString format everywhere
    var oldTrans = histGroup.attr("transform"), newTrans = transformString(desiredLoc.x, desiredLoc.y);
    //if (oldTrans===newTrans) instant = true; // @@ even if caller didn't think so
    var eezer = d3.easeQuadInOut, interpolator = d3.interpolateTransformSvg(oldTrans, newTrans), easedTransform = t=>interpolator(eezer(t));

    var tableGroup = this.tableGroup;
    tableGroup.style("opacity", 0);

    var moveTime = 750, totalTime = moveTime;
    if (instant) {
        drawForElapsedTime(totalTime);
    } else {
        this.startTimer({
            tick: elapsed=>{
                drawForElapsedTime(elapsed);
                if (elapsed >= totalTime) {
                    chart.stopTimer(false);
//console.log("finished");
                }
                },
            forceToEnd: ()=>drawForElapsedTime(totalTime)
            })
    }

    function drawForElapsedTime(elapsed) {
        // update transform even after moveTime, because we might only be called once
        var moveRatio = Math.min(1, elapsed/moveTime);
        histGroup.attr("transform", easedTransform(moveRatio));
    }

    this.primaryOpacity = 0.5;
    this.initBinBehaviour();
};

chartObject.initScrolliness=function initScrolliness(options) {
    // adapted from https://github.com/vlandham/scroll_demo/blob/gh-pages/js/sections.js

    // the job of this code is to install a scrollable content zone and a static but resizable visualisation zone that gets kicked whenever the content scrolls to a new section.

    var chart=this; // the whole object - with code for the scroller and the visualisation

    function scroller() {
        // this code adapted from scroller() function by Jim Vallandingham:
        // https://github.com/vlandham/scroll_demo/blob/gh-pages/js/scroller.js
        // (as found in http://vallandingham.me/scroll_demo/ on 19 March 2017)

        /**
        * scroller - handles the details
        * of figuring out which section
        * the user is currently scrolled
        * to.
        *
        */

        var container = d3.select('body'); // until told otherwise
        // event dispatcher
        var dispatch = d3.dispatch('active', 'progress', 'size'); // ael added size

        // d3 selection of all the
        // text sections that will
        // be scrolled through
        var sections = null;

        // array that will hold the
        // y coordinate of each section
        // that is scrolled through
        var sectionPositions = [];
        var currentIndex = -1;  // somewhat redundantly tracked both here and by the stepController
        // the following are used to switch on and off the inline scrolling of the viz.
        var containerTop, containerMaxScroll, visScrollState = null;

        var navHeight = d3.select("nav").node().getBoundingClientRect().height;
        var heightMargin = navHeight+50;
        var switchPos = 200+navHeight;  // how far from the top we switch in a new section
        var stickPoint = 10+navHeight
        var textMargin = 10;  // NB: tied to scrolly.css

        var visSeln = null;
        // ael - permissible vis and text extents
        var visMinExtent, visMaxExtent, textMinWidth, textMaxWidth;

        /**
        * scroll - constructor function.
        * Sets up scroller to monitor
        * scrolling of stepElems selection.
        *
        * @param stepElems - d3 selection of
        *  elements that will be scrolled
        *  through by user.
        */
        function scroll(stepElems, visElem) {
            sections = stepElems;
            visSeln = visElem;

            stepElems.style('opacity', (d,i)=>i===0? 1 : 0.1);  // first section shown fully, rest faded out

            // when window is scrolled call
            // position. When it is resized
            // call resize.
            d3.select(window)
              .on('scroll.scroller', throttledPosition)
              .on('resize.scroller', debouncedResize);

            // hack to get resize (and hence position)
            // to be called once for
            // the scroll position on
            // load.
            var timer = d3.timer(function () {
                resize();
                timer.stop();
                });
        }

        /**
        * resize - called on load, and
        * also when page is resized.
        * Resizes the vis and the text as needed,
        * then recalculates sectionPositions and
        * calls position() to figure out where
        * the window now is.
        *
        */
        function resize() {
            // ael: first figure out what size we're going to give the text and vis.

            // we rely on the page's base css to define the width of #scrolly.
            // vis gets height of window, up to its visMaxExtent.y, unless the proportionally scaled width would leave less than textMinWidth for the text column.
            // i.e., subject to the min vis extent, we want the vis to be the smaller of:
            //    leaving width of at least textMinWidth (which includes a narrow gutter, specified as #sections.margin-right)
            //    fitting into the window height.

            var divWidth = d3.select("#scrolly").node().getBoundingClientRect().width;
            d3.select("#sections").style("padding-left", "0px");
            var visRatio = visMaxExtent.x / visMaxExtent.y;
            var visMinWidth = Math.max(visMinExtent.x, visRatio*visMinExtent.y);

            var textLimitedMaxWidth = divWidth - textMinWidth;
            var heightLimitedMaxWidth = visRatio * (window.innerHeight - heightMargin);
            var visWidth = Math.max(visMinWidth, Math.min(visMaxExtent.x, Math.min(textLimitedMaxWidth, heightLimitedMaxWidth)));
            var visHeight = visWidth / visRatio;
            var textWidth = Math.max(textMinWidth, Math.min(textMaxWidth, divWidth - visWidth));

            textWidth = textWidth | 0;
            d3.select("#sections").style("width", textWidth-textMargin+"px"); // margin is supplementary to width value
            visWidth = visWidth | 0;
            visHeight = visHeight | 0;
            visSeln.style("width", visWidth+"px").style("height", visHeight+"px");

            var marginNeeded = Math.max(0, Math.floor((divWidth - visWidth - textWidth)/2));
            d3.select("#sections").style("padding-left", marginNeeded+"px");
            visSeln.style("padding-right", marginNeeded+"px");

            dispatch.call('size', this, { x: visWidth, y: visHeight });

            var lastSection = sections.nodes()[sections.size()-1];
            d3.select(lastSection).style("padding-bottom", "0px").style("margin-bottom", "50px");

            // give the page some time to reflow before we measure section positions
            setTimeout(function() {
                // sectionPositions will be each section's
                // starting position relative to the top
                // of the first section.
                sectionPositions = [];
                var startPos;
                sections.each(function (d, i) {
                  var top = this.getBoundingClientRect().top;
                  if (i === 0) startPos = top;
                  sectionPositions.push(top - startPos);
                });

                // for the scrolly container, record its top (in page coords) and the max scroll distance during the interactive phase
                var containerRect = container.node().getBoundingClientRect();
                containerTop = containerRect.top + window.pageYOffset; // px from top of page
                containerMaxScroll = containerRect.height - visHeight;

                visScrollState = null;  // force re-layout

                position();
                }, 250);
        }
        var debouncedResize = lively.lang.fun.debounce(500, resize);

        /**
        * position - get user's current position.
        * if user has scrolled to new section,
        * dispatch active event with new section
        * index.
        *
        * ael: original logic wasn't coping with sections of
        * different lengths.  we now switch to a section when
        * its start comes within a specified distance (switchPos)
        * of the viewport top.
        *
        */
        function position() {
            // reject any position() prior to a resize(), which takes crucial measurements.
            if (!containerTop) return;

            var pos = window.pageYOffset - containerTop; // pos of top of visible region relative to start of scrolly

            var unstickPoint = containerMaxScroll-stickPoint;
            var newState = pos < -stickPoint ? "before" : (pos > unstickPoint ? "after" : "during");
            var isDuring = newState==="during";
            visSeln
                .style("position", isDuring ? "fixed" : null)
                .style("float", isDuring ? null : "right")
                .style("top", isDuring ? stickPoint+"px" : null)
                .style("left", isDuring ? (d3.select("#sections").node().getBoundingClientRect().right+textMargin+1+"px") : null)
                .style("padding-top", isDuring ? null : (newState==="before" ? "0px" : (containerMaxScroll+"px")) );
            visScrollState = newState;

            var sectionIndex = Math.max(0, d3.bisect(sectionPositions, pos+switchPos)-1);

            if (currentIndex !== sectionIndex) {
              dispatch.call('active', this, sectionIndex);
              currentIndex = sectionIndex;
            }

            // NB: no "progress" calls will be made for the very last section
            var sectionTop = sectionPositions[sectionIndex], sectionLength = (sectionIndex<sectionPositions.length-1) ? sectionPositions[sectionIndex+1]-sectionTop : Infinity;
            var belowSectionTop = pos + switchPos - sectionTop;
            if (belowSectionTop > 0) dispatch.call('progress', this, currentIndex, belowSectionTop/sectionLength);
        }

        // augmented version of lively.lang.fun.throttle, for coping if the browser is too busy to service its setTimeout queue.  the events from a scroll gesture on a MacBook trackpad seem to induce such issues, at least in Chrome.
        // the standard throttle uses debounce to clear the throttling flag when the incoming events idle - at which point we're presumably safe in assuming that the setTimeout will be scheduled as it should.
        function highRateThrottle (func, wait) {
            var context, args, timeout, throttling, more, result, timeoutSet, whenDone = lively.lang.fun.debounce(wait, function () {
                    more = throttling = false;
                });
            return function () {
                context = this;
                args = arguments;
                var later = function () {
                    timeout = timeoutSet = null;
                    if (more)
                        func.apply(context, args);
                    whenDone();
                };
                if (!timeout) {
                    timeoutSet = Date.now(); // added
                    timeout = setTimeout(later, wait);
                }
                if (throttling) {
                    more = true;
                    // added code.  if the timeout should have triggered by now, do it manually.
                    if (timeoutSet && (Date.now()-timeoutSet > wait)) {
                      clearTimeout(timeout);
                      later();
                    }

                } else {
                    result = func.apply(context, args);
                }
                whenDone();
                throttling = true;
                return result;
            };
        }
        var throttledPosition = highRateThrottle(position, 100);

        /**
        * container - get/set the parent element
        * of the sections. Useful for if the
        * scrolling doesn't start at the very top
        * of the page.
        *
        * @param value - the new container value
        */
        scroll.container = function (value) {
            if (arguments.length === 0) {
              return container;
            }
            container = value;
            return scroll;
        };

        // @v4 There is now no d3.rebind, so this implements
        // a .on method to pass in a callback to the dispatcher.
        scroll.on = function (action, callback) {
            dispatch.on(action, callback);
        };

        // ael added
        scroll.setVisExtents = function(options) {
            visMinExtent = options.visMinExtent;
            visMaxExtent = options.visExtent;
            textMinWidth = options.textMinWidth;
            textMaxWidth = options.textMaxWidth;

            return scroll;
        }

        scroll.resetLastIndex = function() { currentIndex = -1 }

        scroll.sectionTop = function(sectionIndex) {
            return window.scrollY + sections.nodes()[0].getBoundingClientRect().top + sectionPositions[sectionIndex] - stickPoint;
        }

        return scroll;
    }


    // scrollVis sets up the visualisation control structure, using a scroller created with the function above
    /**
     * scrollVis - encapsulates
     * all the code for the visualization
     * using reusable charts pattern:
     * http://bost.ocks.org/mike/chart/
     *
     * ael: augmented...
     */
    var scrollVis = function (stepDefs, initFnName, refreshFnName) {
        // When scrolling to a new section
        // the activationFunction for that
        // section is called.

        // If a section has an updateFunction
        // then it is called while scrolling
        // through the section with the current
        // progress through the section.

        // When the section to be activated is earlier than the current section,
        // the refreshFunction is invoked, then activation proceeds forwards from
        // the most recent step with the tag replayPoint.

        // ael; margin disabled, for now
        //var margin = { top: 0, left: 20, bottom: 40, right: 10 };

        var activateFunctions = stepDefs.map(def=>def.activate);
        var updateFunctions = stepDefs.map(def=>def.update);

        // Keep track of which visualization
        // we are on and which was the last
        // index activated. When user scrolls
        // quickly, we want to call all the
        // activate functions that the scroll passes.
        var lastIndex = -1;
        var activeIndex = 0;

        var chartObj;
        function refreshChart() { chartObj[refreshFnName].call(chartObj) }

        /**
        * stepController (was chart in original code) - constructor function
        *
        * @param divSeln - the d3 selection
        *  to draw the visualization in.
        */
        var stepController = function (divSeln, ch, extent) {
            chartObj = ch;
            // for now, no margin taken into account.
            // the div will be resized, if necessary, by the scroller object.
            //var extent = { x: width + margin.left + margin.right, y: height + margin.top + margin.bottom };
            divSeln.style("width", extent.x+"px").style("height", extent.y+"px");
            chartObj[initFnName].call(chartObj, divSeln, extent);
        };

        // find the most recent index - at or before "start" - that has the replayPoint tag
        function restartIndex(start) {
            var index = start;
            while (index>0 && !(stepDefs[index].replayPoint)) index--;
            return index;
        }

        /**
        * activate - [reworked by ael]
        *
        * @param index - index of the activated section
        * @param options - (ael added)
        *                   replay: force replay (even if index is same as before), from
        *                       most recent replayPoint
        */
        stepController.activate = function (index, options) {
            var replay = options && options.replay;
            if (index===lastIndex && !replay) return;  // nothing to do

            var originIndex = lastIndex;
            var startIndex = originIndex; // unless there's a restart point along the way
            if (index <= lastIndex || lastIndex===-1) {  // jump backwards, replay, or page load
                refreshChart();
                startIndex = restartIndex(index)-1;
                lastIndex = null;   // for steps that care which step was last rendered
            }

            /*
            activate each relevant section in turn.
            the activation function might need to distinguish among all the following conditions:
                1. orderly transition from previous state to here
                2a/b. fast visit on the way to somewhere ahead, either starting (a) here or (b) earlier
                3. forwards jump ending here
                4a/b. replay (or jump backwards) ending here, starting (a) here or (b) earlier

            if we provide just arguments previousRenderedIndex, targetIndex (and thisIndex), the conditions are:
                1 = n-1, n
                2a = null, n+m
                2b = n-1, n+m
                3 = n-1, n
                4a = null, n
                4b = n-1, n

            1, 3 and 4b are indistinguishable, so all treated as smooth transitions from previous step.  not ideal.
            so add one more argument: originIndex (the last fully displayed index, or -1 if this is a page reload).
            */

            var scrolledSections;
            if (startIndex===index) scrolledSections = [index];
            else scrolledSections = d3.range(startIndex + 1, index + 1); // non-inclusive end
            var first = scrolledSections[0], last = scrolledSections[scrolledSections.length-1];
//console.log("from "+first+" to "+last);
            var prevRendered = lastIndex;
            scrolledSections.forEach(function (i) {
//console.log("step:", prevRendered, last, i);
                var f = activateFunctions[i];
                if (f) {
                    f(chart, originIndex, prevRendered, last, i);
                    prevRendered = i;
                }
                });

            lastIndex = activeIndex = index;
        };

        /**
        * update
        *
        * @param index
        * @param progress
        */
        stepController.update = function (index, progress) {
            var f = updateFunctions[index];
            if (f) f(chart, progress);
        };

        stepController.activeIndex = function() { return activeIndex }

        stepController.resetLastIndex = function() { lastIndex = -1 }

        // return stepController function
        return stepController;
    };

    // set up scroll functionality on the #scrolly div - which contains a #sections div for the scrollable text sections, and (typically) a #vis div for the arbitrarily updatable plot

    var stepDefs = options.stepDefinitions;
    chart.commandList = stepDefs.map(function(def) { return { command: def.command, replayable: !!def.replayable } });

    chart.visMaxExtent = options.visExtent;

    var visSeln = d3.select("#"+options.element);

    // first create a new stepController and its plot, initially displayed at full extent
    var stepController = scrollVis(stepDefs, "initChartSubstrates", "initChartSubgroups");
    stepController(visSeln, chart, options.visExtent);

    // now set up the scroll functionality on the outer div
    var scroll = scroller()
        .container(d3.select('#scrolly'))
        .setVisExtents(options);

    chart.maximumScrolledIndex = -1; // ael - HACK

    // jumping to an index (not through scrolling)
    chart.activateStep = function(index) {
        // 2nd activate() arg forces replay if index hasn't changed
        stepController.activate(index, { replay: true });
        chart.drawCommandList(index);
        }

    chart.jumpToStep = function(index) {
        var oldIndex = stepController.activeIndex();
        var sectionTop = scroll.sectionTop(index);
        window.scrollTo(0, sectionTop);
        // force replay iff index hasn't changed
        if (index===oldIndex) {
            stepController.activate(index, { replay: true });
            chart.drawCommandList(index);
        }
    }

    // replaying to current position from nearest step tagged "replayPoint" (or 0 if none)
    chart.replaySteps = function() {
        var index = stepController.activeIndex();
        stepController.activate(index, { replay: true });
        chart.drawCommandList(index)
        }

    // ael added
    scroll.on('size', function(extent) {
        chart.stopTimer();  // abandon anything that was running
        chart.resizeChartSubstrates(visSeln, extent);
        scroll.resetLastIndex();
        stepController.resetLastIndex();
        });

    // set up event handling for scrolling.  this is called through a throttled handler.
    scroll.on('active', function (index) {
        // highlight current step text
        d3.selectAll('.step')
          .style('opacity', function (d, i) { return i === index ? 1 : 0.1; });

        chart.lastScrolledIndex = index; // ael - for the moving hand
        if (index > chart.maximumScrolledIndex) chart.maximumScrolledIndex = index;

        // activate current section (and intermediates along the way)
        stepController.activate(index);
        chart.drawCommandList(index);
        });

    scroll.on('progress', function (index, progress) {
        stepController.update(index, progress);
        });

    // pass in .step selection as the steps.  triggers the first position and resize calls, based on loaded page state.
    scroll(d3.selectAll('.step'), visSeln);

    chart.loadData(options.dataset);
};

chartObject.iterate=function iterate(values, fn) {
    // we used to have a delay argument, for iterating at a specified rate.  now just store the results for some other function to display.
    var chart=this;

    values.forEach(v=>{
        fn(v);
        chart.scenarioRecords.push({ value: v, bins: chart.duplicateBins() });
        });
};

chartObject.loadData=function loadData(dataset, thenDo) {
    var rawData = [], quantum = 1, binQuantum, units = "", minBins = 8, maxBins = 50;
    this.datasetShortDescriptions = {
        MPG: "fuel consumption (in mpg)<br/>for 32 car models",
        NBA: "age (in years)<br/>for 105 NBA athletes",
        Geyser: "272 records of delay (in seconds)<br/>between eruptions of Old Faithful",
        Diamonds: "price (in US$)<br/>for 1000 diamonds",
        Marathons: "finishing time (in hours)<br/>for 3000 NY marathon runners"
    }
    var chart=this;
    function recordData() {
        chart.dataName = dataset;
        chart.dataUnits = units;
        chart.dataMin = lively.lang.num.roundTo(d3.min(rawData), quantum);
        chart.dataMax = lively.lang.num.roundTo(d3.max(rawData), quantum);
        chart.dataRange = chart.dataMax - chart.dataMin;
        chart.xScale = d3.scaleLinear()
        					.domain([chart.dataMin, chart.dataMax])
        					.range([0, chart.numberLineWidth]);
        // dataQuantum is the precision with which the values have been measured
        chart.dataQuantum = quantum;
        // dataBinQuantum is the precision permissible in setting bin widths (typically same as dataQuantum, but can be overridden in the data setup)
        chart.dataBinQuantum = binQuantum || quantum;
        // dataDecimals, derived from the quantum, is the precision to be used in displaying values.
        chart.dataDecimals = quantum >= 1 ? 0 : (quantum >= 0.1 ? 1 : 2);
        chart.dataBinDecimals = chart.dataBinQuantum >= 1 ? 0 : (quantum >= 0.1 ? 1 : 2);
        delete chart.poolValueEntries;
        // may 2017: for now, these are only used in the last stage of the essay
        chart.minBinsOverRange = minBins;
        chart.maxBinsOverRange = maxBins;
        chart.scenarioRecords = [];

        // quick hack to support an efficient bag-like collection for the data
        var values = [], counts = {};
        rawData.forEach(v => {
            var count = counts[v];
            if (count===undefined) { values.push(v); count = 0 };
            counts[v] = ++count;
            });
        var data = { values: values.sort((a,b)=>a-b), counts: counts, length: rawData.length };
        data.filter = (function(f) {
            var subset = {};
            subset.collection = f===null ? this.values : this.values.filter(f);
            var total = 0;
            subset.collection.forEach(uv=>total+=this.counts[uv]);
            subset.length = total;
            subset.toString = function() { return "{"+this.length+"}"};
            subset.forEach = function(f) {
                var i=0;
                this.collection.forEach(uv=>{
                    var count = data.counts[uv];
                    for (var subI=0; subI<count; subI++) f(uv, i+subI);
                    i+=count;
                    })
                };
            return subset;
            });
        data.valuesAndCountsDo = function(f) {
            this.values.forEach(uv=>f(uv, this.counts[uv]));
            };
        data.allData = data.filter(null);
        data.forEach = function(f) { this.allData.forEach(f) };

        chart.data = data;

        var valueScale = d3.scaleLinear().domain([chart.dataMin, chart.dataMax]);
        var colourInterpolator = d3.interpolateHcl("#5086FE", "#FD2EA7");
        chart.colourScale = function(val, opacity) { var c = d3.color(colourInterpolator(valueScale(val))); c.opacity = opacity; return c.toString() };

        if (thenDo) thenDo();
    }

    switch(dataset) {
        case "marathons":
            // a subset of nyc marathon finishing times
            d3.csv("data/sampled-marathon-times.csv", row=>Number(row.x), function(d) {
                rawData=d;
                quantum=0.001;
                binQuantum = 0.02;
                minBins = 15;
                maxBins = 150;
                units = "hours";
                recordData();
                });
            return;
        case "diamonds":
            // a subset of prices from the ggplot2 diamonds dataset
            d3.csv("data/sampled-diamonds-price-small.csv", row=>Number(row.x), function(d) {
                rawData=d;
                quantum=1;
                binQuantum = 5;
                minBins = 15;
                maxBins = 45;
                units = "US$";
                recordData();
                });
            return;

        case "nba":
            // from chatterjee et al 1992-3 nba player ages http://people.stern.nyu.edu/jsimonof/Casebook/Data/ASCII/nba.dat
            rawData = [28, 30, 26, 30, 28, 31, 30, 27, 29, 24, 27, 29, 24, 30, 28, 32, 25, 29, 34, 23, 32, 28, 28, 23, 32, 27, 34, 26, 30, 30, 23, 31, 28, 27, 25, 32, 29, 34, 28, 23, 26, 30, 32, 27, 27, 25, 24, 27, 25, 27, 31, 30, 25, 26, 33, 24, 26, 31, 24, 27, 28, 22, 30, 31, 23, 25, 31, 33, 28, 37, 28, 24, 34, 24, 28, 33, 23, 26, 28, 26, 25, 25, 26, 25, 27, 35, 31, 25, 30, 24, 23, 23, 27, 27, 25, 24, 24, 23, 23, 26, 24, 23, 32, 24, 27];
            quantum = 1;
            binQuantum = 0.1;
            units = "years";
            break;

        case "geyser":
            // eruption times from R sample dataset https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/faithful.html (ne60, adjusted and rounded as described on that page)
            rawData = [216, 108, 200, 137, 272, 173, 282, 216, 117, 261, 110, 235, 252, 105, 282, 130, 105, 288, 96, 255, 108, 105, 207, 184, 272, 216, 118, 245, 231, 266, 258, 268, 202, 242, 230, 121, 112, 290, 110, 287, 261, 113, 274, 105, 272, 199, 230, 126, 278, 120, 288, 283, 110, 290, 104, 293, 223, 100, 274, 259, 134, 270, 105, 288, 109, 264, 250, 282, 124, 282, 242, 118, 270, 240, 119, 304, 121, 274, 233, 216, 248, 260, 246, 158, 244, 296, 237, 271, 130, 240, 132, 260, 112, 289, 110, 258, 280, 225, 112, 294, 149, 262, 126, 270, 243, 112, 282, 107, 291, 221, 284, 138, 294, 265, 102, 278, 139, 276, 109, 265, 157, 244, 255, 118, 276, 226, 115, 270, 136, 279, 112, 250, 168, 260, 110, 263, 113, 296, 122, 224, 254, 134, 272, 289, 260, 119, 278, 121, 306, 108, 302, 240, 144, 276, 214, 240, 270, 245, 108, 238, 132, 249, 120, 230, 210, 275, 142, 300, 116, 277, 115, 125, 275, 200, 250, 260, 270, 145, 240, 250, 113, 275, 255, 226, 122, 266, 245, 110, 265, 131, 288, 110, 288, 246, 238, 254, 210, 262, 135, 280, 126, 261, 248, 112, 276, 107, 262, 231, 116, 270, 143, 282, 112, 230, 205, 254, 144, 288, 120, 249, 112, 256, 105, 269, 240, 247, 245, 256, 235, 273, 245, 145, 251, 133, 267, 113, 111, 257, 237, 140, 249, 141, 296, 174, 275, 230, 125, 262, 128, 261, 132, 267, 214, 270, 249, 229, 235, 267, 120, 257, 286, 272, 111, 255, 119, 135, 285, 247, 129, 265, 109, 268];
            quantum = 1;
            units = "seconds";
            break;

        default:
        case "mpg":
            // mpg entries from the R mtcars dataset https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/mtcars.html
            // FUDGED to remove the identical values (see raw-mpg below for original set)
            rawData = [21.0, 21.1, 22.8, 21.4, 18.7, 18.1, 14.3, 24.4, 22.9, 19.2, 17.8, 16.4, 17.3, 15.3, 10.4, 10.5, 14.7, 32.4, 30.4, 33.9, 21.5, 15.5, 15.2, 13.3, 19.3, 27.3, 26.0, 30.5, 15.8, 19.7, 15.0, 21.3];
            quantum = 0.1;
            units = "mpg";

    }

    recordData();
};

chartObject.loadLibs=function loadLibs() {
    //Global.JSLoader.loadJs('core/lib/d3/d3.v4.js');
    //Global.JSLoader.loadJs('https://d3js.org/d3.v4.min.js');
    Global.JSLoader.loadJs('https://d3js.org/d3.v4.js');
};

chartObject.pointerImageFlipped=function pointerImageFlipped() {
    // base64 for a PNG with a friendly left-hand pointer
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAnCAQAAAAiX0mDAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAAmJLR0QAAKqNIzIAAAAJcEhZcwAAFiUAABYlAUlSJPAAAAQ8SURBVEjHnZZNbFRVFMd/575XZqa2FiiUgtBKQIlSP7AVowZCCDEsTIiSsMAFyILEGBcsiLsaYSEuxOBHYpo0kLgjGo0fuKEaWaBBvkREIRT5DFJAaSmdaWfe/buYN6/ttFMq52Uy99537++dc+4591zj/4hhcUvx757EcASssR/cUXZSh0uw9wAKWYuv908I2edMIbg3mBFSF1xt8jckbZR5GqjCjZziJglyBKyPGrdbPfA0MprLtZocChxV9soMrQdgCkCm3FuT12oqz71sIQB/A9wqX3t3lMXmPSVbHg+dwmW5jo0IDiAcZynJBANm04bnBEugNR4+JJ1C8TOBDgEP0OGOBYfpZD5vWh4hl+VM2hckSVeF6GAW942jyAgzqqgLzqFn1CaT60HP6xvt1YMetakoe4V4lZlUE4yvSxN7w9N8ybuoU5L0qRDqliR9IrQpRr0u8zzGdNJjPW0EpNyvgV+mjEfO35EkXRNqjIrLdwu9H6MWefc7TUwjQ4gbDgkXo1r84+12gH0GC6kGoIG0FsTfHQAWx4Fw2vxPwLqgK7gSfM/KEi6MUXOgBVjBQyxJNniVLY5bTczgSQB+AfjTdmvlLLXagZl93+lFuvComF01vIS+kCT1KaeJZJuQnUNblJN0SVO9dZEmwFwcy4kDa0lNGLEnAc3fyU5SwFyWWfAIVcMoA/B3DXyAM8AmtsS9fg5Jlwlxw4nTD73J9Av0AXCZmwDcJJu8u6JH9VHS28I1izpLe2hMoY6laEfij7naLElq0TpJ0mJtSN79pp6k3SnEVzQzjTQuBIToMX8x8ddtBkf993Mr0aMlaR3mNblu306eCF8yUAwGF09Oylcl6WetogH/BrcYooBHrpThhWMHdaPCsj5qx4y1c9Gids6SY7CEAuGJ+KxgH1RA+TF5e5Rdsh/5liw58kSoaGARddBOvKdzkzIuYrMY1HZy5ErmlXzlKZDXW7lojQYmgXqbI+Y/5DxZBskXQcNaFRjihN920rYCNcVCQIoMANWkR4A62I79zJ4YFI0+SR0p6pjDItuPjqtb/0iSzuqaJKlbvUksdcjJnaKVJurJEJaXVSMkQz3NvIC2TpDMO4TcHyxnPg3UlBfVkl5V1NLIwvDGGklSl+r8w/7SKNDHQsERnmUBjdxPavx7gxGQZjpNVd0rJP2rZh/0WrRKfgSqxbu/aGUhs6krHiwjEaWaITyeAgXf0MseOrlgvMOi/Rs3sDo+VeE8/gy3GSBbCstKexxSwzy7g5BF7KKNpXyd1Lvis495TB/P3YwaCEiRYRbN1NLDdTwQ0Ex9rFZEnuNcYYAhCmM1Go0KSVNNihBRIAJCQkIchogYIhunyjjn5Mj6KjxDGHkcIiKKL2hBjCoG8lB5UFZCFRBB3Bbg4tJkgMcTFc+m8cTKesO3k+LVonxkgkuHVfiAKs6oGAD/AYvOeA4WBzKmAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDE3LTAzLTMwVDAyOjQxOjQ1KzAyOjAwrFD4gwAAACV0RVh0ZGF0ZTptb2RpZnkAMjAxNy0wMy0zMFQwMjo0MTo0NSswMjowMN0NQD8AAAAASUVORK5CYII="
};

chartObject.prepareScenarioZone=function prepareScenarioZone(rectObj) {
    var chart=this;

    this.chartGroup.append("rect")
        .attr("class", "scenariozone")
        .attr("stroke-dasharray", "6 8")
        .attr("x", rectObj.left)
        .attr("y", rectObj.top)
        .attr("width", rectObj.width)
        .attr("height", rectObj.height)
        .style("stroke", "green")
        .style("fill-opacity", 1e-6)
        .on("mouseover", ()=>chart.slowScenarioCycles=true)
        .on("mouseout", ()=>chart.slowScenarioCycles=false);

    this.slowScenarioCycles = false;
};

chartObject.resizeChartSubstrates=function resizeChartSubstrates(divSeln, newExtent) {

    this.chartSVG.attr("width", newExtent.x).attr("height", newExtent.y);

    var ratio = newExtent.x/this.visMaxExtent.x;
    this.sizeRatio = ratio;

    var ratioPercent = Math.round(ratio*100), baseFontSize = 12, margin = 4/ratio;
    var scaleIndicator = this.chartSVG.selectAll("text.scaleIndicator").data([ratioPercent]);
    scaleIndicator.enter().append("text")
        .attr("class", "scaleIndicator")
        .attr("x", this.visMaxExtent.x-margin)
        .attr("y", margin)
		.attr("dy", this.textOffsets.hanging)
        .style("fill", "#aaa")
        //.style("dominant-baseline", "hanging")
        .style("text-anchor", "end")
        .style("pointer-events", "none")
        .style('-webkit-user-select','none')
      .merge(scaleIndicator)
        .style("font-size", Math.floor(baseFontSize/ratio)+"px")
        .text(d=>"(vis scale: "+d+"%)");

    var bbox = this.chartSVG.select("text.scaleIndicator").node().getBBox(), left = bbox.x, bottom = bbox.y+bbox.height, pad = 4/ratio;
    var indicatorFence = this.chartSVG.selectAll("line.indicatorFence").data([
        { x1: left-pad, y1: 0, x2: left-pad, y2: bottom+pad },
        { x1: left-pad, y1: bottom+pad, x2: this.visMaxExtent.x, y2: bottom+pad }
        ]);
    indicatorFence.enter().append("line")
        .attr("class", "indicatorFence")
        .style("stroke", "#aaa")
        .style("stroke-width", 1)
        .style("pointer-events", "none")
      .merge(indicatorFence)
        .attr("x1", d=>d.x1)
        .attr("y1", d=>d.y1)
        .attr("x2", d=>d.x2)
        .attr("y2", d=>d.y2);

    var canvas = this.chartCanvas.node(), context = canvas.getContext("2d");
    canvas.width = newExtent.x;
    canvas.height = newExtent.y;
    context.scale(1,1);
    context.scale(ratio, ratio);

    canvas = this.chartFixedCanvas.node(), context = canvas.getContext("2d");
    canvas.width = newExtent.x;
    canvas.height = newExtent.y;
    context.scale(1,1);
    context.scale(ratio, ratio);
};

chartObject.rPretty=function rPretty(range, n, internal_only) {
    // this.rPretty([0,56],5,true)
    // from https://gist.github.com/Frencil/aab561687cdd2b0de04a
/**
 * Generate a "pretty" set of ticks (multiples of 1, 2, or 5 on the same order of magnitude for the range)
 * Based on R's "pretty" function:
 * https://github.com/wch/r-source/blob/b156e3a711967f58131e23c1b1dc1ea90e2f0c43/src/appl/pretty.c
 * Arguments:
 *  range (required) :: Two-element array representing the range for the ticks to cover
 *  n     (optional) :: A "target" number of ticks; will not necessarily be the number of ticks you get (default: 5)
 *  internal_only (optional) :: Boolean for whether to only return ticks inside the provided range (default: false)
 */

  if (typeof n == "undefined" || isNaN(parseInt(n))){
    n = 5;
  }
  n = parseInt(n);
  if (typeof internal_only == "undefined"){
    internal_only = false;
  }

  var min_n = n / 3;
  var shrink_sml = 0.75;
  var high_u_bias = 1.5;
  var u5_bias = 0.5 + 1.5 * high_u_bias;
  var d = Math.abs(range[0] - range[1]);
  var c = d / n;
  if ((Math.log(d) / Math.LN10) < -2){
    c = (Math.max(Math.abs(d)) * shrink_sml) / min_n;
  }

  var base = Math.pow(10, Math.floor(Math.log(c)/Math.LN10));
  var base_toFixed = 0;
  if (base < 1){
    base_toFixed = Math.abs(Math.round(Math.log(base)/Math.LN10));
  }

  var unit = base;
  if ( ((2 * base) - c) < (high_u_bias * (c - unit)) ){
    unit = 2 * base;
    if ( ((5 * base) - c) < (u5_bias * (c - unit)) ){
      unit = 5 * base;
      if ( ((10 * base) - c) < (high_u_bias * (c - unit)) ){
        unit = 10 * base;
      }
    }
  }

  var ticks = [];
  if (range[0] <= unit){
    var i = 0;
  } else {
    var i = Math.floor(range[0]/unit)*unit;
    i = parseFloat(i.toFixed(base_toFixed));
  }
  while (i < range[1]){
    ticks.push(i);
    i += unit;
    if (base_toFixed > 0){
      i = parseFloat(i.toFixed(base_toFixed));
    }
  }
  ticks.push(i);

  if (internal_only){
    if (ticks[0] < range[0]){ ticks = ticks.slice(1); }
    if (ticks[ticks.length-1] > range[1]){ ticks.pop(); }
  }

  return ticks;
};

chartObject.spaceBifocally=function spaceBifocally(groupSelection, groupObject) {
    // groupObject includes parameters fishItemWidth, fishWidth, focusIndex, and optionally focusItemOffset and linearFocusOffset;
    var chart=this;
    var itemWidth = groupObject.fishItemWidth, fieldWidth = groupObject.fishWidth, focusIndex = groupObject.focusIndex, focusItemOffset = groupObject.focusItemOffset, linearFocusOffset = groupObject.linearFocusOffset;
    var numItems = groupSelection.selectAll(".fishItem").size(), totalWidth = numItems*itemWidth;
//console.log("width = "+fieldWidth+", totalW = "+totalWidth+", num = "+numItems);

    // during dragging, first time through set a preference for fishy or not, then stick to that preference.  preference gets removed as soon as a refresh outwith chart dragging happens.
    var fitsInField = totalWidth <= fieldWidth;
    var groupElement = groupSelection.node();
    if (!chart.isDragging) delete groupElement.fishLock;
    else if (!groupElement.hasOwnProperty("fishLock")) groupElement.fishLock=fitsInField;

    if (groupElement.fishLock===true || (groupElement.fishLock!==false && fitsInField)) {
        var offset = 0;
        if (linearFocusOffset !== undefined) offset = linearFocusOffset;

        groupSelection.selectAll(".fishItem")
            .attr("transform", d=>"translate("+(d.indexInGroup*itemWidth+itemWidth/2+offset)+",0)")
            .style("opacity", 1)
            .each(function(cellItem) {
                var seln = d3.select(this);
                seln.select("text")
                    //.style("opacity", 1)
                    .style("opacity", focusIndex===undefined ? 1 : Math.max(0.15, 1-(0.3*Math.abs(cellItem.indexInGroup-focusIndex))))
                    .style("font-weight", cellItem.indexInGroup===focusIndex ? 600 : "normal")
                    .attr("letter-spacing", "normal");

                if (cellItem.indexInGroup===focusIndex) seln.raise();

                var rectSeln = seln.select("rect");
                if (cellItem.mouseover) rectSeln.on("mouseover", function(cellItem) { cellItem.mouseover.call(this, cellItem) });
                if (cellItem.mouseout) rectSeln.on("mouseout", function(cellItem) { cellItem.mouseout.call(this, cellItem) });
                rectSeln
                    .attr("width", itemWidth)
                    .attr("x", -itemWidth/2)
                    .on("mousemove", null);
            })

        return;
    }

    var xFish = this.bifocalScale(fieldWidth, totalWidth, 3, itemWidth);
    xFish.focus(itemWidth*focusIndex, false);

    var offset = 0;
    if (focusItemOffset !== undefined) {
        // set the offset such that the focus item ends up at that offset relative to the internal field (from middle of first item to middle of last)
        offset = focusItemOffset-xFish(focusIndex*itemWidth);
    }
//console.log("focus index: "+focusIndex+ ", item width: "+itemWidth+", totalWidth: "+totalWidth);

    groupSelection.selectAll(".fishItem")
        .sort(function(a, b) { return Math.abs(b.indexInGroup-focusIndex) - Math.abs(a.indexInGroup-focusIndex) })
        .attr("transform", d=>"translate("+(xFish(d.indexInGroup*itemWidth)+itemWidth/2+offset)+",0)" )
        .style("opacity", 1)
        .each(function(fishItem) {
            var rectSeln = d3.select(this).select("rect");
            var centreX = fishItem.indexInGroup*itemWidth, fishCentre = xFish(centreX);
            var xRatio = xFish(centreX+1)-fishCentre;
            if (xRatio === 0) xRatio = fishCentre-xFish(centreX-1);
            var effectiveWidth = itemWidth*xRatio;
            rectSeln
                .attr("x", -effectiveWidth/2)
                .attr("width", effectiveWidth)
//.style("fill", d.indexInGroup===focusIndex ? "#ddd" : "#eee")
                // each mousable rectangle in the fishy zone reports mousemove to the zone as a whole, which calculates which rectangle (perhaps the same one) would have received the event in a non-compressed rendering.
                // each item responds to mouseout as it would without the fishiness.
                .on("mouseover", null)
                .on("mouseout", function(fishItem) { fishItem.mouseout.call(this, fishItem) })
                .on("mousemove", function(fishItem) {
                    var fishGroupElem = this.parentNode.parentNode;
                    var mouseX = d3.mouse(fishGroupElem)[0], mouseInScaledRegion = mouseX - itemWidth/2;
                    var index = xFish.findItem(mouseInScaledRegion);
                    d3.select(fishGroupElem).selectAll("rect").each(function(siblingItem) {
                        if (siblingItem.indexInGroup===index && siblingItem.mouseover) siblingItem.mouseover.call(this, siblingItem);
                        });
                    });

            var textSeln = d3.select(this).select("text");
            textSeln
                .style("opacity", cellItem=>focusIndex===undefined ? 1 : Math.max(0.15, 1-(0.3*Math.abs(cellItem.indexInGroup-focusIndex))))
                .style("font-weight", cellItem=>cellItem.indexInGroup===focusIndex ? 600 : "normal")
                .attr("letter-spacing", xRatio==1 ? "normal" : "-"+(1-xRatio)+"ex");
            });
};

chartObject.setTimerInfo=function setTimerInfo(timerInfo) {
    if (this.timerInfo) this.stopTimer();

    this.timerInfo = timerInfo;
};

chartObject.startTimer=function startTimer(timerInfo) {
    timerInfo.timer = d3.timer(timerInfo.tick);
    this.setTimerInfo(timerInfo);
};

chartObject.stopTimer=function stopTimer(forceToEnd) {
    if (!this.timerInfo) return;

    var spec = this.timerInfo;
    if (spec.timer) spec.timer.stop();
    if (spec.cleanup) spec.cleanup();
    if (spec.forceToEnd && forceToEnd) spec.forceToEnd();

    delete this.timerInfo;
};

chartObject.svgSource=function svgSource(name) {
    // svg sources (with captions removed) from the Noun Project
    switch (name) {
        case "mpg":
            // Car by Jens Tärning
            // viewBox was 0 0 100 125
            return `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 -5 100 125" enable-background="new 0 0 100 100" xml:space="preserve"><path d="M72,40c0,0-14-13-22-13H32C17,27,1,40,1,44v18.001l6.507,1.858C7.583,57.021,13.145,51.5,20,51.5  c6.903,0,12.5,5.597,12.5,12.5h35c0-6.903,5.597-12.5,12.5-12.5c6.855,0,12.416,5.521,12.493,12.359L99,62V51C99,47,89,42,72,40z   M37,40.931l-24.449-0.843C17.573,36.613,25.016,33,32,33h5V40.931z M43,41.138V33h7c2.853,0,9.49,4.249,15.064,8.899L43,41.138z"/><circle cx="20" cy="64" r="8.5"/><circle cx="80" cy="64" r="8.5"/></svg>`

        case "nba":
            // Basketball by Andrey Vasiliev
            return `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 100 125" enable-background="new 0 0 100 100" xml:space="preserve"><path d="M83.259,21.384h13.824c1.014,0,1.835-0.821,1.835-1.834c0-1.014-0.821-1.834-1.835-1.834H83.259  c-1.013,0-1.833,0.82-1.833,1.834C81.426,20.562,82.246,21.384,83.259,21.384z"/><path d="M83.259,30.162h6.912c1.015,0,1.836-0.821,1.836-1.834c0-1.014-0.821-1.834-1.836-1.834h-6.912  c-1.013,0-1.833,0.82-1.833,1.834C81.426,29.341,82.246,30.162,83.259,30.162z"/><path d="M97.083,35.273H83.259c-1.013,0-1.833,0.822-1.833,1.833c0,1.014,0.82,1.834,1.833,1.834h13.824  c1.014,0,1.835-0.821,1.835-1.834C98.918,36.095,98.097,35.273,97.083,35.273z"/><path d="M16.741,17.716H2.917c-1.014,0-1.834,0.82-1.834,1.834c0,1.013,0.82,1.834,1.834,1.834h13.824  c1.013,0,1.833-0.821,1.833-1.834C18.574,18.536,17.754,17.716,16.741,17.716z"/><path d="M16.741,26.494H9.829c-1.014,0-1.836,0.82-1.836,1.834c0,1.013,0.822,1.834,1.836,1.834h6.912  c1.013,0,1.833-0.821,1.833-1.834C18.574,27.314,17.754,26.494,16.741,26.494z"/><path d="M16.741,35.273H2.917c-1.014,0-1.834,0.822-1.834,1.833c0,1.014,0.82,1.834,1.834,1.834h13.824  c1.013,0,1.833-0.821,1.833-1.834C18.574,36.095,17.754,35.273,16.741,35.273z"/><path d="M75.462,29.212C75.462,15.172,64.04,3.75,50,3.75c-14.04,0-25.461,11.422-25.461,25.462  c0,12.807,9.513,23.405,21.838,25.173c-0.512,0.683-0.82,1.512-0.82,2.413v10.97c-1.66,0.5-2.904,1.535-3.572,3.074  c-2.343,5.406,3.208,15.792,4.874,18.701l-1.477,6.267c-0.233,0.986,0.377,1.973,1.364,2.206c0.142,0.034,0.282,0.05,0.422,0.05  c0.831,0,1.585-0.569,1.784-1.413l1.644-6.98c0.11-0.464,0.034-0.953-0.21-1.364c-2.687-4.482-6.429-12.795-5.036-16.009  c0.052-0.12,0.122-0.242,0.206-0.362v0.511c0,1.013,0.822,1.835,1.834,1.835c1.014,0,1.835-0.822,1.835-1.835V56.798  c0-0.243,0.301-0.513,0.734-0.513c0.432,0,0.733,0.27,0.733,0.513v6.673v4.062v4.914c0,1.013,0.822,1.835,1.835,1.835  s1.833-0.822,1.833-1.835v-4.914v-4.062c0-0.243,0.302-0.515,0.735-0.515c0.43,0,0.732,0.271,0.732,0.515v1.855v4.163v1.856  c0,1.013,0.82,1.834,1.835,1.834c1.011,0,1.833-0.821,1.833-1.834v-1.856v-4.163c0-0.243,0.301-0.515,0.734-0.515  c0.432,0,0.733,0.271,0.733,0.515v2.814v3.007v0.198c0,1.013,0.82,1.834,1.834,1.834c1.013,0,1.834-0.821,1.834-1.834v-0.198v-3.007  c0-0.244,0.3-0.515,0.733-0.515c0.432,0,0.734,0.271,0.734,0.515v3.007c0,0.036,0,0.074,0.002,0.111l0.271,4.401  c0.004,0.062,0.012,0.124,0.021,0.186c0.009,0.055,0.855,5.476-2.508,10.988c-0.179,0.296-0.272,0.635-0.267,0.979l0.108,8.44  c0.013,1.006,0.831,1.811,1.834,1.811c0.008,0,0.017,0,0.023,0c1.012-0.013,1.823-0.844,1.81-1.857l-0.101-7.926  c3.522-6.122,2.861-12.032,2.735-12.926l-0.262-4.266v-2.949c0-2.306-1.976-4.182-4.402-4.182c-0.331,0-0.65,0.041-0.96,0.106  c-0.567-1.688-2.214-2.921-4.175-2.921c-0.476,0-0.925,0.09-1.354,0.223c-0.766-1.237-2.166-2.08-3.781-2.08  c-0.252,0-0.495,0.033-0.735,0.071v-2.561c0-0.896-0.304-1.722-0.81-2.402C65.911,52.659,75.462,42.043,75.462,29.212z M28.3,31.046  h10.332c-0.369,4.574-2.155,8.859-5.141,12.352C30.583,40.017,28.694,35.744,28.3,31.046z M33.443,15.079  c2.992,3.474,4.793,7.736,5.183,12.299H28.3C28.692,22.704,30.561,18.451,33.443,15.079z M71.7,27.378H61.374  c0.39-4.563,2.19-8.826,5.184-12.3C69.44,18.45,71.309,22.704,71.7,27.378z M57.707,27.378h-5.872V7.511  c4.589,0.385,8.778,2.188,12.12,4.982C60.285,16.666,58.11,21.839,57.707,27.378z M48.166,27.378h-5.873  c-0.404-5.538-2.578-10.712-6.249-14.885c3.342-2.795,7.532-4.597,12.121-4.982V27.378z M42.299,31.046h5.867v19.866  c-4.564-0.383-8.735-2.166-12.068-4.934C39.758,41.787,41.917,36.591,42.299,31.046z M51.835,31.046H57.7  c0.383,5.545,2.541,10.741,6.202,14.933c-3.334,2.768-7.504,4.55-12.067,4.933V31.046z M61.368,31.046H71.7  c-0.394,4.699-2.283,8.971-5.191,12.352C63.522,39.905,61.736,35.62,61.368,31.046z"/></svg>`

        case "marathons":
            // derived from run by Hopkins
            // viewBox was 0 0 517.5 721.8
            // 517.5*1.25 646.875
            // 721.8*1.25 902.25
            // and then flip x and shift (transform was "translate(-116,-342)")
            return `
<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="-50 -50 647 902" version="1.1" x="0px" y="0px"><g transform="translate(647,-342) scale(-1,1)"><path style="" d="m 459.16425,341.81003 a 63.799577,63.799577 0 0 0 -63.757,63.7586 63.799577,63.799577 0 0 0 63.757,63.7586 63.799577,63.799577 0 0 0 63.76,-63.7586 63.799577,63.799577 0 0 0 -63.76,-63.7586 z m -50.908,134.0629 c -11.726,-1.2972 -23.472,3.8576 -30.547,13.8186 l -125.821,23.8789 c -8.811,1.6136 -16.108,7.8025 -19.272,16.2428 l -31.759,84.36566 c -5.026,13.2813 1.629,28.0644 14.91,33.0913 2.978,1.1792 6.049,1.5758 9.09,1.5758 10.366,0 20.033,-6.3043 23.88,-16.6065 l 26.91,-71.0316 71.396,-13.5761 -59.517,114.5482 c -2.794,5.4613 -3.825,11.322 -3.516,16.9696 l -48.123,52.2436 -72.365,-48.9706 c -14.087,-9.4954 -33.171,-5.8455 -42.667,8.2425 -9.495,14.0881 -5.845,33.293 8.242,42.7887 l 94.307,63.6375 c 5.213,3.5375 11.253,5.3336 17.212,5.3336 8.379,0 16.709,-3.4227 22.666,-9.9391 l 63.396,-68.8503 72.849,40.1217 -59.152,110.1847 c -8.007,14.9562 -2.473,33.6293 12.486,41.6975 4.655,2.4824 9.642,3.6361 14.545,3.6361 10.923,0 21.566,-5.8189 27.153,-16.1213 l 73.577,-136.9721 c 8.004,-14.8329 2.527,-33.4471 -12.243,-41.5772 l -56.972,-31.394 51.639,-99.2748 70.911,53.9405 c 4.592,3.5375 10.053,5.2119 15.515,5.2119 5.895,0 11.704,-2.0269 16.485,-6.0609 l 70.546,-59.516 c 10.799,-8.9371 12.154,-25.1426 3.031,-35.8793 -9.061,-10.7988 -25.14,-12.15336 -36.003,-3.0305 l -54.907,46.3037 -61.699,-46.91 1.212,-2.1815 c 8.441,-16.19806 2.016,-36.16646 -14.183,-44.60676 l -41.696,-21.8191 c -3.71,-1.9241 -7.608,-3.0827 -11.516,-3.5152 z" fill="#000000"/></g></svg>`

        case "diamonds":
            // Diamond by O s t r e a
            // viewBox was 0 0 32 40
            return `
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 2 32 40" x="0px" y="0px"><title>diamonda</title><path fill="#000000" d="M9.992 10.523c0.084 0.188 0.271 0.302 0.465 0.302 0.069 0 0.139-0.015 0.207-0.045 0.257-0.113 0.372-0.415 0.259-0.672l-2.436-5.458c-0.115-0.256-0.416-0.371-0.672-0.256-0.258 0.115-0.373 0.415-0.258 0.672l2.435 5.457z"/><path fill="#000000" d="M6.056 12.385c0.15 0 0.298-0.066 0.399-0.191 0.176-0.22 0.139-0.539-0.080-0.715l-3.173-2.53c-0.219-0.176-0.539-0.14-0.715 0.080s-0.138 0.539 0.080 0.715l3.174 2.53c0.093 0.075 0.206 0.111 0.315 0.111z"/><path fill="#000000" d="M22.216 10.701c0.069 0.031 0.14 0.047 0.21 0.047 0.193 0 0.378-0.11 0.463-0.297l1.891-4.136c0.117-0.255 0.006-0.557-0.251-0.675-0.255-0.116-0.559-0.004-0.675 0.251l-1.891 4.136c-0.114 0.256-0.001 0.558 0.253 0.674z"/><path fill="#000000" d="M28.732 8.586l-2.557 2.957c-0.183 0.214-0.16 0.535 0.053 0.718 0.097 0.083 0.214 0.124 0.332 0.124 0.143 0 0.284-0.059 0.385-0.176l2.557-2.959c0.184-0.213 0.16-0.534-0.052-0.718s-0.533-0.161-0.718 0.053z"/><path fill="#000000" d="M16.367 10.116c0.006 0 0.013 0 0.017 0 0.274 0 0.5-0.217 0.509-0.491l0.118-3.504c0.010-0.281-0.21-0.516-0.491-0.525-0.276-0.004-0.515 0.209-0.527 0.491l-0.117 3.504c-0.009 0.282 0.211 0.516 0.49 0.525z"/><path fill="#000000" d="M27.191 17.789c-0.014-0.053-0.037-0.106-0.070-0.155-0.001-0.001-0.001-0.001-0.001-0.003l-3.052-4.378c-0.039-0.092-0.103-0.174-0.191-0.231-0.090-0.057-0.19-0.083-0.289-0.082-0.001 0-0.003 0-0.005 0h-14.555c-0.005 0-0.009 0.002-0.016 0.002-0.032 0.001-0.064 0.005-0.095 0.013-0.013 0.002-0.023 0.005-0.035 0.010-0.026 0.008-0.049 0.017-0.073 0.027-0.013 0.006-0.025 0.011-0.036 0.018-0.008 0.004-0.016 0.006-0.023 0.012-0.016 0.011-0.029 0.024-0.043 0.035-0.008 0.008-0.017 0.014-0.026 0.021-0.027 0.027-0.054 0.056-0.075 0.088v0l-2.982 4.474c-0.001 0.001-0.001 0.002-0.001 0.002-0.034 0.049-0.055 0.104-0.069 0.16-0.001 0.003-0.003 0.006-0.005 0.013-0.006 0.036-0.012 0.070-0.012 0.11 0 0.014 0.004 0.032 0.005 0.047 0 0.011 0.001 0.018 0.003 0.027 0.007 0.050 0.023 0.1 0.045 0.148 0.005 0.008 0.009 0.014 0.013 0.021 0.026 0.047 0.058 0.090 0.098 0.126 0.004 0.002 0.004 0.006 0.006 0.006l10.327 9.219c0.009 0.009 0.018 0.012 0.027 0.016 0.034 0.026 0.069 0.048 0.105 0.064 0.015 0.007 0.029 0.016 0.044 0.021 0.053 0.017 0.107 0.028 0.163 0.028 0.001 0 0.001 0 0.003 0 0.056 0 0.11-0.013 0.162-0.030 0.014-0.005 0.027-0.014 0.042-0.020 0.038-0.014 0.073-0.038 0.106-0.064 0.009-0.006 0.018-0.008 0.026-0.016l10.329-9.219c0.002-0.001 0.004-0.006 0.006-0.006 0.041-0.039 0.073-0.081 0.098-0.129 0.006-0.007 0.010-0.014 0.013-0.021 0.023-0.048 0.038-0.097 0.045-0.15 0.002-0.008 0.002-0.019 0.004-0.029 0.001-0.014 0.004-0.027 0.004-0.041 0-0.041-0.006-0.078-0.014-0.116-0.003-0.004-0.006-0.010-0.008-0.016zM16.368 25.955l-3.616-7.524h7.13l-3.514 7.524zM16.313 14.235l3.15 3.178h-6.3l3.151-3.178zM23.606 14.37l2.123 3.045h-4.108l1.985-3.045zM22.659 13.958l-2.059 3.158-3.13-3.158h5.189zM15.155 13.958l-3.13 3.158-2.059-3.158h5.189zM9.023 14.373l1.982 3.040h-4.008l2.026-3.040zM7.381 18.431h4.243l3.187 6.635-7.43-6.635zM17.884 25.112l3.121-6.681h4.364l-7.485 6.681z"/></svg>`

        case "geyser":
            // derived from Fountain by Anton Gajdosik
            return `
<svg
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   id="svg2"
   xml:space="preserve"
   style="enable-background:new 0 0 100 100;"
   viewBox="0 0 100 125"
   y="0px"
   x="0px"
   version="1.1"><defs
     id="defs24" /><path
     d="m 50.989762,26.749152 c 1.495836,0.111689 2.781856,-0.995628 2.893545,-2.491464 L 55.149118,7.3048794 C 55.260808,5.8090434 54.15349,4.5230232 52.657654,4.4113339 51.161818,4.2996447 49.875798,5.4069622 49.764109,6.9027983 L 48.498298,23.855607 c -0.11169,1.495836 0.995628,2.781856 2.491464,2.893545 z"
     id="path6" /><path
     d="m 63.651368,30.532827 c 0.3,0.1 0.7,0.2 1,0.2 1,0 2,-0.6 2.5,-1.7 3.1,-7.6 7.8,-12.5 13.9,-14.4 1.4,-0.4 2.2,-1.9 1.7,-3.3 -0.4,-1.4000003 -1.9,-2.2000003 -3.3,-1.7000003 -7.7,2.5000003 -13.5,8.3000003 -17.2,17.5000003 -0.6,1.3 0,2.9 1.4,3.4 z"
     id="path8" /><path
     d="m 90.2,47.2 c -5.9,-2.5 -14.9,-3 -24.8,8.8 -2,2.4 -3.7,5 -5.1,7.2 l -3,-15.7 c -0.3,-1.4 -1.7,-2.4 -3.1,-2.1 -1.4,0.3 -2.4,1.7 -2.1,3.1 l 4.3,22.7 c 0,0.5 0.1,1 0.3,1.4 l 0.1,0.6 -6.8,0 -6.8,0 0.1,-0.6 c 0.2,-0.4 0.3,-0.9 0.3,-1.4 l 4.3,-22.7 c 0.3,-1.4 -0.7,-2.8 -2.1,-3.1 -1.4,-0.3 -2.8,0.7 -3.1,2.1 l -3,15.7 C 38.3,60.9 36.6,58.4 34.6,56 24.8,44.2 15.7,44.7 9.8,47.2 c -1.4,0.6 -2,2.1 -1.4,3.5 0.6,1.4 2.1,2 3.5,1.4 13.4,-5.7 24,14.9 26.1,19.5 3.404884,8.298784 20.029396,10.199112 24,0 2.1,-4.5 12.7,-25.2 26.2,-19.5 1.4,0.6 2.9,-0.1 3.5,-1.4 0.5,-1.4 -0.1,-3 -1.5,-3.5 z"
     id="path10" /><path
     d="m 90.468389,27.811854 c -9.1,-1.2 -17.8,3.4 -25.7,13.4 -0.9,1.2 -0.7,2.8 0.4,3.7 0.5,0.4 1.1,0.6 1.6,0.6 0.8,0 1.6,-0.3 2.1,-1 6.7,-8.5 13.7,-12.4 20.9,-11.5 1.5,0.2 2.8,-0.8 3,-2.3 0.1,-1.4 -0.9,-2.8 -2.3,-2.9 z"
     id="path12" /><path
     d="m 22.9,19.8 c 6.1,2 10.8,6.8 13.9,14.4 0.4,1 1.4,1.7 2.5,1.7 0.3,0 0.7,-0.1 1,-0.2 1.4,-0.6 2,-2.1 1.5,-3.5 -3.8,-9.1 -9.5,-15 -17.2,-17.5 -1.4,-0.4 -2.9,0.3 -3.3,1.7 -0.5,1.5 0.2,3 1.6,3.4 z"
     id="path14" /><path
     d="m 28.6,43.6 c 0.5,0.7 1.3,1 2.1,1 0.6,0 1.2,-0.2 1.6,-0.6 1.2,-0.9 1.4,-2.6 0.4,-3.7 C 24.9,30.2 16.3,25.7 7.1,26.9 c -1.5,0.2 -2.5,1.5 -2.3,3 0.2,1.5 1.5,2.5 3,2.3 7.2,-1 14.2,2.9 20.8,11.4 z"
     id="path16" /><path
     d="m 48.006023,72.981759 c -8.772774,-2.699712 -18.117695,0.386131 -27.573701,8.929783 -1.087391,1.033236 -1.156824,2.644192 -0.222189,3.714919 0.42635,0.47773 0.98463,0.774922 1.477639,0.858246 0.788812,0.133318 1.62762,-0.02917 2.237282,-0.636057 8.022814,-7.264602 15.574855,-9.943535 22.524191,-7.856259 1.445696,0.447175 2.894164,-0.3222 3.341339,-1.767896 0.331908,-1.363758 -0.420806,-2.910827 -1.784561,-3.242736 z"
     id="path12-9" /><path
     d="M 83.226019,78.611756 C 76.88113,71.97908 67.217154,70.11963 54.796422,72.971899 c -1.453057,0.372321 -2.298755,1.7452 -2.004412,3.135653 0.139483,0.624936 0.482153,1.156516 0.87205,1.469535 0.623836,0.500827 1.435482,0.767717 2.263605,0.534878 10.545923,-2.433819 18.446025,-1.092771 23.497115,4.116499 1.044485,1.095011 2.684253,1.129062 3.779266,0.08457 0.954429,-1.029108 1.051079,-2.746857 0.02197,-3.701285 z"
     id="path12-9-9" /></svg>`

        case "faithful-alternate":
            // Geyser by Nick Bluth
            return `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" x="0px" y="0px" viewBox="0 0 170 211.25" enable-background="new 0 0 170 169" xml:space="preserve"><g><g><g><defs><path id="c" d="M304,72.5c0,0.6,0.4,1,1,1s1-0.4,1-1v-19c0-0.6-0.4-1-1-1s-1,0.4-1,1V72.5z M309,76.7      c0,0.4,0.5,0.8,1.1,0.8c0.6,0,1.1-0.4,1.1-0.8V58.3c0-0.4-0.5-0.8-1.1-0.8c-0.6,0-1.1,0.4-1.1,0.8V76.7z M290.6,21.2      c1.3,0.3,2.5,0.8,3.7,1.4c0.7,0.4,1.1,1.3,0.7,2c-0.4,0.7-1.3,1.1-2,0.7c-2.5-1.2-5.3-1.8-8.1-1.8c-4.9,0-9.7,2-13.2,5.6      c-7.1,7.3-6.9,19.1,0.5,26.2c7.3,7.1,19.1,6.9,26.2-0.5c0.6-0.6,1.5-0.6,2.1,0c0.5,0.5,0.5,0.9,0.5,1.2c0,0.2,0,0.4,0,0.7      c0,0.5,0,1.3,0,2.4c0,2,0,4.8,0,8.3c0,6.3,0-16.1,0-5.8c0,9.3,0-0.8,0,8.8c0,2.1,0,4.1,0,5.8c0,1,0,1,0,1.6c0,0.5,0,0.5,0,0.6      c0,0.8-0.7,1.5-1.5,1.5s-1.5-0.7-1.5-1.5c0-0.1,0-0.1,0-0.6c0-0.6,0-0.6,0-1.6c0-1.7,0-3.6,0-5.8c0-9.6,0,0.4,0-8.8      c0-10.3,0,12.1,0,5.8c0-3.6-0.1-8.4-0.1-8.4s0.3-0.1-0.9,0.8c-8.2,5.6-19.5,4.8-27-2.3c-8.5-8.2-8.8-21.9-0.5-30.4      c4.1-4.2,9.6-6.5,15.3-6.6c0.7,0,1.3,0,2,0.1c5.2-5.1,12.2-8.1,19.7-8.1c7.7,0,14.8,3.1,19.9,8.3c1.3-0.2,2.6-0.3,3.8-0.3      c5.7,0,11.2,2.4,15.3,6.6c8.2,8.5,8,22.2-0.5,30.4c-7.7,7.4-19.5,8-27.7,1.8c-0.1-0.1-0.2-0.1-0.2-0.1s0,4.7,0,8.3      c0,6.3,0-8.1,0,2.2c0,9.3,0-8.8,0,0.8c0,2.1,0,4.1,0,5.8c0,1,0,1,0,1.6c0,0.5,0,0.5,0,0.6c0,0.8-0.7,1.5-1.5,1.5      s-1.5-0.7-1.5-1.5c0-0.1,0-0.1,0-0.6c0-0.6,0-0.6,0-1.6c0-1.7,0-3.6,0-5.8c0-9.6,0,8.4,0-0.8c0-10.3,0,4.1,0-2.2      c0-3.6,0-6.4,0-8.3c0-1,0-1.8,0-2.4c0-0.3,0-0.5,0-0.7c0-0.5,0-0.8,0.5-1.2c0.6-0.6,1.5-0.6,2.1,0c7.1,7.3,18.8,7.6,26.2,0.5      c7.3-7.1,7.6-18.8,0.5-26.2c-3.5-3.6-8.2-5.6-13.2-5.6c-0.5,0-1,0-1.5,0c1,1.4,2,2.8,2.8,4.4c0.4,0.7,0.1,1.6-0.7,2      c-0.7,0.4-1.6,0.1-2-0.7c-4.2-8.4-12.8-13.8-22.4-13.8C300.6,15.5,295,17.6,290.6,21.2z"/></defs><use xlink:href="#c" overflow="visible"/><clipPath><use xlink:href="#c" overflow="visible"/></clipPath></g></g><g><g><defs><path id="b" d="M317.7,98.7l1-1l0.7-0.7l-1.4-1.4l-0.7,0.7l-1,1l-0.7,0.7l1.4,1.4L317.7,98.7z M317.7,103.7l4-4l0.7-0.7      l-1.4-1.4l-0.7,0.7l-4,4l-0.7,0.7l1.4,1.4L317.7,103.7z M297.7,98.7l0.7-0.7l-1.4-1.4l-0.7,0.7l-5,5l0.7,2.1l0.7-0.7L297.7,98.7      z M264.2,122.2l21.5-21.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-21.5,21.5l-0.7,0.7l1.4,1.4L264.2,122.2z M268.2,123.2l18.5-18.5l0.7-0.7      l-1.4-1.4l-0.7,0.7l-18.5,18.5l-0.7,0.7l1.4,1.4L268.2,123.2z M353.2,123.2l3.5-3.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-3.5,3.5      l-0.7,0.7l1.4,1.4L353.2,123.2z M347.2,124.2l7.5-7.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-7.5,7.5l-0.7,0.7l1.4,1.4L347.2,124.2z       M341.2,125.2l10.5-10.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-10.5,10.5l-0.7,0.7l1.4,1.4L341.2,125.2z M335.2,126.2l14.5-14.5l0.7-0.7      l-1.4-1.4l-0.7,0.7l-14.5,14.5l-0.7,0.7l1.4,1.4L335.2,126.2z M330.2,126.2l16.5-16.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-16.5,16.5      l-0.7,0.7l1.4,1.4L330.2,126.2z M325.2,126.2l18.5-18.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-18.5,18.5l-0.7,0.7l1.4,1.4L325.2,126.2z       M320.2,126.2l21.5-21.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-21.5,21.5l-0.7,0.7l1.4,1.4L320.2,126.2z M315.2,126.2l23.5-23.5l0.7-0.7      l-1.4-1.4l-0.7,0.7l-23.5,23.5l-0.7,0.7l1.4,1.4L315.2,126.2z M310.2,126.2l26.5-26.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-26.5,26.5      l-0.7,0.7l1.4,1.4L310.2,126.2z M305.2,126.2l28.5-28.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-28.5,28.5l-0.7,0.7l1.4,1.4L305.2,126.2z       M300.2,126.2l22.5-22.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-22.5,22.5l-0.7,0.7l1.4,1.4L300.2,126.2z M295.2,126.2l16.5-16.5l0.7-0.7      l-1.4-1.4l-0.7,0.7l-16.5,16.5l-0.7,0.7l1.4,1.4L295.2,126.2z M310.7,105.7l-0.7-2.1l-0.7,0.7l-20.5,20.5l-0.7,0.7l1.4,1.4      l0.7-0.7L310.7,105.7z M309.7,101.7l0.7-0.7l-1-1.9l-1.1,1.2l-23.5,23.5l-0.7,0.7l1.4,1.4l0.7-0.7L309.7,101.7z M281.2,125.2      l27.5-27.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-27.5,27.5l-0.7,0.7l1.4,1.4L281.2,125.2z M277.2,124.2l21.5-21.5l0.7-0.7l-1.4-1.4      l-0.7,0.7l-21.5,21.5l-0.7,0.7l1.4,1.4L277.2,124.2z M290.7,105.7l0.7-0.7l-2.1-0.7l-18.5,18.5l-0.7,0.7l1.4,1.4l0.7-0.7      L290.7,105.7z M283.2,97.1c1.1,0,1.9,0.9,1.9,2v3c0,2.2,1.8,4,4,4v-1v-1h-0.1v1v1c2.2,0,4-1.8,4-4v-3c0-1.1,0.9-2,2-2v-1v-1h0v1      v1c1.1,0,2,0.9,2,2h1h1v-0.1h-1h-1c0,2.2,1.8,4,4,4h0.3c2.2,0,4-1.8,4-4v-0.1c0-1.1,0.9-2,2-2c1.1,0,2,0.9,2,2v7.1      c0,2.2,1.8,4,4,4v-1v-1H313v1v1c2.2,0,4-1.8,4-4v-7c0-1.1,0.9-2,2-2v-1v-1h-0.1v1v1c1.1,0,2,0.9,2,2l0,0.8c-0.2,2.6,1.3,4.9,4,4      l0,0c2.2,0,4-1.8,4-4V99c0-1.1,0.9-2,2-2l2,0l0-2l-2,0c-2.2,0-4,1.8-4,4v0.7c0,1.1-0.9,2-2,2h0c-1.1,0-2-0.9-2-2V99      c0-2.2-1.8-4-4-4v2h0.1v-2c-2.2,0-4,1.8-4,4v7c0,1.1-0.9,2-2,2v2h0.1v-2c-1.1,0-2-0.9-2-2v-7.1c0-2.2-1.8-4-4-4      c-2.2,0-4,1.8-4,4v0.1c0,1.1-0.9,2-2,2h-0.3c-1.1,0-2-0.9-2-2h-2V99h2c0-2.2-1.8-4-4-4v2h0v-2c-2.2,0-4,1.8-4,4v3      c0,1.1-0.9,2-2,2v2h0.1v-2c-1.1,0-2-0.9-2-2v-3c0-2.2-1.8-4-3.9-4V97.1z M294.3,84.5c0.6-0.9,1.7-0.8,6.6,0.7      c2.9,0.9,4.7,1.3,6.7,1.4c0.3,0,0.6,0,0.9,0c2.1-0.1,3.9-0.4,6.6-1.3c4.8-1.5,5.8-1.6,7-0.2l-0.1-0.1c2.4,3,5,6.1,7.8,9.2      c5.1,5.7,10.5,11.1,16,16.2c1.9,1.8,3.7,3.4,5.3,4.8c0.6,0.5,1.1,0.9,1.5,1.3c0.3,0.2,0.4,0.4,0.5,0.5c2.4,2.1,1.9,3.8-1.2,4.4      l-0.1,0c-0.1,0-0.3,0.1-0.6,0.2c-0.6,0.1-1.2,0.3-2,0.5c-2.2,0.5-4.9,1-7.9,1.4c-9,1.4-19.7,2.2-31.8,2.1      c-11.8-0.1-22.6-0.9-32.1-2.2c-3.4-0.5-6.5-1-9-1.5c-0.9-0.2-1.7-0.3-2.3-0.5c-0.4-0.1-0.6-0.1-0.8-0.2      c-3.2-0.6-3.6-2.2-1.2-4.4c0.1,0,0.2-0.2,0.5-0.4c0.4-0.4,0.9-0.8,1.4-1.2c1.5-1.3,3.1-2.9,4.9-4.6c5.1-4.9,10.2-10.1,15-15.5      C288.8,91.5,291.7,88,294.3,84.5L294.3,84.5z M291.9,82.7c-2.5,3.4-5.4,6.9-8.4,10.4c-4.7,5.4-9.7,10.5-14.8,15.3      c-1.8,1.7-3.4,3.2-4.9,4.5c-0.5,0.5-1,0.9-1.4,1.2c-0.2,0.2-0.4,0.3-0.5,0.4c-4.2,3.8-3,8.4,2.6,9.6c0.1,0,0.4,0.1,0.8,0.2      c0.7,0.2,1.5,0.3,2.4,0.5c2.6,0.5,5.7,1,9.2,1.5c9.6,1.3,20.5,2.2,32.5,2.2c12.3,0.1,23.1-0.8,32.3-2.1c3.1-0.5,5.8-1,8.1-1.5      c0.8-0.2,1.5-0.3,2.1-0.5c0.4-0.1,0.6-0.2,0.7-0.2l-0.1,0c5.5-1.2,6.7-5.9,2.5-9.7c-0.1-0.1-0.3-0.2-0.5-0.5      c-0.4-0.4-0.9-0.8-1.5-1.3c-1.6-1.4-3.3-3-5.2-4.7c-5.4-5-10.8-10.4-15.8-16c-2.7-3-5.3-6.1-7.6-9l-0.1-0.1c-1.3-1.5-3-2-5-1.9      c-1.3,0.1-1.7,0.2-5.1,1.3c-2.5,0.8-4,1.1-5.8,1.2c-0.2,0-0.5,0-0.7,0c-1.7-0.1-3.3-0.4-6-1.2c-3.6-1.1-4-1.2-5.2-1.3      C294.5,80.7,292.9,81.2,291.9,82.7L291.9,82.7z"/></defs><use xlink:href="#b" overflow="visible"/><clipPath><use xlink:href="#b" overflow="visible"/></clipPath></g></g></g><g><g><defs><path id="a" d="M137.7,148.7l3-3l0.7-0.7l-1.4-1.4l-0.7,0.7l-3,3l-0.7,0.7l1.4,1.4L137.7,148.7z M132.2,149.2l4.5-4.5     l0.7-0.7l-1.4-1.4l-0.7,0.7l-4.5,4.5l-0.7,0.7l1.4,1.4L132.2,149.2z M127.2,149.2l5.5-5.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-5.5,5.5     l-0.7,0.7l1.4,1.4L127.2,149.2z M121.2,150.2l7.5-7.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-7.5,7.5l-0.7,0.7l1.4,1.4L121.2,150.2z      M81.2,150.2l14.5-14.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-14.5,14.5l-0.7,0.7l1.4,1.4L81.2,150.2z M96.2,150.2l12.5-12.5l0.7-0.7     l-1.4-1.4l-0.7,0.7l-12.5,12.5l-0.7,0.7l1.4,1.4L96.2,150.2z M86.2,150.2l13.5-13.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-13.5,13.5     l-0.7,0.7l1.4,1.4L86.2,150.2z M76.2,150.2l12.5-12.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-12.5,12.5l-0.7,0.7l1.4,1.4L76.2,150.2z      M71.2,150.2l12.5-12.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-12.5,12.5l-0.7,0.7l1.4,1.4L71.2,150.2z M66.2,150.2l12.5-12.5l0.7-0.7     l-1.4-1.4l-0.7,0.7l-12.5,12.5l-0.7,0.7l1.4,1.4L66.2,150.2z M61.2,150.2l12.5-12.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-12.5,12.5     l-0.7,0.7l1.4,1.4L61.2,150.2z M57.2,149.2l12.5-12.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-12.5,12.5l-0.7,0.7l1.4,1.4L57.2,149.2z      M52.2,149.2l12.5-12.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-12.5,12.5l-0.7,0.7l1.4,1.4L52.2,149.2z M47.2,149.2l10.5-10.5l0.7-0.7     l-1.4-1.4l-0.7,0.7l-10.5,10.5l-0.7,0.7l1.4,1.4L47.2,149.2z M91.2,150.2l13.5-13.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-13.5,13.5     l-0.7,0.7l1.4,1.4L91.2,150.2z M105.2,151.2l11.5-11.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-11.5,11.5l-0.7,0.7l1.4,1.4L105.2,151.2z      M101.2,150.2l11.5-11.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-11.5,11.5l-0.7,0.7l1.4,1.4L101.2,150.2z M116.2,150.2l8.5-8.5l0.7-0.7     l-1.4-1.4l-0.7,0.7l-8.5,8.5l-0.7,0.7l1.4,1.4L116.2,150.2z M112.2,149.2l8.5-8.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-8.5,8.5l-0.7,0.7     l1.4,1.4L112.2,149.2z M43.2,148.2l8.5-8.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-8.5,8.5l-0.7,0.7l1.4,1.4L43.2,148.2z M38.2,148.2     l7.5-7.5l0.7-0.7l-1.4-1.4l-0.7,0.7l-7.5,7.5l-0.7,0.7l1.4,1.4L38.2,148.2z M33.2,148.2l5.1-5.1l0.7-0.7l-1.4-1.4l-0.7,0.7     l-5.1,5.1l-0.7,0.7l1.4,1.4L33.2,148.2z M28.2,148.2l5.1-5.1l0.7-0.7l-1.4-1.4l-0.7,0.7l-5.1,5.1l-0.7,0.7l1.4,1.4L28.2,148.2z      M53.3,136.1c-0.9,0.2-1.9,0.4-2.8,0.6c-6.5,1.5-13.4,3.1-20.1,4.7c-2.4,0.6-4.5,1.1-6.5,1.6c-0.7,0.2-1.3,0.3-1.8,0.4     c-0.3,0.1-0.5,0.1-0.6,0.2c-3,0.7-4.4,1.4-4.3,3.1c0.1,1.7,1.7,2.1,4.7,2.4c0.1,0,0.2,0,0.5,0c0.4,0,0.8,0.1,1.3,0.1     c1.4,0.1,3.1,0.2,4.9,0.4c5.2,0.4,10.6,0.8,16.2,1.2c4.9,0.3,9.6,0.6,14.1,0.9c10,0.5,18.3,0.8,24.6,0.8c6.2,0,14.5-0.3,24.3-0.8     c4.4-0.2,9.1-0.5,13.9-0.9c5.5-0.4,10.9-0.8,16-1.2c1.8-0.1,3.4-0.3,4.8-0.4c0.5,0,0.9-0.1,1.3-0.1c0.4,0,0.4,0,0.5,0     c3.1-0.2,4.6-0.7,4.7-2.4c0.1-1.7-1.3-2.4-4.3-3.1c-0.1,0-0.3-0.1-0.7-0.2c-0.5-0.1-1.2-0.3-1.9-0.5c-2-0.5-4.3-1-6.8-1.6     c-7-1.7-14.2-3.4-21-4.9c-0.9-0.2-1.8-0.4-2.7-0.6c-5-1.1-9.6-2.2-13.7-3.1c-0.8-0.2-1.6,0-2.9,0.3c-0.3,0.1-2.6,0.8-3.4,1     c-2.8,0.8-5.5,1.3-8.7,1.3c-3.2,0-6-0.3-9.5-1.1c-0.1,0-3.3-0.8-4.1-0.9c-1.5-0.3-2.5-0.4-3.4-0.2     C62.2,134.1,57.9,135.1,53.3,136.1z M66.6,136.2c0.8-0.2-0.4-0.4,6.2,1.1c3.7,0.8,6.8,1.2,10.2,1.2c3.4-0.1,6.3-0.5,9.4-1.4     c0.8-0.2,3.1-1,3.4-1c0.8-0.2,1.3-0.3,1.4-0.3c4.1,0.9,8.6,1.9,13.6,3c0.9,0.2,1.8,0.4,2.7,0.6c6.8,1.6,13.9,3.2,20.9,4.9     c2.5,0.6,4.7,1.1,6.8,1.6c0.7,0.2,1.3,0.3,1.9,0.5c0.3,0.1,0.5,0.1,0.7,0.2c1,0.2,1.7,0.5,2.1,0.7c0.1,0.1,0.2,0.1,0.2,0.1     c-0.2-0.2-0.3-0.4-0.3-0.8c0-0.4,0.2-0.7,0.4-0.8c0,0-0.1,0-0.2,0.1c-0.4,0.1-1.2,0.3-2.2,0.3c-0.1,0-0.1,0-0.5,0     c-0.4,0-0.8,0.1-1.3,0.1c-1.4,0.1-3,0.2-4.8,0.4c-5.1,0.4-10.5,0.8-16,1.2c-4.8,0.3-9.4,0.6-13.9,0.8c-9.8,0.5-18,0.8-24.1,0.8     c-6.2,0-14.6-0.3-24.5-0.8c-4.5-0.2-9.2-0.5-14-0.8c-5.6-0.4-11-0.8-16.2-1.2c-1.8-0.1-3.4-0.3-4.9-0.4c-0.5,0-0.9-0.1-1.3-0.1     c-0.2,0-0.4,0-0.5,0c-1-0.1-1.7-0.2-2.2-0.3c-0.1,0-0.2-0.1-0.2-0.1c0.2,0.1,0.4,0.4,0.4,0.8c0,0.4-0.1,0.7-0.3,0.8     c0,0,0.1,0,0.2-0.1c0.4-0.2,1.1-0.4,2.1-0.7c0.1,0,0.3-0.1,0.6-0.2c0.5-0.1,1.1-0.3,1.8-0.4c1.9-0.5,4.1-1,6.5-1.6     c6.7-1.6,13.6-3.2,20.1-4.7c0.9-0.2,1.9-0.4,2.8-0.6C58.6,138,62.8,137.1,66.6,136.2z M79,56.5v49c0,0.6,0.4,1,1,1s1-0.4,1-1v-49     c0-0.6-0.4-1-1-1S79,55.9,79,56.5z M84,66.5v59c0,0.6,0.4,1,1,1s1-0.4,1-1v-59c0-0.6-0.4-1-1-1S84,65.9,84,66.5z M65.6,22.2     c1.3,0.3,2.5,0.8,3.7,1.4c0.7,0.4,1.1,1.3,0.7,2c-0.4,0.7-1.3,1.1-2,0.7c-2.5-1.2-5.3-1.8-8.1-1.8c-4.9,0-9.7,2-13.2,5.6     c-7.1,7.3-6.9,19.1,0.5,26.2c7.3,7.1,19.1,6.9,26.2-0.5c0.6-0.6,1.5-0.6,2.1,0c0.5,0.5,0.5,0.9,0.5,1.2c0,0.2,0,0.4,0,0.7     c0,0.5,0,1.3,0,2.4c0,2,0,4.8,0,8.3c0,6.3,0,14.9,0,25.2c0,9.3,0,19.2,0,28.8c0,2.1,0,4.1,0,5.8c0,1,0,1,0,1.6c0,0.5,0,0.5,0,0.6     c0,0.8-0.7,1.5-1.5,1.5c-0.8,0-1.5-0.7-1.5-1.5c0-0.1,0-0.1,0-0.6c0-0.6,0-0.6,0-1.6c0-1.7,0-3.6,0-5.8c0-9.6,0-19.6,0-28.8     c0-10.3,0-18.9,0-25.2c0-3.6-0.1-8.4-0.1-8.4s0.3-0.1-0.9,0.8c-8.2,5.6-19.5,4.8-27-2.3c-8.5-8.2-8.8-21.9-0.5-30.4     c4.1-4.2,9.6-6.5,15.3-6.6c0.7,0,1.3,0,2,0.1c5.2-5.1,12.2-8.1,19.7-8.1c7.7,0,14.8,3.1,19.9,8.3c1.3-0.2,2.6-0.3,3.8-0.3     c5.7,0,11.2,2.4,15.3,6.6c8.2,8.5,8,22.2-0.5,30.4c-7.7,7.4-19.5,8-27.7,1.8c-0.1-0.1-0.2-0.1-0.2-0.1s0,4.7,0,8.3     c0,6.3,0,14.9,0,25.2c0,9.3,0,19.2,0,28.8c0,2.1,0,4.1,0,5.8c0,1,0,1,0,1.6c0,0.5,0,0.5,0,0.6c0,0.8-0.7,1.5-1.5,1.5     c-0.8,0-1.5-0.7-1.5-1.5c0-0.1,0-0.1,0-0.6c0-0.6,0-0.6,0-1.6c0-1.7,0-3.6,0-5.8c0-9.6,0-19.6,0-28.8c0-10.3,0-18.9,0-25.2     c0-3.6,0-6.4,0-8.3c0-1,0-1.8,0-2.4c0-0.3,0-0.5,0-0.7c0-0.5,0-0.8,0.5-1.2c0.6-0.6,1.5-0.6,2.1,0c7.1,7.3,18.8,7.6,26.2,0.5     c7.3-7.1,7.6-18.8,0.5-26.2c-3.5-3.6-8.2-5.6-13.2-5.6c-0.5,0-1,0-1.5,0c1,1.4,2,2.8,2.8,4.4c0.4,0.7,0.1,1.6-0.7,2     c-0.7,0.4-1.6,0.1-2-0.7c-4.2-8.4-12.8-13.8-22.4-13.8C75.6,16.5,70,18.6,65.6,22.2z"/></defs><use xlink:href="#a" overflow="visible"/><clipPath><use xlink:href="#a" overflow="visible"/></clipPath></g></g></svg>`

    }
};

chartObject.switchDataset=function switchDataset(dataName) {
    this.datasetsAvailable = Math.max(this.datasetsAvailable, this.datasetsForSwitching.indexOf(dataName)+1);
    if (this.datasetsAvailable > 1) {
        this.drawDataSelector({ instant: true });
    }
    this.privateSwitchDataset(dataName); // defined within drawDataSelector
};

    return chartObject;
}
