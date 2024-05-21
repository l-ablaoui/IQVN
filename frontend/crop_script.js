//Get the drawing context
var video = document.getElementById("video");
var ctx = video.getContext("2d");
var cropped = document.getElementById("crop");
var ctx_cropped = cropped.getContext("2d");

cropState = "idle";
var cropCenter = { x: (window.cropTopLeft.x + window.cropBotRight.x) / 2, y: (window.cropTopLeft.y + window.cropBotRight.y) / 2 };
var cropMouseDown = cropCenter;

function length2(p1, p2) {
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

video.addEventListener("mousedown", (event) => {
    cropMouseDown = {x: event.offsetX, y: event.offsetY};
    //Get the closest point
    let dP1 = length2(cropMouseDown, window.cropTopLeft);
    let dP2 = length2(cropMouseDown, window.cropBotRight);
    let dC = length2(cropMouseDown, cropCenter);

    let dPTopRight = length2(cropMouseDown, { x: window.cropBotRight.x, y: window.cropTopLeft.y });
    let dPBottomLeft = length2(cropMouseDown, { x: window.cropTopLeft.x, y: window.cropBotRight.y });

    let list = [dP1, dP2, dC, dPTopRight, dPBottomLeft];
    //sort the list
    let minIndex = list.indexOf(Math.min(...list)); //Usage of the spread operator

    if (minIndex == 0) cropState = "dP1";
    if (minIndex == 1) cropState = "dP2";
    if (minIndex == 2) cropState = "dC";
    if (minIndex == 3) cropState = "dCTR";
    if (minIndex == 4) cropState = "dCBL";
});

// mouse move management with the modification of the points location
video.addEventListener("mousemove", (event) => {
    if (cropState == "idle") { return; }
    var mousePosition = {x: event.offsetX, y: event.offsetY};
    var delta = {
        x: mousePosition.x - cropMouseDown.x,
        y: mousePosition.y - cropMouseDown.y,
    };
    switch (cropState) {
        case "dP1":
            window.cropTopLeft = { x: window.cropTopLeft.x + delta.x, y: window.cropTopLeft.y + delta.y };
            break;

        case "dP2":
            window.cropBotRight = { x: window.cropBotRight.x + delta.x, y: window.cropBotRight.y + delta.y };
            break;

        case "dC":
            window.cropTopLeft = { x: window.cropTopLeft.x + delta.x, y: window.cropTopLeft.y + delta.y };
            window.cropBotRight = { x: window.cropBotRight.x + delta.x, y: window.cropBotRight.y + delta.y };
            break;

        case "dCTR":
            window.cropTopLeft = { x: window.cropTopLeft.x, y: window.cropTopLeft.y + delta.y };
            window.cropBotRight = { x: window.cropBotRight.x + delta.x, y: window.cropBotRight.y };
            break;

        case "dCBL":
            window.cropTopLeft = { x: window.cropTopLeft.x + delta.x, y: window.cropTopLeft.y };
            window.cropBotRight = { x: window.cropBotRight.x, y: window.cropBotRight.y + delta.y };
            break;
    }
    cropCenter = { x: (window.cropTopLeft.x + window.cropBotRight.x) / 2, y: (window.cropTopLeft.y + window.cropBotRight.y) / 2 };
    cropMouseDown = mousePosition;

    updateVideo(window.current_frame.src);
    //drawCropped();
});

// update the cropState with the mouse up or out
video.addEventListener("mouseup", (event) => { cropState = "idle"; });
video.addEventListener("mouseout", (event) => { cropState = "idle"; });

var drawRectangle = (ctx, p1, p2) => {
    //Draw the points for the corners of the square
    ctx.fillStyle = "rgba(100,200,255,1)";
    fillCircle(ctx, p1, 5);
    fillCircle(ctx, p2, 5);
    fillCircle(ctx, { x: p1.x, y: p2.y }, 5);
    fillCircle(ctx, { x: p2.x, y: p1.y }, 5);

    //Draw the selection rectangle
    ctx.fillStyle = "rgba(100,200,255,0.3)";
    ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

    ctx.strokeStyle = "rgba(100,200,255,1)";
    ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    ctx.stroke();
}

var drawCropped = () => {
    drawRectangle(ctx, window.cropTopLeft, window.cropBotRight);
    
    /*drawing the lil cropped image on the bottom */
    //Cropped part
    //Clear the background
    ctx_cropped.fillStyle = "white";
    // ctx_cropped.fillRect(0, 0, cropped.width, cropped.height);
    ctx_cropped.fillRect(0, 0, (window.cropBotRight.x - window.cropTopLeft.x), (window.cropBotRight.y - window.cropTopLeft.y));

    //Compute the ratio between the container and the actual image, then draw image operate in the image coordinate system but draw in the video coordinate system
    var rationX = window.current_frame.width / video.width;
    var rationY = window.current_frame.height / video.height;
    cropped.width = parseInt(window.cropBotRight.x - window.cropTopLeft.x);
    cropped.height = parseInt(window.cropBotRight.y - window.cropTopLeft.y);
    ctx_cropped.drawImage(window.current_frame, window.cropTopLeft.x * rationX, window.cropTopLeft.y * rationY, (window.cropBotRight.x - window.cropTopLeft.x) * rationX, (window.cropBotRight.y - window.cropTopLeft.y) * rationY,
        0, 0, (window.cropBotRight.x - window.cropTopLeft.x), (window.cropBotRight.y - window.cropTopLeft.y));
};

