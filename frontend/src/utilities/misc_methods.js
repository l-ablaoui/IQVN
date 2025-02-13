import { 
    REGULAR_COLOR, 
    SELECTION_COLOR,
    MIN_SCALE,
    MAX_SCALE 
} from "./constants";

/** set operation A union B
 * @param {*} array_a expected array of integers
 * @param {*} array_b expected array of integers
 * @returns expected (new reference) array of integers */
export const union = (array_a, array_b) => {
    let set = new Set([...array_a, ...array_b]); // Use a Set to automatically handle duplicates
    return Array.from(set);
};

/** set operation A intersect B
 * @param {*} array_a expected array of integers
 * @param {*} array_b expected array of integers
 * @returns expected (new reference) array of integers */
export const intersection = (array_a, array_b) => {
    let set_a = new Set(array_a);
    let intersection = array_b.filter(element => set_a.has(element));
    return intersection;
};

/** set operation A - B
 * @param {*} array_a expected array of integers
 * @param {*} array_b expected array of integers
 * @returns expected (new reference) array of integers */
export const difference = (array_a, array_b) => {
    let set_b = new Set(array_b);
    let difference = array_a.filter(element => !set_b.has(element)); //A - B
    return difference;
};

/**
 * @param {*} p1 expected 2D float point coordinates 
 * @param {*} p2 expected 2D float point coordinates  
 * @returns expected float representing euclidian distance (power 2) */
export const length2 = (p1, p2) => {
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
};

/** generate high saturation colors
 * @param {*} nb_colors expected non null positive integer, generated colors count
 * @returns expected array of strings, generated colors in a string array */
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

/** generates a color map (string array) with nb_points points where the selected
 * points are colored in blue 
 * @param {*} nb_points total number of points in the original array
 * @param {*} selected_points integer array representing the ID of the selected points
 * @returns string array containing colors mapping an array with nb_points points */
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
        color_map.push((found)? SELECTION_COLOR + "0.5": REGULAR_COLOR);
    }

    return color_map;
};

/** onclick method to enable focus on html elements (namely canvas) */
export const focus_onclick = (dom_element) => { dom_element.focus(); };

/** format time in seconds to HH:MM:SS
 * @param {*} seconds_count expected positive integer
 * @returns expected string representing time in HH:MM:SS */
export const format_time = (seconds_count) => {
    const hours = Math.floor(seconds_count / 3600)
    const minutes = Math.floor((seconds_count - hours * 3600) / 60);
    const seconds = seconds_count % 60;
    
    return `${String(hours).padStart(2, '0')}:` + `${String(minutes).padStart(2, '0')}:`
        + `${String(seconds).padStart(2, '0')}`;
};

/** create discrete interval from interval_start to interval_end
 * @param {*} interval_start expected integer
 * @param {*} interval_end expected integer (interval_end >= interval_start)
 * @returns expected array of sorted integers */
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

/** handles zoom on a canvas element
 * @param {*} svg expected canvas element
 * @param {*} zoom_speed expected float
 * @param {*} scale expected float
 * @param {*} set_scale expected setter method for scale
 * @param {*} translate expected 2D float point
 * @param {*} set_translate expected setter for translate
 * @param {*} event expected wheel event */
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

/** handles panning init on a canvas element
 * @param {*} svg expected canvas element
 * @param {*} set_dragging expected setter method for boolean dragging state
 * @param {*} translate expected 2D float point
 * @param {*} set_drag_offset expected setter method for 2D point drag offset
 * @param {*} event expected mousedown event with access to clientX/Y */
export const handle_zoom_pan_mousedown = (svg, set_dragging, translate, set_drag_offset, event) => {
    set_dragging(true);
    const rect = svg.getBoundingClientRect();
    set_drag_offset({
        x: event.clientX - rect.left - translate.x,
        y: event.clientY - rect.top - translate.y
    });
};

/** handles panning mouvement on a canvas element
 * @param {*} svg expected canvas element
 * @param {*} is_dragging expected boolean state
 * @param {*} set_translate expected setter for 2D point translate
 * @param {*} drag_offset expected 2D float point
 * @param {*} event expected mousemove event with access to clientX/Y */
export const handle_zoom_pan_mousemove = (svg, is_dragging, set_translate, drag_offset, event) => {
    if (is_dragging) {
        const rect = svg.getBoundingClientRect();
        set_translate({
            x: event.clientX - rect.left - drag_offset.x,
            y: event.clientY - rect.top - drag_offset.y
        });
    }
};

/** handles panning end on canvas element
 * @param {*} set_dragging expected setter for boolean dragging state */
export const handle_zoom_pan_mouseup = (set_dragging) => { set_dragging(false); };

/** handles selection area init on a canvas element
 * @param {*} svg expected canvas element
 * @param {*} limit_top_left expected 2D float point, top left point that the selection area can reach at max
 * @param {*} limit_bot_right expected 2D float point, bot right point that the selection area can reach at max
 * @param {*} set_selection_top_left expected setter for 2D point selection area top left corner
 * @param {*} set_selection_bot_right expected setter for 2D point selection area bot right corner
 * @param {*} event expected mousedown event with access to clientX/Y */
export const handle_selection_area_mousedown = (svg, limit_top_left, limit_bot_right, 
    set_selection_top_left, set_selection_bot_right, event) => {
    const rect = svg.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    x = Math.min(Math.max(x, limit_top_left.x), limit_bot_right.x);
    y = Math.min(Math.max(y, limit_top_left.y), limit_bot_right.y);

    set_selection_top_left({x: x, y: y});
    set_selection_bot_right({x: x, y: y});
};

/** handles selection area resizing on mouvement on a canvas element
 * @param {*} svg expected canvas element
 * @param {*} limit_top_left expected 2D float point, top left point that the selection area can reach at max
 * @param {*} limit_bot_right expected 2D float point, bot right point that the selection area can reach at max
 * @param {*} selection_top_left expected 2D float point, top left corner of the selection area
 * @param {*} set_selection_bot_right expected setter for 2D point selection area bot right corner
 * @param {*} event expected mousemove event with access to clientX/Y */
export const handle_selection_area_mousemove = (svg, limit_top_left, limit_bot_right,
    selection_top_left, set_selection_bot_right, event) => {
    if (selection_top_left.x !== 0 && selection_top_left.y !== 0) {
        const rect = svg.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        x = Math.min(Math.max(x, limit_top_left.x), limit_bot_right.x);
        y = Math.min(Math.max(y, limit_top_left.y), limit_bot_right.y);

        set_selection_bot_right({x: x, y: y});
    }
};

/** get the bounding box of a set of 2D points
 * @param {*} points expected array of 2D floats
 * @returns expected array of four floats [min_x, max_x, min_y, max_y] */
export const get_bounding_box = (points) => {
    let min_x = points[0]['x'];
    let max_x = points[0]['x'];
    let min_y = points[0]['y'];
    let max_y = points[0]['y'];

    points.forEach(point => {
        min_x = Math.min(min_x, point['x']);
        max_x = Math.max(max_x, point['x']);
        min_y = Math.min(min_y, point['y']);
        max_y = Math.max(max_y, point['y']);
    });

    return [min_x, max_x, min_y, max_y];
};

/** manually computes the inline offset of a video (src) in an html video element
 * @param {*} video expected html video element
 * @returns expected x and y float values representing the inline offset */
export const get_video_inline_offset = (video) => {
    const { videoWidth, videoHeight, offsetWidth, offsetHeight } = video;

    const inline_ratio = videoWidth / videoHeight;
    const element_ratio = offsetWidth / offsetHeight;

    let x_offset = 0;
    let y_offset = 0;

    if (element_ratio > inline_ratio) {
        // Video is letterboxed horizontally (black bars on left & right)
        const scaled_height = offsetWidth / inline_ratio;
        y_offset = (offsetHeight - scaled_height) / 2;
    } else {
        // Video is letterboxed vertically (black bars on top & bottom)
        const scaled_width = offsetHeight * inline_ratio;
        x_offset = (offsetWidth - scaled_width) / 2;
    }

    return { x_offset, y_offset };
};

/** parse selected frames into time intervals
 * @param {*} selected_frames expected array of integers representing selected frames
 * @param {*} max_index expected integer, maximum frame index
 * @param {*} fps expected integer, frames per second
 * @returns expected string representing time intervals */
export const parse_selected_frames = (selected_frames, max_index, fps) => {
    //represent the selected frames in a boolean manner
    let bool_timeline_frames = new Array(max_index).fill(0);
    selected_frames.forEach((element) => {
        bool_timeline_frames[element] = 1;
    });

    //subsample frames to get seconds
    const bool_timestamps = bool_timeline_frames.filter((_, index) => index % fps === 0);

    //parse time intervals into string
    const intervals = bool_timestamps.reduce((acc, cur, i, arr) => {
        if (cur && (i === 0 || !arr[i - 1])) acc.push([i]);  // Start of a new interval
        if (!cur && arr[i - 1]) acc[acc.length - 1].push(i); // End of an interval
        if (cur && i === arr.length - 1) acc[acc.length - 1].push(i + 1); // End interval if last element is 1
        return acc;
    }, []).map(([start, end]) => `${format_time(start)}-${format_time(end - 1)}`).join("; ");

    return intervals;
};

/** get scores above a certain percentage threshold
 * @param {*} scores expected array of floats
 * @param {*} threshold expected float between 0 and 1, represents a percentage
 * @returns expected array of integers representing the indices of scores above threshold */
export const get_scores_above_threshold = (scores, threshold) => {
    if (scores == null) { return []; }
    if (scores.length == 0) { return []; }

    //normalize scores array
    let min_score = Math.min(...scores);
    let max_score = Math.max(...scores);
    let scaled_scores = scores.map(score => (score - min_score) / (max_score - min_score));

    return scaled_scores.reduce((acc, num, index) => {
        if (num > threshold) acc.push(index);
        return acc;
    }, []);
};
