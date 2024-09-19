// Get the drawing context
let video = document.getElementById("video");

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

const crop_selection_mouse_down = (event) => {
    crop_mouse_down = {x: event.offsetX, y: event.offsetY};
    crop_center = update_crop_center(); // Update crop center on mousedown

    console.log(crop_mouse_down,crop_center, crop_bot_right, crop_top_left);
    console.log(video.width, video.height, video.offsetWidth, video.offsetHeight);

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
};

video.addEventListener("mousedown", crop_selection_mouse_down);

const crop_selection_mouse_move = (event) => {
    if (crop_state == "idle") return;

    let mouse_pos = {x: event.offsetX, y: event.offsetY};
    let delta = {
        x: mouse_pos.x - crop_mouse_down.x,
        y: mouse_pos.y - crop_mouse_down.y,
    };

    switch (crop_state) {
        case "dp1":
            window.crop_top_left = { 
                x: Math.min(window.crop_top_left.x + delta.x, window.crop_bot_right.x), 
                y: Math.min(window.crop_top_left.y + delta.y, window.crop_bot_right.y)
            };
            break;

        case "dp2":
            window.crop_bot_right = { 
                x: Math.max(window.crop_bot_right.x + delta.x, window.crop_top_left.x), 
                y: Math.max(window.crop_bot_right.y + delta.y, window.crop_top_left.y) 
            };
            break;

        case "dc":
            window.crop_top_left = { 
                x: window.crop_top_left.x + delta.x, 
                y: window.crop_top_left.y + delta.y
            };
            window.crop_bot_right = { 
                x: Math.max(window.crop_bot_right.x + delta.x, window.crop_top_left.x), 
                y: Math.max(window.crop_bot_right.y + delta.y, window.crop_top_left.y)
            };
            break;

        case "dcTR":
            window.crop_top_left = { 
                x: window.crop_top_left.x, 
                y: Math.min(window.crop_top_left.y + delta.y, window.crop_bot_right.y) 
            };
            window.crop_bot_right = { 
                x: Math.max(window.crop_bot_right.x + delta.x, window.crop_top_left.x), 
                y: window.crop_bot_right.y 
            };
            break;

        case "dcBL":
            window.crop_top_left = { 
                x: Math.min(window.crop_top_left.x + delta.x, window.crop_bot_right.x), 
                y: window.crop_top_left.y 
            };
            window.crop_bot_right = { 
                x: window.crop_bot_right.x, 
                y: Math.max(window.crop_bot_right.y + delta.y, window.crop_top_left.y) 
            };
            break;
    }
    crop_center = update_crop_center();
    crop_mouse_down = mouse_pos;

    update_video(window.current_frame.src);
};
video.addEventListener("mousemove", crop_selection_mouse_move);

const crop_selection_mouse_up = () => { crop_state = "idle"; }

video.addEventListener("mouseup", crop_selection_mouse_up);
video.addEventListener("mouseout", crop_selection_mouse_up);

const draw_rectangle = (ctx, p1, p2) => {
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

const draw_cropped = () => {
    let video = document.getElementById("video");
    let ctx = video.getContext("2d");
    let ctx_cropped = cropped.getContext("2d");

    let x_draw_ratio = video.width / video.offsetWidth;
    let y_draw_ratio = video.height / video.offsetHeight;

    const parent_div = cropped.parentNode;
    const max_width = parent_div.offsetWidth * 0.7;
    draw_rectangle(ctx, {x: window.crop_top_left.x * x_draw_ratio, y: window.crop_top_left.y * y_draw_ratio}, 
        {x: window.crop_bot_right.x * x_draw_ratio, y: window.crop_bot_right.y * y_draw_ratio});

    // Drawing the cropped image on the bottom
    // Cropped part
    // Clear the background
    ctx_cropped.fillStyle = "white";
    ctx_cropped.fillRect(0, 0, (window.crop_bot_right.x - window.crop_top_left.x), 
        (window.crop_bot_right.y - window.crop_top_left.y));

    // Compute the ratio between the container and the actual image, then draw image operate in the image coordinate system but draw in the video coordinate system
    const ratio_x = window.current_frame.width / video.offsetWidth;
    const ratio_y = window.current_frame.height / video.offsetHeight;
    const crop_width = parseInt(window.crop_bot_right.x - window.crop_top_left.x);
    const crop_height = parseInt(window.crop_bot_right.y - window.crop_top_left.y);
    const drawing_width = Math.min(max_width, crop_width);
    const drawing_height = drawing_width / crop_width * crop_height;
    cropped.width = drawing_width;
    cropped.height = drawing_height;
    ctx_cropped.drawImage(window.current_frame, window.crop_top_left.x * ratio_x, 
        window.crop_top_left.y * ratio_y, crop_width * ratio_x, crop_height * ratio_y, 0, 0, 
        drawing_width, drawing_height);
};

toggle_crop.addEventListener("click", () => {
    let crop = document.getElementById("crop");
    let crop_label = document.getElementById("crop_label");
    if (window.is_crop_visible == false) {
        //update crop square to be a 10th of the image in the center
        const video = document.getElementById("video");
        let width = video.offsetWidth;
        let height = video.offsetHeight;
        
        let step_w = width * 0.05;
        let step_h = height * 0.05;

        window.crop_top_left = { x: width / 2 - step_w, y: height / 2 - step_h };
        window.crop_bot_right = { x: width / 2 + step_w, y: height / 2 + step_h };

        window.is_crop_visible = true;
        crop.style.display = "block";
        crop_label.style.display = "block";
        update_video(window.current_frame.src);
    } 
    else {
        window.is_crop_visible = false;
        crop.style.display = "none";
        crop_label.style.display = "none";
        update_video(window.current_frame.src);
    }
});
