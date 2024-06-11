let obj_plot = document.getElementById("obj_plot");

//to keep space between plot and canvas boundaries
let obj_plot_offset_left = 50;
let obj_plot_offset_right = 20;
let obj_plot_offset_y = 20;

/*main drawing function for detected objects plot*/
let plot_objects = (current_index) => {
    if (window.objs == null) { return; }

    //canvas width/length
    let plot_width = obj_plot.width;
    let plot_height = obj_plot.height;

    //reset the drawing
    let ctx = obj_plot.getContext("2d");
    ctx.clearRect(0, 0, plot_width, plot_height);

    plot_axes(obj_plot_offset_left, obj_plot_offset_right, obj_plot_offset_y, obj_plot);

    // Draw class names on y-axis
    for (let i = 0; i < window.objs["classes"].length; ++i) {
        const yPos = plot_height - obj_plot_offset_y - (i / window.objs["classes"].length) * (plot_height - 2 * obj_plot_offset_y);
        ctx.fillText(window.objs["classes"][i]["label"], obj_plot_offset_left / 10, yPos);
    }

    //for each timestamp, draw circles on the level of the object label
    let current_frame_obj_index = -1;
    for (let k = 0; k < window.objs["results"].length; ++k) {
        let objects = window.objs["results"][k];

        //draw current frame dots last to stand out
        if (objects[0]["timestamp"] == current_index) { 
            current_frame_obj_index = k;
            continue; 
        }
        for (let i = 0;i < objects.length;++i) {
            //xpos reflects the timestamp
            timestamp = objects[i]["timestamp"];
            const x = obj_plot_offset_left + (timestamp / window.objs["maxTime"]) * (plot_width - obj_plot_offset_left - obj_plot_offset_right);
            
            //matching label with plot line (ypos)
            label = objects[i]["label"];
            let j = 0;
            for (;j < window.objs["classes"].length; ++j) {
                if (label == window.objs["classes"][j]["index"]) { break; }
            } 
            const y = plot_height - obj_plot_offset_y - (j / window.objs["classes"].length) * (plot_height - obj_plot_offset_y * 2);

            //draw circle
            ctx.fillStyle = window.REGULAR_COLOR;
            let dot_radius = window.REGULAR_RADIUS;
            fill_circle(ctx, {x: x, y: y}, dot_radius);
        }
    }

    //current frame dots drawing (if any)
    if (current_frame_obj_index != -1) {
        let objects = window.objs["results"][current_frame_obj_index];

        for (let i = 0; i < objects.length;++i) {
            const x = obj_plot_offset_left + (current_index / window.objs["maxTime"]) * (plot_width - obj_plot_offset_right - obj_plot_offset_left);

            label = objects[i]["label"];
            let j = 0;
            for (;j < window.objs["classes"].length; ++j) {
                if (label == window.objs["classes"][j]["index"]) { break; }
            } 
            const y = plot_height - obj_plot_offset_y - (j / window.objs["classes"].length) * (plot_height - obj_plot_offset_y * 2);

            ctx.fillStyle = window.EMPHASIS_COLOR;
            let dot_radius = window.EMPHASIS_RADIUS;
            fill_circle(ctx, {x: x, y: y}, dot_radius);
        }
    }

    //update vertical line position
    plot_marker(current_index, window.objs["maxTime"], obj_plot_offset_left, obj_plot_offset_right, obj_plot_offset_y, window.EMPHASIS_COLOR, 1, obj_plot);
};

/*when clicking on an object marker of the active frame, adjust the cropped area to reflect the object's bounding box */
obj_plot.addEventListener("click", (event) => {
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    //canvas width/length
    let plot_width = obj_plot.width;
    let plot_height = obj_plot.height;

    //if there are no detected objects at the current frame, skip
    if (!(window.current_index in window.objs["results"])) { return; }

    //get detected objects' coordinates in the plot and seeing if the clicked area corresponds to one of em
    let objects = window.objs["results"][window.current_index];
    bb = null;
    for (let i = 0; i < objects.length;++i) {
        //get coordinates of current object on the chart
        label = objects[i]["label"];
        let j = 0;
        for (;j < window.objs["classes"].length; ++j) {
            if (label == window.objs["classes"][j]["index"]) { break; }
        } 
        const y = plot_height - obj_plot_offset_y - (j / window.objs["classes"].length) * (plot_height - obj_plot_offset_y * 2);
        const x = obj_plot_offset_left + (window.current_index / window.objs["maxTime"]) * (plot_width - obj_plot_offset_right - obj_plot_offset_left);

        //check if clicked area is in the circle
        if ((mouseX - x) * (mouseX - x) + (mouseY - y) * (mouseY - y) <= 4 * 4) {
            bb = [objects[i]["min_x"], objects[i]["min_y"], objects[i]["max_x"], objects[i]["max_y"]];
            break;
        }
    }

    //update cropped area if an object is clicked
    if (bb != null) {
        console.log(bb);

        window.crop_top_left.x = bb[0];
        window.crop_top_left.y = bb[1];
        window.crop_bot_right.x = bb[2];
        window.crop_bot_right.y = bb[3];

        //toggle cropping
        window.is_crop_visible = true;
        document.getElementById("crop").style.display = "block";
        document.getElementById("crop_label").style.display = "block";

        //draw the cropped area (calls drao from crop_script)
        update_video(window.current_frame.src);
    }
    //drawCropped();
});
