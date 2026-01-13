import { VIRIDIS1, VIRIDIS2, VIRIDIS3, VIRIDIS4, VIRIDIS5, VIRIDIS6 } from "../utilities/constants";

import { useRef, useState, useEffect } from "react";

/** displays a custom slider allowing dynamic adjustment of the weight between two modalities: image and audio
 * @param {*} set_scores expected setter for an array of combined scores according to the current ratios
 * @param {*} image_scores expected array of floats, represent the cosine similarity scores for the image modality
 * @param {*} audio_scores expected array of floats, represent the cosine similarity scores for the audio modality
 * @param {*} image_score_ratio expected float scalar between 0 and 1, current weight of the image modality 
 * @param {*} set_image_ratio expected setter for image_score_ratio
 * @param {*} audio_score_ratio expected float scalar between 0 and 1, current weight of the audio modality 
 * @param {*} set_audio_ratio expected setter for audio_score_ratio */
const Modality_adjusting_slider = ({set_scores, image_scores, audio_scores, image_score_ratio,
    set_image_ratio, audio_score_ratio, set_audio_ratio}) => {
    const slide_limit_top = 0.05;
    const slide_limit_bot = 0.95;
    const modality_slider_ref = useRef(null);
    const [is_sliding, set_sliding] = useState(false);

    //rendering effect
    useEffect(() => {
        if (modality_slider_ref.current) {
            modality_slider_ref.current.width = modality_slider_ref.current.offsetWidth;
            modality_slider_ref.current.height = modality_slider_ref.current.offsetHeight;
            if (image_scores?.length > 0 && audio_scores?.length == image_scores?.length) {
                render_modality_slider(modality_slider_ref.current);
            }
        }
    }, [set_scores, image_scores, audio_scores, image_score_ratio, audio_score_ratio]);

    /** render a neutral gradient and a selection square depending on the current audio_score_ratio
     * @param {*} svg expected canvas element to render the slider on */
    const render_modality_slider = (svg) => {
        let ctx = svg.getContext("2d", { alpha: true });

        let plot_width = svg.width;
        let plot_height = svg.height;
    
        ctx.clearRect(0, 0, plot_width, plot_height);  

        //draw gradient and name of modalities
        const gradient = ctx.createLinearGradient(0, 0, 0, plot_height);
        gradient.addColorStop(0, `rgb(${VIRIDIS1.red}, ${VIRIDIS1.green}, ${VIRIDIS1.blue})`);  
        gradient.addColorStop(0.2, `rgb(${VIRIDIS2.red}, ${VIRIDIS2.green}, ${VIRIDIS2.blue})`);
        gradient.addColorStop(0.4, `rgb(${VIRIDIS3.red}, ${VIRIDIS3.green}, ${VIRIDIS3.blue})`);
        gradient.addColorStop(0.6, `rgb(${VIRIDIS4.red}, ${VIRIDIS4.green}, ${VIRIDIS4.blue})`);
        gradient.addColorStop(0.8, `rgb(${VIRIDIS5.red}, ${VIRIDIS5.green}, ${VIRIDIS5.blue})`);
        gradient.addColorStop(1, `rgb(${VIRIDIS6.red}, ${VIRIDIS6.green}, ${VIRIDIS6.blue})`);  
        ctx.fillStyle = gradient;
        ctx.fillRect(plot_width * 0.2, 0, plot_width * 0.6, plot_height);

        //write modalities names
        ctx.fillStyle = "black";
        ctx.font = "12px arial";
        ctx.fillText("image", plot_width * 0.2, plot_height * slide_limit_top);
        ctx.fillStyle = "lightgray";
        ctx.font = "12px arial";
        ctx.fillText("sound", plot_width * 0.2, plot_height * slide_limit_bot);

        //draw selection square
        const y = plot_height * (slide_limit_bot - slide_limit_top) 
            * audio_score_ratio + plot_height * slide_limit_top;
        ctx.fillStyle = "rgba(125, 125, 125, 0.5)";
        ctx.fillRect(1, y - plot_height * 0.04, plot_width - 2, plot_height * 0.08);
        ctx.rect(1, y - plot_height * 0.04, plot_width - 2, plot_height * 0.08);
        ctx.strokeStyle = "rgb(0, 0, 0)";
        ctx.stroke();
    };
    
    /** extract ratio from y coordinate and update scores and ratios
     * @param {*} y expected float, y coordinate of the mouse click on the slider
     * @param {*} max_y expected float, height of the canvas */
    const update_scores_ratios = (y, max_y) => {
        set_audio_ratio((y - max_y * slide_limit_top) / (max_y * (slide_limit_bot - slide_limit_top)));
        set_image_ratio(1 - (y - max_y * slide_limit_top) / (max_y * (slide_limit_bot - slide_limit_top)));
        set_scores(image_scores.map((image_s, i) => image_score_ratio 
            * image_s + audio_score_ratio * audio_scores[i]));
    };

    const handle_slider_mousedown = (event) => {
        if (image_scores?.length > 0 && audio_scores?.length == image_scores?.length) {
            set_sliding(true);
            const rect = modality_slider_ref.current.getBoundingClientRect();
            const plot_height = modality_slider_ref.current.height;
            const y = Math.max(Math.min(event.clientY - rect.top, plot_height * slide_limit_bot),
                plot_height * slide_limit_top);
            update_scores_ratios(y, plot_height);
        }
    };

    const handle_slider_mousemove = (event) => {
        if (is_sliding) {
            const rect = modality_slider_ref.current.getBoundingClientRect();
            const plot_height = modality_slider_ref.current.height;
            const y = Math.max(Math.min(event.clientY - rect.top, plot_height * slide_limit_bot),
                plot_height * slide_limit_top);
            update_scores_ratios(y, plot_height);
        }
    };

    const handle_slider_mouseup = (event) => {
        if (is_sliding) {
            const rect = modality_slider_ref.current.getBoundingClientRect();
            const plot_height = modality_slider_ref.current.height;
            const y = Math.max(Math.min(event.clientY - rect.top, plot_height * slide_limit_bot),
                plot_height * slide_limit_top);
            update_scores_ratios(y, plot_height);
        }
        set_sliding(false);
    };

    return ( 
        <canvas
            ref={modality_slider_ref}
            className={`${(image_scores?.length > 0 && audio_scores?.length == image_scores?.length)? 
                "col-1" : ""} h-100 rounded p-0`}
            tabIndex={0}
            onMouseDown={handle_slider_mousedown}
            onMouseMove={handle_slider_mousemove}
            onMouseUp={handle_slider_mouseup}
            onMouseOut={handle_slider_mouseup}
            onContextMenu={(e) => e.preventDefault()} //prevent right click menu on this specific component
        >
        </canvas>
    );
}

export default Modality_adjusting_slider;
