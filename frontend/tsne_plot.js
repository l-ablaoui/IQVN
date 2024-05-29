var tsnePlot = document.getElementById("tsnePlot");
var tsneColorScale = document.getElementById("tsneColorMap");

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
    if (window.displayed_reduction == null) { return; }

    var colorMap = generateColorMap(currentIndex, window.cmap);

    /*get min/max to later normalize reduction values*/
    min_x = window.displayed_reduction[0]['x'];
    max_x = window.displayed_reduction[0]['x'];
    min_y = window.displayed_reduction[0]['y'];
    max_y = window.displayed_reduction[0]['y'];

    for (i = 1;i < window.displayed_reduction.length;++i) {
        min_x = (min_x > window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : min_x;
        max_x = (max_x < window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : max_x;
        min_y = (min_y > window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : min_y;
        max_y = (max_y < window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : max_y;
    }

    //tsnePlot width/length
    var plotWidth = tsnePlot.width;
    var plotHeight = tsnePlot.height;
    
    //reset the drawing
    var ctx = tsnePlot.getContext("2d");
    ctx.clearRect(0, 0, plotWidth, plotHeight);  
    
    //draw the points (square shaped for now)
    for (i = 0;i < window.displayed_reduction.length;++i) {
        //draw current frame marker last to stand out
        if (i == currentIndex) { continue; }

        x = tsnePlotOffsetX + (window.displayed_reduction[i]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX);
        y = plotHeight - tsnePlotOffsetY - (window.displayed_reduction[i]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY);

        ctx.fillStyle = colorMap[i];
        dotRadius = 2;
        // Apply zoom/pan transformations to coordinates only and not to point radius (for visibility purposes)
        fillCircle(ctx, {x: tsneTranslate.x + x * tsneScale, y: tsneTranslate.y + y * tsneScale}, dotRadius);
    }

    x = tsnePlotOffsetX + (window.displayed_reduction[currentIndex]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX);
    y = plotHeight - tsnePlotOffsetY - (window.displayed_reduction[currentIndex]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY);

    ctx.fillStyle = colorMap[currentIndex];
    dotRadius = 4;
    fillCircle(ctx, {x: tsneTranslate.x + x * tsneScale, y: tsneTranslate.y + y * tsneScale}, dotRadius);
    ctx.arc(tsneTranslate.x + x * tsneScale + dotRadius, tsneTranslate.y + y * tsneScale, 0, dotRadius, 2 * Math.PI);
    ctx.strokeStyle = "black";
    ctx.stroke();

    if (window.isSelection) { drawRectangle(ctx, window.selectionTopLeft, window.selectionBotRight); }
}

/*color map stuff */
//plot colormap
var generateColorMap = (currentIndex, cmap) => {
    colorMap = [];
    if (window.displayed_reduction == null) { return colorMap; }

    switch (cmap) {
        case "time": {
            var color1 = {red: 68, green: 53, blue: 91};
            var color2 = {red: 255, green: 212, blue: 191};
            for (var i = 0; i < window.displayed_reduction.length; ++i) { 
                var factor1 = (window.displayed_reduction.length - 1 - i) / (window.displayed_reduction.length - 1);
                var factor2 = i / (window.displayed_reduction.length - 1);
                colorMap.push((currentIndex != i)? 
                    `rgb(${color1.red * factor1 + color2.red * factor2}, 
                    ${color1.green * factor1 + color2.green * factor2}, 
                    ${color1.blue * factor1 + color2.blue * factor2}` 
                    : window.EMPHASIS_COLOR); 
            }
            drawColorScale(0, window.displayed_reduction.length, color1, color2);
            break;
        }

        case "score": {
            //make sure scores exist and match the tsne reduction
            if (window.scores == null) { generateColorMap(currentIndex, ""); }
            if (window.scores.length != window.displayed_reduction.length) { generateColorMap(currentIndex, ""); }

            /*get min/max to normalize scores*/
            min_score = window.scores[0];
            max_score = window.scores[0];

            for (i = 1;i < window.scores.length;++i) {
                min_score = (min_score > window.scores[i])? window.scores[i] : min_score;
                max_score = (max_score < window.scores[i])? window.scores[i] : max_score;
            }

            var color1 = {red: 255, green: 0, blue: 0};
            var color2 = {red: 0, green: 255, blue: 0};
            for (var i = 0; i < window.displayed_reduction.length; ++i) { 
                var factor = (window.scores[i] - min_score) / (max_score - min_score);
                colorMap.push(`rgb(${color1.red * (1 - factor) + color2.red * factor}, 
                    ${color1.green * (1 - factor) + color2.green * factor}, 
                    ${color1.blue * (1 - factor) + color2.blue * factor}`); 
            }
            drawColorScale(min_score, max_score, color1, color2);
            break;
        }

        default: { //gray colormap with red as amphasis
            //squash the color map on default
            tsneColorScale.height = 0;
            for (var i = 0; i < window.displayed_reduction.length; ++i) { colorMap.push((currentIndex == i)? window.EMPHASIS_COLOR: window.REGULAR_COLOR); }
            break;
        }
    }

    return colorMap;
}

var drawColorScale = (minValue, maxValue, minColor, maxColor) => {
    const ctx = tsneColorScale.getContext("2d");
    tsneColorScale.height = 20;
    tsneColorScale.width = 300;

    minValue = Math.trunc(minValue * 100) / 100;
    maxValue = Math.trunc(maxValue * 100) / 100;

    const gradient = ctx.createLinearGradient(0, 0, tsneColorScale.width, 0);
    gradient.addColorStop(0, `rgb(${minColor.red}, ${minColor.green}, ${minColor.blue})`);   // Blue at the left
    gradient.addColorStop(1, `rgb(${maxColor.red}, ${maxColor.green}, ${maxColor.blue})`);  // Red at the right
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, tsneColorScale.width, tsneColorScale.height);

    // Add min and max values
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(minValue, 15, tsneColorScale.height / 2 + 5); // Min value at the left
    ctx.fillStyle = 'white';
    ctx.fillText(maxValue, tsneColorScale.width - 15, tsneColorScale.height / 2 + 5); // Max value at the right
}

//selectors handling (colormap and reduction method)
document.addEventListener("DOMContentLoaded", function() {
    const colorRadioButtons = document.querySelectorAll('input[name="selectColorMap"]');
    const reductionMethodButtons = document.querySelectorAll('input[name="selectReductionMethod"]');

    // Function to handle the colormap change
    const handleColorMapChange = () => {
        const selectedValue = document.querySelector('input[name="selectColorMap"]:checked').value;
        window.cmap = selectedValue;

        //redraw components
        var currentIndex = parseInt(slider.value) - 1;
        plotTsneReduction(currentIndex);
    };

    // Function to handle the reduction algorithm change
    const handleReductionMethodChange = () => {
        const selectedValue = document.querySelector('input[name="selectReductionMethod"]:checked').value;
        window.displayed_reduction = (selectedValue == "tsne")? window.tsne_reduction : 
                                    (selectedValue == "pca")? window.pca_reduction : window.umap_reduction;

        //redraw components
        var currentIndex = parseInt(slider.value) - 1;
        plotTsneReduction(currentIndex);
    };

    // Add change event listener to each radio button
    colorRadioButtons.forEach(radio => {
        radio.addEventListener('change', handleColorMapChange);
    });

    reductionMethodButtons.forEach(radio => {
        radio.addEventListener('change', handleReductionMethodChange);
    });
});

/*On click handling for navigating the video frames*/
/*compare mouse coordinates with each dot of the plot and see if it touches any, must consider the zoom/pan */
tsnePlot.addEventListener("click", async (event) => {
    event.preventDefault();
    
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    //tsnePlot width/length
    var plotWidth = tsnePlot.width;
    var plotHeight = tsnePlot.height;

    //get min/max to later normalize reduction values
    min_x = window.displayed_reduction[0]['x'];
    max_x = window.displayed_reduction[0]['x'];
    min_y = window.displayed_reduction[0]['y'];
    max_y = window.displayed_reduction[0]['y'];

    for (i = 1;i < window.displayed_reduction.length;++i) {
        min_x = (min_x > window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : min_x;
        max_x = (max_x < window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : max_x;
        min_y = (min_y > window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : min_y;
        max_y = (max_y < window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : max_y;
    }
     
    //if clicking on the current frame index (big red dot), do nothing
    var currentIndex = parseInt(slider.value) - 1;
    var x = tsneTranslate.x + tsneScale * (tsnePlotOffsetX + (window.displayed_reduction[currentIndex]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX));
    var y = tsneTranslate.y + tsneScale * (plotHeight - tsnePlotOffsetY - (window.displayed_reduction[currentIndex]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY));

    dotRadius = 4;
    var dist = (mouseX - x) * (mouseX - x) + (mouseY - y) * (mouseY - y);
    if (dist <= dotRadius * dotRadius) {
        return;
    }

    for (i = 0;i < window.displayed_reduction.length;++i) {
        //get each point's coordinates after current zoom/pan
        var x = tsneTranslate.x + tsneScale * (tsnePlotOffsetX + (window.displayed_reduction[i]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX));
        var y = tsneTranslate.y + tsneScale * (plotHeight - tsnePlotOffsetY - (window.displayed_reduction[i]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY));

        dotRadius = 2;
        var dist = (mouseX - x) * (mouseX - x) + (mouseY - y) * (mouseY - y);

        //if the user clicked inside the dot, update the frameIndex
        if (dist <= dotRadius * dotRadius) {
            //fetch current frame
            var name_processed = video_name.split(".")[0]; 
            const response = await fetch(`${server_url}/image/${name_processed}/${i}.png`);
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            updateVideo(imageUrl);

            //update component
            updateScores(i);
            return;
        }
    }
})

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
    tsneDragOffset.x = event.offsetX - tsneTranslate.x;
    tsneDragOffset.y = event.offsetY - tsneTranslate.y;
};
tsnePlot.addEventListener('mousedown', zoomPanMouseDown); 

var zoomPanMouseUp = () => {
    isTsneDragging = false;
};
tsnePlot.addEventListener('mouseup', zoomPanMouseUp);
tsnePlot.addEventListener('mouseout', zoomPanMouseUp);

var zoomPanMouseMove = (event) => {
    if (isTsneDragging) {
        tsneTranslate.x = event.offsetX - tsneDragOffset.x;
        tsneTranslate.y = event.offsetY - tsneDragOffset.y;

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
    if (window.displayed_reduction == null) { return; }

    /*get min/max to later normalize reduction values*/
    min_x = window.displayed_reduction[0]['x'];
    max_x = window.displayed_reduction[0]['x'];
    min_y = window.displayed_reduction[0]['y'];
    max_y = window.displayed_reduction[0]['y'];

    for (i = 1;i < window.displayed_reduction.length;++i) {
        min_x = (min_x > window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : min_x;
        max_x = (max_x < window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : max_x;
        min_y = (min_y > window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : min_y;
        max_y = (max_y < window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : max_y;
    }

    //tsnePlot width/length
    var plotWidth = tsnePlot.width;
    var plotHeight = tsnePlot.height;

    //clear all
    window.selectedPoints = [];

    for (i = 0;i < window.displayed_reduction.length;++i) {
        //get center coordinates
        x = tsnePlotOffsetX + (window.displayed_reduction[i]['x'] - min_x) / (max_x - min_x) * (plotWidth - 2 * tsnePlotOffsetX);
        y = plotHeight - tsnePlotOffsetY - (window.displayed_reduction[i]['y'] - min_y) / (max_y - min_y) * (plotHeight - 2 * tsnePlotOffsetY);

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

var selectionMouseUp = () => { 
    selectionState = "idle"; 

    // Redraw the content
    var currentIndex = parseInt(slider.value) - 1;
    plotTsneReduction(currentIndex);
    updateSelected(currentIndex);
    plotCurve(currentIndex);
}

/*zoom/pan reset option (or reset all?)*/
var resetTsne = document.getElementById("resetTsnePlot");

resetTsne.addEventListener("click", () => {
    //back to initial settings
    tsneScale = 1.0;
    tsneTranslate = { x: 0, y: 0 };
    isTsneDragging = false;
    tsneDragOffset = { x: 0, y: 0 };

    //reset selection
    window.isSelection = false;
    window.selectedPoints = [];

    tsnePlot.removeEventListener("mousemove", selectionMouseMove);
    tsnePlot.removeEventListener("mousedown", selectionMouseDown);
    tsnePlot.removeEventListener("mouseup", selectionMouseUp);
    tsnePlot.removeEventListener("mouseout", selectionMouseUp);

    tsnePlot.addEventListener("mousedown", zoomPanMouseDown);
    tsnePlot.addEventListener("mouseup", zoomPanMouseUp);
    tsnePlot.addEventListener("mouseout", zoomPanMouseUp);
    tsnePlot.addEventListener("mousemove", zoomPanMouseMove);
    tsnePlot.addEventListener("wheel", zoomPanWheel);

    //redraw context
    currentIndex = parseInt(slider.value) - 1;
    plotTsneReduction(currentIndex);
    plotCurve(currentIndex);
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
