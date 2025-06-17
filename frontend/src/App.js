import "./App.css"
import Video_config_bar from "./components/video_config_bar";
import Video_player from "./components/video_player";
import Timeline from "./components/timeline";
import Semantic_plot from "./components/semantic_plot"
import Search_field from "./components/search_field";

import { useRef, useState } from "react";

function App () {
    const [video_src, set_video_src] = useState("");
    const video_ref = useRef(null);
    const fps = 10;

    const [current_index, set_current_index] = useState(0);
    const [max_index, set_max_index] = useState(0);

    const [selected_points, set_selected_points] = useState([]);
    
    const [scores, set_scores] = useState([]);

    const [is_dark_mode, set_dark_mode] = useState(false);

    const update_time = (current_index) => {
        if (video_ref.current) {
            set_current_index(current_index);

            const time_value = current_index / fps;
            video_ref.current.currentTime = time_value;
        }
    };

    return (
        <div className={
            `container-fluid text-center vw-100 vh-100 row 
            ${(is_dark_mode)? "bg-dark text-white" : "bg-light text-dark"}`
        }>
            <div className="col-7 h-100">
                <Video_config_bar 
                    className="row" 
                    set_video_src={set_video_src}
                    set_current_index={set_current_index}
                    set_scores={set_scores}
                    max_index={max_index}
                    fps={fps}
                    selected_points={selected_points}
                    set_selected_points={set_selected_points}
                    is_dark_mode={is_dark_mode}
                    set_dark_mode={set_dark_mode}
                />
                <Video_player 
                    className="row" 
                    video_ref={video_ref}
                    video_src={video_src}
                    set_video_src={set_video_src}
                    set_current_index={set_current_index}
                    set_max_index={set_max_index}
                    set_scores={set_scores}
                    fps={fps}
                />
                <Timeline 
                    className="row"
                    current_index={current_index}
                    update_time={update_time}
                    max_index={max_index}
                    fps={fps}
                    set_selected_points={set_selected_points}
                    selected_points={selected_points}
                    scores={scores}
                />
            </div>
            <div className="col-5 h-100">
                <Search_field 
                    className="row h-5"
                    set_scores={set_scores}
                    current_index={current_index}
                    video_ref={video_ref}
                    is_dark_mode={is_dark_mode}
                />
                <Semantic_plot 
                    className="row"
                    scores={scores} 
                    current_index={current_index} 
                    update_time={update_time}
                    max_index={max_index}
                    video_ref={video_ref}
                    video_src={video_src}
                    set_selected_points={set_selected_points}
                    selected_points={selected_points}
                    is_dark_mode={is_dark_mode}
                />
            </div>
        </div>
    );
}

export default App;
