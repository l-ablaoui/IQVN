let ctrl_pressed = false;
let shift_pressed = false;
let is_selection_dragging = false;

let interval_start = -1;
let interval_end = -1;

let is_timeline_dragging = false;

let timeline = document.getElementById("timeline");

//first draw of component fixing dimensions
timeline.width = timeline.offsetWidth;
timeline.height = timeline.offsetHeight;

/**
 * draws thin verticals lines representing timestamps
 * the length of the interval between each line is computed dynamically
 * so that a total of no more than 10 lines are drawn in the canvas
 * @param {*} max_index the total number of frames in the video (expected to be a non zero positive integer)
 * @param {*} fps video fps rate (expected to be a non zero positive integer)
 * @param {*} svg the canvas where the lines are drawn, expected to be a 2D curve 
 */
const plot_timestamps = (max_index, fps, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;

    let ctx = svg.getContext("2d");

    //check how fine-grained the timestamp has to be and plot markers accordingly
    let unit = 10;
    let i = 1;
    let nb_markers = max_index / fps / unit;
    while (nb_markers >= 10) {
        unit = i * 30;
        nb_markers = max_index / fps / unit;
        ++i;
    }
    const y = plot_height * 0.98;

    //plot markers
    for (let i = 0;i < nb_markers;++i) {
        let x = i * unit * fps / max_index * plot_width;

        //draw line every "unit" seconds
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "lightgray";
        ctx.lineWidth = 0.7;
        ctx.stroke();

        //write timestamp
        ctx.fillStyle = "lightgray";
        ctx.font = "10px arial";
        ctx.fillText(`${Math.trunc((i * unit) / 60)}:${(i * unit) % 60}`, x - 10, y);
    }
};

/**
 * draw defined timestamp, current timestamp marker and selected point as vertical
 * stripes on the rectangle designed to navigate the video temporally
 * @param {*} current_index positive integer that shows the frame currently displayed
 * @param {*} max_index positive integer that represents the number of frames of the video
 * @param {*} fps positive integer that represents the frame per second rate of the video
 */
const plot_timeline = (svg, current_index, selected_points, max_index, fps) => {
    let ctx = svg.getContext("2d");

    let plot_width = svg.width;
    let plot_height = svg.height;

    ctx.clearRect(0, 0, plot_width, plot_height);  

    plot_timestamps(max_index, fps, svg);

    //plot selected points highlight
    if (selected_points != null) {
        for (let i = 0; i < selected_points.length; ++i)  {
            let x = selected_points[i] / (max_index - 1) * plot_width;
            let y1 = plot_height / 3;
            let y2 = 2 * plot_height / 3;
            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
            ctx.strokeStyle = SELECTION_COLOR;
            ctx.stroke();
        }
    }
    plot_marker_triangle(current_index, max_index, svg, 0, 0, 0, "black");
    plot_current_timer(current_index, max_index, fps, svg, 0, 0);
    plot_marker(current_index, max_index, 0, 0, 0, "black", 0.7, svg);
};

//mouse mouvement listeners
const navigate_mousedown = () => { is_timeline_dragging = true; }
const navigate_mousemove = (event) => { 
    is_timeline_dragging && update_frame_index_onclick(timeline, 0, 0, 0, window.max_index, event); 
};
const navigate_mouseup = (event) => {
    is_timeline_dragging && update_frame_index_onclick(timeline, 0, 0, 0, window.max_index, event);
    is_timeline_dragging = false;
}; 
const navigate_mouseout = () => { is_timeline_dragging = false; };

timeline.addEventListener("mousedown", navigate_mousedown);
timeline.addEventListener("mousemove", navigate_mousemove);
timeline.addEventListener("mouseup", navigate_mouseup);
timeline.addEventListener("mouseout", navigate_mouseout);

//keys interaction
//this insures the timeline gets focused on click
timeline.addEventListener("click", focus_onclick);

timeline.addEventListener("keydown", navigate_video_onkeydown);

//selection handling
const timeline_selection_keychange = (event) => {
    ctrl_pressed = event.ctrlKey;
    shift_pressed = event.shiftKey;
};

/**
 * mousedown triggered method, initializes the selection intervals to the frame corresponding to the clicking 
 * area
 * @param {*} svg timeline canvas element
 * @param {*} offset_left left margin that is ignored when clicking
 * @param {*} offset_right right margin that is ignored when clicking
 * @param {*} offset_y both top and bottom margins that are ignored when clicking
 * @param {*} nb_values max number of frames, used for corresponding clicked area with an actual frame number
 * @param {*} event used to track the click area
 */
const timeline_selection_mousedown = (svg, offset_left, offset_right, offset_y, nb_values, event) => {
    //get frame that corresponds to current mouse position
    const mouse_x = event.offsetX;
    const mouse_y = event.offsetY;

    const plot_width = svg.width;
    const plot_height = svg.height;

    //case clicked on the offset
    if (offset_y > mouse_y || mouse_y > plot_height - offset_y) { return; }
    if (offset_left > mouse_x || mouse_x > plot_width - offset_right) { return; }

    const frame_index = Math.trunc((mouse_x - offset_left) / (plot_width - offset_right - offset_left) 
        * (nb_values - 1));

    //init start and end of selection interval
    interval_start = frame_index;
    interval_end = frame_index;
    console.log(interval_start, interval_end, frame_index);
}

/**
 * mousemove triggered method, updates the selected_points array according to the selected frames on the
 * timeline using drag + ctrl + shift interaction. 
 * 
 * drag + ctrl => add selected points to the selection
 * drag + ctrl + shift => remove selected points from the selection
 * @param {*} svg timeline canvas element
 * @param {*} offset_left left margin that is ignored when clicking
 * @param {*} offset_right right margin that is ignored when clicking
 * @param {*} offset_y both top and bottom margins that are ignored when clicking
 * @param {*} nb_values max number of frames, used for corresponding clicked area with an actual frame number
 * @param {*} selected_points array of integers that represent already selected frames, can be empty
 * @param {*} event used to track the click area
 */
const timeline_selection_mousemove = (svg, offset_left, offset_right, offset_y, nb_values, selected_points, event) => {
    //if CTRL is not pressed down, skip
    if (!ctrl_pressed) { return; }

    //get frame that corresponds to current mouse position
    const mouse_x = event.offsetX;
    const mouse_y = event.offsetY;

    const plot_width = svg.width;
    const plot_height = svg.height;

    //case clicked on the offset
    if (offset_y > mouse_y || mouse_y > plot_height - offset_y) { return; }
    if (offset_left > mouse_x || mouse_x > plot_width - offset_right) { return; }

    const frame_index = Math.trunc((mouse_x - offset_left) / (plot_width - offset_right - offset_left) 
        * (nb_values - 1));

    // Update the start and end of the interval based on the mouse position
    interval_start = Math.min(interval_start, frame_index);
    interval_end = Math.max(interval_end, frame_index);

    //create array of selected frames [interval_start, interval_end]
    const interval_length = interval_end - interval_start + 1;
    let interval;
    if (interval_length > 0) {
        interval = Array.from({ length: interval_length }, (_, i) => interval_start + i);
    }
    else {
        interval = [interval_start];
    }
    console.log(interval_start, interval_end, interval);

    // Combine interval with selected points depending on pressed keys
    let new_selected_points;
    if (shift_pressed) {
        new_selected_points = difference(selected_points, interval);
    } else {
        new_selected_points = union(selected_points, interval);
    }

    // Update the passed array by clearing it and repopulating it
    selected_points.length = 0; // Clear the original array
    Array.prototype.push.apply(selected_points, new_selected_points); // Add new elements

    update_scores(window.current_index);
}

timeline.addEventListener("mousedown", (event) => {
    timeline_selection_mousedown(timeline, 0, 0, 0, window.max_index, event);
    is_selection_dragging = true;
});
timeline.addEventListener("mousemove", (event) => {
    is_selection_dragging && timeline_selection_mousemove(timeline, 0, 0, 0, window.max_index, 
        window.selected_points, event);
});
timeline.addEventListener("mouseup", (event) => {
    is_selection_dragging && timeline_selection_mousemove(timeline, 0, 0, 0, window.max_index,
        window.selected_points, event);
    is_selection_dragging = false;
    console.log(window.selected_points);
});
timeline.addEventListener("mouseout", (event) => {
    is_selection_dragging && timeline_selection_mousemove(timeline, 0, 0, 0, window.max_index,
        window.selected_points, event);
    is_selection_dragging = false;
    console.log(window.selected_points);
});

timeline.addEventListener("keydown", timeline_selection_keychange);
timeline.addEventListener("keyup", timeline_selection_keychange);
