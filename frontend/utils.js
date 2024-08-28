/** makes element focusable */
const focus_onclick = () => { timeline.focus(); };

const union = (array_a, array_b) => {
    let set = new Set([...array_a, ...array_b]); // Use a Set to automatically handle duplicates
    return Array.from(set);
};

const difference = (array_a, array_b) => {
    let set_b = new Set(array_b);
    let difference = array_a.filter(element => !set_b.has(element)); //A - B
    return difference;
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
 * plots the current time (window.current_index / window.fps) either on the left or the right
 * of the marker (assuming this one is drawn). assumes also a 2D curve plot
 * @param {*} current_index selected video frame index (positive integer)
 * @param {*} max_index number of frames in the video (positive integer)
 * @param {*} fps video fps rate, assumed to be a non-zero positive integer
 * @param {*} svg canvas element where the time is to be drawn
 * @param {*} offset_left space to be left on the left of the X axis
 * @param {*} offset_right space to be right on the left of the X axis
 */
const plot_current_timer = (current_index, max_index, fps, svg, offset_left, offset_right) => {
    let plot_width = svg.width;
    let plot_height = svg.height;

    let ctx = svg.getContext("2d");

    let offset = plot_height / 30 + 5;
    if (current_index >= max_index / 2) { offset = - offset - 20; }
    let timestamp = current_index / fps;

    let x = offset_left + current_index / max_index * (plot_width - offset_left - offset_right);
    ctx.beginPath();
    ctx.fillStyle = "black";
    ctx.font = "10px arial";
    ctx.fillText(
        `${Math.trunc((timestamp) / 60)}:${Math.trunc((timestamp)) % 60}`,
        x + offset, plot_height * 0.1
    );
};

/**
 * drawing of the small triangle above the timestamp line marker
 * @param {*} current_index selected video frame index (positive integer)
 * @param {*} max_index number of frames in the video (positive integer)
 * @param {*} svg canvas element where the time is to be drawn
 * @param {*} offset_left space to be left on the left of the X axis
 * @param {*} offset_right space to be right on the left of the X axis
 * @param {*} offset_y both top and bottom margin
 */
const plot_marker_triangle = (current_index, max_index, svg, offset_left, offset_right, offset_y, fill_color) => {
    let ctx = svg.getContext("2d");

    let plot_width = svg.width;

    //convert index to canvas x
    let plot_x = offset_left + current_index / (max_index - 1) * (plot_width - offset_left - offset_right);

    //define coordinates
    let top_left = { x: plot_x - 5 * 2 / 3, y: offset_y };
    let top_right = { x: plot_x + 5 * 2 / 3, y: offset_y };
    let mid_left = { x: plot_x - 5 * 2 / 3, y: offset_y + 5 };
    let mid_right = { x: plot_x + 5 * 2 / 3, y: offset_y + 5 };
    let bottom_center = { x: plot_x, y: offset_y + 5 * 2 };

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
}

const format_time = (seconds_count) => {
    const hours = Math.floor(seconds_count / 3600)
    const minutes = Math.floor((seconds_count - hours * 3600) / 60);
    const seconds = seconds_count % 60;
    
    return /*`${String(hours).padStart(2, '0')}:` + */`${String(minutes).padStart(2, '0')}:`
        + `${String(seconds).padStart(2, '0')}`;
};

const parse_selected_frames = (max_index, selected_points) => {
    //represent the selected frames in a boolean manner
    let bool_timestamps = new Array(max_index).fill(0);
    selected_points.forEach((element) => {
        bool_timestamps[element] = 1;
    });

    //parse time intervals into string
    const intervals = bool_timestamps.reduce((acc, cur, i, arr) => {
        if (cur && (i === 0 || !arr[i - 1])) acc.push([i]);  // Start of a new interval
        if (!cur && arr[i - 1]) acc[acc.length - 1].push(i); // End of an interval
        if (cur && i === arr.length - 1) acc[acc.length - 1].push(i + 1); // End interval if last element is 1
        return acc;
    }, []).map(([start, end]) => `${format_time(start)}-${format_time(end - 1)}`).join('; ');

    return intervals;
};
