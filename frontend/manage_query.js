const delete_parent_onclick = (event) => {
    event.target.parentNode.remove();
}

const add_qualificator_onclick = (event, qualificator_type) => {
    let new_element = document.createElement("div");
    event.target.after(new_element);
    new_element.classList.add("qualificator_container", "button_space", "col-sm");

    let new_text_input = document.createElement("input");
    new_text_input.type = "text";
    new_text_input.placeholder = (qualificator_type == "adj_sbj")? "little" :
        (qualificator_type == "adv")? "happily" : "red";
    new_text_input.maxLength = 50;
    new_text_input.classList.add(qualificator_type, "adaptable", "form-control", "row");
    new_element.appendChild(new_text_input);

    let new_delete_button = document.createElement("input");
    new_delete_button.type = "button";
    new_delete_button.value = "x";
    new_delete_button.classList.add("exit_button");
    new_delete_button.addEventListener("click", delete_parent_onclick);
    new_element.appendChild(new_delete_button);
};

document.querySelectorAll(".add_adj_sbj").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_sbj"));
});

document.querySelectorAll(".add_adv").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adv"));
});

document.querySelectorAll(".add_adj_obj").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_obj"));
});

/**
 * helper function, appends a simple sentence structure to the composite_query div element
 * along with every listener needed for adding qualificators
 * @param {*} composite_query div element 
 */
let add_new_sentence = (composite_query) => {
    let new_sentence = document.createElement("div");
    new_sentence.classList.add("sentence", "row", "x_adaptable");

    let plus_adj_sbj_button = document.createElement("input")
    plus_adj_sbj_button.type = "button";
    plus_adj_sbj_button.value = "+adj";
    plus_adj_sbj_button.classList.add("add_adj_sbj", "col-1", "button_space", "btn", "btn-outline-info")
    plus_adj_sbj_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_sbj"));

    let new_subject = document.createElement("input");
    new_subject.type = "text";
    new_subject.placeholder = "e.g. kid";
    new_subject.maxLength = 50;
    new_subject.classList.add("subject", "col-sm", "form-control");

    let plus_adv_button = document.createElement("input")
    plus_adv_button.type = "button";
    plus_adv_button.value = "+adv";
    plus_adv_button.classList.add("add_adv", "col-1", "button_space", "btn", "btn-outline-warning")
    plus_adv_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adv"));

    let new_action = document.createElement("input");
    new_action.type = "text";
    new_action.placeholder = "e.g. kid";
    new_action.maxLength = 50;
    new_action.classList.add("action", "col-sm", "form-control");

    let plus_adj_obj_button = document.createElement("input")
    plus_adj_obj_button.type = "button";
    plus_adj_obj_button.value = "+adj";
    plus_adj_obj_button.classList.add("add_adj_obj", "col-1", "button_space", "btn", "btn-outline-info")
    plus_adj_obj_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_obj"));

    let new_object = document.createElement("input");
    new_object.type = "text";
    new_object.placeholder = "e.g. kid";
    new_object.maxLength = 50;
    new_object.classList.add("object", "col-sm", "form-control");
    
    new_sentence.appendChild(plus_adj_sbj_button);
    new_sentence.appendChild(new_subject);
    new_sentence.appendChild(plus_adv_button);
    new_sentence.appendChild(new_action);
    new_sentence.appendChild(plus_adj_obj_button);
    new_sentence.appendChild(new_object);

    composite_query.appendChild(new_sentence);
};

let remove_sentence = (event) => {
    let node = event.target;
}

let add_sentence_reset_button = (composite_query) => {
    let reset_button = document.createElement("input");
    reset_button.type = "button";
    reset_button.value = "reset";
    reset_button.classList.add("btn", "btn-outline-danger");
    reset_button.addEventListener("click", remove_sentence);

    composite_query.appendChild(reset_button);
};

/**
 * helper function, triggers recursivity through onclick listeners
 * appends as a child an operators button list to the composite query div element
 * adds to each operator button (or/and/minus) an event listener that calls 
 * apply_bool_operation, which basically adds a new list of button and
 * simple query sentence and hides in the current list the other buttons that 
 * werent clicked
 * @param {*} composite_query div element
 */
let add_bool_operators = (composite_query) => {
    let new_operators_list = document.createElement("div");
    new_operators_list.classList.add("connector", "row", "justify-content-center", "x_adaptable");

    let blank_space1 = document.createElement("div");
    blank_space1.classList.add("col-sm");

    let or_button = document.createElement("input");
    or_button.type = "button";
    or_button.value = "OR";
    or_button.classList.add("or", "btn", "btn-info", "col-1", "button_space");
    or_button.addEventListener("click", apply_boolean_operator);

    let and_button = document.createElement("input");
    and_button.type = "button";
    and_button.value = "AND";
    and_button.classList.add("and", "btn", "btn-info", "col-1", "button_space");
    and_button.addEventListener("click", apply_boolean_operator);

    let minus_button = document.createElement("input");
    minus_button.type = "button";
    minus_button.value = "W/O";
    minus_button.classList.add("minus", "btn", "btn-info", "col-1", "button_space");
    minus_button.addEventListener("click", apply_boolean_operator);

    let blank_space2 = document.createElement("div");
    blank_space2.classList.add("col-sm");

    new_operators_list.appendChild(blank_space1);
    new_operators_list.appendChild(or_button);
    new_operators_list.appendChild(and_button);
    new_operators_list.appendChild(minus_button);
    new_operators_list.appendChild(blank_space2);

    composite_query.appendChild(new_operators_list);
};

/**
 * hide every sibling element (same parent element)
 * @param {*} event assumed to be onclick target, used to recover the current element
 */
let hide_all_but_me = (event) => {
    let node = event.target;
    let parent = node.parentNode;
    parent.querySelectorAll("*").forEach(element => {
        if (element !== node) { 
            element.style.display = "none";
        }
    });
};

/**
 * show every sibling element (same parent element)
 * @param {*} event assumed to be onclick target, used to recover the current element
 */
let show_all_my_bros = (event) => {
    let node = event.target;
    let parent = node.parentNode;
    parent.querySelectorAll("*").forEach(element => {
        if (element !== node) { 
            element.style.display = "block";
        }
    });
}

let modify_boolean_operator_onclick = (event) => {
    let node = event.target;
    let parent = node.parentNode;

    let children = parent.querySelectorAll("*");

    let sibling = (children[0] == node)? children[1] : children[0];
    if (sibling.style.display == "none") { show_all_my_bros(event); }
    else if (sibling.style.display == "block") { hide_all_but_me(event); } 
}

/**
 * used by operators buttons (or/and/minus), hides every other operator
 * and add a new sentence with a new set of button that will have the *
 * same function as an onclick event
 * then remove initial onlick functionality and add modification of 
 * bool operation
 * @param {*} event 
 */
let apply_boolean_operator = (event) => {
    //initial hide all but currently pressed operator
    hide_all_but_me(event);

    //append new query line (sentence + new set of operators)
    let composite_query = document.getElementById("composite_text_query");
    add_new_sentence(composite_query);
    add_bool_operators(composite_query);

    //remove the ability to add new operators from current operators
    // and replace with operator modification process
    let node = event.target;
    let parent = node.parentNode;
    parent.querySelectorAll("*").forEach(element => {
        element.removeEventListener("click", apply_boolean_operator);
        element.addEventListener("click", modify_boolean_operator_onclick);
    });
}

//initial onclick or/and/minus
document.querySelectorAll(".or").forEach(element => {
    element.addEventListener("click", apply_boolean_operator);
});

document.querySelectorAll(".and").forEach(element => {
    element.addEventListener("click", apply_boolean_operator);
});

document.querySelectorAll(".minus").forEach(element => {
    element.addEventListener("click", apply_boolean_operator);
});

/**
 * connect the query elements (sub, action, obj) in a CLIP understandable manner
 * @todo consider several queries and combine
 * @returns processed string query
 */
const process_query = () => {
    const subject_input = document.getElementsByClassName("subject");
    const action_input = document.getElementsByClassName("action");
    const object_input = document.getElementsByClassName("object");

    let subject_str = "";
    let object_str = "";
    let action_str = "";
    
    document.querySelectorAll(".adj_sbj").forEach(element => {
        subject_str += element.value + " ";
    });
    document.querySelectorAll(".adj_obj").forEach(element => {
        object_str += element.value + " ";
    });
    document.querySelectorAll(".adv").forEach(element => {
        action_str += element.value + " ";
    });

    subject_str += subject_input[0].value;
    object_str += object_input[0].value;
    action_str += action_input[0].value;

    if (action_str  == "") {
        if (subject_str == "") {
            //empty query remains empty
            if (object_str == "") {
                return "";
            }
            else {
                //add "a photo of" due to CLIP specificities
                return "a photo of " + object_str;
            }
        }
        else {
            if (object_str == "") {
                return "a photo of " + subject_str;
            }
            else {
                return "a photo of " + subject_str +
                    " and " + object_str;
            }
        }
    }
    else {
        if (subject_str == "") {
            if (object_str == "") {
                //add subject to the action, something being the most general
                //perhaps condition it to the verb or send several and link
                //with "and/or" from server side
                return "something " + action_str;
            }
            else {
                return action_str + " " + object_str;
            }
        }
        else {
            return subject_str + " " + action_str + " " + object_str;
        }
    }
};

//Text-based search, expecting an array of scores plus a reduction array from the server
text_search_button.addEventListener('click', async () => {
    try {
        let score_plot_loader = document.getElementById("score_plot_loader");
        let reduction_plot_loader = document.getElementById("reduction_plot_loader");
        score_plot_loader.style.display = "block";
        reduction_plot_loader.style.display = "block";

        let score_plot = document.getElementById("score_plot");
        const processed_query = process_query(); 
        if (process_query == "") { return; }
        console.log("query: ", processed_query);

        //request similarity scores from the server
        const response = await fetch(`${server_url}/search?query=${processed_query}`);
        const body = await response.json();

        console.log(body);

        //only keep scores and tsne reduction values
        window.scores = body['scores'].map(function(value,index) { return value[1]; });

        window.tsne_reduction = body['tsne'];
        window.pca_reduction = body['pca'];
        window.umap_reduction = body['umap'];

        window.tsne_clusters = body['tsne_clusters'];
        window.pca_clusters = body['pca_clusters'];
        window.umap_clusters = body['umap_clusters'];
        
        let tsne_cluster_frames = [];
        let pca_cluster_frames = [];
        let umap_cluster_frames = [];

        //fetching frames corresponding to each cluster's centroid for each reduction algorithm
        let cluster_frames = body['tsne_cluster_frames'];
        for(let i = 0;i < cluster_frames.length;++i) {
            let name_processed = window.current_video.split(".")[0]; 
            const cf_response = await fetch(
                `${server_url}/image/${name_processed}/${cluster_frames[i]["centroid"]}.png`
            );
            const cf_blob = await cf_response.blob();
            const cf_url = URL.createObjectURL(cf_blob);

            tsne_cluster_frames.push([cluster_frames[i]["centroid"], cf_url]);
        }

        cluster_frames = body['pca_cluster_frames'];
        for(let i = 0;i < cluster_frames.length;++i) {
            let name_processed = window.current_video.split(".")[0]; 
            const cf_response = await fetch(
                `${server_url}/image/${name_processed}/${cluster_frames[i]["centroid"]}.png`
            );
            const cf_blob = await cf_response.blob();
            const cf_url = URL.createObjectURL(cf_blob);

            pca_cluster_frames.push([cluster_frames[i]["centroid"], cf_url]);
        }

        cluster_frames = body['umap_cluster_frames'];
        for(let i = 0;i < cluster_frames.length;++i) {
            let name_processed = window.current_video.split(".")[0]; 
            const cf_response = await fetch(
                `${server_url}/image/${name_processed}/${cluster_frames[i]["centroid"]}.png`
            );
            const cf_blob = await cf_response.blob();
            const cf_url = URL.createObjectURL(cf_blob);

            umap_cluster_frames.push([cluster_frames[i]["centroid"], cf_url]);
        }

        window.tsne_cluster_frames = tsne_cluster_frames;
        window.pca_cluster_frames = pca_cluster_frames;
        window.umap_cluster_frames = umap_cluster_frames;

        //set default displayed reduction algorithm
        window.displayed_reduction = window.tsne_reduction;
        window.displayed_reduction = window.tsne_reduction;
        
        //adjust the max value
        window.max_index = window.scores.length;

        //fetching first video frame
        let name_processed = window.current_video.split(".")[0]; 
        const imgresponse = await fetch(
            `${server_url}/image/${name_processed}/${window.current_index}.png`
        );
        const blob = await imgresponse.blob();
        const image_url = URL.createObjectURL(blob);
        window.current_frame.src = image_url

        //update component
        update_video(window.current_frame.src);

        //show buttons for toggling scores/reduction
        toggle_scores.style.display = "block";
        toggle_reduction.style.display = "block";
        score_plot.addEventListener("click", (event) => update_frame_index_onclick(score_plot, 
            score_plot_offset_left, score_plot_offset_right, score_plot_offset_y, window.max_index, event));

        //update the curve plot
        update_scores(window.current_index);

        score_plot_loader.style.display = "none";
        reduction_plot_loader.style.display = "none";
    } 
    catch (error) {
        console.error("Error loading similarity scores: ", error);
    }
});
