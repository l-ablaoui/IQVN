import Image_crop_area from "./image_crop_area"
import { 
    fetch_query_scores, 
    fetch_image_scores, 
    fetch_crop_scores
} from "../utilities/api_methods";
import { get_video_inline_offset } from "../utilities/misc_methods";

import React, { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faImages, faCrop, faSearch } from "@fortawesome/free-solid-svg-icons";

const Search_field = ({video_ref, current_index, set_scores}) => {
    const text_input_ref = useRef(null);
    const image_input_ref = useRef(null);
    const image_crop_ref = useRef(null);
    const search_button_ref = useRef(null);
    const image_file_input_ref = useRef(null);
    const crop_area_ref = useRef(null);

    const [selection_top_left, set_selection_top_left] = useState({x: 0, y: 0});
    const [selection_bot_right, set_selection_bot_right] = useState({x: 0, y: 0});

    /** video absolute top left corner, used to limit the cropping area */
    const [video_top_left, set_video_top_left] = useState({x: 0, y: 0});

    /** video absolute bottom right corner, used to limit the cropping area */
    const [video_bot_right, set_video_bot_right] = useState({x: 0, y: 0});

    /** highjack click to the file input when clicking on the icon */
    const handle_image_upload_click = () => {
        image_file_input_ref.current.click();
    };

    /** on image change, fetch the image scores from the server
     * @param {*} event expected file input change event */ 
    const handle_image_file_input_change = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            fetch_image_scores(files[0]).then((scores) =>
                set_scores(scores)
            );
        }
    };

    /** triggers image_crop_area */
    const handle_image_crop_click = () => {
        const video = video_ref.current;

        //stop the video if its currently running
        video.pause();

        // get video dimensions to limit the cropping area
        const video_width = video.offsetWidth;
        const video_height = video.offsetHeight;

        const rect = video.getBoundingClientRect();
        const video_left = rect.left;
        const video_top = rect.top;

        set_video_top_left({x: video_left, y: video_top});
        set_video_bot_right({x: video_left + video_width, y: video_top + video_height});

        // make the cropping area visible and set it to the window's dimensions
        let crop_area = crop_area_ref.current;
        crop_area.width = window.innerWidth;
        crop_area.height = window.innerHeight;
        crop_area.className = "d-block position-absolute top-0 start-0";
        crop_area.zIndex = 1000;

        // overriding the top_left bot_right corners of selection once to trigger the rendering
        set_selection_top_left({x: video_left, y: video_top});
        set_selection_bot_right({x: video_left, y: video_top});
    };

    /** extracts the crop area from the canva, scales it to the video dimensions 
     * and calls the image crop similarity endpoint of the server */
    const apply_crop_image_search = async () => {
        const video = video_ref.current;
        const video_width = video.videoWidth;
        const video_height = video.videoHeight;
        const offset_width = video.offsetWidth;
        const offset_height = video.offsetHeight;

        const rect = video.getBoundingClientRect();
        const video_left = rect.left;
        const video_top = rect.top;
        const { x_offset, y_offset } = get_video_inline_offset(video);

        const crop_width = Math.trunc(Math.abs((selection_top_left.x - selection_bot_right.x) 
            * video_width / offset_width));
        const crop_height = Math.trunc(Math.abs((selection_top_left.y - selection_bot_right.y)
            * video_height / offset_height));

        const x_min = Math.trunc((selection_top_left.x - video_left - x_offset) * video_width / offset_width);
        const y_min = Math.trunc((selection_top_left.y - video_top - y_offset) * video_height / offset_height);

        fetch_crop_scores(current_index, [x_min, y_min, crop_width, crop_height]).then((scores) => {
            set_scores(scores);
        });
    };
    
    /** triggers textual score endpoints of the server */
    const handle_search_click = () => {
        const query_input = text_input_ref.current.value;

        if (query_input.length > 0) {
            fetch_query_scores(query_input).then((scores) => {
                if (scores?.length > 0) { 
                    set_scores(scores); 
                } 
            });
        }
    };

    return (
        <div className="row w-100 vh-5">
            <div className="col-8">
                <input 
                    type={"text"} 
                    placeholder={"search in video"} 
                    maxLength={300}
                    ref={text_input_ref}
                    className="form-control"
                />
            </div>
            <button
                onClick={handle_image_upload_click}
                ref={image_input_ref}
                className="col-1 btn"
            >
                <FontAwesomeIcon icon={faImages} />
                <input 
                    type="file" 
                    class="d-none" 
                    ref={image_file_input_ref}
                    onChange={handle_image_file_input_change}
                    accept="image/png, image/jpeg, image/gif" 
                />
            </button>
            <button
                onClick={handle_image_crop_click}
                ref={image_crop_ref}
                className="col-1 btn"
            >
                <FontAwesomeIcon icon={faCrop}/>
            </button>
            <button
                onClick={handle_search_click}
                ref={search_button_ref}
                className="col-2 btn"
            >
                <FontAwesomeIcon icon={faSearch} />
            </button>
            <Image_crop_area 
                crop_area_ref={crop_area_ref}
                selection_top_left={selection_top_left}
                selection_bot_right={selection_bot_right}
                set_selection_top_left={set_selection_top_left}
                set_selection_bot_right={set_selection_bot_right}
                video_top_left={video_top_left}
                video_bot_right={video_bot_right}
                apply_effect={apply_crop_image_search}
            />
        </div>
    );
};

export default Search_field;