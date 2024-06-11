let plot_marker_triangle = (current_index, max_index, svg) => {
    let ctx = svg.getContext("2d");

    let plot_width = svg.width;
    let plot_height = svg.height;
    const triangle_length = plot_height / 20;

    //convert index to canvas x
    let plot_x = current_index / (max_index - 1) * plot_width;

    //define coordinates
    let top_left = { x: plot_x - 4, y: 0 };
    let top_right = { x: plot_x + 4, y: 0 };
    let mid_left = { x: plot_x - 4, y: triangle_length };
    let mid_right = { x: plot_x + 4, y: triangle_length };
    let bottom_center = { x: plot_x, y: triangle_length * 2 };

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

let plot_timestamps = (max_index, fps, svg) => {
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
    const y = plot_height * 0.9;

    //plot markers
    for (let i = 0;i < nb_markers;++i) {
        let x = i * unit * fps / max_index * plot_width;

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

let plot_timeline = (current_index, max_index, fps) => {
    let timeline = document.getElementById("timeline");
    let ctx = timeline.getContext("2d");

    let plot_width = timeline.width;
    let plot_height = timeline.height;

    ctx.clearRect(0, 0, plot_width, plot_height);  

    plot_timestamps(max_index, fps, timeline);
    //plot selected points highlight
    if (window.scores != null && window.selected_points != null) {
        for (let i = 0; i < window.selected_points.length; ++i) {
            let x = window.selected_points[i] / (window.scores.length - 1) * plot_width;
            ctx.beginPath();
            ctx.moveTo(x, plot_height / 3);
            ctx.lineTo(x, plot_height * 2 / 3);
            ctx.strokeStyle = "rgba(100,200,255,0.3)";
            ctx.stroke();
        }
    }
    plot_marker_triangle(current_index, max_index, timeline);
    plot_marker(current_index, max_index, 0, 0, 0, "black", 0.5, timeline);
};

let is_timeline_dragging = false;

let timeline = document.getElementById("timeline");

//first draw of component fixing dimensions
timeline.width = timeline.offsetWidth;
timeline.height = timeline.offsetHeight;

//mouse mouvement listeners
timeline.addEventListener("mousedown", () => { is_timeline_dragging = true; });
timeline.addEventListener("mousemove", (event) => { is_timeline_dragging && update_frame_index_onclick(timeline, 0, 0, 0, window.max_index, event); } );
timeline.addEventListener("mouseup", (event) => {
    update_frame_index_onclick(timeline, 0, 0, 0, window.max_index, event);
    is_timeline_dragging = false;
});
timeline.addEventListener("mouseout", () => { is_timeline_dragging = false; });

//keys interaction
//this insures the timeline gets focused on click
timeline.addEventListener("click", () => { timeline.focus(); })
timeline.addEventListener("keydown", async (event) => {
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
            window.current_index = Math.min(window.current_index + 1, window.max_index);
            break;
        case "default":
            return;
    }
    let name_processed = window.current_video.split(".")[0]; 
    const response = await fetch(`${server_url}/image/${name_processed}/${window.current_index}.png`);
    const blob = await response.blob();
    const image_url = URL.createObjectURL(blob);

    window.current_frame.src = image_url;
    update_video(window.current_frame.src);
    update_scores(window.current_index);
});