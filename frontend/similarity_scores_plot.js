var scorePlot = document.getElementById("scorePlot");

//Plot the score curve
var plotCurve = (currentIndex) => {
    if (window.scores == null) { return; }

    //normalize scores array
    minScore = Math.min(...window.scores);
    maxScore = Math.max(...window.scores);
    scaledScores = window.scores.map(score => (score - minScore) / (maxScore - minScore));

    //offset, to keep space between plot and canvas boundaries
    var offsetLeft = 35;
    var offsetRight = 0;
    var offsetY = 20;

    //canvas with/length
    var plotWidth = scorePlot.clientWidth;
    var plotHeight = scorePlot.clientHeight;

    //reset the drawing
    var ctx = scorePlot.getContext("2d");
    ctx.clearRect(0, 0, plotWidth, plotHeight);

    plotAxes(offsetLeft, offsetRight, offsetY, scorePlot);

    // Draw scale values on y-axis
    for (let i = 0; i < 5; i += 1) {
        const yPos = plotHeight - offsetY - (i / 5) * (plotHeight - 2 * offsetY);

        //Math.trunc(value * 100) / 100 := a precision of 0.01
        ctx.fillText(Math.trunc(((4 - i) * minScore / 4 + i / 4 * maxScore) * 100) / 100.0, offsetLeft / 4, yPos);
    }

    //selected points highlight
    for (var i = 0; i < window.selectedPoints.length; ++i) {
        var x = offsetLeft + (window.selectedPoints[i] / (scaledScores.length - 1)) * (plotWidth - offsetRight - offsetLeft);
        ctx.beginPath();
        ctx.moveTo(x, offsetY);
        ctx.lineTo(x, plotHeight - offsetY);
        ctx.strokeStyle = "rgba(100,200,255,0.3)";
        ctx.stroke();
    }

    //draw the curve
    ctx.beginPath();
    ctx.moveTo(offsetLeft, plotHeight - scaledScores[0] * (plotHeight - 2 * offsetY));

    for (var i = 1; i < scaledScores.length; i++) {
        var x = offsetLeft + (i / (scaledScores.length - 1)) * (plotWidth - offsetRight - offsetLeft);
        var y = plotHeight - offsetY - scaledScores[i] * (plotHeight - 2 * offsetY);
        ctx.lineTo(x, y);
    }

    ctx.strokeStyle = window.REGULAR_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    //update vertical line position
    plotMarker(currentIndex, window.scores.length, offsetLeft, offsetRight, offsetY, scorePlot);
};
