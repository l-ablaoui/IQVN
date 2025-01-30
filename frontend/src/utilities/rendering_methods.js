/** render a dot in a canvas
 * @param {*} ctx canvas context
 * @param {*} point coordinates (dot center)
 * @param {*} radius dot radius */
export const fill_circle = (ctx, point, radius) => {
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius, radius, 0, 0, 2 * Math.PI);
    ctx.fill();
};

/** draw a rentagle (full), its contour and the points of the corners
 * @param {*} ctx 2D context where the rectangle is drawn
 * @param {*} p1 top left corner
 * @param {*} p2 bottom right corner */
export const draw_rectangle = (ctx, p1, p2, contour_color, rectangle_color) => {
    // Draw the points for the corners of the square
    ctx.fillStyle = contour_color;
    fill_circle(ctx, p1, 5);
    fill_circle(ctx, p2, 5);
    fill_circle(ctx, { x: p1.x, y: p2.y }, 5);
    fill_circle(ctx, { x: p2.x, y: p1.y }, 5);

    // Draw the selection rectangle
    ctx.fillStyle = rectangle_color;
    ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

    ctx.strokeStyle = contour_color;
    ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
    ctx.stroke();
};

/** utility function to draw a vertical line in a 2d plot inside a canvas
 * @param {*} current_index logical x coordinate of the marker, corresponds to the current frame number (video frame) in this usecase
 * @param {*} max maximum value in the x axis, corresponds to the number of frame in the video in this usecase
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} color color of the line marker
 * @param {*} line_width line width of the line marker
 * @param {*} svg canvas where the line is drawn */
export const plot_marker = (current_index, max, offset_left, offset_right, offset_y, color, line_width, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;
    let ctx = svg.getContext("2d", { alpha: true });
    let x = offset_left + (current_index / (max - 1)) * (plot_width - offset_left - offset_right);
    
    ctx.beginPath();
    ctx.moveTo(x, offset_y);
    ctx.lineTo(x, plot_height - offset_y);
    ctx.strokeStyle = color;
    ctx.lineWidth = line_width;
    ctx.stroke();
};

/** plots the current time (window.current_index / window.fps) either on the left or the right
 * of the marker (assuming this one is drawn). assumes also a 2D curve plot
 * @param {*} current_index selected video frame index (positive integer)
 * @param {*} max_index number of frames in the video (positive integer)
 * @param {*} fps video fps rate, assumed to be a non-zero positive integer
 * @param {*} svg canvas element where the time is to be drawn
 * @param {*} offset_left space to be left on the left of the X axis
 * @param {*} offset_right space to be right on the left of the X axis */
export const plot_current_timer = (current_index, max_index, fps, svg, offset_left, offset_right) => {
    let plot_width = svg.width;
    let plot_height = svg.height;

    let ctx = svg.getContext("2d", { alpha: true });

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

/** drawing of the small triangle above the timestamp line marker
 * @param {*} current_index selected video frame index (positive integer)
 * @param {*} max_index number of frames in the video (positive integer)
 * @param {*} svg canvas element where the time is to be drawn
 * @param {*} offset_left space to be left on the left of the X axis
 * @param {*} offset_right space to be right on the left of the X axis
 * @param {*} offset_y both top and bottom margin */
export const plot_marker_triangle = (current_index, max_index, svg, offset_left, offset_right, offset_y, fill_color) => {
    let ctx = svg.getContext("2d", { alpha: true });

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

/** draws thin verticals lines representing timestamps
 * the length of the interval between each line is computed dynamically
 * so that a total of no more than 10 lines are drawn in the canvas
 * @param {*} max_index the total number of frames in the video (expected to be a non zero positive integer)
 * @param {*} fps video fps rate (expected to be a non zero positive integer)
 * @param {*} svg the canvas where the lines are drawn, expected to be a 2D curve */
export const plot_timestamps = (max_index, fps, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;

    let ctx = svg.getContext("2d", { alpha: true });

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

/** utility function to draw the x/y axes of a 2D plot in a canvas
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} svg canvas where the axes are drawn */
export const plot_axes = (offset_left, offset_right, offset_y, svg) => {
    let lenX = svg.width;
    let lenY = svg.height;
    let ctx = svg.getContext("2d", { alpha: true });

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

/** Render a horizontal separator on a canvas (svg)'s full width
 * the separator is located at threshold percent of the height of the canvas
 * @param {*} threshold level in terms of height for drawing the selector, expected float between 0 and 1
 * @param {*} offset_left offset for left, expected positive integer
 * @param {*} offset_right offset for right, expected positive integer
 * @param {*} offset_y offset for top and bot, expected positive integer that falls 
 * in the range of the canvas' height
 * @param {*} svg expected html canvas element */
export const draw_selector = (threshold, offset_left, offset_right, offset_y, selector_color, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;
    let ctx = svg.getContext("2d", { alpha: true });
    let y = offset_y + (1 - threshold) * (plot_height - 2 * offset_y);
    
    //line
    ctx.beginPath();
    ctx.moveTo(offset_left, y);
    ctx.lineTo(plot_width - offset_right, y);
    ctx.strokeStyle = selector_color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    //left triangle
    ctx.beginPath();
    ctx.moveTo(offset_left, y - 6);
    ctx.lineTo(offset_left, y + 6);
    ctx.lineTo(offset_left + 6, y);
    ctx.closePath();
    ctx.fillStyle = selector_color;
    ctx.fill();
    ctx.closePath();

    //right triangle
    ctx.beginPath();
    ctx.moveTo(plot_width - offset_right, y - 6);
    ctx.lineTo(plot_width - offset_right, y + 6);
    ctx.lineTo(plot_width - offset_right - 6, y);
    ctx.closePath();
    ctx.fillStyle = selector_color;
    ctx.fill();
    ctx.closePath();
};

/** get the border-radius dynamically from an html element */
export const get_border_radius = (element) => {
    const style = window.getComputedStyle(element);
    const border_radius = style.borderTopLeftRadius; // Get the top-left radius (they're usually the same)
    return parseFloat(border_radius) || 0; // Return as a number (default to 0 if not set)
};
