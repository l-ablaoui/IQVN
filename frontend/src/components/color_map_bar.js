import { 
    EMPHASIS_COLOR, 
    HIGH_SCORE_COLOR, 
    LOW_SCORE_COLOR, 
    REGULAR_COLOR, 
    SELECTION_COLOR, 
    TIME_END_COLOR, 
    TIME_START_COLOR 
} from '../utilities/constants';
import { generate_HSL_colors } from '../utilities/misc_methods';
import { get_border_radius } from "../utilities/rendering_methods";

import React, { useEffect, useRef } from 'react';

/** This component renders the color map that is applied to the semantic plot and handles the color map selection.
 * @param {*} cmap expected string with values "default", "clusters", "timestamps" 
 * and "scores", currently selected color map
 * @param {*} set_cmap expected setter of the string color map
 * @param {*} clusters expected array of integers representing cluster labels
 * @param {*} scores expected array of floats representing similarity scores
 * @param {*} max_index expected non-zero positive integer, maximum frame index in the video */
const Color_map_bar = ({cmap, set_cmap, clusters, scores, max_index}) => {
    const color_map_bar_ref = useRef(null);

    // re-rendering effect
    useEffect(() => {
        if (color_map_bar_ref.current) {
            color_map_bar_ref.current.width = color_map_bar_ref.current.offsetWidth;
            color_map_bar_ref.current.height = color_map_bar_ref.current.offsetHeight;
            render_color_map_bar(cmap);
        }
    }, [cmap, clusters, scores, max_index]);

    /** onclick listener for all 4 color map buttons, update the selected color map depending 
     * on the clicked button value, color the clicked button blue and the rest gray
     * @param {*} event expected onclick event with access to target and parent elements */
    const handle_cmap_buttons_on_click = (event) => {
        let button = event.target;
        let parent = event.target?.parentElement;
        const value = event.target?.value;

        // set current button to primary
        button.className = "col-2 btn btn-primary";

        // set other buttons to secondary
        parent.childNodes.forEach((child) => {
            if (child !== button && child.tagName === "INPUT") {
                child.className = "col-2 btn btn-secondary";
            }
        });

        // set the color map to the selected value
        set_cmap(value);
    };

    /** render color map bar based on the selected color map (blocks colors for default and clusters 
     * and gradient colors for timestamps and scores)
     * @param {*} cmap expected string with values "default", "clusters", "timestamps" and "scores", 
     * currently selected color map */
    const render_color_map_bar = (cmap) => {
        if (cmap === "default") {
            render_color_map_bar_blocks([REGULAR_COLOR, SELECTION_COLOR + "1)", EMPHASIS_COLOR]);
        }
        else if (cmap === "clusters" && clusters?.length > 0) {
            // get the number of clusters 
            let max_label = clusters[0];
            for (let i = 1;i < clusters.length;++i) {
                if (max_label < clusters[i]) {
                    max_label = clusters[i];
                }
            }
            const nb_clusters = max_label + 1;

            // generate the random colors
            const colors = generate_HSL_colors(nb_clusters);
            render_color_map_bar_blocks(colors);
        }
        else if (cmap === "timestamps") {
            render_color_map_bar_gradient(0, max_index, TIME_START_COLOR, TIME_END_COLOR);
        }
        else if (cmap === "scores" && scores?.length > 0) {
            // get the min and max values
            let min_value = scores[0];
            let max_value = scores[0];
            for (let i = 1;i < scores.length;++i) {
                if (min_value > scores[i]) {
                    min_value = scores[i];
                }
                if (max_value < scores[i]) {
                    max_value = scores[i];
                }
            }

            render_color_map_bar_gradient(min_value, max_value, LOW_SCORE_COLOR, HIGH_SCORE_COLOR);
        }
    }

    /** divide color map bar into blocks of colors
     * @param {*} colors expected array of string-coded colors */
    const render_color_map_bar_blocks = (colors) => {
        const color_map_bar = color_map_bar_ref.current;
        const ctx = color_map_bar.getContext("2d", {alpha: true});
        const width = color_map_bar.width;
        const height = color_map_bar.height;

        ctx.clearRect(0, 0, width, height);
        const radius = get_border_radius(color_map_bar);

        // Clip to rounded rectangle
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();

        const nb_colors = colors.length;
        const block_width = width / nb_colors;
        for (let i = 0; i < nb_colors; i++) {
            ctx.fillStyle = colors[i];
            ctx.fillRect(i * block_width, 0, block_width, height);
        }
    };

    /** render color map bar as a gradient between two colors 
     * @param {*} min_value expected float, value to display at the left of the gradient
     * @param {*} max_value expected float, value to display at the right of the gradient
     * @param {*} min_color expected object with red, green and blue fields, color at the left of the gradient
     * @param {*} max_color expected object with red, green and blue fields, color at the right of the gradient */
    const render_color_map_bar_gradient = (min_value, max_value, min_color, max_color) => {
        const color_map_bar = color_map_bar_ref.current;
        const ctx = color_map_bar.getContext("2d", {alpha: true});
        const width = color_map_bar.width;
        const height = color_map_bar.height;

        min_value = Math.trunc(min_value * 100) / 100;
        max_value = Math.trunc(max_value * 100) / 100;

        ctx.clearRect(0, 0, width, height);
        const radius = get_border_radius(color_map_bar);

        // Clip to rounded rectangle
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.clip();

        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, `rgb(${min_color.red}, ${min_color.green}, ${min_color.blue})`);  
        gradient.addColorStop(1, `rgb(${max_color.red}, ${max_color.green}, ${max_color.blue})`);  
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    
        // Add min and max values
        ctx.fillStyle = 'black';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(min_value, 18, height / 2 + 5); // Min value at the left
        ctx.fillText(max_value, width - 18, height / 2 + 5); // Max value at the right
    };

    return (
        <div className="row h-10 w-100">
            <input 
                type="button" 
                value="default" 
                className="col-2 h-100 btn btn-primary"
                onClick={handle_cmap_buttons_on_click}
            />
            <input 
                type="button" 
                value="clusters" 
                className="col-2 h-100 btn btn-secondary"
                onClick={handle_cmap_buttons_on_click}
            />
            <input 
                type="button" 
                value="timestamps" 
                className="col-2 h-100 btn btn-secondary"
                onClick={handle_cmap_buttons_on_click}
            />
            <input 
                type="button" 
                value="scores" 
                className="col-2 h-100 btn btn-secondary"
                onClick={handle_cmap_buttons_on_click}
            />
            <canvas 
                className="col-4 h-100 d-block rounded"
                ref={color_map_bar_ref}>
            </canvas>
        </div>
    );
}

export default Color_map_bar;