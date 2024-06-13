/************************/
/*variables declaration*/
/************************/

//document components
let text_search_button = document.getElementById("text_search_button");
let image_search_buttonmage = document.getElementById("image_search_button");
let object_detection_button = document.getElementById("object_detection_button");
let depthEstimate = document.getElementById("depthmap_computation_button");

let toggle_obj = document.getElementById("toggle_obj");
let toggle_scores = document.getElementById("toggle_scores");
let toggle_reduction = document.getElementById("toggle_reduction");
let toggle_depth = document.getElementById("toggle_depth");
let toggle_crop = document.getElementById("toggle_crop");

//hiding canvas and buttons at first
document.getElementById("obj_div").style.display = "none";
document.getElementById("score_div").style.display = "none";
document.getElementById("tsne_div").style.display = "none";
document.getElementById("depth_div").style.display = "none";
document.getElementById("crop").style.display = "none";
document.getElementById("crop_label").style.display = "none";
toggle_obj.style.display = "none";
toggle_scores.style.display = "none";
toggle_reduction.style.display = "none";
toggle_depth.style.display = "none";

const server_url = 'http://localhost:8000';
/*********************/
/*methods declaration*/
/*********************/

/**
 * @param {*} p1 2d point cootdinates 
 * @param {*} p2 another 2d point cootdinates 
 * @returns euclidian distance (power 2)
 */
let length2 = (p1, p2) => {
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

/**
 * utility function to draw a dot in a canvas
 * @param {*} ctx canvas context
 * @param {*} point coordinates (dot center)
 * @param {*} radius dot radius
 */
let fill_circle = (ctx, point, radius) => {
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius, radius, 0, 0, 2 * Math.PI);
    ctx.fill();
}

/**
 * utility function to draw a vertical line in a 2d plot inside a canvas
 * @param {*} current_index logical x coordinate of the marker, corresponds to the current frame number (video frame) in this usecase
 * @param {*} max maximum value in the x axis, corresponds to the number of frame in the video in this usecase
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} color color of the line marker
 * @param {*} line_width line width of the line marker
 * @param {*} svg canvas where the line is drawn
 */
let plot_marker = (current_index, max, offset_left, offset_right, offset_y, color, line_width, svg) => {
    let plot_width = svg.width;
    let plot_height = svg.height;
    let ctx = svg.getContext("2d");
    let x = offset_left + (current_index / (max - 1)) * (plot_width - offset_left - offset_right);
    
    ctx.beginPath();
    ctx.moveTo(x, offset_y);
    ctx.lineTo(x, plot_height - offset_y);
    ctx.strokeStyle = color;
    ctx.lineWidth = line_width;
    ctx.stroke();
};

/**
 * utility function to draw the x/y axes of a 2D plot in a canvas
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} svg canvas where the axes are drawn
 */
let plot_axes = (offset_left, offset_right, offset_y, svg) => {
    let lenX = svg.width;
    let lenY = svg.height;
    let ctx = svg.getContext("2d");

    //draw x axis
    ctx.beginPath();
    ctx.moveTo(offset_left, lenY - offset_y);
    ctx.lineTo(lenX - offset_right, lenY - offset_y);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();

    //draw arrow at the end of the x axis
    ctx.beginPath();
    ctx.moveTo(lenX - offset_right, lenY - offset_y);
    ctx.lineTo(lenX - offset_right - 5, lenY - offset_y + 5);
    ctx.lineTo(lenX - offset_right - 5, lenY - offset_y - 5);
    ctx.closePath();
    ctx.fillStyle = "black";
    ctx.fill();

    //draw y axis
    ctx.beginPath();
    ctx.moveTo(offset_left, offset_y);
    ctx.lineTo(offset_left, lenY - offset_y);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.stroke();

    //draw arrow at the end of the y axis
    ctx.beginPath();
    ctx.moveTo(offset_left, offset_y);
    ctx.lineTo(offset_left + 5, offset_y + 5);
    ctx.lineTo(offset_left - 5, offset_y + 5);
    ctx.closePath();
    ctx.fillStyle = "black";
    ctx.fill();
    ctx.stroke();
};

/**
 * draw video frame in the dedicated video canvas
 * @param {*} image_url video's current frame
 */
let update_video = (image_url) => {
    // Set the image source to the created URL
    window.current_frame.src = image_url;

    // Wait for the image to load
    window.current_frame.onload = () => {
        // Access the width and height properties
        const width = window.current_frame.width;
        const height = window.current_frame.height;

        // Get the canvas element
        const canvas = document.getElementById("video");
        const ctx = canvas.getContext("2d");

        // Set canvas dimensions to match the image
        canvas.width = width;
        canvas.height = height;

        // Clear any previous content on the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the image onto the canvas
        ctx.drawImage(window.current_frame, 0, 0, width, height);

        if (window.is_crop_visible) { draw_cropped(); }
    };
}

/**
 * this function is called to update all data visualisation components
 * @param {*} frame_index currently visualised video frame's index
 */
let update_scores = (frame_index) => {
    if (window.current_index != frame_index) { window.current_index = frame_index; }
    // Update plot
    plot_timeline(frame_index, window.max_index, window.fps);
    plot_objects(frame_index);
    plot_score_curve(frame_index);
    plot_tsne_reduction(frame_index);
    update_depth_video(frame_index);
    //TODO update other plots or frames later (possible in here)
};

/***********/
/*Listeners*/
/***********/

/**
 * debouce prevents function call before the delay passes, used to offload mousemove calls
 * @param {*} func  function to be debounced
 * @param {*} delay ms unit 
 * @returns debounced function reference
 */
let debounce = (func, delay) => {
    let timeout_id;
    return (...args) => {
        if (timeout_id) {
            clearTimeout(timeout_id);
        }
        timeout_id = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

//resize listener has to addapt the sizes of each component that has height as a function of width
window.addEventListener("resize", () => {
    //update components' relative sizes
    let score_plot = document.getElementById("score_plot");
    score_plot.width = score_plot.offsetWidth;
    score_plot.height = score_plot.width * 0.5;

    let tsne_plot = document.getElementById("reduction_plot");
    tsne_plot.width = tsne_plot.offsetWidth;
    tsne_plot.height = tsne_plot.width;

    let obj_plot = document.getElementById("obj_plot");
    obj_plot.width = obj_plot.offsetWidth;
    obj_plot.height = obj_plot.width * 0.7;

    let timeline = document.getElementById("timeline");
    timeline.width = timeline.offsetWidth;
    timeline.height = timeline.offsetHeight;

    //redraw everything
    update_video(window.current_frame.src);
    update_scores(window.current_index);
});

/**
 * onClick method used in canvas with a drawn 2D plot/curve. It updates the current frame
 * index based on the logical x axis value
 * @param {*} svg canvas where the plot/curve is drawn
 * @param {*} offset_left left offset to the beginning of the plot in the canvas (px unit)
 * @param {*} offset_right right offset to the end of the plot in the canvas (px unit)
 * @param {*} offset_y top and bottom offsets to the plot in the canvas (px unit)
 * @param {*} nb_values maximum value in the x axis, corresponds to the number of frame in the video in this usecase
 * @param {*} event captures the coordinates of the click 
 */
let update_frame_index_onclick = async (svg, offset_left, offset_right, offset_y, nb_values, event) => {
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    let plot_width = svg.width;
    let plot_height = svg.height;

    //case clicked on the offset
    if (offset_y > mouseY || mouseY > plot_height - offset_y) { return; }
    if (offset_left > mouseX || mouseX > plot_width - offset_right) { return; }

    try {
        let frame_index = Math.trunc((mouseX - offset_left) / (plot_width - offset_right - offset_left) * (nb_values - 1));

        //fetch current frame
        let name_processed = window.current_video.split(".")[0]; 
        const response = await fetch(`${server_url}/image/${name_processed}/${frame_index}.png`);
        const blob = await response.blob();
        const image_url = URL.createObjectURL(blob);
    
        window.current_frame.src = image_url;
        update_video(window.current_frame.src);
        update_scores(frame_index);
    }
    catch (error) {
        console.error("Error getting frame ", frame_index, " of the video: ", error);
    }
    
}

toggle_crop.addEventListener("click", () => {
    let crop = document.getElementById("crop");
    let crop_label = document.getElementById("crop_label");
    if (window.is_crop_visible == false) {
        window.is_crop_visible = true;
        crop.style.display = "block";
        crop_label.style.display = "block";
        update_video(window.current_frame.src);
    } 
    else {
        window.is_crop_visible = false;
        crop.style.display = "none";
        crop_label.style.display = "none";
        update_video(window.current_frame.src);
    }
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

toggle_scores.addEventListener("click", () => {
    let x = document.getElementById("score_div");
    if (x.style.display === "none") {
        x.style.display = "block";
        toggle_scores.value = "▼ Similarity scores chart";

        let score_plot = document.getElementById("score_plot");
        score_plot.style.display = "block";
        score_plot.width = score_plot.offsetWidth;
        score_plot.height = score_plot.width * 0.5;

        plot_score_curve(window.current_index);
    } else {
        x.style.display = "none";
        toggle_scores.value = "▲ Similarity scores chart";
    }
});

toggle_reduction.addEventListener("click", () => {
    let x = document.getElementById("tsne_div");
    if (x.style.display === "none") {
        x.style.display = "block";
        toggle_reduction.value = "▼ Video embeddings scatter plot in reduced embedding space";

        let tsne_plot = document.getElementById("reduction_plot");
        tsne_plot.style.display = "block";
        tsne_plot.width = tsne_plot.offsetWidth;
        tsne_plot.height = tsne_plot.width;

        plot_tsne_reduction(window.current_index);
    } else {
        x.style.display = "none";
        toggle_reduction.value = "▲ Video embeddings scatter plot in reduced embedding space";
    }
});

toggle_depth.addEventListener("click", async () => {
    let depth_div = document.getElementById("depth_div");
    if (depth_div.style.display == "none") {
        depth_div.style.display = "block";
        toggle_depth.value = "▼ Depth map";
        try {
            await update_depth_video(window.current_index);
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

//Text-based search, expecting an array of scores plus a reduction array from the server
text_search_button.addEventListener('click', async () => {
    try {
        let score_plot = document.getElementById("score_plot");

        //query input
        let inputValue = document.getElementById("query_input").value;

        //request similarity scores from the server
        const response = await fetch(`${server_url}/search?query=${inputValue}`);
        const body = await response.json();

        //only keep scores and tsne reduction values
        window.scores = body['scores'].map(function(value,index) { return value[1]; });

        window.tsne_reduction = body['tsne'];
        window.pca_reduction = body['pca'];
        window.umap_reduction = body['umap'];

        window.tsne_clusters = body['tsne_clusters'];
        window.pca_clusters = body['pca_clusters'];
        window.umap_clusters = body['umap_clusters'];
        
        window.displayed_reduction = window.tsne_reduction;

        console.log(body);

        //adjust the max value
        window.max_index = window.scores.length;
        
        let name_processed = window.current_video.split(".")[0]; 
        const imgresponse = await fetch(`${server_url}/image/${name_processed}/${window.current_index}.png`);
        const blob = await imgresponse.blob();
        const image_url = URL.createObjectURL(blob);
        window.current_frame.src = image_url

        //update component
        update_video(window.current_frame.src);

        //show buttons for toggling scores/reduction
        toggle_scores.style.display = "block";
        toggle_reduction.style.display = "block";
        score_plot.addEventListener("click", (event) => update_frame_index_onclick(score_plot, 
                                                        score_plot_offset_left,
                                                        score_plot_offset_right,
                                                        score_plot_offset_y,
                                                        window.max_index,
                                                        event));

        //update the curve plot
        update_scores(window.current_index);
    } 
    catch (error) {
        console.error("Error loading similarity scores: ", error);
    }
});

//Image-based search, needs the cropped image to be defined (hover over the 
//video) and expecting an array of window.scores plus a reduction array from the server
image_search_button.addEventListener('click', async () => {
    try {
        let score_plot = document.getElementById("score_plot");
        
        const dataURL = cropped.toDataURL('image/png');
        const response = await fetch(`${server_url}/upload_png/`, 
            {method: 'POST', body: JSON.stringify({ image_data: dataURL }), 
            headers: {'Content-Type': 'application/json'}});
        const body = await response.json();

        //only keep window.scores and tsne reduction values
        window.scores = body['scores'].map(function(value,index) { return value[1]; });

        window.tsne_reduction = body['tsne'];
        window.pca_reduction = body['pca'];
        window.umap_reduction = body['umap'];

        window.tsne_clusters = body['tsne_clusters'];
        window.pca_clusters = body['pca_clusters'];
        window.umap_clusters = body['umap_clusters'];

        window.displayed_reduction = window.tsne_reduction;

        console.log(body);
        
        //request to update the image
        let name_processed = window.current_video.split(".")[0]; 
        const imgresponse = await fetch(`${server_url}/image/${name_processed}/${window.current_index}.png`);
        const blob = await imgresponse.blob();
        const image_url = URL.createObjectURL(blob);

        window.current_frame.src = image_url;
        //update component
        update_video(window.current_frame);

        //show buttons for toggling window.scores/reduction
        toggle_scores.style.display = "block";
        toggle_reduction.style.display = "block";
        score_plot.addEventListener("click", (event) => update_frame_index_onclick(score_plot, 
                                                            score_plot_offset_left,
                                                            score_plot_offset_right,
                                                            score_plot_offset_y,
                                                            window.max_index,
                                                            event));

        //update the curve plot
        update_scores(window.current_index);
    }
    catch (error) {
        console.error("Error loading similarity window.scores: ", error);
    }
});

object_detection_button.addEventListener('click', async () => {
    //when reorganizing the detection's array, it is assumed that the detections are 
    //ordrered in terms of timestamp
    try {
        const response = await fetch(`${server_url}/video/objects/${window.current_video}`);
        const body = await response.json();
        let results = body["result"];

        let classes = [];
        //organizing the final array by timestamp
        let objects = [];
        //objects found in a single timestamp
        let object = [];

        let timestamp = 0.0;
        for (let i = 0;i < results.length;++i) {
            //keep tabs on the timestamp
            if (results[i]["timestamp"] != timestamp) {
                objects[timestamp] = object;
                timestamp = results[i]["timestamp"];
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
                "timestamp": results[i]["timestamp"]
            });
        }

        window.objs = {"results": objects, "classes": classes, "maxTime": body["frames"]};
        console.log(window.objs);

        //show button for toggling obj chart
        toggle_obj.style.display = "block";
        //obj_plot.addEventListener("click", (event) => update_frame_index_onclick(obj_plot, score_plotOffsetLeft, score_plotOffsetRight, score_plotOffsetY, window.max_index, event));

        update_scores(window.current_index);
    }
    catch (error) {
        console.error("Error detecting objects: ", error);
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
