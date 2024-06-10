//offset, to keep space between plot and canvas boundaries
var scorePlotOffsetLeft = 35;
var scorePlotOffsetRight = 0;
var scorePlotOffsetY = 20;

//Plot the score curve
var plot_score_curve = (currentIndex) => {
    var scorePlot = document.getElementById("scorePlot");

    if (window.scores == null) { return; }

    //normalize scores array
    minScore = Math.min(...window.scores);
    maxScore = Math.max(...window.scores);
    scaledScores = window.scores.map(score => (score - minScore) / (maxScore - minScore));

    //canvas with/length
    var plotWidth = scorePlot.width;
    var plotHeight = scorePlot.height;

    //reset the drawing
    var ctx = scorePlot.getContext("2d");
    ctx.clearRect(0, 0, plotWidth, plotHeight);

    plot_axes(scorePlotOffsetLeft, scorePlotOffsetRight, scorePlotOffsetY, scorePlot);

    // Draw scale values on y-axis
    for (let i = 0; i < 5; i += 1) {
        const yPos = plotHeight - scorePlotOffsetY - (i / 5) * (plotHeight - 2 * scorePlotOffsetY);

        //Math.trunc(value * 100) / 100 := a precision of 0.01
        ctx.fillText(Math.trunc(((4 - i) * minScore / 4 + i / 4 * maxScore) * 100) / 100.0, scorePlotOffsetLeft / 4, yPos);
    }

    //selected points highlight
    for (var i = 0; i < window.selected_points.length; ++i) {
        var x = scorePlotOffsetLeft + (window.selected_points[i] / (scaledScores.length - 1)) * (plotWidth - scorePlotOffsetRight - scorePlotOffsetLeft);
        ctx.beginPath();
        ctx.moveTo(x, scorePlotOffsetY);
        ctx.lineTo(x, plotHeight - scorePlotOffsetY);
        ctx.strokeStyle = "rgba(100,200,255,0.3)";
        ctx.stroke();
    }

    //draw the curve
    ctx.beginPath();
    ctx.moveTo(scorePlotOffsetLeft, plotHeight - scaledScores[0] * (plotHeight - 2 * scorePlotOffsetY));

    for (var i = 1; i < scaledScores.length; i++) {
        var x = scorePlotOffsetLeft + (i / (scaledScores.length - 1)) * (plotWidth - scorePlotOffsetRight - scorePlotOffsetLeft);
        var y = plotHeight - scorePlotOffsetY - scaledScores[i] * (plotHeight - 2 * scorePlotOffsetY);
        ctx.lineTo(x, y);
    }

    ctx.strokeStyle = window.REGULAR_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    //update vertical line position
    plot_marker(currentIndex, window.scores.length, scorePlotOffsetLeft, scorePlotOffsetRight, scorePlotOffsetY, window.EMPHASIS_COLOR, 1, scorePlot);
};
