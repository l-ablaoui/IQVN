import React from "react";

/** Video component contains a <video> element that plays a video from the server and 
 * a <select> element that allows the user to select a video from those available in 
 * the server. 
 * @param {*} video_ref expected reference to an html video element with access to "current"
 * @param {*} video_src expected string, source of the video, expected to match the video_ref.current src
 * @param {*} set_current_index expected setter of the integer current frame index
 * @param {*} set_max_index expected setter of the integer maximum frame index
 * @param {*} fps expected positive integer, frames per second ratio in the video */
const Video_player = ({video_ref, video_src, set_current_index, set_max_index, fps}) => {
    
    /** keydown handles video speed change 
     * @param {*} event expected keydown event with access to key */
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

    /** on metadata load, set the max index for timeline and semantic plot to the number of frames */
    const handle_video_loaded_metadata = () => {
        const total_duration = video_ref.current.duration;
        set_max_index(Math.trunc(total_duration * fps));
    };

    /** on time update (reading the video or navigating with the timeline) */
    const handle_video_time_update = () => {
        set_current_index(Math.trunc(video_ref.current.currentTime * fps))
    };

    return (
        <div className="row justify-content-center">
            <video 
                className="row d-block mx-auto w-100 vh-75 object-fit-contain" 
                ref={video_ref}
                key={video_src}
                tabIndex={0} // to allow video to receive keyboard
                onKeyDown={handle_video_keydown}
                onLoadedMetadata={handle_video_loaded_metadata}
                onTimeUpdate={handle_video_time_update}
                controls>
                <source 
                    src={video_src}
                    type="video/mp4"
                    key={video_src} // force reload when video_src changes
                />
            </video>
        </div>
    );
}
  
export default Video_player;   
