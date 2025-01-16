import { 
    REGULAR_COLOR, 
    SELECTION_COLOR,
    MIN_SCALE,
    MAX_SCALE 
} from "./constants";

export const union = (array_a, array_b) => {
    let set = new Set([...array_a, ...array_b]); // Use a Set to automatically handle duplicates
    return Array.from(set);
};

export const intersection = (array_a, array_b) => {
    let set_a = new Set(array_a);
    let intersection = array_b.filter(element => set_a.has(element));
    return intersection;
};

export const difference = (array_a, array_b) => {
    let set_b = new Set(array_b);
    let difference = array_a.filter(element => !set_b.has(element)); //A - B
    return difference;
};

/**
 * @param {*} p1 2d point coordinates 
 * @param {*} p2 another 2d point cootdinates 
 * @returns euclidian distance (power 2)
 */
export const length2 = (p1, p2) => {
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
};

/**
 * generate high saturation colors
 * @param {*} nb_colors generated colors count
 * @returns generated colors in a string array
 */
export const generate_HSL_colors = (nb_colors) => {
    let colors = [];
    const saturation = 70; // Saturation percentage
    const lightness = 50;  // Lightness percentage

    for (let i = 0; i < nb_colors; i++) {
        const hue = Math.floor((360 / nb_colors) * i);
        colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`);
    }

    return colors;
};

/**
 * generates a color map (string array) with nb_points points where the selected
 * points are colored in blue 
 * @param {*} nb_points total number of points in the original array
 * @param {*} selected_points integer array representing the ID of the selected points
 * @returns string array containing colors mapping an array with nb_points points
 */
export const generate_selected_points_color_map = (nb_points, selected_points) => {
    let color_map = [];

    for (let i = 0;i < nb_points;++i) {
        //check if current point is selected
        let found = false;
        for (let j = 0;j < selected_points.length;++j) {
            if (i == selected_points[j]) {
                found = true;
            }
        }
        color_map.push((found)? SELECTION_COLOR + "0.5": REGULAR_COLOR + "0.5");
    }

    return color_map;
};

export const focus_onclick = (dom_element) => { dom_element.focus(); };

export const format_time = (seconds_count) => {
    const hours = Math.floor(seconds_count / 3600)
    const minutes = Math.floor((seconds_count - hours * 3600) / 60);
    const seconds = seconds_count % 60;
    
    return `${String(hours).padStart(2, '0')}:` + `${String(minutes).padStart(2, '0')}:`
        + `${String(seconds).padStart(2, '0')}`;
};

//mouse mouvement listeners
export const get_integer_interval = (interval_start, interval_end) => {
    //create array of selected frames [interval_start, interval_end]
    const interval_length = interval_end - interval_start + 1;
    let interval;
    if (interval_length > 0) {
        interval = Array.from({ length: interval_length }, (_, i) => interval_start + i);
    }
    else {
        interval = [interval_start];
    }

    return interval;
};

export const handle_zoom_pan_wheel = (svg, zoom_speed, scale, set_scale, translate, set_translate, event) => {
    event.preventDefault();

    const rect = svg.getBoundingClientRect();
    const mouse_x = event.clientX - rect.left;
    const mouse_y = event.clientY - rect.top;

    const wheel = event.deltaY < 0 ? 1 : -1;
    const zoom_factor = 1 + wheel * zoom_speed;
    
    // Calculate new scale but constrain it within a range
    const new_scale = Math.max(Math.min(scale * zoom_factor, MAX_SCALE), MIN_SCALE);
    
    // Adjust translation to keep the zoom centered on the cursor
    set_translate({
        x: mouse_x - ((mouse_x - translate.x) / scale) * new_scale,
        y: mouse_y - ((mouse_y - translate.y) / scale) * new_scale
    });

    // Apply the new scale
    set_scale(new_scale);
};

export const handle_zoom_pan_mousedown = (svg, set_dragging, translate, set_drag_offset, event) => {
    set_dragging(true);
    const rect = svg.getBoundingClientRect();
    set_drag_offset({
        x: event.clientX - rect.left - translate.x,
        y: event.clientY - rect.top - translate.y
    });
};

export const handle_zoom_pan_mousemove = (svg, is_dragging, set_translate, drag_offset, event) => {
    if (is_dragging) {
        const rect = svg.getBoundingClientRect();
        set_translate({
            x: event.clientX - rect.left - drag_offset.x,
            y: event.clientY - rect.top - drag_offset.y
        });
    }
};

export const handle_zoom_pan_mouseup = (set_dragging) => {
    set_dragging(false);
};
