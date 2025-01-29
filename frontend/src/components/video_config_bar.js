import { BACKEND_SERVER_URL } from "../utilities/constants";
import { fetch_server_videos_list, post_video_name } from "../utilities/api_methods";
import { parse_selected_frames } from "../utilities/misc_methods";

import { useState, useEffect } from "react";

const Video_config_bar = ({set_video_src, set_current_index, set_scores, 
    selected_points, set_selected_points, max_index, fps}) => {
    const [video_names, set_video_names] = useState([]);
    
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
        <div className="row justify-content-center">
            <div className="row video_selector">
                <div className="col-2"><label>select video: </label></div>
                <div className="col-6">
                    <select 
                        name="video_names"
                        className="form-select"
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
                    className="col-2 btn btn-outline-secondary"
                    onClick={handle_clear_selection}
                />
                <input 
                    type="button" 
                    value="copy selection" 
                    className="col-2 btn btn-outline-primary"
                    onClick={handle_copy_selection}
                />
            </div>
        </div>
    );
};

export default Video_config_bar;
