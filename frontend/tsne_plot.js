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

//selection stuff
selectionState = "idle";
var selectionCenter = { x: (window.selectionTopLeft.x + window.selectionBotRight.x) / 2, y: (window.selectionTopLeft.y + window.selectionBotRight.y) / 2 };
var selectionMouseDownPoint = selectionCenter;

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

        ctx.fillStyle = "gray";
        dotRadius = 2;
        // Apply zoom/pan transformations to coordinates only and not to point radius (for visibility purposes)
        fillCircle(ctx, {x: tsneTranslate.x + x * tsneScale, y: tsneTranslate.y + y * tsneScale}, dotRadius);
    }

    x = tsnePlotOffsetX + (window.tsne_reduction[currentIndex]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX);
    y = plotHeight - tsnePlotOffsetY - (window.tsne_reduction[currentIndex]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY);

    ctx.fillStyle = "royalblue";
    dotRadius = 4;
    fillCircle(ctx, {x: tsneTranslate.x + x * tsneScale, y: tsneTranslate.y + y * tsneScale}, dotRadius);

    if (window.isSelection) { drawRectangle(ctx, window.selectionTopLeft, window.selectionBotRight); }
}

/*zoom/pan handling */
var zoomPanWheel = (event) => {
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
    var currentIndex = parseInt(slider.value) - 1;
    plotTsneReduction(currentIndex);
};
tsnePlot.addEventListener('wheel', zoomPanWheel);

var zoomPanMouseDown = (event) => {
    isTsneDragging = true;
    tsneDragOffset.x = event.clientX - tsneTranslate.x;
    tsneDragOffset.y = event.clientY - tsneTranslate.y;
};
tsnePlot.addEventListener('mousedown', zoomPanMouseDown); 

var zoomPanMouseUp = () => {
    isTsneDragging = false;
};
tsnePlot.addEventListener('mouseup', zoomPanMouseUp);
tsnePlot.addEventListener('mouseout', zoomPanMouseUp);

var zoomPanMouseMove = (event) => {
    if (isTsneDragging) {
        tsneTranslate.x = event.clientX - tsneDragOffset.x;
        tsneTranslate.y = event.clientY - tsneDragOffset.y;

        //redraw context
        currentIndex = parseInt(slider.value) - 1;
        plotTsneReduction(currentIndex);
    }
};
tsnePlot.addEventListener('mousemove', zoomPanMouseMove);

/*handling embedding selection */

// Function to check if the circle intersects a rectangle edge
var intersectsEdge = (p1, p2, c, r) => {
    // Closest point on the edge to the circle's center
    let closestX = Math.max(p1.x, Math.min(c.x, p2.x));
    let closestY = Math.max(p1.y, Math.min(c.y, p2.y));

    // Distance from the circle's center to the closest point on the edge
    let distanceSq = length2(c, { x: closestX, y: closestY });

    return distanceSq <= r * r;
}

// utility function to check if the dots are inside the selection area
var isCircleInSquare = (p1, p2, c, r) => {
    /*circle completely inside */
    // Ensure p1 is the top-left corner and p2 is the bottom-right corner
    var rectLeft = Math.min(p1.x, p2.x);
    var rectRight = Math.max(p1.x, p2.x);
    var rectTop = Math.min(p1.y, p2.y);
    var rectBottom = Math.max(p1.y, p2.y);

    // Check if the circle is completely inside the rectangle
    var isCompletelyInside = 
        (c.x - r >= rectLeft) &&
        (c.x + r <= rectRight) &&
        (c.y - r >= rectTop) &&
        (c.y + r <= rectBottom);

    // Check intersection with each of the four edges of the rectangle
    var intersects =
        intersectsEdge(p1, p2, c, r) || // Top edge
        intersectsEdge(p1, p2, c, r) || // Bottom edge
        intersectsEdge(p1, p2, c, r) || // Left edge
        intersectsEdge(p1, p2, c, r); // Right edge

    // if the circle is completely inside or starts intersecting with the rectangle, it is selected
    return intersects || isCompletelyInside;
};

// update the selection indices global vector
var updateSelected = (currentIndex) => {
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

    //clear all
    window.selectedPoints = [];

    for (i = 0;i < window.tsne_reduction.length;++i) {
        //get center coordinates
        x = tsnePlotOffsetX + (window.tsne_reduction[i]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX);
        y = plotHeight - tsnePlotOffsetY - (window.tsne_reduction[i]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY);

        //checking if circle is in the selected area, taking into account the current zoom/pan and the big coloured dot that is the current frame embedding
        if (isCircleInSquare(window.selectionTopLeft, window.selectionBotRight, 
            {x: tsneTranslate.x + x * tsneScale, y: tsneTranslate.y + y * tsneScale}, 
            (currentIndex == i)? 4 : 2)) {
            window.selectedPoints.push(i);
        }
    }
};

var selectionMouseDown = (event) => {
    selectionMouseDownPoint = {x: event.offsetX, y: event.offsetY};
    //Get the closest point
    let dP1 = length2(selectionMouseDownPoint, window.selectionTopLeft);
    let dP2 = length2(selectionMouseDownPoint, window.selectionBotRight);
    let dC = length2(selectionMouseDownPoint, selectionCenter);

    let dPTopRight = length2(selectionMouseDownPoint, { x: window.selectionBotRight.x, y: window.selectionTopLeft.y });
    let dPBottomLeft = length2(selectionMouseDownPoint, { x: window.selectionTopLeft.x, y: window.selectionBotRight.y });

    let list = [dP1, dP2, dC, dPTopRight, dPBottomLeft];
    //sort the list
    let minIndex = list.indexOf(Math.min(...list)); //Usage of the spread operator

    if (minIndex == 0) selectionState = "dP1";
    if (minIndex == 1) selectionState = "dP2";
    if (minIndex == 2) selectionState = "dC";
    if (minIndex == 3) selectionState = "dCTR";
    if (minIndex == 4) selectionState = "dCBL";
};

var selectionMouseMove = (event) => {
    if (selectionState == "idle") { return; }
    var mousePosition = {x: event.offsetX, y: event.offsetY};
    var delta = {
        x: mousePosition.x - selectionMouseDownPoint.x,
        y: mousePosition.y - selectionMouseDownPoint.y,
    };
    switch (selectionState) {
        case "dP1":
            window.selectionTopLeft = { x: window.selectionTopLeft.x + delta.x, y: window.selectionTopLeft.y + delta.y };
            break;

        case "dP2":
            window.selectionBotRight = { x: window.selectionBotRight.x + delta.x, y: window.selectionBotRight.y + delta.y };
            break;

        case "dC":
            window.selectionTopLeft = { x: window.selectionTopLeft.x + delta.x, y: window.selectionTopLeft.y + delta.y };
            window.selectionBotRight = { x: window.selectionBotRight.x + delta.x, y: window.selectionBotRight.y + delta.y };
            break;

        case "dCTR":
            window.selectionTopLeft = { x: window.selectionTopLeft.x, y: window.selectionTopLeft.y + delta.y };
            window.selectionBotRight = { x: window.selectionBotRight.x + delta.x, y: window.selectionBotRight.y };
            break;

        case "dCBL":
            window.selectionTopLeft = { x: window.selectionTopLeft.x + delta.x, y: window.selectionTopLeft.y };
            window.selectionBotRight = { x: window.selectionBotRight.x, y: window.selectionBotRight.y + delta.y };
            break;
    }
    selectionCenter = { x: (window.selectionTopLeft.x + window.selectionBotRight.x) / 2, y: (window.selectionTopLeft.y + window.selectionBotRight.y) / 2 };
    selectionMouseDownPoint = mousePosition;

    // Redraw the content
    var currentIndex = parseInt(slider.value) - 1;
    plotTsneReduction(currentIndex);
    updateSelected(currentIndex);
    plotCurve(currentIndex);
}

var selectionMouseUp = (event) => { selectionState = "idle"; }

/*zoom/pan reset option*/
var resetTsne = document.getElementById("resetTsnePlot");

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

/*zoomPan/selection toggle option */
var toggleSelection = document.getElementById("selectDots");

toggleSelection.addEventListener("click", () => {
    if (window.isSelection == false) {
        window.isSelection = true;
        tsnePlot.removeEventListener("mousemove", zoomPanMouseMove);
        tsnePlot.removeEventListener("mousedown", zoomPanMouseDown);
        tsnePlot.removeEventListener("mouseup", zoomPanMouseUp);
        tsnePlot.removeEventListener("mouseout", zoomPanMouseUp);
        tsnePlot.removeEventListener("wheel", zoomPanWheel);

        tsnePlot.addEventListener("mousedown", selectionMouseDown);
        tsnePlot.addEventListener("mouseup", selectionMouseUp);
        tsnePlot.addEventListener("mousemove", selectionMouseMove);

        var currentIndex = parseInt(slider.value) - 1;
        updateSelected(currentIndex);
        plotCurve(currentIndex);
    }
    else {
        window.isSelection = false;
        tsnePlot.removeEventListener("mousemove", selectionMouseMove);
        tsnePlot.removeEventListener("mousedown", selectionMouseDown);
        tsnePlot.removeEventListener("mouseup", selectionMouseUp);
        tsnePlot.removeEventListener("mouseout", selectionMouseUp);

        tsnePlot.addEventListener("mousedown", zoomPanMouseDown);
        tsnePlot.addEventListener("mouseup", zoomPanMouseUp);
        tsnePlot.addEventListener("mouseout", zoomPanMouseUp);
        tsnePlot.addEventListener("mousemove", zoomPanMouseMove);
        tsnePlot.addEventListener("wheel", zoomPanWheel);
    }
    //redraw context
    currentIndex = parseInt(slider.value) - 1;
    plotTsneReduction(currentIndex);
});
