var objPlot = document.getElementById("objPlot");

//to keep space between plot and canvas boundaries
var objPlotOffsetLeft = 50;
var objPlotOffsetRight = 20;
var objPlotOffsetY = 20;

/*main drawing function for detected objects plot*/
var plotObjects = (currentIndex) => {
    if (window.objs == null) { return; }

    //canvas width/length
    var plotWidth = objPlot.width;
    var plotHeight = objPlot.height;

    //reset the drawing
    var ctx = objPlot.getContext("2d");
    ctx.clearRect(0, 0, plotWidth, plotHeight);

    plotAxes(objPlotOffsetLeft, objPlotOffsetRight, objPlotOffsetY, objPlot);

    // Draw class names on y-axis
    for (var i = 0; i < window.objs["classes"].length; ++i) {
        const yPos = plotHeight - objPlotOffsetY - (i / window.objs["classes"].length) * (plotHeight - 2 * objPlotOffsetY);
        ctx.fillText(window.objs["classes"][i]["label"], objPlotOffsetLeft / 10, yPos);
    }

    //for each timestamp, draw circles on the level of the object label
    var currentFrameObjIndex = -1;
    for (var k = 0; k < window.objs["results"].length; ++k) {
        var objects = window.objs["results"][k];

        //draw current frame dots last to stand out
        if (objects[0]["timestamp"] == currentIndex) { 
            currentFrameObjIndex = k;
            continue; 
        }
        for (var i = 0;i < objects.length;++i) {
            //xpos reflects the timestamp
            timestamp = objects[i]["timestamp"];
            const x = objPlotOffsetLeft + (timestamp / window.objs["maxTime"]) * (plotWidth - objPlotOffsetLeft - objPlotOffsetRight);
            
            //matching label with plot line (ypos)
            label = objects[i]["label"];
            var j = 0;
            for (;j < window.objs["classes"].length; ++j) {
                if (label == window.objs["classes"][j]["index"]) { break; }
            } 
            const y = plotHeight - objPlotOffsetY - (j / window.objs["classes"].length) * (plotHeight - objPlotOffsetY * 2);

            //draw circle
            ctx.fillStyle = window.REGULAR_COLOR;
            dotRadius = 2;
            fillCircle(ctx, {x: x, y: y}, dotRadius);
        }
    }

    //current frame dots drawing (if any)
    if (currentFrameObjIndex != -1) {
        var objects = window.objs["results"][currentFrameObjIndex];

        for (var i = 0; i < objects.length;++i) {
            const x = objPlotOffsetLeft + (currentIndex / window.objs["maxTime"]) * (plotWidth - objPlotOffsetRight - objPlotOffsetLeft);

            label = objects[i]["label"];
            var j = 0;
            for (;j < window.objs["classes"].length; ++j) {
                if (label == window.objs["classes"][j]["index"]) { break; }
            } 
            const y = plotHeight - objPlotOffsetY - (j / window.objs["classes"].length) * (plotHeight - objPlotOffsetY * 2);

            ctx.fillStyle = window.EMPHASIS_COLOR;
            dotRadius = 4;
            fillCircle(ctx, {x: x, y: y}, dotRadius);
        }
    }

    //update vertical line position
    plotMarker(currentIndex, window.objs["maxTime"], objPlotOffsetLeft, objPlotOffsetRight, objPlotOffsetY, objPlot);
};

/*when clicking on an object marker of the active frame, adjust the cropped area to reflect the object's bounding box */
objPlot.addEventListener("click", (event) => {
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    //canvas width/length
    var plotWidth = objPlot.width;
    var plotHeight = objPlot.height;

    //if there are no detected objects at the current frame, skip
    currentFrame = parseInt(slider.value) - 1;
    if (!(currentFrame in window.objs["results"])) { return; }

    //get detected objects' coordinates in the plot and seeing if the clicked area corresponds to one of em
    var objects = window.objs["results"][currentFrame];
    bb = null;
    for (var i = 0; i < objects.length;++i) {
        //get coordinates of current object on the chart
        label = objects[i]["label"];
        var j = 0;
        for (;j < window.objs["classes"].length; ++j) {
            if (label == window.objs["classes"][j]["index"]) { break; }
        } 
        const y = plotHeight - objPlotOffsetY - (j / window.objs["classes"].length) * (plotHeight - objPlotOffsetY * 2);
        const x = objPlotOffsetLeft + (currentFrame / window.objs["maxTime"]) * (plotWidth - objPlotOffsetRight - objPlotOffsetLeft);

        //check if clicked area is in the circle
        if ((mouseX - x) * (mouseX - x) + (mouseY - y) * (mouseY - y) <= 4 * 4) {
            bb = [objects[i]["min_x"], objects[i]["min_y"], objects[i]["max_x"], objects[i]["max_y"]];
            break;
        }
    }

    //update cropped area if an object is clicked
    if (bb != null) {
        console.log(bb);

        window.cropTopLeft.x = bb[0];
        window.cropTopLeft.y = bb[1];
        window.cropBotRight.x = bb[2];
        window.cropBotRight.y = bb[3];

        //toggle cropping
        window.isCropVisible = true;
        document.getElementById("crop").style.display = "block";
        document.getElementById("cropLabel").style.display = "block";

        //draw the cropped area (calls drao from crop_script)
        updateVideo(window.current_frame.src);
    }
    //drawCropped();
});
