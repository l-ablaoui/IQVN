let plot_marker_triangle = (current_index, max_index, svg) => {
    let ctx = svg.getContext("2d");

    let plot_width = svg.width;
    let plot_height = svg.height;
    const triangle_length = plot_height / 20;

    //convert index to canvas x
    let plot_x = current_index / (max_index - 1) * plot_width;

    //define coordinates
    let top_left = { x: plot_x - triangle_length * 2 / 3, y: 0 };
    let top_right = { x: plot_x + triangle_length * 2 / 3, y: 0 };
    let mid_left = { x: plot_x - triangle_length * 2 / 3, y: triangle_length };
    let mid_right = { x: plot_x + triangle_length * 2 / 3, y: triangle_length };
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

let plot_current_timer = (current_index, max_index, fps, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;

    let ctx = svg.getContext("2d");

    let offset = plot_height / 30 + 5;
    if (current_index >= max_index / 2) { offset = - offset - 20; }
    let timestamp = current_index / fps;

    let x = current_index / max_index * plot_width;
    ctx.beginPath();
    ctx.fillStyle = "darkgray";
    ctx.font = "10px arial";
    ctx.fillText(`${Math.trunc((timestamp) / 60)}:${Math.trunc((timestamp)) % 60}`, x + offset, plot_height * 0.1);
}

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
            for (let j = 0;j < window.selected_points[i].length;++j) {
                let x = window.selected_points[i][j] / (window.scores.length - 1) * plot_width;
                let y1 = (2 * (window.selected_points.length - 1 - i) + 1) / (2 * window.selected_points.length + 1) * plot_height;
                let y2 = (2 * (window.selected_points.length - 1 - i) + 2) / (2 * window.selected_points.length + 1) * plot_height;
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.strokeStyle = `rgba(
                    ${SELECTION_COLORS[i].red},
                    ${SELECTION_COLORS[i].green},
                    ${SELECTION_COLORS[i].blue},
                    ${(window.current_selection == i)? 0.8 : 0.4})`;
                ctx.stroke();
            }
        }
    }
    plot_marker_triangle(current_index, max_index, timeline);
    plot_current_timer(current_index, max_index, fps, timeline);
    plot_marker(current_index, max_index, 0, 0, 0, "black", 0.5, timeline);
};

let union = (array_a, array_b) => {
    let set = new Set([...array_a, ...array_b]); // Use a Set to automatically handle duplicates
    return Array.from(set);
};

let intersection = (array_a, array_b) => {
    let set_a = new Set(array_a);
    let intersection = array_b.filter(element => set_a.has(element));
    return intersection;
};

let difference = (array_a, array_b) => {
    let set_b = new Set(array_b);
    let difference = array_a.filter(element => !set_b.has(element)); //A - B
    return difference;
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

let new_selection = document.getElementById("new_selection");
let selections = document.getElementById("selections");
let selections2 = document.getElementById("selections2");
let perform = document.getElementById("set_operator");

new_selection.addEventListener("click", () => {
    if (window.selected_points[window.current_selection].length == 0) {
        console.log("Current selection is still empty!");
        return;
    }

    if (window.selected_points.length == 4) {
        console.log("Too many selections");
        return;
    }

    //add selection array (new query)
    window.selected_points.push([]);
    window.current_selection += 1;

    let name_option = document.createElement("option");
    name_option.value = "query" + window.current_selection;
    switch (window.current_selection) {
        case 0: 
            name_option.text = "blue";
            break;
        case 1: 
            name_option.text = "red";
            break;
        case 2: 
            name_option.text = "yellow";
            break;
        case 3: 
            name_option.text = "green";
            break;
    }
    name_option.style.color = `rgb(${SELECTION_COLORS[window.current_selection].red},
                            ${SELECTION_COLORS[window.current_selection].green}
                            ${SELECTION_COLORS[window.current_selection].blue})`;
    selections.add(name_option);
    selections.selectedIndex = window.current_selection;

    selected_reduction_dots = window.selected_points[window.current_selection];
    selected_score_spikes = [];

    update_selection2_list();
    update_scores(window.current_index);
});

let update_selection_list = () => {
    let selections = document.getElementById("selections");

    //clear options
    while (selections.options.length > 0) {
        selections.remove(0);
    }

    //add options (all but the currently selected one)
    for (let i = 0;i < window.selected_points.length;++i) {
        let name_option = document.createElement("option");
        name_option.value = "query" + i;
        switch (i) {
            case 0: 
                name_option.text = "blue";
                break;
            case 1: 
                name_option.text = "red";
                break;
            case 2: 
                name_option.text = "yellow";
                break;
            case 3: 
                name_option.text = "green";
                break;
        }
        name_option.style.color = `rgb(${SELECTION_COLORS[i].red},
                                ${SELECTION_COLORS[i].green}
                                ${SELECTION_COLORS[i].blue})`;
        selections.add(name_option);
    }
};

let update_selection2_list = () => {
    let selections2 = document.getElementById("selections2");

    //clear options
    while (selections2.options.length > 0) {
        selections2.remove(0);
    }

    //add options (all but the currently selected one)
    for (let i = 0;i < window.selected_points.length;++i) {
        if (i == window.current_selection) { continue; }
        let name_option = document.createElement("option");
        name_option.value = "query" + i;
        switch (i) {
            case 0: 
                name_option.text = "blue";
                break;
            case 1: 
                name_option.text = "red";
                break;
            case 2: 
                name_option.text = "yellow";
                break;
            case 3: 
                name_option.text = "green";
                break;
        }
        name_option.style.color = `rgb(${SELECTION_COLORS[i].red},
                                ${SELECTION_COLORS[i].green}
                                ${SELECTION_COLORS[i].blue})`;
        selections2.add(name_option);
    }
};

selections.addEventListener("change", () => {
    //update the currently selected array for selection points
    window.current_selection = selections.selectedIndex;

    //FOR NOW, when the user changes queries in timeline, the old selected points are all put in the tsne area
    //modifying the tsne selection modifies all the selection, modifying the selected score spikes triggers a union
    selected_reduction_dots = window.selected_points[window.current_selection];
    selected_score_spikes = [];
    
    update_selection2_list();
    update_scores(window.current_index);
});

perform.addEventListener("click", () => {
    let array_a_index = selections.selectedIndex;
    let array_b_index = -1;
    if (selections2.options.length == 0) { return; }

    let opt = selections2.options[selections2.selectedIndex].value;

    switch (opt) {
        case "query0": 
            array_b_index = 0;
            break;
        case "query1":
            array_b_index = 1;
            break;
        case "query2": 
            array_b_index = 2;
            break;
        case "query3":
            array_b_index = 3;
            break;
        default:
            break;
    }

    let operator_list = document.getElementById("operator_list");
    let operator = operator_list.options[operator_list.selectedIndex].value;
    let res = [];

    switch (operator) {
        case "union":
            res = union(window.selected_points[array_a_index], window.selected_points[array_b_index]);
            break;
        case "intersection":
            res = intersection(window.selected_points[array_a_index], window.selected_points[array_b_index]);
            break;
        case "xor":
            u = union(window.selected_points[array_a_index], window.selected_points[array_b_index]);
            i = intersection(window.selected_points[array_a_index], window.selected_points[array_b_index]);
            res = difference(u, i);
            break;
        case "difference":
            res = difference(window.selected_points[array_a_index], window.selected_points[array_b_index]);
            break;
    }

    window.current_selection = Math.min(array_a_index, array_b_index);
    window.selected_points[Math.min(array_a_index, array_b_index)] = res;
    window.selected_points.splice(Math.max(array_a_index, array_b_index), 1);
    
    update_selection_list();
    update_selection2_list();
    update_scores(window.current_index);
});

let reset_all = document.getElementById("reset_all");
reset_all.addEventListener("click", () => {
    window.selected_points = [[]];
    window.current_selection = 0;
    update_scores(window.current_index);
});