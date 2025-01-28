import "../App.css"
import { SELECTION_COLOR } from "../utilities/constants";
import {
    plot_timestamps, 
    plot_marker, 
    plot_marker_triangle, 
    plot_current_timer, 
    plot_axes, 
} from "../utilities/rendering_methods";
import { 
    generate_selected_points_color_map,
    get_integer_interval,
    difference,
    union 
} from "../utilities/misc_methods";

import { useState, useRef, useEffect } from "react";

const Timeline = ({current_index, update_time, max_index, fps, selected_points, set_selected_points, scores}) => {
    const [is_timeline_dragging, set_timeline_dragging] = useState(false);

    const [interval_start, set_interval_start] = useState(-1);
    const [interval_end, set_interval_end] = useState(-1);

    const [ctrl_pressed, set_ctrl_pressed] = useState(false);
    const [shift_pressed, set_shift_pressed] = useState(false);
    const [is_selection_clicking, set_selection_clicking] = useState(false);
    const [is_selection_dragging, set_selection_dragging] = useState(false);

    const offset_left = 5;
    const offset_right = 5;
    const offset_y = 0;

    const timeline_ref = useRef(null);

    useEffect(() => {
        if (timeline_ref.current) {
            timeline_ref.current.width = timeline_ref.current.offsetWidth;
            timeline_ref.current.height = timeline_ref.current.offsetHeight;
            render_timeline(selected_points, current_index);
        }
    }, [current_index, max_index, selected_points, scores]);

    /** mousedown handles cursor mouvement/video frame update and frames selection
     * @param {*} event expected onMouseDown event with access to clientX/Y
    */
    const handle_timeline_mousedown = (event) => { 
        // mouvement of the cursor when user clicks or drags
        set_timeline_dragging(true); 

        // handling of selection when the CTRL is pressed
        handle_timeline_selection_mousedown(timeline_ref.current, offset_left, 
            offset_right, offset_y, max_index, event);
        set_selection_dragging(true);
    };

    /** mousemove handles cursor mouvement/video frame update and frames selection
     * @param {*} event expected onMouseMove event with access to clientX/Y
    */
    const handle_timeline_mousemove = (event) => { 
        // mouvement of the cursor when user clicks or drags
        is_timeline_dragging && update_time_onclick(offset_left, offset_right, offset_y, max_index, event); 

        // handling of selection when the CTRL is pressed
        is_selection_dragging && handle_timeline_selection_mousemove(timeline_ref.current, 
            offset_left, offset_right, offset_y, max_index, selected_points, event);
    };

    /** mouseup handles cursor mouvement/video frame update and frames selection
     * @param {*} event expected onMouseUp event with access to clientX/Y
    */
    const handle_timeline_mouseup = (event) => {
        // mouvement of the cursor when user clicks or drags
        is_timeline_dragging && update_time_onclick(offset_left, offset_right, offset_y, max_index, event);
        set_timeline_dragging(false);

        // handling of selection when the CTRL is pressed
        is_selection_dragging && handle_timeline_selection_mousemove(timeline_ref.current, 
            offset_left, offset_right, offset_y, max_index, selected_points, event);
        set_selection_dragging(false);
    }; 

    /** mouseout handles cursor mouvement/video frame update and frames selection
     * @param {*} event expected onMouseOut event with access to clientX/Y
    */
    const handle_timeline_mouseout = (event) => { 
        // mouvement of the cursor when user clicks or drags
        set_timeline_dragging(false); 

        // handling of selection when the CTRL is pressed
        is_selection_dragging && handle_timeline_selection_mousemove(timeline_ref.current, 
            offset_left, offset_right, offset_y, max_index, selected_points, event);
        set_selection_dragging(false);
    };

    /** keydown handles left/right mouvement of the cursor and selection of frames
     * @param {*} event expected onKeyDown event with access to key
     */
    const handle_timeline_keydown = (event) => {
        // handle current_index mouvement
        if (event.key == "ArrowRight") {
            update_time(Math.min(current_index + 1, max_index));
        }
        if (event.key == "ArrowLeft") {
            update_time(Math.max(current_index - 1, 0));
        }

        // handle selection with keys
        handle_timeline_selection_keychange(event);
        handle_timeline_selection_left_right_keydown(event, current_index, selected_points);
    };

    /** keyup handles left/right mouvement of the cursor and selection of frames
     * @param {*} event expected onKeyUp event with access to key
     */
    const handle_timeline_keyup = (event) => {
        handle_timeline_selection_keychange(event);
    };

    /** capture ctrl and shift click for selection*/
    const handle_timeline_selection_keychange = (event) => {
        set_ctrl_pressed(event.ctrlKey);

        //if ctrl is in keyup state, stop any current selection
        if (!ctrl_pressed) {
            set_selection_clicking(false);
            set_selection_dragging(false);
        }

        set_shift_pressed(event.shiftKey);
    };

    /** if left/right keys are pressed while ctrl is pressed, apply selection*/
    const handle_timeline_selection_left_right_keydown = (event, current_index, selected_points) => {
        //ctrl aint pressed, skip
        if (!ctrl_pressed) { return; }

        // the first time a key is pressed while ctrl is pressed, init intervals
        // the beginning of the interval is always the current index (frozen when selecting intervals)
        if (!is_selection_clicking) {
            set_selection_clicking(true);
            set_interval_start(current_index);
            set_interval_end(current_index);
        }
        // update intervals and selection depending on the key pressed (left/right)
        else {
            //update intervals
            if (event.key == "ArrowRight") {
                set_interval_end(interval_end + 1);
            }
            if (event.key == "ArrowLeft") {
                set_interval_end(interval_end - 1);
            }

            //update selection

            let new_selected_points = [];
            
            // checking if the intervals got inverted
            if (interval_end > interval_start) {
                new_selected_points = get_integer_interval(interval_start, interval_end);
            }
            else {
                new_selected_points = get_integer_interval(interval_end, interval_start);
            }

            if (shift_pressed) {
                new_selected_points = difference(selected_points, new_selected_points);
            } 
            else {
                new_selected_points = union(selected_points, new_selected_points);
            }
            
            // Update the passed array (no duplicates union)
            set_selected_points(new_selected_points);
        }
    };

    /** mousedown triggered method, initializes the selection intervals to the frame corresponding 
     * to the clicking area
     * @param {*} svg timeline canvas element
     * @param {*} offset_left left margin that is ignored when clicking
     * @param {*} offset_right right margin that is ignored when clicking
     * @param {*} offset_y both top and bottom margins that are ignored when clicking
     * @param {*} max_index max number of frames, used for corresponding clicked area with an actual frame number
     * @param {*} event used to track the click area
     */
    const handle_timeline_selection_mousedown = (svg, offset_left, offset_right, offset_y, max_index, event) => {
        //get frame that corresponds to current mouse position
        const rect = timeline_ref.current.getBoundingClientRect();
        const mouse_x = event.clientX - rect.left;
        const mouse_y = event.clientY - rect.top;

        const plot_width = svg.width;
        const plot_height = svg.height;

        //case clicked on the offset
        if (offset_y > mouse_y || mouse_y > plot_height - offset_y) { return; }
        if (offset_left > mouse_x || mouse_x > plot_width - offset_right) { return; }

        const frame_index = Math.trunc((mouse_x - offset_left) / (plot_width - offset_right - offset_left) 
            * (max_index - 1));

        //init start and end of selection interval
        set_interval_start(frame_index);
        set_interval_end(frame_index);
    };

    /** mousemove triggered method, updates the selected_points array according 
     * to the selected frames on the timeline using drag + ctrl + shift interaction. 
     * 
     * drag + ctrl => add selected points to the selection,
     * drag + ctrl + shift => remove selected points from the selection
     * @param {*} svg timeline canvas element
     * @param {*} offset_left left margin that is ignored when clicking
     * @param {*} offset_right right margin that is ignored when clicking
     * @param {*} offset_y both top and bottom margins that are ignored when clicking
     * @param {*} max_index max number of frames, used for corresponding clicked area with an actual frame number
     * @param {*} selected_points array of integers that represent already selected frames, can be empty
     * @param {*} event expected onClick event with access to clientX/Y
     */
    const handle_timeline_selection_mousemove = (svg, offset_left, offset_right, offset_y, max_index, selected_points, event) => {
        //if CTRL is not pressed down, skip
        if (!ctrl_pressed) { return; }

        //get frame that corresponds to current mouse position
        const rect = timeline_ref.current.getBoundingClientRect();
        const mouse_x = event.clientX - rect.left;
        const mouse_y = event.clientY - rect.top;

        const plot_width = svg.width;
        const plot_height = svg.height;

        //case clicked on the offset
        if (offset_y > mouse_y || mouse_y > plot_height - offset_y) { return; }
        if (offset_left > mouse_x || mouse_x > plot_width - offset_right) { return; }

        const frame_index = Math.trunc((mouse_x - offset_left) / (plot_width - offset_right - offset_left) 
            * (max_index - 1));

        // Update the start and end of the interval based on the mouse position
        set_interval_start(Math.min(interval_start, frame_index));
        set_interval_end(Math.max(interval_end, frame_index));
        
        let new_selected_points = get_integer_interval(interval_start, interval_end);

        // Combine interval with selected points depending on pressed keys
        if (shift_pressed) {
            new_selected_points = difference(selected_points, new_selected_points);
        } 
        else {
            new_selected_points = union(selected_points, new_selected_points);
        }

        // Update the passed array (no duplicates union)
        set_selected_points(new_selected_points);
    };

    /** update current frame (and current timer on video) based on the mouse click position
     * @param {*} offset_left expected positive integer
     * @param {*} offset_right expected positive integer
     * @param {*} offset_y offset_top + offset_bot, expected positive integer
     * @param {*} max_index total number of frames, expected positive integer
     * @param {*} event expected onClick event with access to clientX/Y
     */
    const update_time_onclick = (offset_left, offset_right, offset_y, max_index, event) => {
        const rect = timeline_ref.current.getBoundingClientRect();
        const mouse_x = event.clientX - rect.left;
        const mouse_y = event.clientY - rect.top;

        const plot_width = timeline_ref.current.width;
        const plot_height = timeline_ref.current.height;

        //case clicked on the offset
        if (offset_y > mouse_y || mouse_y > plot_height - offset_y) { return; }
        if (offset_left > mouse_x || mouse_x > plot_width - offset_right) { return; }

        const new_index = Math.trunc((mouse_x - offset_left) / (plot_width - offset_right - offset_left) 
            * (max_index - 1));
        update_time(new_index);
        render_timeline(selected_points, current_index);
    };

    /** render video timeline with timestamps and axes
     * 
     * selected points are represented with blue background,
     * current frame is marked with a cursor, 
     * scores are rendered as a curve if they have been computed
     * @param {*} selected_points expected array of integers, IDs of selected points
     * @param {*} current_index expected integer, ID of the currently displayed video frame
     */
    const render_timeline = (selected_points, current_index) => {
        let ctx = timeline_ref.current.getContext("2d", { alpha: true });

        let plot_width = timeline_ref.current.offsetWidth;
        let plot_height = timeline_ref.current.offsetWidth;
    
        ctx.clearRect(0, 0, plot_width, plot_height);  
    
        //plot selected points highlight
        if (selected_points != null) {
            for (let i = 0; i < selected_points.length - 1; ++i)  {
                let x1 = selected_points[i] / (max_index - 1) * plot_width;
                ctx.beginPath();
                ctx.moveTo(x1, 0);
                ctx.rect(x1, 0, 1 / max_index - plot_width, plot_height);
                ctx.strokeStyle = SELECTION_COLOR + "0.1)";
                ctx.stroke();
            }
        }

        render_score_curve(timeline_ref.current);
        plot_timestamps(max_index, fps, timeline_ref.current);
        plot_marker_triangle(current_index, max_index, timeline_ref.current, offset_left, offset_right, offset_y, "black");
        plot_current_timer(current_index, max_index, fps, timeline_ref.current, offset_left, offset_right);
        plot_marker(current_index, max_index, offset_left, offset_right, offset_y, "black", 0.7, timeline_ref.current);
        plot_axes(offset_left, offset_right, offset_y, timeline_ref.current);
    };

    /** render scores as a curve on the given svg
     * @param {*} svg expected canvas element
     */
    const render_score_curve = (svg) => {
        if (!scores) { return; }

        const plot_width = svg.offsetWidth;
        const plot_height = svg.offsetHeight;

        //normalize scores array
        let min_score = Math.min(...scores);
        let max_score = Math.max(...scores);
        let scaled_scores = scores.map(score => (score - min_score) / (max_score - min_score));

        //draw the curve
        let ctx = svg.getContext("2d", { alpha: true });
        ctx.beginPath();
        let previous_x = offset_left;
        let previous_y = plot_height - scaled_scores[0] * (plot_height - 2 * offset_y);
        let color_map = generate_selected_points_color_map(max_index, selected_points); 

        //iterate through the points
        for (let i = 1; i < scaled_scores.length; i++) {
            let x = offset_left + (i / (scaled_scores.length - 1)) * 
                (plot_width - offset_right - offset_left);
            let y = plot_height - offset_y - scaled_scores[i] * 
                (plot_height - 2 * offset_y);

            // Start a new path segment with the new color
            let current_path = new Path2D();
            current_path.moveTo(previous_x, previous_y);
            current_path.lineTo(x, y);
            ctx.strokeStyle = color_map[i];
            ctx.stroke(current_path);

            //update old position
            previous_x = x;
            previous_y = y;
        }
    };

    return (
        <canvas
            ref={timeline_ref}
            key={scores}
            className="timeline"
            tabIndex={0}
            onMouseDown={handle_timeline_mousedown}
            onMouseMove={handle_timeline_mousemove}
            onMouseUp={handle_timeline_mouseup}
            onMouseOut={handle_timeline_mouseout}
            onKeyDown={handle_timeline_keydown}
            onKeyUp={handle_timeline_keyup}
        >
        </canvas>
    );
}

export default Timeline;