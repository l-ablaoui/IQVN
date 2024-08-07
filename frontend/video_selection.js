//get all videos in "backend/videos" to select between 
let video_name_selection = document.getElementById("video_names_selection");

/**
 * resets all output results (scores, objects, depth, ...) and loads
 * the video whos name is currently selected
 */
let load_video = async () => {
    try {
        //update video name locally
        window.current_video = video_name_selection.value;

        //update video name in server
        const response = await fetch(`${server_url}/select_video/`, 
        {method: 'POST', body: JSON.stringify({ video_name: window.current_video }), 
        headers: {'Content-Type': 'application/json'}});
        const body = await response.json();
        console.log(body);

        //update timeline range
        window.max_index = body["frame_count"];
        window.fps = body["fps"];

        //reset index
        window.current_index = 0;

        //reset selected points and timeline
        window.selected_points = [];
        window.current_selection = 0;

        //toggle all score divs if they are visible
        document.getElementById("obj_div").style.display = "none";
        document.getElementById("score_div").style.display = "none";
        document.getElementById("reduction_div").style.display = "none";
        document.getElementById("depth_div").style.display = "none";
        document.getElementById("crop").style.display = "none";
        document.getElementById("crop_label").style.display = "none";
        document.getElementById("toggle_obj").style.display = "none";
        document.getElementById("toggle_scores").style.display = "none";
        document.getElementById("toggle_reduction").style.display = "none";
        document.getElementById("toggle_depth").style.display = "none";

        //draw the video's first frame
        let name_processed = window.current_video.split(".")[0]; 
        const imgresponse = await fetch(`${server_url}/image/${name_processed}/${window.current_index}.png`);
        const blob = await imgresponse.blob();
        const image_url = URL.createObjectURL(blob);
        
        //reset radio buttons to default value when loading a new video
        Array.from(document.querySelectorAll(
            '[name="select_reduction_method"]')).forEach((element,index) => {
                if (element.value === "tsne") {
                    element.checked = true;
                } else {
                    element.checked = false;
                }
            });

        Array.from(document.querySelectorAll(
            '[name="select_color_map"]')).forEach((element,index) => {
                if (element.value === "default") {
                    element.checked = true;
                } else {
                    element.checked = false;
                }
            });

        window.current_frame.src = image_url;
        update_video(image_url);
        update_scores(window.current_index);

        let video_canvas = document.getElementById("video");
        video_canvas.width = video_canvas.offsetWidth;
        video_canvas.height = video_canvas.offsetHeight;
    }
    catch (error) {
        console.error("Error loading video: ", error);
    }
};

video_name_selection.addEventListener("change", load_video);

/**
 * asks the server for the list of available videos and loads their name
 * in the selection menu 
 */
let update_video_selection = async () => {
    try {
        const response = await fetch(`${server_url}/video/`);
        const video_names = await response.json();
        console.log(video_names);

        for (let i = 0;i < video_names.length;++i) {
            let name_option = document.createElement("option");
            name_option.value = video_names[i];
            name_option.text = video_names[i].substring(0, video_names[i].lastIndexOf('.'));
            video_name_selection.add(name_option);
        }

        window.current_video = video_name_selection.value;
    }
    catch (error) {
        console.error("Error retrieving available videos: ", error);
    }
};

//init selection and load first video
update_video_selection().then(() => {
    // Ensure load_video is called only after update_video_selection completes
    load_video();
});