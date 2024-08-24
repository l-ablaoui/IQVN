/***********************/
/*variables declaration*/
/***********************/
//to keep space between plot and canvas boundaries (reduction plots)
let reduction_plot_offset_x;
let reduction_plot_offset_y = 20;

//document components
let text_search_button = document.getElementById("text_search_button");
let image_search_button = document.getElementById("image_search_button");

let object_detection_button = document.getElementById("object_detection_button");
let depthEstimate = document.getElementById("depthmap_computation_button");

let toggle_obj = document.getElementById("toggle_obj");
let toggle_scores = document.getElementById("toggle_scores");
let toggle_reduction = document.getElementById("toggle_reduction");
let toggle_depth = document.getElementById("toggle_depth");
let toggle_crop = document.getElementById("toggle_crop");

//hiding canvas and buttons at first
document.getElementById("obj_div").style.display = "none";
document.getElementById("score_div").style.display = "none";
document.getElementById("reduction_div").style.display = "none";
document.getElementById("depth_div").style.display = "none";
document.getElementById("crop").style.display = "none";
document.getElementById("crop_label").style.display = "none";
toggle_obj.style.display = "none";
toggle_scores.style.display = "none";
toggle_reduction.style.display = "none";
toggle_depth.style.display = "none";

const server_url = 'http://localhost:8000';

/*********************/
/*methods declaration*/
/*********************/

const union = (array_a, array_b) => {
    let set = new Set([...array_a, ...array_b]); // Use a Set to automatically handle duplicates
    return Array.from(set);
};

const intersection = (array_a, array_b) => {
    let set_a = new Set(array_a);
    let intersection = array_b.filter(element => set_a.has(element));
    return intersection;
};

const difference = (array_a, array_b) => {
    let set_b = new Set(array_b);
    let difference = array_a.filter(element => !set_b.has(element)); //A - B
    return difference;
};

/**
 * @param {*} p1 2d point coordinates 
 * @param {*} p2 another 2d point cootdinates 
 * @returns euclidian distance (power 2)
 */
const length2 = (p1, p2) => {
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
};

/**
 * utility function to draw a dot in a canvas
 * @param {*} ctx canvas context
 * @param {*} point coordinates (dot center)
 * @param {*} radius dot radius
 */
const fill_circle = (ctx, point, radius) => {
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius, radius, 0, 0, 2 * Math.PI);
    ctx.fill();
};

/**
 * utility function to draw a vertical line in a 2d plot inside a canvas
 * @param {*} current_index logical x coordinate of the marker, corresponds to the current frame number (video frame) in this usecase
 * @param {*} max maximum value in the x axis, corresponds to the number of frame in the video in this usecase
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} color color of the line marker
 * @param {*} line_width line width of the line marker
 * @param {*} svg canvas where the line is drawn
 */
const plot_marker = (current_index, max, offset_left, offset_right, offset_y, color, line_width, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;
    let ctx = svg.getContext("2d");
    let x = offset_left + (current_index / (max - 1)) * (plot_width - offset_left - offset_right);
    
    ctx.beginPath();
    ctx.moveTo(x, offset_y);
    ctx.lineTo(x, plot_height - offset_y);
    ctx.strokeStyle = color;
    ctx.lineWidth = line_width;
    ctx.stroke();
};

/**
 * utility function to draw the x/y axes of a 2D plot in a canvas
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} svg canvas where the axes are drawn
 */
const plot_axes = (offset_left, offset_right, offset_y, svg) => {
    let lenX = svg.width;
    let lenY = svg.height;
    let ctx = svg.getContext("2d");

    //draw x axis
    ctx.beginPath();
    ctx.moveTo(offset_left, lenY - offset_y);
    ctx.lineTo(lenX - offset_right, lenY - offset_y);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();

    //draw arrow at the end of the x axis
    ctx.beginPath();
    ctx.moveTo(lenX - offset_right, lenY - offset_y);
    ctx.lineTo(lenX - offset_right - 5, lenY - offset_y + 5);
    ctx.lineTo(lenX - offset_right - 5, lenY - offset_y - 5);
    ctx.closePath();
    ctx.fillStyle = "black";
    ctx.fill();

    //draw y axis
    ctx.beginPath();
    ctx.moveTo(offset_left, offset_y);
    ctx.lineTo(offset_left, lenY - offset_y);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();

    //draw arrow at the end of the y axis
    ctx.beginPath();
    ctx.moveTo(offset_left, offset_y);
    ctx.lineTo(offset_left + 5, offset_y + 5);
    ctx.lineTo(offset_left - 5, offset_y + 5);
    ctx.closePath();
    ctx.fillStyle = "black";
    ctx.fill();
    ctx.stroke();
};

/**
 * plots the current time (window.current_index / window.fps) either on the left or the right
 * of the marker (assuming this one is drawn). assumes also a 2D curve plot
 * @param {*} current_index selected video frame index
 * @param {*} max_index number of frames in the video, assumed to be a non-zero positive integer
 * @param {*} fps video fps rate, assumed to be a non-zero positive integer
 * @param {*} svg canvas element where the time is to be drawn
 * @param {*} offset_left space to be left on the left of the X axis
 * @param {*} offset_right space to be right on the left of the X axis
 */
let plot_current_timer = (current_index, max_index, fps, svg, offset_left, offset_right) => {
    let plot_width = svg.width;
    let plot_height = svg.height;

    let ctx = svg.getContext("2d");

    let offset = plot_height / 30 + 5;
    if (current_index >= max_index / 2) { offset = - offset - 20; }
    let timestamp = current_index / fps;

    let x = offset_left + current_index / max_index * (plot_width - offset_left - offset_right);
    ctx.beginPath();
    ctx.fillStyle = "darkgray";
    ctx.font = "10px arial";
    ctx.fillText(
        `${Math.trunc((timestamp) / 60)}:${Math.trunc((timestamp)) % 60}`,
        x + offset, plot_height * 0.1
    );
};

/**
 * drawing of the small triangle above the timestamp line marker
 * @param {*} current_index 
 * @param {*} max_index 
 * @param {*} svg 
 * @param {*} offset_left 
 * @param {*} offset_right 
 * @param {*} offset_y 
 */
let plot_marker_triangle = (current_index, max_index, svg, offset_left, offset_right, offset_y, fill_color) => {
    let ctx = svg.getContext("2d");

    let plot_width = svg.width;
    let plot_height = svg.height;
    const triangle_length = (plot_height - 2 * offset_y) / 25;

    //convert index to canvas x
    let plot_x = offset_left + current_index / (max_index - 1) * (plot_width - offset_left - offset_right);

    //define coordinates
    let top_left = { x: plot_x - triangle_length * 2 / 3, y: offset_y };
    let top_right = { x: plot_x + triangle_length * 2 / 3, y: offset_y };
    let mid_left = { x: plot_x - triangle_length * 2 / 3, y: offset_y + triangle_length };
    let mid_right = { x: plot_x + triangle_length * 2 / 3, y: offset_y + triangle_length };
    let bottom_center = { x: plot_x, y: offset_y + triangle_length * 2 };

    // Start drawing the triangle
    ctx.beginPath();
    ctx.moveTo(bottom_center.x, bottom_center.y); // Bottom point
    ctx.lineTo(mid_left.x, mid_left.y); // Mid left point
    ctx.lineTo(top_left.x, top_left.y); // Top left point
    ctx.lineTo(top_right.x, top_right.y); // Top right point
    ctx.lineTo(mid_right.x, mid_right.y); // Mid right point
    ctx.closePath();

    // Fill the triangle with a color
    ctx.fillStyle = fill_color;
    ctx.fill();
};

/**
 * draw video frame in the dedicated video canvas
 * @param {*} image_url video's current frame
 */
const update_video = (image_url) => {
    // Set the image source to the created URL
    window.current_frame.src = image_url;

    // Wait for the image to load
    window.current_frame.onload = () => {
        // Access the width and height properties
        const width = window.current_frame.width;
        const height = window.current_frame.height;

        // Get the canvas element
        const canvas = document.getElementById("video");
        const ctx = canvas.getContext("2d");

        // Set canvas dimensions to match the image
        canvas.width = width;
        canvas.height = height;

        // Clear any previous content on the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the image onto the canvas
        ctx.drawImage(window.current_frame, 0, 0, width, height);

        if (window.is_crop_visible) { draw_cropped(); }
    };
};

/**
 * this function is called to update all data visualisation components
 * @param {*} frame_index currently visualised video frame's index
 */
const update_scores = (frame_index) => {
    if (window.current_index != frame_index) { 
        window.current_index = frame_index; 
    }
    // Update plot
    plot_timeline(frame_index, window.max_index, window.fps);
    if (obj_plot.style.display == "block") {
        console.log("plotting object graph");
        plot_objects(frame_index);
    }
    if (score_plot.style.display == "block") {
        console.log("plotting score curve");
        plot_score_curve(frame_index);
    }
    if (reduction_plot.style.display == "block") {
        console.log("plotting semantic distribution");
        plot_dimension_reduction(frame_index);
    }
    if (depth_video.style.display == "block") {
        update_depth_video(frame_index);
    }
};

/***********/
/*Listeners*/
/***********/

/**
 * debouce prevents function call before the delay passes, used to offload mousemove calls
 * @param {*} func  function to be debounced
 * @param {*} delay ms unit 
 * @returns debounced function reference
 */
let debounce = (func, delay) => {
    let timeout_id;
    return (...args) => {
        if (timeout_id) {
            clearTimeout(timeout_id);
        }
        timeout_id = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

//resize listener has to addapt the sizes of each component that has height as a function of width
window.addEventListener("resize", () => {
    //update components' relative sizes
    let video_canvas = document.getElementById("video");
    video_canvas.width = video_canvas.offsetWidth;
    video_canvas.height = video_canvas.offsetHeight;

    let score_plot = document.getElementById("score_plot");
    score_plot.width = score_plot.offsetWidth;
    score_plot.height = score_plot.width * 0.4;

    let reduction_plot = document.getElementById("reduction_plot");
    reduction_plot.width = reduction_plot.offsetWidth;
    reduction_plot.height = reduction_plot.width * 0.7;
    reduction_plot_offset_x = reduction_plot.width * 0.15;

    let obj_plot = document.getElementById("obj_plot");
    obj_plot.width = obj_plot.offsetWidth;
    obj_plot.height = obj_plot.width * 0.7;

    let timeline = document.getElementById("timeline");
    timeline.width = timeline.offsetWidth;
    timeline.height = timeline.offsetHeight;

    //redraw everything
    update_video(window.current_frame.src);
    update_scores(window.current_index);
});

const fetch_frame_by_index = async (frame_index) =>  {
    try {
        //fetch current frame
        let name_processed = window.current_video.split(".")[0]; 
        const response = await fetch(`${server_url}/image/${name_processed}/${frame_index}.png`);
        const blob = await response.blob();
        const image_url = URL.createObjectURL(blob);
    
        window.current_frame.src = image_url;
        update_video(window.current_frame.src);
        update_scores(frame_index);
    }
    catch (error) {
        console.error("Error getting frame ", frame_index, " of the video: ", error);
    }
};

/**
 * onClick method used in canvas with a drawn 2D plot/curve. It updates the current frame
 * index based on the logical x axis value
 * @param {*} svg canvas where the plot/curve is drawn
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} nb_values maximum value in the x axis, corresponds to the number of frame in the video in this usecase
 * @param {*} event captures the coordinates of the click 
 */
const update_frame_index_onclick = async (svg, offset_left, offset_right, offset_y, nb_values, event) => {
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    const plot_width = svg.width;
    const plot_height = svg.height;

    //case clicked on the offset
    if (offset_y > mouseY || mouseY > plot_height - offset_y) { return; }
    if (offset_left > mouseX || mouseX > plot_width - offset_right) { return; }

    const frame_index = Math.trunc((mouseX - offset_left) / (plot_width - offset_right - offset_left) 
        * (nb_values - 1));
    await fetch_frame_by_index (frame_index);
};

/** makes element focusable */
const focus_onclick = () => { timeline.focus(); };

/**
 * keyboard interaction to move forward or backwards in the video
 * assuming usage on a focusable element of the interface
 * @param {*} event click area
 */
const navigate_video_onkeydown = async (event) => {
    switch (event.code) {
        case "ArrowLeft":
        case "ArrowDown":
        case "KeyA":
        case "KeyW":
            window.current_index = Math.max(window.current_index - 1, 0);
            break;
        case "ArrowRight": 
        case "ArrowUp":
        case "KeyD":
        case "KeyS":
            window.current_index = Math.min(window.current_index + 1, window.max_index - 1);
            break;
        case "default":
            return;
    }

    try {
        let name_processed = window.current_video.split(".")[0]; 
        const response = await fetch(
            `${server_url}/image/${name_processed}/${window.current_index}.png`
        );
        const blob = await response.blob();
        const image_url = URL.createObjectURL(blob);

        window.current_frame.src = image_url;
        update_video(window.current_frame.src);
        update_scores(window.current_index);
    }
    catch (error) {
        console.error("Error getting video frame ", window.current_frame, " : ", error);
    }
};

const getDataURL = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

/*Image-based search, needs the cropped image to be defined (hover over the video)
and expecting an array of window.scores plus a reduction array from the server*/
image_search_button.addEventListener('click', async () => {
    let score_plot_loader = document.getElementById("score_plot_loader");
    let reduction_plot_loader = document.getElementById("reduction_plot_loader");
    let general_loader = document.getElementById("general_loader");
    score_plot_loader.style.display = "block";
    reduction_plot_loader.style.display = "block";
    general_loader.style.display = "block";

    try {
        let dataURL = cropped.toDataURL('image/png');
        if (window.is_crop_visible == false) {
            const file = image_load.files[0];
            if (file) { dataURL = await getDataURL(file); }
        }
        const response = await fetch(`${server_url}/upload_png/`, 
            {method: 'POST', body: JSON.stringify({ image_data: dataURL }), 
            headers: {'Content-Type': 'application/json'}});
        const body = await response.json();
        console.log(body);

        //only keep window.scores and tsne reduction values
        window.scores = body['scores'].map(function(value, index) { return value[1]; });
        
        //update component
        update_video(window.current_frame);

        //show buttons for toggling window.scores/reduction
        toggle_scores.style.display = "block";
        document.getElementById("score_plot").addEventListener("click", (event) => update_frame_index_onclick(score_plot, 
            score_plot_offset_left, score_plot_offset_right, score_plot_offset_y, window.max_index, event));

        //update the curve plot
        update_scores(window.current_index);
    }
    catch (error) {
        console.error("Error loading similarity scores for image query: ", error);
    }

    score_plot_loader.style.display = "none";
    reduction_plot_loader.style.display = "none";
    general_loader.style.display = "none";
});

const go_to_timestamp_onclick = async () => {
    const timestamp = document.getElementById("timestamp_input").value;
    if (timestamp < 0 || timestamp * window.fps > window.max_index) { return; }
    await fetch_frame_by_index(Math.trunc(timestamp * window.fps));
};

const go_to_frame_number_onclick = async () => {
    const frame_index = document.getElementById("frame_number_input").value;
    if (frame_index < 0 || frame_index > window.max_index) { return; }
    await fetch_frame_by_index(Math.trunc(frame_index));
};

document.getElementById("go_to_timestamp").addEventListener("click", go_to_timestamp_onclick);
document.getElementById("timestamp_input").addEventListener("keydown", async (event) => { 
    (event.key === "Enter") && await go_to_timestamp_onclick();
});

document.getElementById("go_to_frame_number").addEventListener("click", go_to_frame_number_onclick);
document.getElementById("frame_number_input").addEventListener("keydown", async (event) => {
    (event.key === "Enter") && await go_to_frame_number_onclick();
});

const format_time = (seconds_count) => {
    const hours = Math.floor(seconds_count / 3600)
    const minutes = Math.floor((seconds_count - hours * 3600) / 60);
    const seconds = seconds_count % 60;
    
    return /*`${String(hours).padStart(2, '0')}:` + */`${String(minutes).padStart(2, '0')}:`
        + `${String(seconds).padStart(2, '0')}`;
};

const parse_selected_frames = () => {
    //represent the selected frames in a boolean manner
    let bool_timeline_frames = new Array(window.max_index).fill(0);
    window.selected_points.forEach((element) => {
        bool_timeline_frames[element] = 1;
    });

    //subsample frames to get seconds
    const bool_timestamps = bool_timeline_frames.filter((_, index) => index % window.fps === 0);

    //parse time intervals into string
    const intervals = bool_timestamps.reduce((acc, cur, i, arr) => {
        if (cur && (i === 0 || !arr[i - 1])) acc.push([i]);  // Start of a new interval
        if (!cur && arr[i - 1]) acc[acc.length - 1].push(i); // End of an interval
        if (cur && i === arr.length - 1) acc[acc.length - 1].push(i + 1); // End interval if last element is 1
        return acc;
    }, []).map(([start, end]) => `${format_time(start)}-${format_time(end - 1)}`).join('; ');

    return intervals;
};

document.getElementById("copy_selected").addEventListener("click", () => {
    const parsed_selected_frames = parse_selected_frames();

    navigator.clipboard.writeText(parsed_selected_frames)
        .then(() => {
            console.log('Text copied to clipboard');
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
        });
});
//hide button but leave it for later use
document.getElementById("copy_selected").style.display = "none";
