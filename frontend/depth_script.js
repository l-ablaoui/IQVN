const update_depth_video = async (current_index) => {
    if (!window.depth) { return; }
    
    try {
        let name_processed = window.current_video.split(".")[0]; 
        const imgresponse = await fetch(`${server_url}/image/depth-${name_processed}/depth_frame_${current_index}.png`);
        const blob = await imgresponse.blob();
        const image_url = URL.createObjectURL(blob);
    
        let display_frame = new Image(); 
        display_frame.src = image_url;
    
        display_frame.onload = () => {
            // Access the width and height properties
            const width = display_frame.width;
            const height = display_frame.height;
    
            // Get the canvas element
            const canvas = document.getElementById("depth_video");
            const ctx = canvas.getContext("2d");
    
            // Set canvas dimensions to match the image
            canvas.width = width;
            canvas.height = height;
    
            // Clear any previous content on the canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
    
            // Draw the image onto the canvas
            ctx.drawImage(display_frame, 0, 0, width, height);
        };
    }
    catch (error) {
        console.error("Error drawing the depth frame: ", error);
    }
};

toggle_depth.addEventListener("click", () => {
    let depth_div = document.getElementById("depth_div");
    if (depth_div.style.display == "none") {
        depth_div.style.display = "block";
        toggle_depth.value = "▼ Depth map";
        try {
            update_depth_video(window.current_index);
        }
        catch (error) {
            console.error("Error updating the depth video: ", error);
        }
    } 
    else {
        toggle_depth.value = "▲ Depth map";
        depth_div.style.display = "none";
    }
});

depthEstimate.addEventListener("click", async () => {
    try {
        //compute the depth map
        const response = await fetch(`${server_url}/video/depth/${window.current_video}`);
        const body = await response.json();
        console.log(body);

        //display the depth map of the current frame only
        update_depth_video(window.current_index);

        toggle_depth.style.display = "block";
        window.depth = true;
    }
    catch (error) {
        console.error("Error computing depth map: ", error);
    }
});