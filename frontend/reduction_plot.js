let reduction_plot = document.getElementById("reduction_plot");
let reduction_color_scale = document.getElementById("reduction_color_map");

//initial zoom setting
let reduction_scale = 1.0;
let reduction_translate = { x: 0, y: 0 };
const reduction_zoom_speed = 0.1;

// Variables for panning
let is_reduction_dragging = false;
let reduction_drag_offset = { x: 0, y: 0 };

//to keep space between plot and canvas boundaries
let reduction_plot_offset_x = 20;
let reduction_plot_offset_y = 20;

//selection stuff
let selection_state = "idle";
let selection_center = { x: (window.selection_top_left.x + window.selection_bot_right.x) / 2, y: (window.selection_top_left.y + window.selection_bot_right.y) / 2 };
let selection_mouse_down_point = selection_center;

/*main drawing function for reduction reduced embeddings' scatter plot */
let plot_dimension_reduction = (current_index) => {
    if (window.displayed_reduction == null) { return; }

    let color_map = generate_color_map(current_index, window.cmap);
    let radius_map = generate_radius_map([current_index]);

    /*get min/max to later normalize reduction values*/
    /* Get min/max to normalize reduction values */
    let min_x = window.displayed_reduction[0]["x"];
    let max_x = window.displayed_reduction[0]["x"];
    let min_y = window.displayed_reduction[0]["y"];
    let max_y = window.displayed_reduction[0]["y"];

    for (let i = 1; i < window.displayed_reduction.length; ++i) {
        min_x = Math.min(min_x, window.displayed_reduction[i]["x"]);
        max_x = Math.max(max_x, window.displayed_reduction[i]["x"]);
        min_y = Math.min(min_y, window.displayed_reduction[i]["y"]);
        max_y = Math.max(max_y, window.displayed_reduction[i]["y"]);
    }

    //reduction_plot width/length
    let plot_width = reduction_plot.width;
    let plot_height = reduction_plot.height;
    
    //reset the drawing
    let ctx = reduction_plot.getContext("2d");
    ctx.clearRect(0, 0, plot_width, plot_height);  
    
    let x, y, dot_radius;

    //draw the points (square shaped for now)
    for (let i = 0;i < window.displayed_reduction.length;++i) {
        //draw current frame marker last to stand out
        if (i == current_index) { continue; }

        x = reduction_plot_offset_x + (window.displayed_reduction[i]['x'] - min_x) / (max_x - min_x) * (plot_width - 2 * reduction_plot_offset_x);
        y = plot_height - reduction_plot_offset_y - (window.displayed_reduction[i]['y'] - min_y) / (max_y - min_y) * (plot_height - 2 * reduction_plot_offset_y);

        ctx.fillStyle = color_map[i];
        dot_radius = radius_map[i];
        // Apply zoom/pan transformations to coordinates only and not to point radius (for visibility purposes)
        fill_circle(ctx, {x: reduction_translate.x + x * reduction_scale, y: reduction_translate.y + y * reduction_scale}, dot_radius);
    }

    x = reduction_plot_offset_x + (window.displayed_reduction[current_index]['x'] - min_x) / (max_x - min_x) * (plot_width - 2 * reduction_plot_offset_x);
    y = plot_height - reduction_plot_offset_y - (window.displayed_reduction[current_index]['y'] - min_y) / (max_y - min_y) * (plot_height - 2 * reduction_plot_offset_y);

    ctx.fillStyle = color_map[current_index];
    dot_radius = radius_map[current_index];
    fill_circle(ctx, {x: reduction_translate.x + x * reduction_scale, y: reduction_translate.y + y * reduction_scale}, dot_radius);
    ctx.arc(reduction_translate.x + x * reduction_scale + dot_radius, reduction_translate.y + y * reduction_scale, 0, dot_radius, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "black";
    ctx.stroke();

    if (window.is_selection) { draw_rectangle(ctx, window.selection_top_left, window.selection_bot_right); }
};

let generate_radius_map = (indices) => {
    radius_map = [];
    if (window.displayed_reduction == null) { return radius_map; }

    for (let i = 0; i < window.displayed_reduction.length; ++i) { 
        let j;
        for (j = 0;j < indices.length;++j) {
            if (i == indices[j]) {
                radius_map.push(window.EMPHASIS_RADIUS);
                break;
            }
        }
        if (j == indices.length) { radius_map.push(window.REGULAR_RADIUS); }
    }

    return radius_map;
}

/*color map stuff */
//plot colormap
let generate_color_map = (current_index, cmap) => {
    color_map = [];
    if (window.displayed_reduction == null) { return color_map; }

    switch (cmap) {
        case "time": {
            let color1 = {red: 68, green: 53, blue: 91};
            let color2 = {red: 255, green: 212, blue: 191};
            for (let i = 0; i < window.displayed_reduction.length; ++i) { 
                let factor1 = (window.displayed_reduction.length - 1 - i) / (window.displayed_reduction.length - 1);
                let factor2 = i / (window.displayed_reduction.length - 1);
                color_map.push((current_index != i)? 
                    `rgb(${color1.red * factor1 + color2.red * factor2}, 
                    ${color1.green * factor1 + color2.green * factor2}, 
                    ${color1.blue * factor1 + color2.blue * factor2}` 
                    : window.EMPHASIS_COLOR); 
            }
            draw_color_scale(0, window.displayed_reduction.length, color1, color2);
            break;
        }

        case "score": {
            //make sure scores exist and match the reduction reduction
            if (window.scores == null) { generate_color_map(current_index, ""); }
            if (window.scores.length != window.displayed_reduction.length) { generate_color_map(current_index, ""); }

            /*get min/max to normalize scores*/
            min_score = window.scores[0];
            max_score = window.scores[0];

            for (let i = 1;i < window.scores.length;++i) {
                min_score = (min_score > window.scores[i])? window.scores[i] : min_score;
                max_score = (max_score < window.scores[i])? window.scores[i] : max_score;
            }

            let color1 = {red: 255, green: 0, blue: 0};
            let color2 = {red: 0, green: 200, blue: 0};
            for (let i = 0; i < window.displayed_reduction.length; ++i) { 
                let factor = (window.scores[i] - min_score) / (max_score - min_score);
                color_map.push(`rgba(${color1.red * (1 - factor) + color2.red * factor}, 
                    ${color1.green * (1 - factor) + color2.green * factor}, 
                    ${color1.blue * (1 - factor) + color2.blue * factor},
                    ${Math.sqrt(factor)}`); // the lower the score is the more transparent the color is, using root square to prevent drastic behavior
            }
            draw_color_scale(min_score, max_score, color1, color2);
            break;
        }

        case "clusters": {
            //squash the color map 
            reduction_color_scale.height = 0;

            //get currently displayed reduction DBSCAN clusters
            let current_clusters = (window.old_reduction == "tsne")? window.reduction_clusters :
                                (window.old_reduction == "pca")? window.pca_clusters : window.umap_clusters;
            
            //get the number of clusters 
            let max_label = current_clusters[0];
            for (let i = 1;i < current_clusters.length;++i) {
                if (max_label < current_clusters[i]) {
                    max_label = current_clusters[i];
                }
            }
            let nb_clusters = max_label + 1;

            //generating random colors
            function generate_HSL_colors(nb_colors) {
                let colors = [];
                const saturation = 70; // Saturation percentage
                const lightness = 50;  // Lightness percentage
            
                for (let i = 0; i < nb_colors; i++) {
                    const hue = Math.floor((360 / nb_colors) * i);
                    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
                }
            
                return colors;
            }
            let colors = generate_HSL_colors(nb_clusters);

            //applying colors to clusters (-1/no cluster will be gray and current index red)
            for (let i = 0; i < window.displayed_reduction.length; ++i) { 
                if (i == current_index) {
                    color_map.push(window.EMPHASIS_COLOR);
                }
                else {
                    if (current_clusters[i] == -1) { 
                        color_map.push(window.REGULAR_COLOR);
                    }
                    else {
                        color_map.push(colors[current_clusters[i]]);
                    }
                }
            }

            break;
        } 

        default: { //gray colormap with red as amphasis
            //squash the color map on default
            reduction_color_scale.height = 0;

            //highlight selected points
            color_map = generate_score_color_map();
            color_map[current_index] = window.EMPHASIS_COLOR;
            break;
        }
    }

    return color_map;
}

let draw_color_scale = (min_value, max_value, min_color, max_color) => {
    const ctx = reduction_color_scale.getContext("2d");
    reduction_color_scale.height = 20;
    reduction_color_scale.width = 300;

    min_value = Math.trunc(min_value * 100) / 100;
    max_value = Math.trunc(max_value * 100) / 100;

    const gradient = ctx.createLinearGradient(0, 0, reduction_color_scale.width, 0);
    gradient.addColorStop(0, `rgb(${min_color.red}, ${min_color.green}, ${min_color.blue})`);   // Blue at the left
    gradient.addColorStop(1, `rgb(${max_color.red}, ${max_color.green}, ${max_color.blue})`);  // Red at the right
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, reduction_color_scale.width, reduction_color_scale.height);

    // Add min and max values
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(min_value, 15, reduction_color_scale.height / 2 + 5); // Min value at the left
    ctx.fillStyle = 'white';
    ctx.fillText(max_value, reduction_color_scale.width - 15, reduction_color_scale.height / 2 + 5); // Max value at the right
}

let animate_reduction_transition = (old_reduction, new_reduction, duration) => {
    //copying to make sure the reduction results aint touched
    const start_time = performance.now();

    const animate = () => {
        const current_time = performance.now();
        const elapsed_time = current_time - start_time;
        const t = Math.min(elapsed_time / duration, 1); // Normalized time [0, 1]
  
        window.displayed_reduction = old_reduction.map((old_point, i) => {
            const new_point = new_reduction[i];
            return {
                x: (1 - t) * old_point.x + t * new_point.x,
                y: (1 - t) * old_point.y + t * new_point.y
            };
        });
        
        // Draw scatter plot with currentData
        plot_dimension_reduction(window.current_index);

        if (t < 1) {
            requestAnimationFrame(animate);
        } 
        else {
            window.displayed_reduction = new_reduction;
            
            // Get min/max to normalize reduction values 
            window.reduction_min_x = window.displayed_reduction[0]["x"];
            window.reduction_max_x = window.displayed_reduction[0]["x"];
            window.reduction_min_y = window.displayed_reduction[0]["y"];
            window.reduction_max_y = window.displayed_reduction[0]["y"];

            for (let i = 1; i < window.displayed_reduction.length; ++i) {
                window.reduction_min_x = Math.min(window.reduction_min_x, window.displayed_reduction[i]["x"]);
                window.reduction_max_x = Math.max(window.reduction_max_x, window.displayed_reduction[i]["x"]);
                window.reduction_min_y = Math.min(window.reduction_min_y, window.displayed_reduction[i]["y"]);
                window.reduction_max_y = Math.max(window.reduction_max_y, window.displayed_reduction[i]["y"]);
            }

            //build kdtree to accelerate selection
            build_tree();
        }
    }
  
    animate();    
};

/*selectors handling (colormap and reduction method)*/
const color_radio_buttons = document.querySelectorAll('input[name="select_color_map"]');
const reduction_method_buttons = document.querySelectorAll('input[name="select_reduction_method"]');

// Function to handle the colormap change
const handle_color_map_change = () => {
    const selected_value = document.querySelector('input[name="select_color_map"]:checked').value;
    window.cmap = selected_value;

    //redraw components
    plot_dimension_reduction(window.current_index);
};

// Function to handle the reduction algorithm change
const handle_reduction_method_change = () => {
    const selected_value = document.querySelector('input[name="select_reduction_method"]:checked').value;
    const old_reduction = (window.old_reduction == "tsne")? window.tsne_reduction :
                        (window.old_reduction == "pca")? window.pca_reduction : window.umap_reduction;
    const new_reduction = (selected_value == "tsne")? window.tsne_reduction :
                        (selected_value == "pca")? window.pca_reduction : window.umap_reduction;

    //redraw component (animate position transition)
    animate_reduction_transition(old_reduction, new_reduction, 1000);

    //update state after animation
    window.old_reduction = selected_value;
};

// Add change event listener to each radio button
color_radio_buttons.forEach(radio => { radio.addEventListener('change', handle_color_map_change); });
reduction_method_buttons.forEach(radio => { radio.addEventListener('change', handle_reduction_method_change); });

/*On click handling for navigating the video frames*/
/*compare mouse coordinates with each dot of the plot and see if it touches any, must consider the zoom/pan */
reduction_plot.addEventListener("click", async (event) => {
    event.preventDefault();
    
    const mouse_x = event.offsetX;
    const mouse_y = event.offsetY;

    //reduction_plot width/length
    let plot_width = reduction_plot.width;
    let plot_height = reduction_plot.height;

    //get min/max to later normalize reduction values
    min_x = window.displayed_reduction[0]['x'];
    max_x = window.displayed_reduction[0]['x'];
    min_y = window.displayed_reduction[0]['y'];
    max_y = window.displayed_reduction[0]['y'];

    for (let i = 1;i < window.displayed_reduction.length;++i) {
        min_x = (min_x > window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : min_x;
        max_x = (max_x < window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : max_x;
        min_y = (min_y > window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : min_y;
        max_y = (max_y < window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : max_y;
    }
     
    //if clicking on the current frame index (big red dot), do nothing
    let x = reduction_translate.x + reduction_scale * 
        (reduction_plot_offset_x + 
            (window.displayed_reduction[window.current_index]['x'] - min_x) / 
            (max_x - min_x) * (plot_width - 2 * reduction_plot_offset_x));
    let y = reduction_translate.y + reduction_scale * 
        (plot_height - reduction_plot_offset_y - 
            (window.displayed_reduction[window.current_index]['y'] - min_y) / 
            (max_y - min_y) * (plot_height - 2 * reduction_plot_offset_y));

    dot_radius = 4;
    let dist = (mouse_x - x) * (mouse_x - x) + (mouse_y - y) * (mouse_y - y);
    if (dist <= dot_radius * dot_radius) {
        return;
    }

    try {
        for (let i = 0;i < window.displayed_reduction.length;++i) {
            //get each point's coordinates after current zoom/pan
            let x = reduction_translate.x + reduction_scale * 
                (reduction_plot_offset_x + 
                    (window.displayed_reduction[i]['x'] - min_x) / 
                    (max_x - min_x) * (plot_width - 2 * reduction_plot_offset_x));
            let y = reduction_translate.y + reduction_scale * 
                (plot_height - reduction_plot_offset_y - 
                    (window.displayed_reduction[i]['y'] - min_y) / 
                    (max_y - min_y) * (plot_height - 2 * reduction_plot_offset_y));
    
            dot_radius = 2;
            let dist = (mouse_x - x) * (mouse_x - x) + (mouse_y - y) * (mouse_y - y);
    
            //if the user clicked inside the dot, update the frameIndex
            if (dist <= dot_radius * dot_radius) {
                //fetch current frame
                let name_processed = window.current_video.split(".")[0]; 
                const response = await fetch(`${server_url}/image/${name_processed}/${i}.png`);
                const blob = await response.blob();
                const image_url = URL.createObjectURL(blob);
    
                window.current_frame.src = image_url;
                update_video(image_url);
    
                //update component
                update_scores(i);
                return;
            }
        }
    }
    catch (error) {
        console.log("Error getting video frame: ", error);
    }
});

/*zoom/pan handling */
let zom_pan_wheel = (event) => {
    event.preventDefault();
    
    const mouse_x = event.offsetX;
    const mouse_y = event.offsetY;

    const wheel = event.deltaY < 0 ? 1 : -1;
    const zoom_factor = 1 + wheel * reduction_zoom_speed;
    
    // Calculate new scale but constrain it within a range
    const new_scale = Math.max(Math.min(reduction_scale * zoom_factor, window.MAX_SCALE), window.MIN_SCALE);
    
    // Adjust translation to keep the zoom centered on the cursor
    reduction_translate.x = mouse_x - ((mouse_x - reduction_translate.x) / reduction_scale) * new_scale;
    reduction_translate.y = mouse_y - ((mouse_y - reduction_translate.y) / reduction_scale) * new_scale;

    // Apply the new scale
    reduction_scale = new_scale;

    // Redraw the content
    plot_dimension_reduction(window.current_index);
};

let zom_pan_mouse_down = (event) => {
    is_reduction_dragging = true;
    reduction_drag_offset.x = event.offsetX - reduction_translate.x;
    reduction_drag_offset.y = event.offsetY - reduction_translate.y;
};

let zom_pan_mouse_up = () => {
    is_reduction_dragging = false;
};

let zom_pan_mouse_move = (event) => {
    if (is_reduction_dragging) {
        reduction_translate.x = event.offsetX - reduction_drag_offset.x;
        reduction_translate.y = event.offsetY - reduction_drag_offset.y;

        //redraw context
        plot_dimension_reduction(window.current_index);
    }
};

reduction_plot.addEventListener('wheel', zom_pan_wheel);
reduction_plot.addEventListener('mousedown', zom_pan_mouse_down); 
reduction_plot.addEventListener('mouseup', zom_pan_mouse_up);
reduction_plot.addEventListener('mouseout', zom_pan_mouse_up);
reduction_plot.addEventListener('mousemove', zom_pan_mouse_move);

/*handling embedding selection */

// Function to check if the circle intersects a rectangle edge
let intersect_edges = (p1, p2, c, r) => {
    // Closest point on the edge to the circle's center
    let closest_x = Math.max(p1.x, Math.min(c.x, p2.x));
    let closest_y = Math.max(p1.y, Math.min(c.y, p2.y));

    // Distance from the circle's center to the closest point on the edge
    let distance_sq = length2(c, { x: closest_x, y: closest_y });

    return distance_sq <= r * r;
}

/**
 * utility function to check if a circle is inside or intersects with a rectangle
 * @param {*} p1 top left corner of the rectangle
 * @param {*} p2 bottom right corner of the rectangle
 * @param {*} c center of the circle
 * @param {*} r radius of the circle
 * @returns true if the circle is completely contained within the rectangle or 
 * if one the edges of the rectangle intersect with the circle
 */
let is_circle_in_square = (p1, p2, c, r) => {
    /*circle completely inside */
    // Ensure p1 is the top-left corner and p2 is the bottom-right corner
    let rect_left = Math.min(p1.x, p2.x);
    let rect_right = Math.max(p1.x, p2.x);
    let rect_top = Math.min(p1.y, p2.y);
    let rect_bottom = Math.max(p1.y, p2.y);

    // Check if the circle is completely inside the rectangle
    let is_completely_inside = 
        (c.x - r >= rect_left) &&
        (c.x + r <= rect_right) &&
        (c.y - r >= rect_top) &&
        (c.y + r <= rect_bottom);

    // Check intersection with each of the four edges of the rectangle
    let intersects =
        intersect_edges(p1, p2, c, r) || // Top edge
        intersect_edges(p1, p2, c, r) || // Bottom edge
        intersect_edges(p1, p2, c, r) || // Left edge
        intersect_edges(p1, p2, c, r); // Right edge

    // if the circle is completely inside or starts intersecting with the rectangle, it is selected
    return intersects || is_completely_inside;
};

// update the selection indices global vector
let update_selected = (current_index) => {
    if (window.displayed_reduction == null) { return; }

    /*get min/max to later normalize reduction values*/
    min_x = window.reduction_min_x;
    max_x = window.reduction_max_x;
    min_y = window.reduction_min_y;
    max_y = window.reduction_max_x;

    //reduction_plot width/length
    let plot_width = reduction_plot.width;
    let plot_height = reduction_plot.height;

    //clear all
    window.selected_points = [];

    // Define the range query function
    function range_query (node, depth) {
        if (!node) return;

        // Check if the point is within the selection area
        let x = reduction_plot_offset_x + (node.obj.x - window.min_x) / (window.max_x - window.min_x) * (plot_width - 2 * reduction_plot_offset_x);
        let y = plot_height - reduction_plot_offset_y - (node.obj.y - window.min_y) / (window.max_y - window.min_y) * (plot_height - 2 * reduction_plot_offset_y);

        if (is_circle_in_square(
            window.selection_top_left, 
            window.selection_bot_right, 
            { x: reduction_translate.x + x * reduction_scale, y: reduction_translate.y + y * reduction_scale }, 
            (current_index == node.index) ? 4 : 2)) {
            window.selected_points.push(node.obj.index);

            //recursive call either ways
            range_query(node.left, depth + 1);
            range_query(node.right, depth + 1);
        }
        else {
            //check intersting branches here
            if (node.left) {
                if (depth % 2 == 0) {
                    let left_x = reduction_plot_offset_x + (node.left.obj.x - window.min_x) / (window.max_x - window.min_x) * (plot_width - 2 * reduction_plot_offset_x);

                    if ((reduction_translate.x + left_x * reduction_scale) + 4 >= window.selection_top_left.x) {
                        range_query(node.left, depth + 1);
                    }
                }
                else {
                    let left_y = plot_height - reduction_plot_offset_y - (node.left.obj.y - window.min_y) / (window.max_y - window.min_y) * (plot_height - 2 * reduction_plot_offset_y);
                    if ((reduction_translate.y + left_y * reduction_scale) + 4 >= window.selection_top_left.y) {
                        range_query(node.left, depth + 1);
                    }
                }
            }
            if (node.right) {
                if (depth % 2 == 0) {
                    let right_x = reduction_plot_offset_x + (node.right.obj.x - window.min_x) / (window.max_x - window.min_x) * (plot_width - 2 * reduction_plot_offset_x);

                    if ((reduction_translate.x + right_x * reduction_scale) - 4 <= window.selection_bot_right.x) {
                        range_query(node.right, depth + 1);
                    }
                }
                else {
                    let right_y = plot_height - reduction_plot_offset_y - (node.right.obj.y - window.min_y) / (window.max_y - window.min_y) * (plot_height - 2 * reduction_plot_offset_y);
                    if ((reduction_translate.y + right_y * reduction_scale) - 4 <= window.selection_bot_right.y) {
                        range_query(node.right, depth + 1);
                    }
                }
            }
        }
    }

    // Perform range query
    range_query(window.reduction_tree.root, 0);
};

let selection_mouse_down = (event) => {
    selection_mouse_down_point = {x: event.offsetX, y: event.offsetY};

    //Get the closest point
    let dp1 = length2(selection_mouse_down_point, window.selection_top_left);
    let dp2 = length2(selection_mouse_down_point, window.selection_bot_right);
    let dc = length2(selection_mouse_down_point, selection_center);

    let dp_top_right = length2(selection_mouse_down_point, { x: window.selection_bot_right.x, y: window.selection_top_left.y });
    let dp_bottom_left = length2(selection_mouse_down_point, { x: window.selection_top_left.x, y: window.selection_bot_right.y });

    let list = [dp1, dp2, dc, dp_top_right, dp_bottom_left];
    //sort the list
    let min_index = list.indexOf(Math.min(...list)); //Usage of the spread operator

    if (min_index == 0) selection_state = "dp1";
    if (min_index == 1) selection_state = "dp2";
    if (min_index == 2) selection_state = "dc";
    if (min_index == 3) selection_state = "dctr";
    if (min_index == 4) selection_state = "dcbl";
};

let selection_mouse_move = (event) => {
    if (selection_state == "idle") { return; }
    let mouse_position = {x: event.offsetX, y: event.offsetY};
    let delta = {
        x: mouse_position.x - selection_mouse_down_point.x,
        y: mouse_position.y - selection_mouse_down_point.y,
    };
    switch (selection_state) {
        case "dp1":
            window.selection_top_left = { x: window.selection_top_left.x + delta.x, y: window.selection_top_left.y + delta.y };
            break;

        case "dp2":
            window.selection_bot_right = { x: window.selection_bot_right.x + delta.x, y: window.selection_bot_right.y + delta.y };
            break;

        case "dc":
            window.selection_top_left = { x: window.selection_top_left.x + delta.x, y: window.selection_top_left.y + delta.y };
            window.selection_bot_right = { x: window.selection_bot_right.x + delta.x, y: window.selection_bot_right.y + delta.y };
            break;

        case "dctr":
            window.selection_top_left = { x: window.selection_top_left.x, y: window.selection_top_left.y + delta.y };
            window.selection_bot_right = { x: window.selection_bot_right.x + delta.x, y: window.selection_bot_right.y };
            break;

        case "dcbl":
            window.selection_top_left = { x: window.selection_top_left.x + delta.x, y: window.selection_top_left.y };
            window.selection_bot_right = { x: window.selection_bot_right.x, y: window.selection_bot_right.y + delta.y };
            break;
    }
    selection_center = { x: (window.selection_top_left.x + window.selection_bot_right.x) / 2, y: (window.selection_top_left.y + window.selection_bot_right.y) / 2 };
    selection_mouse_down_point = mouse_position;

    // Redraw the content
    update_selected(window.current_index);
    update_scores(window.current_index);
}

let debounced_selection_mouse_move = debounce(selection_mouse_move, 200);

let selection_mouse_up = () => { 
    selection_state = "idle"; 

    // Redraw the content
    update_selected(window.current_index);
    update_scores(window.current_index);
}

/*zoom/pan reset option (or reset all?)*/
let reset_reduction_plot = document.getElementById("reset_reduction_plot");

reset_reduction_plot.addEventListener("click", () => {
    //back to initial settings
    reduction_scale = 1.0;
    reduction_translate = { x: 0, y: 0 };
    is_reduction_dragging = false;
    reduction_drag_offset = { x: 0, y: 0 };

    //reset selection
    window.is_selection = false;
    window.selected_points = [];

    reduction_plot.removeEventListener("mousemove", debounced_selection_mouse_move);
    reduction_plot.removeEventListener("mousedown", selection_mouse_down);
    reduction_plot.removeEventListener("mouseup", selection_mouse_up);
    reduction_plot.removeEventListener("mouseout", selection_mouse_up);

    reduction_plot.addEventListener("mousedown", zom_pan_mouse_down);
    reduction_plot.addEventListener("mouseup", zom_pan_mouse_up);
    reduction_plot.addEventListener("mouseout", zom_pan_mouse_up);
    reduction_plot.addEventListener("mousemove", zom_pan_mouse_move);
    reduction_plot.addEventListener("wheel", zom_pan_wheel);

    //redraw context
    update_scores(window.current_index);
});

/*zoomPan/selection toggle option */
let toggle_selection = document.getElementById("select_dots");

toggle_selection.addEventListener("click", () => {
    if (window.is_selection == false) {
        window.is_selection = true;
        reduction_plot.removeEventListener("mousemove", zom_pan_mouse_move);
        reduction_plot.removeEventListener("mousedown", zom_pan_mouse_down);
        reduction_plot.removeEventListener("mouseup", zom_pan_mouse_up);
        reduction_plot.removeEventListener("mouseout", zom_pan_mouse_up);
        reduction_plot.removeEventListener("wheel", zom_pan_wheel);

        reduction_plot.addEventListener("mousedown", selection_mouse_down);
        reduction_plot.addEventListener("mouseup", selection_mouse_up);
        reduction_plot.addEventListener("mousemove", selection_mouse_move);

        update_selected(window.current_index);
        plot_score_curve(window.current_index);
    }
    else {
        window.is_selection = false;
        reduction_plot.removeEventListener("mousemove", debounced_selection_mouse_move);
        reduction_plot.removeEventListener("mousedown", selection_mouse_down);
        reduction_plot.removeEventListener("mouseup", selection_mouse_up);
        reduction_plot.removeEventListener("mouseout", selection_mouse_up);

        reduction_plot.addEventListener("mousedown", zom_pan_mouse_down);
        reduction_plot.addEventListener("mouseup", zom_pan_mouse_up);
        reduction_plot.addEventListener("mouseout", zom_pan_mouse_up);
        reduction_plot.addEventListener("mousemove", zom_pan_mouse_move);
        reduction_plot.addEventListener("wheel", zom_pan_wheel);
    }
    //redraw context
    plot_dimension_reduction(window.current_index);
});
