//offset, to keep space between plot and canvas boundaries
const score_plot_offset_left = 35;
const score_plot_offset_right = 12;
let score_plot_offset_y = 20;
let is_thresholding = false;
let threshold = 0.8;
let is_threshold_dragging = false;
let selected_score_spikes = [];

let generate_score_color_map = () => {
    let color_map = [];

    for (let i = 0;i < window.scores.length;++i) {
        //check if current point is selected
        let found = false;
        for (let j = 0;j < window.selected_points.length;++j) {
            if (i == window.selected_points[j]) {
                found = true;
            }
        }
        color_map.push((found)? `rgb(${SELECTION_COLORS[0].red},
            ${SELECTION_COLORS[0].green},
            ${SELECTION_COLORS[0].blue})` : window.REGULAR_COLOR);
    }

    return color_map;
}

const draw_selector = (threshold, offset_left, offset_right, offset_y, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;
    let ctx = svg.getContext("2d");
    let y = offset_y + (1 - threshold) * (plot_height - 2 * offset_y);
    
    //line
    ctx.beginPath();
    ctx.moveTo(offset_left, y);
    ctx.lineTo(plot_width - offset_right, y);
    ctx.strokeStyle = window.EMPHASIS_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    //left triangle
    ctx.beginPath();
    ctx.moveTo(offset_left, y - 6);
    ctx.lineTo(offset_left, y + 6);
    ctx.lineTo(offset_left + 6, y);
    ctx.closePath();
    ctx.fillStyle = window.EMPHASIS_COLOR;
    ctx.fill();
    ctx.closePath();

    //right triangle
    ctx.beginPath();
    ctx.moveTo(plot_width - offset_right, y - 6);
    ctx.lineTo(plot_width - offset_right, y + 6);
    ctx.lineTo(plot_width - offset_right - 6, y);
    ctx.closePath();
    ctx.fillStyle = window.EMPHASIS_COLOR;
    ctx.fill();
    ctx.closePath();
}

//Plot the score curve
const plot_score_curve = (current_index) => {
    let score_plot = document.getElementById("score_plot");

    if (window.scores == null) { return; }

    //normalize scores array
    let min_score = Math.min(...window.scores);
    let max_score = Math.max(...window.scores);
    let scaled_scores = window.scores.map(score => (score - min_score) / (max_score - min_score));

    //canvas with/length
    let plot_width = score_plot.width;
    let plot_height = score_plot.height;

    //reset the drawing
    let ctx = score_plot.getContext("2d");
    ctx.clearRect(0, 0, plot_width, plot_height);

    plot_axes(score_plot_offset_left, 0, score_plot_offset_y, score_plot);

    // Draw scale values on y-axis
    for (let i = 0; i < 5; i += 1) {
        const yPos = plot_height - score_plot_offset_y - (i / 5) * (plot_height - 2 * score_plot_offset_y);

        //Math.trunc(value * 100) / 100 := a precision of 0.01
        ctx.fillText(Math.trunc(((4 - i) * min_score / 4 + i / 4 * max_score) * 100) 
            / 100.0, score_plot_offset_left / 4, yPos);
    }

    // Draw scale values on x-axis
    //check how fine-grained the timestamp has to be and plot markers accordingly
    let unit = 10;
    let i = 1;
    let nb_markers = window.max_index / window.fps / unit;
    while (nb_markers >= 10) {
        unit = i * 30;
        nb_markers = window.max_index / window.fps / unit;
        ++i;
    }

    const y = plot_height - score_plot_offset_y / 2;
    for (let i = 0;i < nb_markers;++i) {
        let x = score_plot_offset_left + i * unit * window.fps / window.max_index * 
            (plot_width - score_plot_offset_left - score_plot_offset_right);

        //write timestamp
        ctx.fillText(`${Math.trunc((i * unit) / 60)}:${(i * unit) % 60}`, x - 10, y);
    }

    //draw the curve
    ctx.beginPath();
    let previous_x = score_plot_offset_left;
    let previous_y = plot_height - scaled_scores[0] * (plot_height - 2 * score_plot_offset_y);
    let color_map = generate_score_color_map(); 

    // Iterate through the points
    for (let i = 1; i < scaled_scores.length; i++) {
        let x = score_plot_offset_left + (i / (scaled_scores.length - 1)) * 
            (plot_width - score_plot_offset_right - score_plot_offset_left);
        let y = plot_height - score_plot_offset_y - scaled_scores[i] * 
            (plot_height - 2 * score_plot_offset_y);

        // Start a new path segment with the new color
        currentPath = new Path2D();
        currentPath.moveTo(previous_x, previous_y);
        currentPath.lineTo(x, y);
        ctx.strokeStyle = color_map[i];
        ctx.stroke(currentPath);

        //update old position
        previous_x = x;
        previous_y = y;
    }

    if (is_thresholding) {
        draw_selector(threshold, score_plot_offset_left, score_plot_offset_right,
            score_plot_offset_y, score_plot);
    }
    else {
        plot_marker(current_index, window.max_index, score_plot_offset_left, 
            score_plot_offset_right, score_plot_offset_y, window.EMPHASIS_COLOR, 
            1, score_plot);
        plot_marker_triangle(current_index, window.max_index, score_plot, 
            score_plot_offset_left, score_plot_offset_right, score_plot_offset_y, window.EMPHASIS_COLOR);
        plot_current_timer(current_index, window.max_index, window.fps, score_plot, 
            score_plot_offset_left, score_plot_offset_right);
    }
    
};

const get_scores_above_threshold = (scores, threshold) => {
    if (scores == null) { return; }

    //normalize scores array
    let min_score = Math.min(...scores);
    let max_score = Math.max(...scores);
    let scaled_scores = scores.map(score => (score - min_score) / (max_score - min_score));

    return scaled_scores.reduce((acc, num, index) => {
        if (num > threshold) acc.push(index);
        return acc;
    }, []);
};

const threshold_mouse_down = () => { 
    is_threshold_dragging = true; 

    const today = new Date;
    const time_log = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()} `
        + `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()} : `
        + ` begin thresholding in score plot`;

    fetch (`${server_url}/log/`, {
        method: 'POST', 
        body: JSON.stringify({interaction_log: time_log}),
        headers: {'Content-Type': 'application/json'}
    });
};

const threshold_mouse_move = (event, offset_y, svg) => { 
    if (!is_threshold_dragging) { return; }
    let mouse_y = event.offsetY;
    let plot_height = svg.height;

    threshold = 1 - Math.max(0, Math.min(1, (mouse_y - offset_y) / (plot_height - 2 * offset_y)));
    window.all_thresholds[window.focused_sentence] = threshold;
    update_focused_threshold();

    selected_score_spikes = [];
    selected_score_spikes = get_scores_above_threshold(window.scores, threshold);
    window.selected_points = selected_score_spikes;
    update_scores(window.current_index);
};

const threshold_mouse_up = (event, offset_y, svg) => { 
    is_threshold_dragging = false;

    let mouse_y = event.offsetY;
    let plot_height = svg.height;

    threshold = 1 - Math.max(0, Math.min(1, (mouse_y - offset_y) / (plot_height - 2 * offset_y)));
    update_focused_threshold();

    selected_score_spikes = get_scores_above_threshold(window.scores, threshold);
    window.selected_points = selected_score_spikes;
    update_scores(window.current_index);

    const today = new Date;
    const time_log = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()} `
        + `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()} : `
        + ` end thresholding in score plot. Current threshold: ${threshold.toFixed(2)}`;

    fetch (`${server_url}/log/`, {
        method: 'POST', 
        body: JSON.stringify({interaction_log: time_log}),
        headers: {'Content-Type': 'application/json'}
    });
}

//duplicating the storage of mouseup and mousemove for the sake of keeping a deletable reference
const threshold_final_mouse_move = (event) => threshold_mouse_move(event, score_plot_offset_y, score_plot);
const threshold_final_mouse_up = (event) => threshold_mouse_up(event, score_plot_offset_y, score_plot);

let select_threshold = document.getElementById("select_threshold");
select_threshold.addEventListener("click", () => {
    let score_plot = document.getElementById("score_plot");
    if (is_thresholding) {
        score_plot.removeEventListener("mousedown", threshold_mouse_down);
        score_plot.removeEventListener("mousemove",threshold_final_mouse_move);
        score_plot.removeEventListener("mouseup", threshold_final_mouse_up);
        is_thresholding = false;
    }
    else {
        score_plot.addEventListener("mousedown", threshold_mouse_down);
        score_plot.addEventListener("mousemove", threshold_final_mouse_move);
        score_plot.addEventListener("mouseup", threshold_final_mouse_up);
        selected_score_spikes = [];
        selected_score_spikes = get_scores_above_threshold(window.scores, threshold);
        window.selected_points = selected_score_spikes;
        is_thresholding = true;
    }
    update_scores(window.current_index);
});

let reset_score_plot = document.getElementById("reset_score_plot");
reset_score_plot.addEventListener("click", () => {
    if (is_thresholding) {
        score_plot.removeEventListener("mousedown", threshold_mouse_down);
        score_plot.removeEventListener("mousemove",threshold_final_mouse_move);
        score_plot.removeEventListener("mouseup", threshold_final_mouse_up);
        is_thresholding = false;
    }
    is_thresholding = false;
    window.selected_points = [];
    update_scores(window.current_index);
});

toggle_scores.addEventListener("click", () => {
    let x = document.getElementById("score_div");
    if (x.style.display === "none") {
        x.style.display = "block";
        toggle_scores.value = "▼ Similarity scores chart";

        let score_plot = document.getElementById("score_plot");
        score_plot.style.display = "block";
        score_plot.width = score_plot.offsetWidth;
        score_plot.height = score_plot.width * 0.4;

        plot_score_curve(window.current_index);
    } 
    else {
        x.style.display = "none";
        toggle_scores.value = "▲ Similarity scores chart";
    }
});

const score_plot = document.getElementById("score_plot");
score_plot.addEventListener("click", focus_onclick);
score_plot.addEventListener("keydown", navigate_video_onkeydown);
