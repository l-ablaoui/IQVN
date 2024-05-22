var updateDepthVideo = async (frameIndex) => {
    var name_processed = video_name.split(".")[0]; 
    const imgresponse = await fetch(`${server_url}/image/depth-${name_processed}/depth_frame_${frameIndex}.png`);
    const blob = await imgresponse.blob();
    const imageUrl = URL.createObjectURL(blob);

    var display_frame = new Image(); 
    display_frame.src = imageUrl;

    display_frame.onload = () => {
        // Access the width and height properties
        const width = display_frame.width;
        const height = display_frame.height;

        // Get the canvas element
        const canvas = document.getElementById("depthVideo");
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