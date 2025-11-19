import Image_crop_area from "./image_crop_area"
import { 
    fetch_text_query_scores, 
    fetch_image_scores, 
    fetch_crop_scores,
    fetch_compound_query_scores
} from "../utilities/api_methods";
import { 
    get_video_inline_offset, 
    save_cursor_position,
    restore_cursor_position
} from "../utilities/misc_methods";
import { parse_query } from "../utilities/query_parser";

import { useEffect, useRef, useState } from "react";
import { Images, Crop, Search, Shapes } from "lucide-react";

/** This component enables textual and image based search in the video. Image search supports 
 * external images or cropping the video frame. Cropping depends on Image_crop_area component.
 * @todo implement object detection and display
 * @param {*} video_ref expected reference to an html video element with access to "current"
 * @param {*} current_index expected positive integer, current frame index in the video
 * @param {*} set_scores expected setter of the scores state
 * @param {*} is_dark_mode expected boolean, true if dark mode is enabled */
const Search_field = ({video_ref, current_index, set_scores, is_dark_mode}) => {
    const text_input_ref = useRef(null);
    const image_input_ref = useRef(null);
    const image_crop_ref = useRef(null);
    const search_button_ref = useRef(null);
    const image_file_input_ref = useRef(null);
    const crop_area_ref = useRef(null);

    /** reference to the cursor position in the editable div text input */
    const cursor_position_ref = useRef(null);

    const [selection_top_left, set_selection_top_left] = useState({x: 0, y: 0});
    const [selection_bot_right, set_selection_bot_right] = useState({x: 0, y: 0});

    /** video absolute top left corner, used to limit the cropping area */
    const [video_top_left, set_video_top_left] = useState({x: 0, y: 0});

    /** video absolute bottom right corner, used to limit the cropping area */
    const [video_bot_right, set_video_bot_right] = useState({x: 0, y: 0});

    /** text query value in the textarea as seen and typed by the user */
    const [query_value, set_query_value] = useState("");
    const [input_files, set_input_files] = useState([]);

    const separators = ['AND', 'OR', 'W/O'];
    const regrouper_pairs = [['"', '"'], ["'", "'"], ['[', ']']];

    //restore cursor position on query_value change
    useEffect(() => {
        if (!text_input_ref.current || !cursor_position_ref.current) { return; }
        restore_cursor_position(text_input_ref, cursor_position_ref.current);
    }, [query_value]);

    //reset on video_ref change
    useEffect(() => {
        set_video_top_left({x: 0, y: 0});
        set_video_bot_right({x: 0, y: 0});
        set_selection_top_left({x: 0, y: 0});
        set_selection_bot_right({x: 0, y: 0});
        set_query_value("");
        set_input_files([]);
    }, [video_ref]);

    /** highjack click to the file input when clicking on the icon */
    const handle_image_upload_click = () => {
        image_file_input_ref.current.click();
    };

    /** on image change, fetch the image scores from the server
     * @param {*} event expected file input change event */ 
    const handle_image_file_input_change = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            set_query_value(query_value + ` '${files[0].name}'`);
            set_input_files([...input_files, files[0]]);
            fetch_image_scores(files[0]).then((scores) => {
                if (scores?.length > 0) {
                    set_scores(scores);
                }
            });
        }
    };

    /** triggers image_crop_area */
    const handle_image_crop_click = () => {
        const video = video_ref.current;

        //stop the video if its currently running
        video.pause();

        //get video dimensions to limit the cropping area
        const video_width = video.offsetWidth;
        const video_height = video.offsetHeight;

        const rect = video.getBoundingClientRect();
        const video_left = rect.left;
        const video_top = rect.top;

        set_video_top_left({x: video_left, y: video_top});
        set_video_bot_right({x: video_left + video_width, y: video_top + video_height});

        //make the cropping area visible and set it to the window's dimensions
        let crop_area = crop_area_ref.current;
        crop_area.width = window.innerWidth;
        crop_area.height = window.innerHeight;
        crop_area.className = "d-block position-absolute top-0 start-0";
        crop_area.zIndex = 1000;

        //overriding the top_left bot_right corners of selection once to trigger the rendering
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

        set_query_value(query_value + ` [${x_min}, ${y_min}, ${crop_width}, ${crop_height}, ${current_index}]`);
        fetch_crop_scores(current_index, [x_min, y_min, crop_width, crop_height]).then((scores) => {
            if (scores?.length > 0) {
                set_scores(scores);
            }
        });
    };
    
    /** triggers score acquisition for query from server end */
    const handle_search_click = () => {
        const query_input = query_value.trim();
        
        if (query_input.length > 0) {
            const parsed_query = parse_query(query_input, regrouper_pairs, separators);
            
            //if only one query is present, trigger direct search
            if (parsed_query.length == 1 && parsed_query[0].length > 0) {
                switch (parsed_query[0][0]) {
                    case regrouper_pairs[0][0]: { //double quotes
                        fetch_text_query_scores(parsed_query[0]).then((scores) => {
                            if (scores?.length > 0) { 
                                set_scores(scores); 
                            } 
                        });
                        return;
                    }
                    case regrouper_pairs[1][0]: { //single quotes
                        const file_name = parsed_query[0].slice(1, -1).trim();
                        const matched_file = input_files.find(file => file.name === file_name);
                        if (matched_file) {
                            fetch_image_scores(matched_file).then((scores) => {
                                if (scores?.length > 0) { 
                                    set_scores(scores); 
                                }
                            });
                        }
                        return;
                    }
                    case regrouper_pairs[2][0]: { //braces
                        const bounding_box = JSON.parse(parsed_query[0]).map(Number);
                        const [x_min, y_min, crop_width, crop_height, current_index] = bounding_box;
                        fetch_crop_scores(current_index, [x_min, y_min, crop_width, crop_height]).then((scores) => {
                            if (scores?.length > 0) {
                                set_scores(scores);
                            }
                        });
                        return;
                    }
                }
            }
            //compound query search
            let multimodal_query = [];
            for (const query of parsed_query) {
                switch (query[0]) {
                    case regrouper_pairs[0][0]: { //double quotes
                        multimodal_query.push({ "text_query": query.slice(1, -1) });
                        break;
                    }
                    case regrouper_pairs[1][0]: { //single quotes
                        const file_name = query.slice(1, -1).trim();
                        const matched_file = input_files.find(file => file.name === file_name);
                        if (matched_file) {
                            multimodal_query.push({ "image_query": matched_file });
                        }
                        break;
                    }
                    case regrouper_pairs[2][0]: { //braces
                        const bounding_box = JSON.parse(query).map(Number);
                        const [x_min, y_min, crop_width, crop_height, current_index] = bounding_box;
                        multimodal_query.push({
                            "crop_query": {
                                "current_index": current_index,
                                "crop_box": [x_min, y_min, crop_width, crop_height]
                            }
                        });
                        break;
                    }
                    case separators[0][0]: { //AND
                        multimodal_query.push({ "logic": separators[0] });
                        break;
                    }
                    case separators[1][0]: { //OR
                        multimodal_query.push({ "logic": separators[1] });
                        break;
                    }
                    case separators[2][0]: { //W/O
                        multimodal_query.push({ "logic": separators[2] });
                        break;
                    }
                }
            }
            console.log(multimodal_query);
            fetch_compound_query_scores(multimodal_query).then((scores) => {
                if (scores?.length > 0) {
                    set_scores(scores);
                }
            });
        }
    };

    /** highlights different parts of the compound query for better visibility */
    const highlight = (text) => {
        if (!text) { return ""; }

        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        //highlight double quoted sections in blue
        html = html.replace(/"([^"]*)"/g, '<span class="text-primary">"$1"</span>');

        //highlight logical keywords in red
        html = html.replace(/\b(AND|OR|W\/O)\b/g, '<span class="text-danger">$1</span>');
        
        //highlight single quoted sections in green
        html = html.replace(/'([^']*)'/g, '<span class="text-success">\'$1\'</span>');

        //highlight braced values in orange
        html = html.replace(/\[([^\]]*)\]/g, '<span class="text-warning">[$1]</span>');

        return html;
    };

    /** captures user input in the text area */
    const handle_typing_input = () => {
        cursor_position_ref.current = save_cursor_position(text_input_ref);
        const text = text_input_ref.current.innerText;
        set_query_value(text);
    }

    /** prevents enter key from line break and triggers search */
    const handle_enter_pressed = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handle_search_click();
        }
    };

    return (
        <div className="row w-100 h-5">
            <div className="col-8 h-100 position-relative">
                <div 
                    contentEditable={true}
                    className={`form-control text-start h-100 nowrap overflow-x responsive-text ${is_dark_mode ? 
                        "text-light bg-transparent" : "text-dark bg-transparent"
                    }`}
                    dangerouslySetInnerHTML={{ __html: highlight(query_value) }}
                    placeholder="search in video"
                    spellCheck="false"
                    ref={text_input_ref}
                    onInput={handle_typing_input}
                    onKeyDown={handle_enter_pressed}
                />
            </div>
            <button
                onClick={handle_search_click}
                ref={search_button_ref}
                className="col-1 h-100 btn border-secondary border-top-0 border-start-0 border-bottom-0 rounded-0"
            >
                <Search className={(is_dark_mode)? "h-100 text-light" : "h-100 text-dark"} />
            </button>
            <button
                onClick={handle_image_upload_click}
                ref={image_input_ref}
                className="col-1 h-100 btn"
            >
                <Images className={(is_dark_mode)? "h-100 text-light" : "h-100 text-dark"} />
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
                className="col-1 h-100 btn"
            >
                <Crop className={(is_dark_mode)? "h-100 text-light" : "h-100 text-dark"} />
            </button>
            <button
                //onClick={}
                //ref={}
                className="col-1 h-100 btn border-secondary border-top-0 border-bottom-0 border-end-0 rounded-0"
            >
                <Shapes className={(is_dark_mode)? "h-100 text-light" : "h-100 text-dark"} />
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