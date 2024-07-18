// Get the drawing context
let video = document.getElementById("video");
let ctx = video.getContext("2d");
let cropped = document.getElementById("crop");
let ctx_cropped = cropped.getContext("2d");

let crop_state = "idle";
let crop_mouse_down = { x: 0, y: 0 };

// Initialize window.crop_top_left and window.crop_bot_right with example values for testing
window.crop_top_left = { x: 50, y: 50 };
window.crop_bot_right = { x: 150, y: 150 };

// Function to update the crop center
const update_crop_center = () => {
    return { 
        x: (window.crop_top_left.x + window.crop_bot_right.x) / 2, 
        y: (window.crop_top_left.y + window.crop_bot_right.y) / 2 
    };
}

let crop_center = update_crop_center();

video.addEventListener("mousedown", (event) => {
    crop_mouse_down = {x: event.offsetX, y: event.offsetY};
    crop_center = update_crop_center(); // Update crop center on mousedown

    // Get the closest point
    let dp1 = length2(crop_mouse_down, window.crop_top_left);
    let dp2 = length2(crop_mouse_down, window.crop_bot_right);
    let dc = length2(crop_mouse_down, crop_center);

    let dp_top_right = length2(crop_mouse_down, { x: window.crop_bot_right.x, y: window.crop_top_left.y });
    let dp_bottom_left = length2(crop_mouse_down, { x: window.crop_top_left.x, y: window.crop_bot_right.y });

    let list = [dp1, dp2, dc, dp_top_right, dp_bottom_left];
    // Sort the list
    let min_index = list.indexOf(Math.min(...list)); // Usage of the spread operator

    if (min_index == 0) crop_state = "dp1";
    if (min_index == 1) crop_state = "dp2";
    if (min_index == 2) crop_state = "dc";
    if (min_index == 3) crop_state = "dcTR";
    if (min_index == 4) crop_state = "dcBL";
});

video.addEventListener("mousemove", (event) => {
    if (crop_state == "idle") return;

    let mouse_pos = {x: event.offsetX, y: event.offsetY};
    let delta = {
        x: mouse_pos.x - crop_mouse_down.x,
        y: mouse_pos.y - crop_mouse_down.y,
    };

    switch (crop_state) {
        case "dp1":
            window.crop_top_left = { 
                x: window.crop_top_left.x + delta.x, 
                y: window.crop_top_left.y + delta.y 
            };
            break;

        case "dp2":
            window.crop_bot_right = { 
                x: window.crop_bot_right.x + delta.x, 
                y: window.crop_bot_right.y + delta.y 
            };
            break;

        case "dc":
            window.crop_top_left = { 
                x: window.crop_top_left.x + delta.x, 
                y: window.crop_top_left.y + delta.y 
            };
            window.crop_bot_right = { 
                x: window.crop_bot_right.x + delta.x, 
                y: window.crop_bot_right.y + delta.y 
            };
            break;

        case "dcTR":
            window.crop_top_left = { 
                x: window.crop_top_left.x, 
                y: window.crop_top_left.y + delta.y 
            };
            window.crop_bot_right = { 
                x: window.crop_bot_right.x + delta.x, 
                y: window.crop_bot_right.y 
            };
            break;

        case "dcBL":
            window.crop_top_left = { 
                x: window.crop_top_left.x + delta.x, 
                y: window.crop_top_left.y 
            };
            window.crop_bot_right = { 
                x: window.crop_bot_right.x, 
                y: window.crop_bot_right.y + delta.y 
            };
            break;
    }
    crop_center = update_crop_center();
    crop_mouse_down = mouse_pos;

    update_video(window.current_frame.src);
});

video.addEventListener("mouseup", () => { crop_state = "idle"; });
video.addEventListener("mouseout", () => { crop_state = "idle"; });

let draw_rectangle = (ctx, p1, p2) => {
    // Draw the points for the corners of the square
    ctx.fillStyle = "rgba(100,200,255,1)";
    fill_circle(ctx, p1, 5);
    fill_circle(ctx, p2, 5);
    fill_circle(ctx, { x: p1.x, y: p2.y }, 5);
    fill_circle(ctx, { x: p2.x, y: p1.y }, 5);

    // Draw the selection rectangle
    ctx.fillStyle = "rgba(100,200,255,0.3)";
    ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

    ctx.strokeStyle = "rgba(100,200,255,1)";
    ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    ctx.stroke();
}

let draw_cropped = () => {
    draw_rectangle(ctx, window.crop_top_left, window.crop_bot_right);

    // Drawing the cropped image on the bottom
    // Cropped part
    // Clear the background
    ctx_cropped.fillStyle = "white";
    ctx_cropped.fillRect(0, 0, (window.crop_bot_right.x - window.crop_top_left.x), 
        (window.crop_bot_right.y - window.crop_top_left.y));

    // Compute the ratio between the container and the actual image, then draw image operate in the image coordinate system but draw in the video coordinate system
    let ratio_x = window.current_frame.width / video.width;
    let ratio_y = window.current_frame.height / video.height;
    cropped.width = parseInt(window.crop_bot_right.x - window.crop_top_left.x);
    cropped.height = parseInt(window.crop_bot_right.y - window.crop_top_left.y);
    ctx_cropped.drawImage(
        window.current_frame, 
        window.crop_top_left.x * ratio_x, 
        window.crop_top_left.y * ratio_y, 
        (window.crop_bot_right.x - window.crop_top_left.x) * ratio_x, 
        (window.crop_bot_right.y - window.crop_top_left.y) * ratio_y,
        0, 0, (window.crop_bot_right.x - window.crop_top_left.x), 
        (window.crop_bot_right.y - window.crop_top_left.y));
};

