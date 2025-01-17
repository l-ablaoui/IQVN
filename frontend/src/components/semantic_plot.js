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
import {
    fill_circle, 
    draw_rectangle, 
} from "../utilities/rendering_methods";
import { 
    length2,
    generate_HSL_colors, 
    generate_selected_points_color_map,
    handle_zoom_pan_wheel,
    handle_zoom_pan_mousedown,
    handle_zoom_pan_mousemove, 
    handle_zoom_pan_mouseup,
    handle_selection_area_mousedown,
    handle_selection_area_mousemove
} from "../utilities/misc_methods";
import Color_map_bar from "./color_map_bar";

import React, { useEffect, useRef, useState } from "react";
import { fetch_video_semantic_representation } from "../utilities/api_methods";

const Semantic_plot = ({video_src, scores, current_index, update_time, max_index, selected_points}) => {
    const semantic_plot_ref = useRef(null);

    const [points, set_points] = useState([]);
    const [clusters, set_clusters] = useState([]);
    const [cluster_frames, set_cluster_frames] = useState([]);

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

    useEffect(() => {
        if (semantic_plot_ref.current) {
            semantic_plot_ref.current.width = semantic_plot_ref.current.offsetWidth;
            semantic_plot_ref.current.height = semantic_plot_ref.current.offsetHeight;
            render_semantic_plot(points, current_index);
        }
    }, [current_index, points, clusters, cluster_frames, scores, semantic_plot_scale, 
        semantic_plot_translate, selection_top_left, selection_bot_right, cmap]);

    useEffect(() => {
        if (video_src != "") {
            fetch_video_semantic_representation(video_src).then((results) => {
                set_points(results["tsne_reduction"]);
                set_clusters(results["tsne_clusters"]);
                set_cluster_frames(results["tsne_cluster_frames"]);
            });
        }
    }, [video_src]);

    const handle_onwheel = (event) => { 
        handle_zoom_pan_wheel(
            semantic_plot_ref.current,
            semantic_plot_zoom_speed, 
            semantic_plot_scale, set_SP_scale, 
            semantic_plot_translate, set_SP_translate, 
            event
        ); 
    };

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
            event.preventDefault();
            const width = semantic_plot_ref.current.width;
            const height = semantic_plot_ref.current.height;
            handle_selection_area_mousedown(semantic_plot_ref.current, {x: 0, y: 0},
                {x: width, y: height}, set_selection_top_left, set_selection_bot_right, event);
            console.log(selection_top_left, selection_bot_right);
            set_selecting(true);
        }
    };

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
            event.preventDefault();
            const width = semantic_plot_ref.current.width;
            const height = semantic_plot_ref.current.height;
            handle_selection_area_mousemove(semantic_plot_ref.current, {x: 0, y: 0},
                {x: width, y: height}, selection_top_left, set_selection_bot_right, event);
            console.log(selection_top_left, selection_bot_right);
        }
    };

    const handle_mouseup = (event) => { 
        if (event.nativeEvent.button == 0) {
            handle_zoom_pan_mouseup(set_SP_dragging);
        }
        if (is_selecting) {
            event.preventDefault();
            const width = semantic_plot_ref.current.width;
            const height = semantic_plot_ref.current.height;
            handle_selection_area_mousemove(semantic_plot_ref.current, {x: 0, y: 0},
                {x: width, y: height}, selection_top_left, set_selection_bot_right, event);
            set_selecting(false);
        }
    };

    /**
         * triggers a time update when a point on the semantic plot is clicked
         * @todo fix bug where some points are hard to click on
         * @param {*} event expected onClick event
         */
    const handle_onclick = (event) => {
        event.preventDefault();
        if (event.nativeEvent.button == 2) { return; };
        if (points?.length == 0) { return; }
        
        const rect = semantic_plot_ref.current.getBoundingClientRect();
        const mouse_x = event.clientX - rect.left;
        const mouse_y = event.clientY - rect.top;

        //reduction_plot width/length
        let plot_width = semantic_plot_ref.current.offsetWidth;
        let plot_height = semantic_plot_ref.current.offsetHeight;

        //if touching the offsets, ignore
        if (mouse_x < semantic_plot_offset_x - EMPHASIS_RADIUS 
            || mouse_x > plot_width - semantic_plot_offset_x + EMPHASIS_RADIUS) { 
            return; 
        }

        //get min/max to later normalize reduction values
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
        
        //if clicking on the current frame index (big red dot), do nothing
        let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
            { width: plot_width, height: plot_height}, current_index);

        let dot_radius = EMPHASIS_RADIUS;

        let dist = (mouse_x - x) * (mouse_x - x) + (mouse_y - y) * (mouse_y - y);
        if (dist <= dot_radius * dot_radius) {
            return;
        }

        for (let i = 0;i < points.length;++i) {
            //get each point's coordinates after current zoom/pan
            let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
                { width: plot_width, height: plot_height}, i);

            dot_radius = REGULAR_RADIUS;
            let dist = length2({x: mouse_x, y: mouse_y}, {x: x, y: y});

            //if the user clicked inside the dot, update the frameIndex
            if (dist <= dot_radius * dot_radius) {
                update_time(i);
                return;
            } 
        } 
    };

    /**
     * scale points to fit in the semantic plot canvas and renders them as dots
     * @param {*} points expected array of 2D points (dicts with x and y properties)
     * @param {*} current_index expected positive integer between 0 and points.length
     */
    const render_semantic_plot = (points, current_index) => {
        if (points?.length == 0) { return; }

        let color_map = generate_color_map(points, current_index, cmap);
        let radius_map = generate_radius_map(points, [current_index]);

        //get min/max to later normalize reduction values
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
    
        //semantic_plot width/length
        let plot_width = semantic_plot_ref.current.width;
        let plot_height = semantic_plot_ref.current.height;
        
        //reset the drawing
        let ctx = semantic_plot_ref.current.getContext("2d", { alpha: true });
        ctx.clearRect(0, 0, plot_width, plot_height);  
        
        let dot_radius;
    
        //draw the points (square shaped for now)
        for (let i = 0;i < points.length;++i) {
            //draw current frame marker last to stand out
            if (i == current_index) { continue; }
    
            let {x, y} = get_semantic_plot_coordinates({ x: min_x, y: min_y }, { x: max_x, y: max_y }, 
                { width: plot_width, height: plot_height}, i);
            ctx.fillStyle = color_map[i];
            dot_radius = radius_map[i];

            // Apply zoom/pan transformations to coordinates only and not to point radius (for visibility purposes)
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
        
        if (is_selecting) { 
            draw_rectangle(ctx, selection_top_left, selection_bot_right); 
            //update whatever selection is going on
        }
    
        //drawing rectangles to hide the points when zooming 
        //draw in white and then draw the color (transparency issues)
        ctx.fillStyle = "white";
        ctx.fillRect(
            0, 
            0, 
            semantic_plot_offset_x - window.EMPHASIS_RADIUS, 
            plot_height
        );
    
        ctx.fillStyle = "white";
        ctx.fillRect(
            plot_width - semantic_plot_offset_x + window.EMPHASIS_RADIUS, 
            0, 
            semantic_plot_offset_x, plot_height
        );
    
        ctx.fillStyle = "rgba(255, 150, 0, 0.1)";
        ctx.fillRect(
            0, 
            0, 
            semantic_plot_offset_x - window.EMPHASIS_RADIUS, 
            plot_height
        );
    
        ctx.fillStyle = "rgba(255, 150, 0, 0.1)";
        ctx.fillRect(
            plot_width - semantic_plot_offset_x + window.EMPHASIS_RADIUS, 
            0, 
            semantic_plot_offset_x, 
            plot_height
        );
    
        //draw_cluster_frames(color_map, min_x, min_y, max_x, max_y);
    };

    /**
     * generate a radius value array that maps the 2D points to be rendered
     * depending on which points need to be highlighted (bigger radius size 
     * compared to regular points)
     * @param {*} indices point IDs that need to be highlighted when rendered
     * @returns 2D points matching map for radius value when rendered 
     */
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

    /**
     * sorts 2D points for the least overlap when displaying their representative 
     * frames on the sides
     * @param {*} centroids 2D points (expected floats) 
     * @returns input 2D points list sorted for least label overlap
     */
    const sort_cluster_frames = (centroids) => {
        centroids.sort((c1, c2) => c1["x"] - c2["x"]);
        const middle = Math.trunc(centroids.length / 2);
        let first_half = centroids.slice(0, middle).sort((c1, c2) => c1["y"] - c2["y"]);
        let second_half = centroids.slice(middle, centroids.length).sort((c1, c2) => c1["y"] - c2["y"]);

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

    const get_semantic_plot_coordinates = (min_point, max_point, plot_dim, i) => {
        let x = (semantic_plot_offset_x + (points[i]['x'] - min_point.x) / 
                (max_point.x - min_point.x) * (plot_dim.width - 2 * semantic_plot_offset_x));
        x = semantic_plot_translate.x + semantic_plot_scale * x;
    
        let y = (plot_dim.height - semantic_plot_offset_y - (points[i]['y'] - min_point.y) / 
                (max_point.y - min_point.y) * (plot_dim.height - 2 * semantic_plot_offset_y));
        y = semantic_plot_translate.y + semantic_plot_scale * y; 
            
        return { x, y };
    };

    /**
     * generate a string array that represents colors that map the 2D points
     * 
     * the generated colors depend on the state of the color map
     * Possible color maps:
     * - default (gray for regular points, blue for selected ones, red for the emphasized one)
     * - clusters (colors are generated with generate_HSL_colors and affected to each cluster)
     * - time (colors change depending on the timestamp of each point(frame) in the video)
     * - score (colors change depending on the cosine similarity value)
     * @param {*} current_index 
     * @param {*} cmap 
     * @returns 
     */
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
                //draw_color_scale(0, max_index / fps, TIME_START_COLOR, TIME_END_COLOR);
                break;
            }

            case "scores": {
                //make sure scores exist and match the reduction 
                if (scores?.length != points?.length) { generate_color_map(points, current_index, ""); }

                /*get min/max to normalize scores*/
                let min_score = scores[0];
                let max_score = scores[0];

                for (let i = 1;i < scores.length;++i) {
                    min_score = (min_score > scores[i])? scores[i] : min_score;
                    max_score = (max_score < scores[i])? scores[i] : max_score;
                }

                for (let i = 0; i < points.length; ++i) { 
                    let factor = (scores[i] - min_score) / (max_score - min_score);
                    color_map.push(`rgba(${Math.trunc(LOW_SCORE_COLOR.red * (1 - factor) + HIGH_SCORE_COLOR.red * factor)}, 
                        ${Math.trunc(LOW_SCORE_COLOR.green * (1 - factor) + HIGH_SCORE_COLOR.green * factor)}, 
                        ${Math.trunc(LOW_SCORE_COLOR.blue * (1 - factor) + HIGH_SCORE_COLOR.blue * factor)},
                        ${Math.sqrt(factor).toFixed(2)})`); // the lower the score is more transparent the color is, 
                                                //using root square to prevent drastic behavior    
                }
                color_map[current_index] = EMPHASIS_COLOR;
                //draw_color_scale(min_score, max_score, LOW_SCORE_COLOR, HIGH_SCORE_COLOR);
                break;
            }

            case "clusters": {
                //squash the color map 
                //reduction_color_scale.height = 0;
                
                //get the number of clusters 
                let max_label = clusters[0];
                for (let i = 1;i < clusters.length;++i) {
                    if (max_label < clusters[i]) {
                        max_label = clusters[i];
                    }
                }
                let nb_clusters = max_label + 1;

                let colors = generate_HSL_colors(nb_clusters);

                //applying colors to clusters (-1/no cluster will be gray and current index red)
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

            default: { //gray colormap with red as emphasis
                //squash the color map on default
                //reduction_color_scale.height = 0;

                //highlight selected points
                color_map = generate_selected_points_color_map(points.length, selected_points);
                color_map[current_index] = EMPHASIS_COLOR;
                break;
            }
        }

        return color_map;
    };

    return (
        <div className="row justify-content-center">
            <canvas 
                className="semantic_plot row" 
                ref={semantic_plot_ref}
                onWheel={handle_onwheel}
                onMouseDown={handle_mousedown}
                onMouseMove={handle_mousemove}
                onMouseUp={handle_mouseup}
                onClick={handle_onclick}>    
            </canvas>
            <Color_map_bar 
                className="row" 
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
