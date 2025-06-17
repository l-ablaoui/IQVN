import Color_map_bar from "./color_map_bar";
import { 
    EMPHASIS_RADIUS, 
    REGULAR_RADIUS, 
    REGULAR_COLOR, 
    EMPHASIS_COLOR, 
    TIME_START_COLOR, 
    TIME_END_COLOR, 
    LOW_SCORE_COLOR, 
    HIGH_SCORE_COLOR
} from "../utilities/constants";
import { fetch_video_semantic_representation } from "../utilities/api_methods";
import { 
    length2,
    generate_HSL_colors, 
    generate_selected_points_color_map,
    handle_zoom_pan_wheel,
    handle_zoom_pan_mousedown,
    handle_zoom_pan_mousemove, 
    handle_zoom_pan_mouseup,
    handle_selection_area_mousedown,
    handle_selection_area_mousemove,
    get_bounding_box,
    union,
    difference
} from "../utilities/misc_methods";
import {
    fill_circle, 
    draw_rectangle, 
} from "../utilities/rendering_methods";

import React, { useEffect, useRef, useState } from "react";

/** This component represents the semantic (from a VLM standpoint) 2D representation of the video frames 
 * It allows the user to select points (additive to other selection methods), visualize precomputed 
 * clusters of points and their representative frames, and visualize the scores of the frames in the video
 * through a color map and visualize the temporal position of the frames in the video through another color map
 * @param {*} video_ref expected reference to the video element
 * @param {*} video_src expected string, URL to the video file, must match the video_ref source
 * @param {*} scores expected empty array or array of floats between 0 and 1, scores for each frame in the video
 * @param {*} current_index expected positive integer between 0 and scores.length, current frame index
 * @param {*} update_time expected setter for current_index and the html element video timer
 * @param {*} max_index expected positive integer, maximum frame index in the video
 * @param {*} selected_points expected empty array or array of positive integers, selected frame indices
 * @param {*} set_selected_points expected setter for selected_points
 * @param {*} is_dark_mode expected boolean, true if the dark mode is enabled */
const Semantic_plot = ({video_ref, video_src, scores, current_index, update_time, 
    max_index, selected_points, set_selected_points, is_dark_mode}) => {
    const semantic_plot_ref = useRef(null);

    /** 2D, float, logical coordinates, vectors */
    const [points, set_points] = useState([]);
    const [clusters, set_clusters] = useState([]);
    const [cluster_frames, set_cluster_frames] = useState([]);
    const [frames_horizontal, set_frames_horizontal] = useState(true);

    /** semantic plot color map, possible values= default (show selected points), clusters, timestamps and scores */
    const [cmap, set_cmap] = useState("default");

    const [semantic_plot_offset_x, set_SP_offset_x] = useState(50);
    const [semantic_plot_offset_y, set_SP_offset_y] = useState(10);

    const [semantic_plot_scale, set_SP_scale] = useState(1);
    const [semantic_plot_translate, set_SP_translate] = useState({x: 0, y: 0});
    const semantic_plot_zoom_speed = 0.1;
    const [semantic_plot_drag_offset, set_SP_drag_offset] = useState({x: 0, y: 0});
    const [is_SP_dragging, set_SP_dragging] = useState(false);

    const [selection_top_left, set_selection_top_left] = useState({x: -10, y: -10});
    const [selection_bot_right, set_selection_bot_right] = useState({x: -10, y: -10});
    const [is_selecting, set_selecting] = useState(false);
    const [is_ctrl_pressed, set_ctrl_pressed] = useState(false);
    /** state used to freeze the selected points during movement */
    const [temp_selected, set_temp_selected] = useState([]);

    // prevent right click menu on this specific component
    useEffect(() => {
        function handle_context_menu(e) {
            e.preventDefault(); // prevents the default right-click menu from appearing
        }
        semantic_plot_ref.current.addEventListener("contextmenu", handle_context_menu);

        return () => {
            semantic_plot_ref.current.removeEventListener("contextmenu", handle_context_menu);
        };
    }, []);

    // re-rendering effect
    useEffect(() => {
        if (semantic_plot_ref.current) {
            // update the canvas size
            semantic_plot_ref.current.width = semantic_plot_ref.current.offsetWidth;
            semantic_plot_ref.current.height = semantic_plot_ref.current.offsetHeight;
            const offset_width = semantic_plot_ref.current.width;
            const offset_height = semantic_plot_ref.current.height;

            // check if the cluster frames should be rendered horizontally or vertically
            set_frames_horizontal(offset_width > offset_height);

            // update plot offsets
            if (frames_horizontal) {
                set_SP_offset_y(offset_height / 14);
                set_SP_offset_x((offset_width - 6 * offset_height / 7) / 2);
            }
            else {
                set_SP_offset_x(offset_width / 14);
                set_SP_offset_y((offset_height - 6 * offset_width / 7) / 2);
            }

            console.log(semantic_plot_offset_x, semantic_plot_offset_y, offset_width, offset_height);
            render_semantic_plot(points, current_index);
        }
    }, [current_index, points, clusters, cluster_frames, scores, semantic_plot_scale, selected_points,
        semantic_plot_translate, selection_top_left, selection_bot_right, cmap, is_dark_mode]);
    
    // fetch semantic representation from server effect
    useEffect(() => {
        if (video_src != "") {
            set_points([]);
            set_clusters([]);
            set_cluster_frames([]);
            fetch_video_semantic_representation(video_src).then((results) => {
                set_points(results["tsne_reduction"]);
                set_clusters(results["tsne_clusters"]);
                set_cluster_frames(results["tsne_cluster_frames"]);
            });
        }
    }, [video_src]);

    /** onwheel zoom handler for the semantic plot
     * @param {*} event expected a wheel event */
    const handle_onwheel = (event) => { 
        handle_zoom_pan_wheel(
            semantic_plot_ref.current,
            semantic_plot_zoom_speed, 
            semantic_plot_scale, set_SP_scale, 
            semantic_plot_translate, set_SP_translate, 
            event
        ); 
    };

    /** mousedown handles left click pan and right click selection
     * @param {*} event expected mousedown event */
    const handle_mousedown = (event) => {
        if (event.nativeEvent.button == 0) {
            handle_zoom_pan_mousedown(
                semantic_plot_ref.current,
                set_SP_dragging,
                semantic_plot_translate,
                set_SP_drag_offset,
                event
            );
        }
        else if (event.nativeEvent.button == 2) {
            const width = semantic_plot_ref.current.width;
            const height = semantic_plot_ref.current.height;
            handle_selection_area_mousedown(semantic_plot_ref.current, {x: 0, y: 0},
                {x: width, y: height}, set_selection_top_left, set_selection_bot_right, event);
            set_temp_selected(selected_points);
            set_selecting(true);
        }
    };

    /** mousemove handles left click pan and right click selection
     * @param {*} event expected mousemove event */
    const handle_mousemove = (event) => {
        if (event.nativeEvent.button == 0) {
            handle_zoom_pan_mousemove(
                semantic_plot_ref.current,
                is_SP_dragging, 
                set_SP_translate,
                semantic_plot_drag_offset,
                event
            );
        }
        if (is_selecting) {
            const width = semantic_plot_ref.current.width;
            const height = semantic_plot_ref.current.height;
            handle_selection_area_mousemove(semantic_plot_ref.current, {x: 0, y: 0},
                {x: width, y: height}, selection_top_left, set_selection_bot_right, event);
            const top_left = {x: Math.min(selection_top_left.x, selection_bot_right.x),
                y: Math.min(selection_top_left.y, selection_bot_right.y)};
            const bot_right = {x: Math.max(selection_top_left.x, selection_bot_right.x),
                y: Math.max(selection_top_left.y, selection_bot_right.y)};
            let box_selected = select_points_in_box(top_left, bot_right);
            if (is_ctrl_pressed) {
                let new_selected_points = difference(temp_selected, box_selected);
                set_selected_points(new_selected_points);
            }
            else {
                let new_selected_points = union(temp_selected, box_selected);
                set_selected_points(new_selected_points);
            }
        }
    };

    /** mouseup handles left click pan and right click selection
     * @param {*} event expected mouseup event */
    const handle_mouseup = (event) => { 
        if (event.nativeEvent.button == 0) {
            handle_zoom_pan_mouseup(set_SP_dragging);
        }
        if (is_selecting) {
            const width = semantic_plot_ref.current.width;
            const height = semantic_plot_ref.current.height;
            handle_selection_area_mousemove(semantic_plot_ref.current, {x: 0, y: 0},
                {x: width, y: height}, selection_top_left, set_selection_bot_right, event);
            const top_left = {x: Math.min(selection_top_left.x, selection_bot_right.x),
                y: Math.min(selection_top_left.y, selection_bot_right.y)};
            const bot_right = {x: Math.max(selection_top_left.x, selection_bot_right.x),
                y: Math.max(selection_top_left.y, selection_bot_right.y)};
            let box_selected = select_points_in_box(top_left, bot_right);
            if (is_ctrl_pressed) {
                let new_selected_points = difference(temp_selected, box_selected);
                set_selected_points(new_selected_points);
            }
            else {
                let new_selected_points = union(temp_selected, box_selected);
                set_selected_points(new_selected_points);
            }
            set_selecting(false);
        }
    };

    /** updates CTRL press, if pressed, selection is inversed */
    const handle_keydown = (event) => {  
        set_ctrl_pressed(event.ctrlKey);
    };

    /** triggers a time update when a point on the semantic plot is clicked
     * @todo fix bug where some points are hard to click on
     * @param {*} event expected onClick event */
    const handle_onclick = (event) => {
        if (event.nativeEvent.button == 2) { return; };
        if (points?.length == 0) { return; }
        
        const rect = semantic_plot_ref.current.getBoundingClientRect();
        const mouse_x = event.clientX - rect.left;
        const mouse_y = event.clientY - rect.top;

        // reduction_plot width/length
        let plot_width = semantic_plot_ref.current.offsetWidth;
        let plot_height = semantic_plot_ref.current.offsetHeight;

        // get min/max to later normalize reduction values
        let [min_x, max_x, min_y, max_y] = get_bounding_box(points);
        
        // if clicking on the current frame index (big red dot), do nothing
        let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
            { width: plot_width, height: plot_height}, current_index);

        let dot_radius = EMPHASIS_RADIUS;
        let dist = length2({x: mouse_x, y: mouse_y}, {x: x, y: y});
        if (dist <= dot_radius * dot_radius) {
            return;
        }

        dot_radius = REGULAR_RADIUS;
        for (let i = 0;i < points.length;++i) {
            // get each point's coordinates after current zoom/pan
            let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
                { width: plot_width, height: plot_height}, i);

            let dist = length2({x: mouse_x, y: mouse_y}, {x: x, y: y});

            // if the user clicked inside the dot, update the frameIndex
            if (dist <= dot_radius * dot_radius) {
                update_time(i);
                return;
            } 
        } 
    };

    /** scale points to fit in the semantic plot canvas and renders them as dots
     * @param {*} points expected array of 2D points (dicts with x and y properties)
     * @param {*} current_index expected positive integer between 0 and points.length */
    const render_semantic_plot = (points, current_index) => {
        if (points?.length == 0) { return; }

        let color_map = generate_color_map(points, current_index, cmap);
        let radius_map = generate_radius_map(points, [current_index]);

        // get min/max to later normalize reduction values
        let [min_x, max_x, min_y, max_y] = get_bounding_box(points);
    
        // semantic_plot width/length
        let plot_width = semantic_plot_ref.current.width;
        let plot_height = semantic_plot_ref.current.height;
        
        // reset the drawing
        let ctx = semantic_plot_ref.current.getContext("2d", { alpha: true });
        ctx.clearRect(0, 0, plot_width, plot_height);  
        
        let dot_radius;
    
        // render the points (square shaped for now)
        for (let i = 0;i < points.length;++i) {
            // draw current frame marker last to stand out
            if (i == current_index) { continue; }
    
            let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
                { width: plot_width, height: plot_height}, i);
            ctx.fillStyle = color_map[i];
            dot_radius = radius_map[i];

            // apply zoom/pan transformations to coordinates only and not to point radius (for visibility purposes)
            fill_circle(ctx, {x: x, y: y}, dot_radius);
        }
    
        let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
            { width: plot_width, height: plot_height}, current_index);
    
        ctx.fillStyle = color_map[current_index];
        dot_radius = radius_map[current_index];
        fill_circle(ctx, {x: x, y: y}, dot_radius);
        ctx.arc(x + dot_radius, y, 0, dot_radius, 2 * Math.PI);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
        ctx.stroke();
        
        // render selection rectangle if selecting
        if (is_selecting) { 
            draw_rectangle(ctx, selection_top_left, selection_bot_right, 
                "rgba(100, 200, 255, 1)", "rgba(100, 200, 255, 0.3)"); 
        }
    
        // rendering rectangles to hide the points when zooming 
        // render in white and then draw the color (transparency issues)
        ctx.fillStyle = (!is_dark_mode)? "rgb(248, 249, 250)" : "rgb(33, 37, 41)";
        ctx.fillRect(
            0, 
            0, 
            (frames_horizontal)? semantic_plot_offset_x - EMPHASIS_RADIUS : plot_width, 
            (frames_horizontal)? plot_height : semantic_plot_offset_y - EMPHASIS_RADIUS
        );
        ctx.fillStyle = (!is_dark_mode)? "rgb(248, 249, 250)" : "rgb(33, 37, 41)";
        ctx.fillRect(
            (frames_horizontal)? plot_width - semantic_plot_offset_x + EMPHASIS_RADIUS : 0, 
            (frames_horizontal)? 0 : plot_height - semantic_plot_offset_y + EMPHASIS_RADIUS, 
            (frames_horizontal)? semantic_plot_offset_x : plot_width, 
            (frames_horizontal)? plot_height : semantic_plot_offset_y - EMPHASIS_RADIUS
        );
        ctx.fillStyle = (!is_dark_mode)? "rgba(248, 249, 250, 0.1)" : "rgba(33, 37, 41, 0.1)";
        ctx.fillRect(
            0, 
            0, 
            (frames_horizontal)? semantic_plot_offset_x - EMPHASIS_RADIUS : plot_width, 
            (frames_horizontal)? plot_height : semantic_plot_offset_y - EMPHASIS_RADIUS
        );
        ctx.fillStyle = (!is_dark_mode)? "rgba(248, 249, 250, 0.1)" : "rgba(33, 37, 41, 0.1)";
        ctx.fillRect(
            (frames_horizontal)? plot_width - semantic_plot_offset_x + EMPHASIS_RADIUS : 0, 
            (frames_horizontal)? 0 : plot_height - semantic_plot_offset_y + EMPHASIS_RADIUS, 
            (frames_horizontal)? semantic_plot_offset_x : plot_width, 
            (frames_horizontal)? plot_height : semantic_plot_offset_y - EMPHASIS_RADIUS
        );
        
        // render the cluster frames
        render_cluster_frames(semantic_plot_ref.current, color_map, min_x, min_y, max_x, max_y);
    };

    /** renders frame snippets ob svg that represent the centroids of each cluster
     * @param {*} svg expected canvas element
     * @param {*} color_map expected array of string coded colors for each point
     * @param {*} min_x expected float, minimum x value of the points
     * @param {*} min_y expected float, minimum y value of the points
     * @param {*} max_x expected float, maximum x value of the points
     * @param {*} max_y expected float, maximum y value of the points */
    const render_cluster_frames = (svg, color_map, min_x, min_y, max_x, max_y) => {
        if (cluster_frames?.length < 2) { return; }
        
        let ctx = svg.getContext("2d");
        let plot_width = svg.width;
        let plot_height = svg.height;

        // get centroids and sort them so that each half of the images gets printed left and right
        let centroids = [];
        cluster_frames.forEach((point) => {
            let i = point[0];
            let img_src = point[1];
            let p = get_semantic_plot_coordinates({x: min_x, y: min_y}, {x: max_x, y: max_y}, 
                {width: plot_width, height: plot_height}, i);
            centroids.push({idx: i, src: img_src, x: p.x, y: p.y});
        });
        centroids = sort_cluster_frames(centroids);

        let l = Math.trunc(cluster_frames.length / 2);
        const original_frame_width = video_ref.current.videoWidth;
        const original_frame_height = video_ref.current.videoHeight;

        let small_frame_height = plot_height / l - l * 0.5; // - l * 2 is to keep a little margin between frames
        let small_frame_width = original_frame_width * small_frame_height / original_frame_height;
        
        // if the width/height of the frame is too much to draw on the margin, reduce 
        // it to the max the margin can take and adjust the height accordingly
        if (frames_horizontal && small_frame_width > semantic_plot_offset_x - 10) {
            let new_small_width = semantic_plot_offset_x - 10;
            small_frame_height = small_frame_height * new_small_width / small_frame_width;
            small_frame_width = new_small_width;
            if (small_frame_height > plot_height / (l + 1)) {
                let new_small_height = plot_height / (l + 1) - l * 0.5;
                small_frame_width = small_frame_width * new_small_height / small_frame_height;
                small_frame_height = new_small_height;
            }
        }
        else if (!frames_horizontal && small_frame_height > semantic_plot_offset_y - 10) {
            let new_small_height = semantic_plot_offset_y - 10;
            small_frame_width = small_frame_width * new_small_height / small_frame_height;
            small_frame_height = new_small_height;
            if (small_frame_width > plot_width / (l + 1)) {
                let new_small_width = plot_width / (l + 1) - l * 0.5;
                small_frame_height = small_frame_height * new_small_width / small_frame_width;
                small_frame_width = new_small_width;
            }
        }

        for (let i = 0;i < l;++i) {
            // center the image in terms of width
            const x = (frames_horizontal)? semantic_plot_offset_x / 2 - small_frame_width / 2 : i * plot_width / l;
            const y = (frames_horizontal)? i * plot_height / l : semantic_plot_offset_y / 2 - small_frame_height / 2;
            const img = new Image();
            img.src = centroids[i]["src"];
            img.onload = () => {
                // render the line from centroid image to its corresponding dot
                ctx.strokeStyle = color_map[centroids[i]["idx"]];
                ctx.beginPath();
                ctx.moveTo(centroids[i]["x"], centroids[i]["y"]);
                ctx.lineTo(x + small_frame_width / 2, y + small_frame_height / 2); 
                ctx.stroke();

                // render the image
                ctx.drawImage(img, x, y, small_frame_width, small_frame_height);
    
                // render border for each image
                ctx.strokeStyle = color_map[centroids[i]["idx"]];
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + small_frame_width, y);
                ctx.lineTo(x + small_frame_width, y + small_frame_height);
                ctx.lineTo(x, y + small_frame_height);
                ctx.lineTo(x, y);
                ctx.stroke();
            };
        }
    
        for (let i = l;i < cluster_frames.length;++i) {
            const remains = (l * 2 == cluster_frames.length)? l : (l + 1);
            const x = (frames_horizontal)? plot_width - semantic_plot_offset_x / 2 - small_frame_width / 2 : 
                (i - l) * plot_width / remains;
            const y = (frames_horizontal)? (i - l) * plot_height / remains :
                plot_height - semantic_plot_offset_y / 2 - small_frame_height / 2;
            const img = new Image();
            
            img.src = centroids[i]["src"];
            img.onload = () => {
                // render the line from centroid image to its corresponding dot
                ctx.strokeStyle = color_map[centroids[i]["idx"]];
                ctx.beginPath();
                ctx.moveTo(centroids[i]["x"], centroids[i]["y"]);
                ctx.lineTo(x + small_frame_width / 2, y + small_frame_height / 2); 
                ctx.stroke();

                // render the image
                ctx.drawImage(img, x, y, small_frame_width, small_frame_height);
    
                // render border for each image
                ctx.strokeStyle = color_map[centroids[i]["idx"]];
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + small_frame_width, y);
                ctx.lineTo(x + small_frame_width, y + small_frame_height);
                ctx.lineTo(x, y + small_frame_height);
                ctx.lineTo(x, y);
                ctx.stroke();
            };
        }
    };

    /** generate a radius value array that maps the 2D points to be rendered
     * depending on which points need to be highlighted (bigger radius size 
     * compared to regular points)
     * @param {*} indices point IDs that need to be highlighted when rendered
     * @returns 2D points matching map for radius value when rendered */
    const generate_radius_map = (points, indices) => {
        let radius_map = [];
    
        for (let i = 0; i < points?.length; ++i) { 
            let j;
            for (j = 0;j < indices.length;++j) {
                if (i == indices[j]) {
                    radius_map.push(EMPHASIS_RADIUS);
                    break;
                }
            }
            if (j == indices.length) { radius_map.push(REGULAR_RADIUS); }
        }
    
        return radius_map;
    };

    /** sorts 2D points for the least overlap when displaying their representative 
     * frames on the sides
     * @param {*} centroids 2D points (expected floats) 
     * @returns input 2D points list sorted for least label overlap */
    const sort_cluster_frames = (centroids) => {
        // sort centroids by the principal axis
        centroids.sort((c1, c2) => (frames_horizontal)? c1["x"] - c2["x"] : c1["y"] - c2["y"]);

        // divide the centroids in two halves and sort each half by the secondary axis
        const middle = Math.trunc(centroids.length / 2);
        let first_half = centroids.slice(0, middle).sort((c1, c2) => 
            (frames_horizontal)? c1["y"] - c2["y"] : c1["x"] - c2["x"]
        );
        let second_half = centroids.slice(middle, centroids.length).sort((c1, c2) => 
            (frames_horizontal)? c1["y"] - c2["y"] : c1["x"] - c2["x"]
        );

        // merge the two halves back together
        for (let i = 0;i < centroids.length;++i) {
            if (i < middle) {
                centroids[i] = first_half[i];
            }
            else {
                centroids[i] = second_half[i - middle];
            }
        }
        return centroids;
    };

    /** apply zoom/pan transformations to the 2D points to be rendered
     * @param {*} min_point expected 2D point with x and y float properties
     * @param {*} max_point expected 2D point with x and y float properties, max_point > min_point
     * @param {*} plot_dim expected 2D point with width and height float properties
     * @param {*} i expected integer, index of the point to be transformed
     * @returns expected 2D point with x and y float properties, transformed */
    const get_semantic_plot_coordinates = (min_point, max_point, plot_dim, i) => {
        let x = semantic_plot_offset_x + (points[i]['x'] - min_point.x) / 
            (max_point.x - min_point.x) * (plot_dim.width - 2 * semantic_plot_offset_x);
        x = semantic_plot_translate.x + semantic_plot_scale * x;
    
        let y = plot_dim.height - semantic_plot_offset_y - (points[i]['y'] - min_point.y) / 
            (max_point.y - min_point.y) * (plot_dim.height - 2 * semantic_plot_offset_y);
        y = semantic_plot_translate.y + semantic_plot_scale * y; 
            
        return { x, y };
    };

    /** generate a string array that represents colors that map the 2D points
     * 
     * the generated colors depend on the state of the color map
     * Possible color maps:
     * - default (gray for regular points, blue for selected ones, red for the emphasized one)
     * - clusters (colors are generated with generate_HSL_colors and affected to each cluster)
     * - time (colors change depending on the timestamp of each point(frame) in the video)
     * - score (colors change depending on the cosine similarity value)
     * @param {*} current_index expected integer, index of the currently displayed frame
     * @param {*} cmap expected string, color map type [default, clusters, timestamps, scores]
     * @returns string coded colors array */
    const generate_color_map = (points, current_index, cmap) => {
        let color_map = [];

        switch (cmap) {
            case "timestamps": {
                for (let i = 0; i < points.length; ++i) { 
                    let factor1 = (points.length - 1 - i) / (points.length - 1);
                    let factor2 = i / (points.length - 1);
                    color_map.push((current_index != i)? 
                        `rgba(${TIME_START_COLOR.red * factor1 + TIME_END_COLOR.red * factor2}, 
                        ${TIME_START_COLOR.green * factor1 + TIME_END_COLOR.green * factor2}, 
                        ${TIME_START_COLOR.blue * factor1 + TIME_END_COLOR.blue * factor2}, 0.7)` 
                        : EMPHASIS_COLOR); 
                }
                break;
            }
            case "scores": {
                // make sure scores exist and match the reduction 
                if (scores?.length != points?.length) { generate_color_map(points, current_index, ""); }

                // get min/max to normalize scores
                let min_score = scores[0];
                let max_score = scores[0];

                for (let i = 1;i < scores.length;++i) {
                    min_score = (min_score > scores[i])? scores[i] : min_score;
                    max_score = (max_score < scores[i])? scores[i] : max_score;
                }

                // apply colors to scores (red for low, green for high)
                for (let i = 0; i < points.length; ++i) { 
                    let factor = (scores[i] - min_score) / (max_score - min_score);
                    color_map.push(`rgba(${Math.trunc(LOW_SCORE_COLOR.red * (1 - factor) + HIGH_SCORE_COLOR.red * factor)}, 
                        ${Math.trunc(LOW_SCORE_COLOR.green * (1 - factor) + HIGH_SCORE_COLOR.green * factor)}, 
                        ${Math.trunc(LOW_SCORE_COLOR.blue * (1 - factor) + HIGH_SCORE_COLOR.blue * factor)},
                        ${Math.sqrt(factor).toFixed(2)})`); // the lower the score is more transparent the color is, 
                                                //using root square to prevent drastic behavior    
                }
                color_map[current_index] = EMPHASIS_COLOR;
                break;
            }
            case "clusters": {
                // get the number of clusters 
                let max_label = clusters[0];
                for (let i = 1;i < clusters.length;++i) {
                    if (max_label < clusters[i]) {
                        max_label = clusters[i];
                    }
                }
                let nb_clusters = max_label + 1;

                let colors = generate_HSL_colors(nb_clusters);

                // applying colors to clusters (-1/no cluster will be gray and current index red)
                for (let i = 0; i < points.length; ++i) { 
                    if (i == current_index) {
                        color_map.push(EMPHASIS_COLOR);
                    }
                    else {
                        if (clusters[i] == -1) { 
                            color_map.push(REGULAR_COLOR);
                        }
                        else {
                            color_map.push(colors[clusters[i]]);
                        }
                    }
                }
                break;
            } 
            default: {  
                color_map = generate_selected_points_color_map(points.length, selected_points);
                color_map[current_index] = EMPHASIS_COLOR;
                break;
            }
        }

        return color_map;
    };

    /** isolates the points that are inside the selection box delimited by top_left and bot_right
     * @param {*} top_left expected 2D point with x and y float properties
     * @param {*} bot_right expected 2D point with x and y float properties
     * @returns expected integer array with the IDs of the selected points */
    const select_points_in_box = (top_left, bot_right) => {
        let selected_points = [];
        let [min_x, max_x, min_y, max_y] = get_bounding_box(points);

        for (let i = 0; i < points.length; ++i) {
            let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
                { width: semantic_plot_ref.current.width, height: semantic_plot_ref.current.height}, i);

            if (x >= top_left.x && x <= bot_right.x && y >= top_left.y && y <= bot_right.y) {
                selected_points.push(i);
            }
        }

        return selected_points;
    };

    return (
        <div className="row h-95 w-100 justify-content-center">
            <canvas 
                className="row w-100 h-90" 
                ref={semantic_plot_ref}
                tabIndex={0}  // to allow the canvas to be focused and receive keyboard events
                onWheel={handle_onwheel}
                onMouseDown={handle_mousedown}
                onMouseMove={handle_mousemove}
                onMouseUp={handle_mouseup}
                onClick={handle_onclick}
                onKeyDown={handle_keydown}
                onKeyUp={handle_keydown}
            >    
            </canvas>
            <Color_map_bar 
                className="row justify-content-center" 
                cmap={cmap}
                set_cmap={set_cmap}
                clusters={clusters}
                scores={scores}
                max_index={max_index}
            />
        </div>
    );
};
  
export default Semantic_plot;   
