import "./App.css"
import Video_config_bar from "./components/video_config_bar";
import Video_player from "./components/video_player";
import Timeline from "./components/timeline";
import Semantic_plot from "./components/semantic_plot"
import Search_field from "./components/search_field";
import Modality_adjusting_slider from "./components/modality_adjusting_slider";

import { useRef, useState } from "react";

function App () {
    const [video_src, set_video_src] = useState("");
    const [video_name, set_video_name] = useState("");
    const video_ref = useRef(null);
    const fps = 10;

    const [current_index, set_current_index] = useState(0);
    const [max_index, set_max_index] = useState(0);

    const [points, set_points] = useState([]);
    const [selected_points, set_selected_points] = useState([]);
    
    const [scores, set_scores] = useState([]);
    const [image_scores, set_image_scores] = useState([]);
    const [audio_scores, set_audio_scores] = useState([]);
    const [image_score_ratio, set_image_ratio] = useState(0.6);
    const [audio_score_ratio, set_audio_ratio] = useState(0.4);

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
                    set_video_name={set_video_name}
                    className="row h-100" 
                    set_video_src={set_video_src}
                    set_current_index={set_current_index}
                    set_scores={set_scores}
                    set_image_scores={set_image_scores}
                    set_image_ratio={set_image_ratio}
                    set_audio_scores={set_audio_scores}
                    set_audio_ratio={set_audio_ratio}
                    max_index={max_index}
                    fps={fps}
                    set_points={set_points}
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
                <div className="row h-25 justify-content-center">
                    <Timeline 
                        current_index={current_index}
                        update_time={update_time}
                        max_index={max_index}
                        fps={fps}
                        set_selected_points={set_selected_points}
                        selected_points={selected_points}
                        scores={scores}
                        image_scores={image_scores}
                        audio_scores={audio_scores}
                    />
                    <Modality_adjusting_slider
                        set_scores={set_scores}
                        image_scores={image_scores}
                        audio_scores={audio_scores}
                        image_score_ratio={image_score_ratio}
                        set_image_ratio={set_image_ratio}
                        audio_score_ratio={audio_score_ratio}
                        set_audio_ratio={set_audio_ratio}
                    />
                </div>
            </div>
            <div className="col-5 h-100">
                <Search_field 
                    className="row h-5"
                    set_scores={set_scores}
                    set_image_scores={set_image_scores}
                    image_score_ratio={image_score_ratio}
                    set_audio_scores={set_audio_scores}
                    audio_score_ratio={audio_score_ratio}
                    set_image_ratio={set_image_ratio}
                    set_audio_ratio={set_audio_ratio}
                    current_index={current_index}
                    video_name={video_name}
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
                    points={points}
                    set_points={set_points}
                    set_selected_points={set_selected_points}
                    selected_points={selected_points}
                    is_dark_mode={is_dark_mode}
                />
            </div>
        </div>
    );
}

export default App;
