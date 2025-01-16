import "../App.css";
import { DEACTIVATED_COLOR } from "../utilities/constants";
import { draw_rectangle } from "../utilities/rendering_methods";

import React, { useEffect, useRef, useState } from 'react';

/**
 * @todo code the crop function for searching
 */
const Image_crop_area = ({crop_area_ref, selection_top_left, selection_bot_right, 
    set_selection_top_left, set_selection_bot_right, apply_effect, video_top_left,
    video_bot_right}) => {
    useEffect(() => {
        render_crop_area();
    }, [selection_top_left, selection_bot_right]);

    const handle_crop_area_mousedown = (event) => {
        const rect = crop_area_ref.current.getBoundingClientRect();
        let x = event.clientX - rect.left;
        let y = event.clientY - rect.top;
        x = Math.min(Math.max(x, video_top_left.x), video_bot_right.x);
        y = Math.min(Math.max(y, video_top_left.y), video_bot_right.y);

        set_selection_top_left({x: x, y: y});
        set_selection_bot_right({x: x, y: y});
    };

    const handle_crop_area_mousemove = (event) => {
        if (selection_top_left.x !== 0 && selection_top_left.y !== 0) {
            const rect = crop_area_ref.current.getBoundingClientRect();
            let x = event.clientX - rect.left;
            let y = event.clientY - rect.top;
            x = Math.min(Math.max(x, video_top_left.x), video_bot_right.x);
            y = Math.min(Math.max(y, video_top_left.y), video_bot_right.y);

            set_selection_bot_right({x: x, y: y});
        };
    };

    const handle_crop_area_mouseup = (event) => {
        if (selection_top_left.x !== 0 && selection_top_left.y !== 0) {
            const rect = crop_area_ref.current.getBoundingClientRect();
            let x = event.clientX - rect.left;
            let y = event.clientY - rect.top;
            x = Math.min(Math.max(x, video_top_left.x), video_bot_right.x);
            y = Math.min(Math.max(y, video_top_left.y), video_bot_right.y);

            set_selection_bot_right({x: x, y: y});
            apply_effect();
            crop_area_ref.current.className = "d-none image_crop_area";
        }
    };

    const render_crop_area = () => {
        const plot_width = crop_area_ref.current.width;
        const plot_height = crop_area_ref.current.height;
        
        const ctx = crop_area_ref.current.getContext("2d", { alpha: true });
        ctx.clearRect(0, 0, plot_width, plot_height);
        const min_point = {x: Math.min(selection_top_left.x, selection_bot_right.x), 
            y: Math.min(selection_top_left.y, selection_bot_right.y)};
        const max_point = {x: Math.max(selection_top_left.x, selection_bot_right.x), 
            y: Math.max(selection_top_left.y, selection_bot_right.y)};

        //draw the crop area by leaving everything outside the selection area with a dark overlay 
        ctx.fillStyle = DEACTIVATED_COLOR;
        ctx.fillRect(0, 0, plot_width, min_point.y);
        ctx.fillRect(0, min_point.y, min_point.x, plot_height - min_point.y);
        ctx.fillRect(max_point.x, min_point.y, plot_width - max_point.x, plot_height - min_point.y);
        ctx.fillRect(min_point.x, max_point.y, max_point.x - min_point.x, plot_height - max_point.y);

        if (min_point.x !== max_point.x && min_point.y !== max_point.y) {
            draw_rectangle(ctx, min_point, max_point);
        }
    };

    return (
        <div>
            <canvas
                ref={crop_area_ref}
                className="d-none image_crop_area"
                onMouseDown={handle_crop_area_mousedown}
                onMouseMove={handle_crop_area_mousemove}
                onMouseUp={handle_crop_area_mouseup}
            >
            </canvas>
        </div>
    );
};

export default Image_crop_area;