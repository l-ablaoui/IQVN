//Get the drawing context
var video = document.getElementById("video");
var ctx = video.getContext("2d");
var cropped = document.getElementById("crop");
var ctx_cropped = cropped.getContext("2d");

cropState = "idle";
var cropCenter = { x: (window.crop_top_left.x + window.crop_bot_right.x) / 2, y: (window.crop_top_left.y + window.crop_bot_right.y) / 2 };
var cropMouseDown = cropCenter;

function length2(p1, p2) {
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

video.addEventListener("mousedown", (event) => {
    cropMouseDown = {x: event.offsetX, y: event.offsetY};
    //Get the closest point
    let dP1 = length2(cropMouseDown, window.crop_top_left);
    let dP2 = length2(cropMouseDown, window.crop_bot_right);
    let dC = length2(cropMouseDown, cropCenter);

    let dPTopRight = length2(cropMouseDown, { x: window.crop_bot_right.x, y: window.crop_top_left.y });
    let dPBottomLeft = length2(cropMouseDown, { x: window.crop_top_left.x, y: window.crop_bot_right.y });

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
            window.crop_top_left = { x: window.crop_top_left.x + delta.x, y: window.crop_top_left.y + delta.y };
            break;

        case "dP2":
            window.crop_bot_right = { x: window.crop_bot_right.x + delta.x, y: window.crop_bot_right.y + delta.y };
            break;

        case "dC":
            window.crop_top_left = { x: window.crop_top_left.x + delta.x, y: window.crop_top_left.y + delta.y };
            window.crop_bot_right = { x: window.crop_bot_right.x + delta.x, y: window.crop_bot_right.y + delta.y };
            break;

        case "dCTR":
            window.crop_top_left = { x: window.crop_top_left.x, y: window.crop_top_left.y + delta.y };
            window.crop_bot_right = { x: window.crop_bot_right.x + delta.x, y: window.crop_bot_right.y };
            break;

        case "dCBL":
            window.crop_top_left = { x: window.crop_top_left.x + delta.x, y: window.crop_top_left.y };
            window.crop_bot_right = { x: window.crop_bot_right.x, y: window.crop_bot_right.y + delta.y };
            break;
    }
    cropCenter = { x: (window.crop_top_left.x + window.crop_bot_right.x) / 2, y: (window.crop_top_left.y + window.crop_bot_right.y) / 2 };
    cropMouseDown = mousePosition;

    update_video(window.current_frame.src);
    //drawCropped();
});

// update the cropState with the mouse up or out
video.addEventListener("mouseup", (event) => { cropState = "idle"; });
video.addEventListener("mouseout", (event) => { cropState = "idle"; });

var drawRectangle = (ctx, p1, p2) => {
    //Draw the points for the corners of the square
    ctx.fillStyle = "rgba(100,200,255,1)";
    fill_circle(ctx, p1, 5);
    fill_circle(ctx, p2, 5);
    fill_circle(ctx, { x: p1.x, y: p2.y }, 5);
    fill_circle(ctx, { x: p2.x, y: p1.y }, 5);

    //Draw the selection rectangle
    ctx.fillStyle = "rgba(100,200,255,0.3)";
    ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

    ctx.strokeStyle = "rgba(100,200,255,1)";
    ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    ctx.stroke();
}

var drawCropped = () => {
    drawRectangle(ctx, window.crop_top_left, window.crop_bot_right);
    
    /*drawing the lil cropped image on the bottom */
    //Cropped part
    //Clear the background
    ctx_cropped.fillStyle = "white";
    // ctx_cropped.fillRect(0, 0, cropped.width, cropped.height);
    ctx_cropped.fillRect(0, 0, (window.crop_bot_right.x - window.crop_top_left.x), (window.crop_bot_right.y - window.crop_top_left.y));

    //Compute the ratio between the container and the actual image, then draw image operate in the image coordinate system but draw in the video coordinate system
    var rationX = window.current_frame.width / video.width;
    var rationY = window.current_frame.height / video.height;
    cropped.width = parseInt(window.crop_bot_right.x - window.crop_top_left.x);
    cropped.height = parseInt(window.crop_bot_right.y - window.crop_top_left.y);
    ctx_cropped.drawImage(window.current_frame, window.crop_top_left.x * rationX, window.crop_top_left.y * rationY, (window.crop_bot_right.x - window.crop_top_left.x) * rationX, (window.crop_bot_right.y - window.crop_top_left.y) * rationY,
        0, 0, (window.crop_bot_right.x - window.crop_top_left.x), (window.crop_bot_right.y - window.crop_top_left.y));
};

