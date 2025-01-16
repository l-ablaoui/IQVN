import '../App.css';
import { BACKEND_SERVER_URL } from "../utilities/constants";
import { fetch_server_videos_list, post_video_name } from "../utilities/api_methods";

import { useRef, useState, useEffect } from "react";

/**
 * Video component contains a <video> element that plays a video from the server and 
 * a <select> element that allows the user to select a video from those available in 
 * the server.
 * @returns 
 */
const Video_player = ({video_ref, video_src, set_video_src, set_current_index, set_max_index, fps}) => {
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
    }, [video_src]);

    //on option change in the <select> element
    const handle_video_selector_change = (event) => {
        const current_video_name = event.target.value;
        set_video_src(`${BACKEND_SERVER_URL}video/${current_video_name}`);
        post_video_name(current_video_name);
    };

    const handle_video_keydown = (event) => {
        if (!video_ref.current) return;

        switch (event.key) {
            case "+": {
                video_ref.current.playbackRate = Math.min(5, video_ref.current.playbackRate + 0.5); 
                video_ref.current.play();
                console.log("+", video_ref.current.playbackRate);
                break;
            }
            case "-": {
                video_ref.current.playbackRate = Math.max(0.5, video_ref.current.playbackRate - 0.5); 
                video_ref.current.play();
                console.log("-", video_ref.current.playbackRate);
                break;
            }
            default: {
                break;
            }
        }
    };

    //on metadata load, set the max index for timeline and semantic plot to the number of frames
    const handle_video_loaded_metadata = () => {
        const total_duration = video_ref.current.duration;
        set_max_index(Math.trunc(total_duration * fps));
    };

    //on time update (reading the video or navigating with the timeline)
    const handle_video_time_update = (event) => {
        set_current_index(Math.trunc(video_ref.current.currentTime * fps))
    };

    return (
        <div className="row justify-content-center">
            <div className="row video_selector">
                <div className="col-2"><label>select video: </label></div>
                <div className="col-10">
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
            </div>
            <video 
                className="row video_player" 
                ref={video_ref}
                key={video_src}
                tabIndex="0" // Allow video to receive keyboard
                onKeyDown={handle_video_keydown}
                onLoadedMetadata={handle_video_loaded_metadata}
                onTimeUpdate={handle_video_time_update}
                controls>
                <source 
                    src={video_src}
                    type="video/mp4"
                    key={video_src} // Force reload when video_src changes
                />
            </video>
        </div>
    );
}
  
export default Video_player;   
