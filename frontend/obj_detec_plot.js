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
    const objects_per_frame = window.objs["results"];
    const obj_classes = window.objs["classes"];
    const max_index = window.objs["maxTime"];
    let current_frame_obj_index = -1;
    for (const [frame, objects] of Object.entries(objects_per_frame)) {
         //draw current frame dots last to stand out
        if (frame == current_index) { 
            current_frame_obj_index = frame;
            continue; 
        }
        for (let i = 0;i < objects.length;++i) {
            //xpos reflects the timestamp
            const x = obj_plot_offset_left + (frame / max_index) * 
                (plot_width - obj_plot_offset_left - obj_plot_offset_right);
            
            //matching label with plot line (ypos)
            const label = objects[i]["label"];
            let j = 0;
            for (;j < obj_classes.length; ++j) {
                if (label == obj_classes[j]["index"]) { break; }
            } 
            const y = plot_height - obj_plot_offset_y - (j / obj_classes.length) * 
                (plot_height - obj_plot_offset_y * 2);

            //draw circle
            ctx.fillStyle = window.REGULAR_COLOR;
            let dot_radius = window.REGULAR_RADIUS;
            fill_circle(ctx, {x: x, y: y}, dot_radius);
        }
    }

    //current frame dots drawing (if any)
    if (current_frame_obj_index != -1) {
        let objects = objects_per_frame[current_frame_obj_index];

        for (let i = 0; i < objects.length;++i) {
            const x = obj_plot_offset_left + (current_index / max_index) * 
                (plot_width - obj_plot_offset_right - obj_plot_offset_left);

            const label = objects[i]["label"];
            let j = 0;
            for (;j < obj_classes.length; ++j) {
                if (label == obj_classes[j]["index"]) { break; }
            } 
            const y = plot_height - obj_plot_offset_y - (j / obj_classes.length) * 
                (plot_height - obj_plot_offset_y * 2);

            ctx.fillStyle = window.EMPHASIS_COLOR;
            let dot_radius = window.EMPHASIS_RADIUS;
            fill_circle(ctx, {x: x, y: y}, dot_radius);
        }
    }

    //update vertical line position
    plot_marker(current_index, window.objs["maxTime"], obj_plot_offset_left, 
        obj_plot_offset_right, obj_plot_offset_y, window.EMPHASIS_COLOR, 1, obj_plot);
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
        let video = document.getElementById("video");
        let x_draw_ratio = video.offsetWidth / video.width;
        let y_draw_ratio = video.offsetHeight / video.height;
        console.log(bb);

        window.crop_top_left.x = bb[0] * x_draw_ratio;
        window.crop_top_left.y = bb[1] * y_draw_ratio;
        window.crop_bot_right.x = bb[2] * x_draw_ratio;
        window.crop_bot_right.y = bb[3] * y_draw_ratio;

        //toggle cropping
        window.is_crop_visible = true;
        document.getElementById("crop").style.display = "block";
        document.getElementById("crop_label").style.display = "block";

        //draw the cropped area (calls drao from crop_script)
        update_video(window.current_frame.src);
    }
    //drawCropped();
});

toggle_obj.addEventListener("click", () => {
    let x = document.getElementById("obj_div");
    if (x.style.display === "none") {
        x.style.display = "block";
        toggle_obj.value = "▼ Detected objects";

        let obj_plot = document.getElementById("obj_plot");
        obj_plot.style.display = "block";
        obj_plot.width = obj_plot.offsetWidth;
        obj_plot.height = obj_plot.width * 0.7;
        
        plot_objects(window.current_index);
    } else {
        x.style.display = "none";
        toggle_obj.value = "▲ Detected objects";
    }
});

object_detection_button.addEventListener('click', async () => {
    //when reorganizing the detection's array, it is assumed that the detections are 
    //ordrered in terms of timestamp
    try {
        const response = await fetch(`${server_url}/video/objects/${window.current_video}`);
        const body = await response.json();
        let results = body["result"];

        console.log(results);

        let classes = [];
        //organizing the final array by timestamp
        let objects = [];
        //objects found in a single timestamp
        let object = [];

        if (results.length <= 0) { return; }
        let frame = results[0]["frame"];
        for (let i = 0;i < results.length;++i) {
            //keep tabs on the timestamp
            if (results[i]["frame"] != frame) {
                objects[frame] = object;
                frame = results[i]["frame"];
                object = [];
            }

            //keep tabs on the classes pool (no repetition)
            let found = false;
            for (let j = 0;j < classes.length;++j) {
                if (results[i]["class"] == classes[j]["index"]) {
                    found = true;
                    break;
                } 
            }
            if (!found) {
                classes.push({"index": results[i]["class"], "label": results[i]["name"]});
            }

            //save bounding box, timestamp and class number
            object.push({
                "min_x": results[i]["xmin"], 
                "min_y": results[i]["ymin"], 
                "max_x": results[i]["xmax"], 
                "max_y": results[i]["ymax"],
                "label": results[i]["class"],
                "frame": results[i]["frame"]
            });
        }

        window.objs = {"results": objects, "classes": classes, "maxTime": body["frames"]};
        console.log(window.objs);

        //show button for toggling obj chart
        toggle_obj.style.display = "block";

        update_scores(window.current_index);
    }
    catch (error) {
        console.error("Error detecting objects: ", error);
    }
});
