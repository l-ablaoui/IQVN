var tsnePlot = document.getElementById("tsnePlot");
var tsne_color_scale = document.getElementById("tsneColorMap");

//initial zoom setting
var tsne_scale = 1.0;
var tsne_translate = { x: 0, y: 0 };
const tsne_zoom_speed = 0.1;

// Variables for panning
var is_tsne_dragging = false;
var tsne_drag_offset = { x: 0, y: 0 };

//to keep space between plot and canvas boundaries
var tsne_plot_offset_x = 20;
var tsne_plot_offset_y = 20;

//selection stuff
selection_state = "idle";
var selection_center = { x: (window.selection_top_left.x + window.selection_bot_right.x) / 2, y: (window.selection_top_left.y + window.selection_bot_right.y) / 2 };
var selection_mouse_down_point = selection_center;

/*main drawing function for tsne reduced embeddings' scatter plot */
var plot_tsne_reduction = (current_index) => {
    if (window.displayed_reduction == null) { return; }

    var color_map = generate_color_map(current_index, window.cmap);
    var radius_map = generate_radius_map([current_index]);

    /*get min/max to later normalize reduction values*/
    var min_x = window.displayed_reduction[0]['x'];
    var max_x = window.displayed_reduction[0]['x'];
    var min_y = window.displayed_reduction[0]['y'];
    var max_y = window.displayed_reduction[0]['y'];

    for (i = 1;i < window.displayed_reduction.length;++i) {
        min_x = (min_x > window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : min_x;
        max_x = (max_x < window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : max_x;
        min_y = (min_y > window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : min_y;
        max_y = (max_y < window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : max_y;
    }

    //tsnePlot width/length
    var plot_width = tsnePlot.width;
    var plot_height = tsnePlot.height;
    
    //reset the drawing
    var ctx = tsnePlot.getContext("2d");
    ctx.clearRect(0, 0, plot_width, plot_height);  
    
    var x, y, dot_radius;

    //draw the points (square shaped for now)
    for (i = 0;i < window.displayed_reduction.length;++i) {
        //draw current frame marker last to stand out
        if (i == current_index) { continue; }

        x = tsne_plot_offset_x + (window.displayed_reduction[i]['x'] - min_x) / (max_x - min_x) * (plot_width - 2 * tsne_plot_offset_x);
        y = plot_height - tsne_plot_offset_y - (window.displayed_reduction[i]['y'] - min_y) / (max_y - min_y) * (plot_height - 2 * tsne_plot_offset_y);

        ctx.fillStyle = color_map[i];
        dot_radius = radius_map[i];
        // Apply zoom/pan transformations to coordinates only and not to point radius (for visibility purposes)
        fill_circle(ctx, {x: tsne_translate.x + x * tsne_scale, y: tsne_translate.y + y * tsne_scale}, dot_radius);
    }

    x = tsne_plot_offset_x + (window.displayed_reduction[current_index]['x'] - min_x) / (max_x - min_x) * (plot_width - 2 * tsne_plot_offset_x);
    y = plot_height - tsne_plot_offset_y - (window.displayed_reduction[current_index]['y'] - min_y) / (max_y - min_y) * (plot_height - 2 * tsne_plot_offset_y);

    ctx.fillStyle = color_map[current_index];
    dot_radius = radius_map[current_index];
    fill_circle(ctx, {x: tsne_translate.x + x * tsne_scale, y: tsne_translate.y + y * tsne_scale}, dot_radius);
    ctx.arc(tsne_translate.x + x * tsne_scale + dot_radius, tsne_translate.y + y * tsne_scale, 0, dot_radius, 2 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "black";
    ctx.stroke();

    if (window.is_selection) { drawRectangle(ctx, window.selection_top_left, window.selection_bot_right); }
};

var generate_radius_map = (indices) => {
    radius_map = [];
    if (window.displayed_reduction == null) { return radius_map; }

    for (var i = 0; i < window.displayed_reduction.length; ++i) { 
        var j;
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
var generate_color_map = (current_index, cmap) => {
    color_map = [];
    if (window.displayed_reduction == null) { return color_map; }

    switch (cmap) {
        case "time": {
            var color1 = {red: 68, green: 53, blue: 91};
            var color2 = {red: 255, green: 212, blue: 191};
            for (var i = 0; i < window.displayed_reduction.length; ++i) { 
                var factor1 = (window.displayed_reduction.length - 1 - i) / (window.displayed_reduction.length - 1);
                var factor2 = i / (window.displayed_reduction.length - 1);
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
            //make sure scores exist and match the tsne reduction
            if (window.scores == null) { generate_color_map(current_index, ""); }
            if (window.scores.length != window.displayed_reduction.length) { generate_color_map(current_index, ""); }

            /*get min/max to normalize scores*/
            min_score = window.scores[0];
            max_score = window.scores[0];

            for (i = 1;i < window.scores.length;++i) {
                min_score = (min_score > window.scores[i])? window.scores[i] : min_score;
                max_score = (max_score < window.scores[i])? window.scores[i] : max_score;
            }

            var color1 = {red: 255, green: 0, blue: 0};
            var color2 = {red: 0, green: 200, blue: 0};
            for (var i = 0; i < window.displayed_reduction.length; ++i) { 
                var factor = (window.scores[i] - min_score) / (max_score - min_score);
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
            tsne_color_scale.height = 0;

            //get currently displayed reduction DBSCAN clusters
            var current_clusters = (window.old_reduction == "tsne")? window.tsne_clusters :
                                (window.old_reduction == "pca")? window.pca_clusters : window.umap_clusters;
            
            //get the number of clusters 
            var max_label = current_clusters[0];
            for (i = 1;i < current_clusters.length;++i) {
                if (max_label < current_clusters[i]) {
                    max_label = current_clusters[i];
                }
            }
            var nb_clusters = max_label + 1;

            //generating random colors
            function generate_HSL_colors(numColors) {
                let colors = [];
                const saturation = 70; // Saturation percentage
                const lightness = 50;  // Lightness percentage
            
                for (let i = 0; i < numColors; i++) {
                    const hue = Math.floor((360 / numColors) * i);
                    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
                }
            
                return colors;
            }
            var colors = generate_HSL_colors(nb_clusters);

            //applying colors to clusters (-1/no cluster will be gray and current index red)
            for (var i = 0; i < window.displayed_reduction.length; ++i) { 
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
            tsne_color_scale.height = 0;
            for (var i = 0; i < window.displayed_reduction.length; ++i) { color_map.push((current_index == i)? window.EMPHASIS_COLOR: window.REGULAR_COLOR); }
            break;
        }
    }

    return color_map;
}

var draw_color_scale = (min_value, max_value, min_color, max_color) => {
    const ctx = tsne_color_scale.getContext("2d");
    tsne_color_scale.height = 20;
    tsne_color_scale.width = 300;

    min_value = Math.trunc(min_value * 100) / 100;
    max_value = Math.trunc(max_value * 100) / 100;

    const gradient = ctx.createLinearGradient(0, 0, tsne_color_scale.width, 0);
    gradient.addColorStop(0, `rgb(${min_color.red}, ${min_color.green}, ${min_color.blue})`);   // Blue at the left
    gradient.addColorStop(1, `rgb(${max_color.red}, ${max_color.green}, ${max_color.blue})`);  // Red at the right
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, tsne_color_scale.width, tsne_color_scale.height);

    // Add min and max values
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(min_value, 15, tsne_color_scale.height / 2 + 5); // Min value at the left
    ctx.fillStyle = 'white';
    ctx.fillText(max_value, tsne_color_scale.width - 15, tsne_color_scale.height / 2 + 5); // Max value at the right
}

var animate_reduction_transition = (old_reduction, new_reduction, duration) => {
    //copying to make sure the reduction results aint touched
    const start_time = performance.now();

    function animate() {
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
        plot_tsne_reduction(window.current_index);

        if (t < 1) {
            requestAnimationFrame(animate);
        } 
        else {
            window.displayed_reduction = new_reduction;
        }
    }
  
    animate();    
};

/*selectors handling (colormap and reduction method)*/
const color_radio_buttons = document.querySelectorAll('input[name="selectColorMap"]');
const reduction_method_buttons = document.querySelectorAll('input[name="selectReductionMethod"]');

// Function to handle the colormap change
const handle_color_map_change = () => {
    const selected_value = document.querySelector('input[name="selectColorMap"]:checked').value;
    window.cmap = selected_value;

    //redraw components
    plot_tsne_reduction(window.current_index);
};

// Function to handle the reduction algorithm change
const handle_reduction_method_change = () => {
    const selected_value = document.querySelector('input[name="selectReductionMethod"]:checked').value;
    var old_reduction = (window.old_reduction == "tsne")? window.tsne_reduction :
                        (window.old_reduction == "pca")? window.pca_reduction : window.umap_reduction;
    var new_reduction = (selected_value == "tsne")? window.tsne_reduction :
                        (selected_value == "pca")? window.pca_reduction : window.umap_reduction;

    //redraw component (animate position transition)
    animate_reduction_transition(old_reduction, new_reduction, 1000);

    //update state after animation
    window.old_reduction = selected_value;
};

// Add change event listener to each radio button
color_radio_buttons.forEach(radio => {
    radio.addEventListener('change', handle_color_map_change);
});

reduction_method_buttons.forEach(radio => {
    radio.addEventListener('change', handle_reduction_method_change);
});

/*On click handling for navigating the video frames*/
/*compare mouse coordinates with each dot of the plot and see if it touches any, must consider the zoom/pan */
tsnePlot.addEventListener("click", async (event) => {
    event.preventDefault();
    
    const mouse_x = event.offsetX;
    const mouse_y = event.offsetY;

    //tsnePlot width/length
    var plot_width = tsnePlot.width;
    var plot_height = tsnePlot.height;

    //get min/max to later normalize reduction values
    min_x = window.displayed_reduction[0]['x'];
    max_x = window.displayed_reduction[0]['x'];
    min_y = window.displayed_reduction[0]['y'];
    max_y = window.displayed_reduction[0]['y'];

    for (i = 1;i < window.displayed_reduction.length;++i) {
        min_x = (min_x > window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : min_x;
        max_x = (max_x < window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : max_x;
        min_y = (min_y > window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : min_y;
        max_y = (max_y < window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : max_y;
    }
     
    //if clicking on the current frame index (big red dot), do nothing
    var x = tsne_translate.x + tsne_scale * (tsne_plot_offset_x + (window.displayed_reduction[window.current_index]['x'] - min_x) / (max_x - min_x) * (plot_width - 2 * tsne_plot_offset_x));
    var y = tsne_translate.y + tsne_scale * (plot_height - tsne_plot_offset_y - (window.displayed_reduction[window.current_index]['y'] - min_y) / (max_y - min_y) * (plot_height - 2 * tsne_plot_offset_y));

    dot_radius = 4;
    var dist = (mouse_x - x) * (mouse_x - x) + (mouse_y - y) * (mouse_y - y);
    if (dist <= dot_radius * dot_radius) {
        return;
    }

    for (i = 0;i < window.displayed_reduction.length;++i) {
        //get each point's coordinates after current zoom/pan
        var x = tsne_translate.x + tsne_scale * (tsne_plot_offset_x + (window.displayed_reduction[i]['x'] - min_x) / (max_x - min_x) * (plot_width - 2 * tsne_plot_offset_x));
        var y = tsne_translate.y + tsne_scale * (plot_height - tsne_plot_offset_y - (window.displayed_reduction[i]['y'] - min_y) / (max_y - min_y) * (plot_height - 2 * tsne_plot_offset_y));

        dot_radius = 2;
        var dist = (mouse_x - x) * (mouse_x - x) + (mouse_y - y) * (mouse_y - y);

        //if the user clicked inside the dot, update the frameIndex
        if (dist <= dot_radius * dot_radius) {
            //fetch current frame
            var name_processed = window.current_video.split(".")[0]; 
            const response = await fetch(`${server_url}/image/${name_processed}/${i}.png`);
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);

            window.current_frame.src = imageUrl;
            update_video(imageUrl);

            //update component
            update_scores(i);
            return;
        }
    }
})

/*zoom/pan handling */
var zom_pan_wheel = (event) => {
    event.preventDefault();
    
    const mouse_x = event.offsetX;
    const mouse_y = event.offsetY;

    const wheel = event.deltaY < 0 ? 1 : -1;
    const zoom_factor = 1 + wheel * tsne_zoom_speed;
    
    // Calculate new scale but constrain it within a range
    const new_scale = Math.max(Math.min(tsne_scale * zoom_factor, window.MAX_SCALE), window.MIN_SCALE);
    
    // Adjust translation to keep the zoom centered on the cursor
    tsne_translate.x = mouse_x - ((mouse_x - tsne_translate.x) / tsne_scale) * new_scale;
    tsne_translate.y = mouse_y - ((mouse_y - tsne_translate.y) / tsne_scale) * new_scale;

    // Apply the new scale
    tsne_scale = new_scale;

    // Redraw the content
    plot_tsne_reduction(window.current_index);
};
tsnePlot.addEventListener('wheel', zom_pan_wheel);

var zom_pan_mouse_down = (event) => {
    is_tsne_dragging = true;
    tsne_drag_offset.x = event.offsetX - tsne_translate.x;
    tsne_drag_offset.y = event.offsetY - tsne_translate.y;
};
tsnePlot.addEventListener('mousedown', zom_pan_mouse_down); 

var zom_pan_mouse_up = () => {
    is_tsne_dragging = false;
};
tsnePlot.addEventListener('mouseup', zom_pan_mouse_up);
tsnePlot.addEventListener('mouseout', zom_pan_mouse_up);

var zom_pan_mouse_move = (event) => {
    if (is_tsne_dragging) {
        tsne_translate.x = event.offsetX - tsne_drag_offset.x;
        tsne_translate.y = event.offsetY - tsne_drag_offset.y;

        //redraw context
        plot_tsne_reduction(window.current_index);
    }
};
tsnePlot.addEventListener('mousemove', zom_pan_mouse_move);

/*handling embedding selection */

// Function to check if the circle intersects a rectangle edge
var intersect_edges = (p1, p2, c, r) => {
    // Closest point on the edge to the circle's center
    let closest_x = Math.max(p1.x, Math.min(c.x, p2.x));
    let closest_y = Math.max(p1.y, Math.min(c.y, p2.y));

    // Distance from the circle's center to the closest point on the edge
    let distanceSq = length2(c, { x: closest_x, y: closest_y });

    return distanceSq <= r * r;
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
var is_circle_in_square = (p1, p2, c, r) => {
    /*circle completely inside */
    // Ensure p1 is the top-left corner and p2 is the bottom-right corner
    var rect_left = Math.min(p1.x, p2.x);
    var rect_right = Math.max(p1.x, p2.x);
    var rect_top = Math.min(p1.y, p2.y);
    var rect_bottom = Math.max(p1.y, p2.y);

    // Check if the circle is completely inside the rectangle
    var is_completely_inside = 
        (c.x - r >= rect_left) &&
        (c.x + r <= rect_right) &&
        (c.y - r >= rect_top) &&
        (c.y + r <= rect_bottom);

    // Check intersection with each of the four edges of the rectangle
    var intersects =
        intersect_edges(p1, p2, c, r) || // Top edge
        intersect_edges(p1, p2, c, r) || // Bottom edge
        intersect_edges(p1, p2, c, r) || // Left edge
        intersect_edges(p1, p2, c, r); // Right edge

    // if the circle is completely inside or starts intersecting with the rectangle, it is selected
    return intersects || is_completely_inside;
};

// update the selection indices global vector
var update_selected = (current_index) => {
    if (window.displayed_reduction == null) { return; }

    /*get min/max to later normalize reduction values*/
    min_x = window.displayed_reduction[0]['x'];
    max_x = window.displayed_reduction[0]['x'];
    min_y = window.displayed_reduction[0]['y'];
    max_y = window.displayed_reduction[0]['y'];

    for (i = 1;i < window.displayed_reduction.length;++i) {
        min_x = (min_x > window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : min_x;
        max_x = (max_x < window.displayed_reduction[i]['x'])? window.displayed_reduction[i]['x'] : max_x;
        min_y = (min_y > window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : min_y;
        max_y = (max_y < window.displayed_reduction[i]['y'])? window.displayed_reduction[i]['y'] : max_y;
    }

    //tsnePlot width/length
    var plot_width = tsnePlot.width;
    var plot_height = tsnePlot.height;

    //clear all
    window.selected_points = [];

    for (i = 0;i < window.displayed_reduction.length;++i) {
        //get center coordinates
        x = tsne_plot_offset_x + (window.displayed_reduction[i]['x'] - min_x) / (max_x - min_x) * (plot_width - 2 * tsne_plot_offset_x);
        y = plot_height - tsne_plot_offset_y - (window.displayed_reduction[i]['y'] - min_y) / (max_y - min_y) * (plot_height - 2 * tsne_plot_offset_y);

        //checking if circle is in the selected area, taking into account the current zoom/pan and the big coloured dot that is the current frame embedding
        if (is_circle_in_square(window.selection_top_left, window.selection_bot_right, 
            {x: tsne_translate.x + x * tsne_scale, y: tsne_translate.y + y * tsne_scale}, 
            (current_index == i)? 4 : 2)) {
            window.selected_points.push(i);
        }
    }
};

var selection_mouse_down = (event) => {
    selection_mouse_down_point = {x: event.offsetX, y: event.offsetY};
    //Get the closest point
    let dP1 = length2(selection_mouse_down_point, window.selection_top_left);
    let dP2 = length2(selection_mouse_down_point, window.selection_bot_right);
    let dC = length2(selection_mouse_down_point, selection_center);

    let dPTopRight = length2(selection_mouse_down_point, { x: window.selection_bot_right.x, y: window.selection_top_left.y });
    let dPBottomLeft = length2(selection_mouse_down_point, { x: window.selection_top_left.x, y: window.selection_bot_right.y });

    let list = [dP1, dP2, dC, dPTopRight, dPBottomLeft];
    //sort the list
    let minIndex = list.indexOf(Math.min(...list)); //Usage of the spread operator

    if (minIndex == 0) selection_state = "dP1";
    if (minIndex == 1) selection_state = "dP2";
    if (minIndex == 2) selection_state = "dC";
    if (minIndex == 3) selection_state = "dCTR";
    if (minIndex == 4) selection_state = "dCBL";
};

var selection_mouse_move = (event) => {
    if (selection_state == "idle") { return; }
    var mousePosition = {x: event.offsetX, y: event.offsetY};
    var delta = {
        x: mousePosition.x - selection_mouse_down_point.x,
        y: mousePosition.y - selection_mouse_down_point.y,
    };
    switch (selection_state) {
        case "dP1":
            window.selection_top_left = { x: window.selection_top_left.x + delta.x, y: window.selection_top_left.y + delta.y };
            break;

        case "dP2":
            window.selection_bot_right = { x: window.selection_bot_right.x + delta.x, y: window.selection_bot_right.y + delta.y };
            break;

        case "dC":
            window.selection_top_left = { x: window.selection_top_left.x + delta.x, y: window.selection_top_left.y + delta.y };
            window.selection_bot_right = { x: window.selection_bot_right.x + delta.x, y: window.selection_bot_right.y + delta.y };
            break;

        case "dCTR":
            window.selection_top_left = { x: window.selection_top_left.x, y: window.selection_top_left.y + delta.y };
            window.selection_bot_right = { x: window.selection_bot_right.x + delta.x, y: window.selection_bot_right.y };
            break;

        case "dCBL":
            window.selection_top_left = { x: window.selection_top_left.x + delta.x, y: window.selection_top_left.y };
            window.selection_bot_right = { x: window.selection_bot_right.x, y: window.selection_bot_right.y + delta.y };
            break;
    }
    selection_center = { x: (window.selection_top_left.x + window.selection_bot_right.x) / 2, y: (window.selection_top_left.y + window.selection_bot_right.y) / 2 };
    selection_mouse_down_point = mousePosition;

    // Redraw the content
    plot_tsne_reduction(window.current_index);
    update_selected(window.current_index);
    plot_score_curve(window.current_index);
}

var selection_mouse_up = () => { 
    selection_state = "idle"; 

    // Redraw the content
    plot_tsne_reduction(window.current_index);
    update_selected(window.current_index);
    plot_score_curve(window.current_index);
}

/*zoom/pan reset option (or reset all?)*/
var resetTsne = document.getElementById("resetTsnePlot");

resetTsne.addEventListener("click", () => {
    //back to initial settings
    tsne_scale = 1.0;
    tsne_translate = { x: 0, y: 0 };
    is_tsne_dragging = false;
    tsne_drag_offset = { x: 0, y: 0 };

    //reset selection
    window.is_selection = false;
    window.selected_points = [];

    tsnePlot.removeEventListener("mousemove", selection_mouse_move);
    tsnePlot.removeEventListener("mousedown", selection_mouse_down);
    tsnePlot.removeEventListener("mouseup", selection_mouse_up);
    tsnePlot.removeEventListener("mouseout", selection_mouse_up);

    tsnePlot.addEventListener("mousedown", zom_pan_mouse_down);
    tsnePlot.addEventListener("mouseup", zom_pan_mouse_up);
    tsnePlot.addEventListener("mouseout", zom_pan_mouse_up);
    tsnePlot.addEventListener("mousemove", zom_pan_mouse_move);
    tsnePlot.addEventListener("wheel", zom_pan_wheel);

    //redraw context
    plot_tsne_reduction(window.current_index);
    plot_score_curve(window.current_index);
});

/*zoomPan/selection toggle option */
var toggleSelection = document.getElementById("selectDots");

toggleSelection.addEventListener("click", () => {
    if (window.is_selection == false) {
        window.is_selection = true;
        tsnePlot.removeEventListener("mousemove", zom_pan_mouse_move);
        tsnePlot.removeEventListener("mousedown", zom_pan_mouse_down);
        tsnePlot.removeEventListener("mouseup", zom_pan_mouse_up);
        tsnePlot.removeEventListener("mouseout", zom_pan_mouse_up);
        tsnePlot.removeEventListener("wheel", zom_pan_wheel);

        tsnePlot.addEventListener("mousedown", selection_mouse_down);
        tsnePlot.addEventListener("mouseup", selection_mouse_up);
        tsnePlot.addEventListener("mousemove", selection_mouse_move);

        update_selected(window.current_index);
        plot_score_curve(window.current_index);
    }
    else {
        window.is_selection = false;
        tsnePlot.removeEventListener("mousemove", selection_mouse_move);
        tsnePlot.removeEventListener("mousedown", selection_mouse_down);
        tsnePlot.removeEventListener("mouseup", selection_mouse_up);
        tsnePlot.removeEventListener("mouseout", selection_mouse_up);

        tsnePlot.addEventListener("mousedown", zom_pan_mouse_down);
        tsnePlot.addEventListener("mouseup", zom_pan_mouse_up);
        tsnePlot.addEventListener("mouseout", zom_pan_mouse_up);
        tsnePlot.addEventListener("mousemove", zom_pan_mouse_move);
        tsnePlot.addEventListener("wheel", zom_pan_wheel);
    }
    //redraw context
    plot_tsne_reduction(window.current_index);
});
