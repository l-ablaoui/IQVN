import { BACKEND_SERVER_URL } from "../utilities/constants";
import { 
    fetch_server_videos_list, 
    post_video_name 
} from "../utilities/api_methods";
import { parse_selected_frames } from "../utilities/misc_methods";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

/** this component handles selecting a video from the server, clearing/copying the selected frames 
 * in string format and toggling dark mode
 * @param {*} set_video_src expected setter of the string video source
 * @param {*} set_current_index expected setter of the integer current frame index
 * @param {*} set_scores expected setter of the array of floats representing similarity scores
 * @param {*} selected_points expected array of integers representing selected frames' indices
 * @param {*} set_selected_points expected setter of the array of integers representing selected frames
 * @param {*} max_index expected non-zero positive integer, maximum frame index in the video
 * @param {*} fps expected positive integer, frames per second ratio in the video
 * @param {*} is_dark_mode expected boolean, true if dark mode is enabled
 * @param {*} set_dark_mode expected setter of the boolean dark mode */
const Video_config_bar = ({set_video_src, set_current_index, set_scores, selected_points, 
    set_selected_points, max_index, fps, is_dark_mode, set_dark_mode}) => {
    const [video_names, set_video_names] = useState([]);
    
    // fetch available video list from server on component mount
    useEffect(() => {
        const load_video_list = async () => {
            const fetched_video_names = await fetch_server_videos_list();

            if (fetched_video_names?.length > 0) {   
                set_video_names(fetched_video_names);
                set_video_src(`${BACKEND_SERVER_URL}video/${fetched_video_names[0]}`);
                await post_video_name(fetched_video_names[0]);
            }
        };
        load_video_list();
    }, []);

    /** on option change in the <select> element, updates video_src*/
    const handle_video_selector_change = (event) => {
        const current_video_name = event.target.value;
        if (!current_video_name) return;
        set_current_index(0);
        set_scores([]);
        set_video_src(`${BACKEND_SERVER_URL}video/${current_video_name}`);
        post_video_name(current_video_name);
    };

    /** wipe out current selection of frames */
    const handle_clear_selection = () => {
        set_selected_points([]);
    };

    /** copy selected frames as string-coded timestamps to clipboard */
    const handle_copy_selection = () => {
        const parsed_selected_frames = parse_selected_frames(selected_points, max_index, fps);

        navigator.clipboard.writeText(parsed_selected_frames).then(() => {
            console.log("Text copied to clipboard");
        }).catch(err => {
            console.error("Failed to copy text: ", err);
        });
    };
    
    return (
        <div className="row w-100 h-5 justify-content-center">
            <div className="col-3 h-100">
                <button 
                    className="col-5 h-100 btn"
                    onClick={(is_dark_mode)? () => set_dark_mode(false) : () => set_dark_mode(true)} 
                >
                    <FontAwesomeIcon 
                        className={`h-100 ${(is_dark_mode)? "text-light" : "text-dark"}`} 
                        icon={(is_dark_mode)? faSun : faMoon} 
                    /> 
                </button>
                <label className="col-7 form-label">select video: </label>
            </div>
            <div className="col-5 h-100">
                <select 
                    name="video_names"
                    className={`h-100 bg-transparent ${(is_dark_mode)? 
                        "text-light form-select" : "text-dark form-select"}` 
                    }
                    onChange={handle_video_selector_change}>
                    {video_names.map((video_name) => (
                        <option key={video_name} value={video_name}>
                            {video_name.substring(0, video_name.lastIndexOf("."))}
                        </option>
                    ))}
                </select>
            </div>
            <input 
                type="button" 
                value="clear selection" 
                className="col-2 btn h-100 btn-outline-secondary"
                onClick={handle_clear_selection}
            />
            <input 
                type="button" 
                value="copy selection" 
                className="col-2 btn h-100 btn-outline-primary"
                onClick={handle_copy_selection}
            />
        </div>
    );
};

export default Video_config_bar;
