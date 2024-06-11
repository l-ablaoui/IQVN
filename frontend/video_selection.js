//get all videos in "backend/videos" to select between 
let video_name_selection = document.getElementById("video_names_selection");

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

        //draw the video's first frame
        let name_processed = window.current_video.split(".")[0]; 
        const imgresponse = await fetch(`${server_url}/image/${name_processed}/${window.current_index}.png`);
        const blob = await imgresponse.blob();
        const image_url = URL.createObjectURL(blob);

        window.current_frame.src = image_url;
        update_video(image_url);
        update_scores(window.current_index);
    }
    catch (error) {
        console.error("Error loading video: ", error);
    }
};

video_name_selection.addEventListener("change", load_video);

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