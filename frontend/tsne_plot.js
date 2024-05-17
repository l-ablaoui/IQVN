var tsnePlot = document.getElementById("tsnePlot");

//initial zoom setting
var tsneScale = 1.0;
var tsneTranslate = { x: 0, y: 0 };
const tsneZoomSpeed = 0.1;

// Variables for panning
var isTsneDragging = false;
var tsneDragOffset = { x: 0, y: 0 };

//to keep space between plot and canvas boundaries
var tsnePlotOffsetX = 20;
var tsnePlotOffsetY = 20;

/*main drawing function for tsne reduced embeddings' scatter plot */
var plotTsneReduction = (currentIndex) => {
    if (window.tsne_reduction == null) { return; }

    /*get min/max to later normalize reduction values*/
    min_x = window.tsne_reduction[0]['x'];
    max_x = window.tsne_reduction[0]['x'];
    min_y = window.tsne_reduction[0]['y'];
    max_y = window.tsne_reduction[0]['y'];

    for (i = 1;i < window.tsne_reduction.length;++i) {
        min_x = (min_x > window.tsne_reduction[i]['x'])? window.tsne_reduction[i]['x'] : min_x;
        max_x = (max_x < window.tsne_reduction[i]['x'])? window.tsne_reduction[i]['x'] : max_x;
        min_y = (min_y > window.tsne_reduction[i]['y'])? window.tsne_reduction[i]['y'] : min_y;
        max_y = (max_y < window.tsne_reduction[i]['y'])? window.tsne_reduction[i]['y'] : max_y;
    }

    //tsnePlot width/length
    var plotWidth = tsnePlot.clientWidth;
    var plotHeight = tsnePlot.clientHeight;

    //reset the drawing
    var ctx = tsnePlot.getContext("2d");
    ctx.clearRect(0, 0, plotWidth, plotHeight);  
    
    //draw the points (square shaped for now)
    for (i = 0;i < window.tsne_reduction.length;++i) {
        //draw current frame marker last to stand out
        if (i == currentIndex) { continue; }
        x = tsnePlotOffsetX + (window.tsne_reduction[i]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX);
        y = plotHeight - tsnePlotOffsetY - (window.tsne_reduction[i]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY);

        dotColor = "gray";
        dotRadius = 2;
        ctx.beginPath();

        // Apply zoom/pan transformations to coordinates only and not to point radius (for visibility purposes)
        ctx.moveTo(tsneTranslate.x + x * tsneScale - dotRadius, tsneTranslate.y + y * tsneScale);
        ctx.arc(tsneTranslate.x + x * tsneScale, tsneTranslate.y + y * tsneScale, dotRadius, 0, Math.PI * 2, true);
        ctx.strokeStyle = dotColor;
        ctx.fill();
        ctx.stroke();
    }

    x = tsnePlotOffsetX + (window.tsne_reduction[currentIndex]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX);
    y = plotHeight - tsnePlotOffsetY - (window.tsne_reduction[currentIndex]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY);

    dotColor = "dodgerblue";
    dotRadius = 4;
    ctx.beginPath();
    ctx.moveTo(tsneTranslate.x + x * tsneScale - dotRadius, tsneTranslate.y + y * tsneScale);
    ctx.arc(tsneTranslate.x + x * tsneScale, tsneTranslate.y + y * tsneScale, dotRadius, 0, Math.PI * 2, true);
    ctx.strokeStyle = dotColor;
    ctx.fill();
    ctx.stroke();
}

/*zoom/pan handling */
tsnePlot.addEventListener('wheel', (event) => {
    event.preventDefault();
    
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    const wheel = event.deltaY < 0 ? 1 : -1;
    const zoomFactor = 1 + wheel * tsneZoomSpeed;
    
    // Calculate new scale but constrain it within a range
    const newScale = Math.max(Math.min(tsneScale * zoomFactor, 10), 0.1);
    
    // Adjust translation to keep the zoom centered on the cursor
    tsneTranslate.x = mouseX - ((mouseX - tsneTranslate.x) / tsneScale) * newScale;
    tsneTranslate.y = mouseY - ((mouseY - tsneTranslate.y) / tsneScale) * newScale;

    // Apply the new scale
    tsneScale = newScale;

    // Redraw the content
    currentIndex = parseInt(slider.value) - 1;
    plotTsneReduction(currentIndex);
});

tsnePlot.addEventListener('mousedown', (event) => {
    isTsneDragging = true;
    tsneDragOffset.x = event.clientX - tsneTranslate.x;
    tsneDragOffset.y = event.clientY - tsneTranslate.y;
});

tsnePlot.addEventListener('mouseup', () => {
    isTsneDragging = false;
});

tsnePlot.addEventListener('mouseout', () => {
    isTsneDragging = false;
});

tsnePlot.addEventListener('mousemove', (event) => {
    if (isTsneDragging) {
        tsneTranslate.x = event.clientX - tsneDragOffset.x;
        tsneTranslate.y = event.clientY - tsneDragOffset.y;

        //redraw context
        currentIndex = parseInt(slider.value) - 1;
        plotTsneReduction(currentIndex);
    }
});

/*zoom/pan reset option*/
resetTsne = document.getElementById("resetTsnePlot");

resetTsne.addEventListener("click", () => {
    //back to initial settings
    tsneScale = 1.0;
    tsneTranslate = { x: 0, y: 0 };
    isTsneDragging = false;
    tsneDragOffset = { x: 0, y: 0 };

    //redraw context
    currentIndex = parseInt(slider.value) - 1;
    plotTsneReduction(currentIndex);
});