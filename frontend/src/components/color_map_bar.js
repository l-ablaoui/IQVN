import React, { useEffect, useRef, useState } from 'react';

const Color_map_bar = ({cmap, set_cmap}) => {
    const color_map_bar_ref = useRef(null);

    const handle_cmap_buttons_on_click = (event) => {
        let button = event.target;
        let parent = event.target?.parentElement;
        const value = event.target?.value;

        console.log(value);
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

    const render_color_map_bar = () => {
        const canvas = color_map_bar_ref.current;
        const ctx = canvas.getContext("2d");
        const width = canvas.width;
        const height = canvas.height;
        const nb_colors = 100;
        
        const saturation = 100;
        const lightness = 50;
        const colors = [];

        for (let i = 0; i < nb_colors; i++) {
            const hue = Math.floor((360 / nb_colors) * i);
            colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, 0.7)`);
        }

        const color_width = width / nb_colors;
        for (let i = 0; i < nb_colors; i++) {
            ctx.fillStyle = colors[i];
            ctx.fillRect(i * color_width, 0, color_width, height);
        }
    };

    return (
        <div className="row">
            <input 
                type="button" 
                value="default" 
                className="col-2 btn btn-primary"
                onClick={handle_cmap_buttons_on_click}
            />
            <input 
                type="button" 
                value="clusters" 
                className="col-2 btn btn-secondary"
                onClick={handle_cmap_buttons_on_click}
            />
            <input 
                type="button" 
                value="timestamps" 
                className="col-2 btn btn-secondary"
                onClick={handle_cmap_buttons_on_click}
            />
            <input 
                type="button" 
                value="scores" 
                className="col-2 btn btn-secondary"
                onClick={handle_cmap_buttons_on_click}
            />
            <canvas 
                className="col-4"
                ref={color_map_bar_ref}>
            </canvas>
        </div>
    );
}

export default Color_map_bar;