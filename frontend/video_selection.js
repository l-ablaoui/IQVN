//get all videos in "backend/videos" to select between 
var video_name_selection = document.getElementById("video_names_selection");

var load_video = async () => {
    try {
        window.current_video = video_name_selection.value;

        const response = await fetch(`${server_url}/select_video/`, 
        {method: 'POST', body: JSON.stringify({ video_name: window.current_video }), 
        headers: {'Content-Type': 'application/json'}});
        const body = await response.json();

        slider.max = body["frame_count"];
    }
    catch (error) {
        console.error("Error loading video: ", error);
    }
};

video_name_selection.addEventListener("change", load_video);

var update_video_selection = async () => {
    try {
        const response = await fetch(`${server_url}/video/`);
        const video_names = await response.json();
        console.log(video_names);

        for (var i = 0;i < video_names.length;++i) {
            var name_option = document.createElement("option");
            name_option.value = video_names[i];
            name_option.text = video_names[i].substring(0, video_names[i].lastIndexOf('.'));
            video_name_selection.add(name_option);
        }

        window.current_video = video_name_selection.value;
        console.log(window.current_video);
    }
    catch (error) {
        console.error("Error retrieving available videos: ", error);
    }
};

//init selection and load first video
update_video_selection();
load_video();