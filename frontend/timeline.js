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
const plot_timeline = (current_index, max_index, fps) => {
    let timeline = document.getElementById("timeline");
    let ctx = timeline.getContext("2d");

    let plot_width = timeline.width;
    let plot_height = timeline.height;

    ctx.clearRect(0, 0, plot_width, plot_height);  

    plot_timestamps(max_index, fps, timeline);

    //plot selected points highlight
    if (window.scores != null && window.selected_points != null) {
        for (let i = 0; i < window.selected_points.length; ++i)  {
            let x = window.selected_points[i] / (window.scores.length - 1) * plot_width;
            let y1 = plot_height / 3;
            let y2 = 2 * plot_height / 3;
            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
            ctx.strokeStyle = `rgba(
                ${SELECTION_COLORS[0].red},
                ${SELECTION_COLORS[0].green},
                ${SELECTION_COLORS[0].blue},
                ${(window.current_selection == i)? 0.8 : 0.4})`;
            ctx.stroke();
        }
    }
    plot_marker_triangle(current_index, max_index, timeline, 0, 0, 0, "black");
    plot_current_timer(current_index, max_index, fps, timeline, 0, 0);
    plot_marker(current_index, max_index, 0, 0, 0, "black", 0.7, timeline);
};

let is_timeline_dragging = false;

let timeline = document.getElementById("timeline");

//first draw of component fixing dimensions
timeline.width = timeline.offsetWidth;
timeline.height = timeline.offsetHeight;

//mouse mouvement listeners
timeline.addEventListener("mousedown", () => { is_timeline_dragging = true; });
timeline.addEventListener("mousemove", (event) => { 
    is_timeline_dragging && update_frame_index_onclick(timeline, 0, 0, 0, window.max_index, event); 
} );
timeline.addEventListener("mouseup", (event) => {
    update_frame_index_onclick(timeline, 0, 0, 0, window.max_index, event);
    is_timeline_dragging = false;

    const today = new Date;
    const time_log = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()} `
        + `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()} : `
        + ` frame selection in timeline: ${window.current_index}`;

    fetch (`${server_url}/log/`, {
        method: 'POST', 
        body: JSON.stringify({interaction_log: time_log}),
        headers: {'Content-Type': 'application/json'}
    });
});
timeline.addEventListener("mouseout", () => { is_timeline_dragging = false; });

//keys interaction
//this insures the timeline gets focused on click
timeline.addEventListener("click", focus_onclick);

timeline.addEventListener("keydown", navigate_video_onkeydown);
