var plot_marker_triangle = (current_index, max_index, svg) => {
    var ctx = svg.getContext("2d");

    var plot_width = svg.width;
    var plot_height = svg.height;
    const triangle_length = plot_height / 20;

    //convert index to canvas x
    var plot_x = current_index / (max_index - 1) * plot_width;

    //define coordinates
    var top_left = { x: plot_x - 4, y: 0 };
    var top_right = { x: plot_x + 4, y: 0 };
    var mid_left = { x: plot_x - 4, y: triangle_length };
    var mid_right = { x: plot_x + 4, y: triangle_length };
    var bottom_center = { x: plot_x, y: triangle_length * 2 };

    // Start drawing the triangle
    ctx.beginPath();
    ctx.moveTo(bottom_center.x, bottom_center.y); // Bottom point
    ctx.lineTo(mid_left.x, mid_left.y); // Mid left point
    ctx.lineTo(top_left.x, top_left.y); // Top left point
    ctx.lineTo(top_right.x, top_right.y); // Top right point
    ctx.lineTo(mid_right.x, mid_right.y); // Mid right point
    ctx.closePath();

    // Fill the triangle with a color
    ctx.fillStyle = "black";
    ctx.fill();
};

var plot_timestamps = (max_index, fps, svg) => {
    var plot_width = svg.width;
    var plot_height = svg.height;

    var ctx = svg.getContext("2d");

    //check how fine-grained the timestamp has to be and plot markers accordingly
    var unit = 10;
    var i = 1;
    var nb_markers = max_index / fps / unit;
    while (nb_markers >= 10) {
        unit = i * 30;
        nb_markers = max_index / fps / unit;
        ++i;
    }
    const y = plot_height * 0.9;

    //plot markers
    for (var i = 0;i < nb_markers;++i) {
        var x = i * unit * fps / max_index * plot_width;

        //draw line every "unit" seconds
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "lightgray";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        //write timestamp
        ctx.fillStyle = "lightgray";
        ctx.font = "10px arial";
        ctx.fillText(`${Math.trunc((i * unit) / 60)}:${(i * unit) % 60}`, x - 10, plot_height * 0.98);
    }
};

var plot_timeline = (current_index, max_index, fps) => {
    var timeline = document.getElementById("timeline");
    var ctx = timeline.getContext("2d");

    var plot_width = timeline.width;
    var plot_height = timeline.height;

    ctx.clearRect(0, 0, plot_width, plot_height);  

    plot_marker_triangle(current_index, max_index, timeline);
    plot_marker(current_index, max_index, 0, 0, 0, "black", 0.5, timeline);
    plot_timestamps(max_index, window.fps, timeline);
};

var is_timeline_dragging = false;

var timeline = document.getElementById("timeline");

//first draw of component fixing dimensions
timeline.width = timeline.offsetWidth;
timeline.height = timeline.offsetHeight;

//mouse mouvement listeners
timeline.addEventListener("mousedown", () => { is_timeline_dragging = true; });
timeline.addEventListener("mousemove", (event) => { is_timeline_dragging && update_frame_index_onclick(timeline, 0, 0, 0, slider.max, event); } );
timeline.addEventListener("mouseup", (event) => {
    update_frame_index_onclick(timeline, 0, 0, 0, slider.max, event);
    is_timeline_dragging = false;
});
timeline.addEventListener("mouseout", (event) => {
    update_frame_index_onclick(timeline, 0, 0, 0, slider.max, event);
    is_timeline_dragging = false;
});

//keys interaction
timeline.addEventListener("keydown", (event) => {
    console.log("working!");
    switch (event.code) {
        case "ArrowRight": 
        case "ArrowUp":
        case "KeyA":
        case "KeyW":
            window.current_index = Math.max(window.current_index - 1, 0);
            update_video(window.current_index);
            update_scores(window.current_index);
            break;
        case "ArrowLeft":
        case "ArrowDown":
        case "KeyD":
        case "KeyS":
            window.current_index = Math.min(window.current_index + 1, window.max_index);
            update_video(window.current_index);
            update_scores(window.current_index);
            break;
    }
});