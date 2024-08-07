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
    plus_adj_sbj_button.classList.add("add_adj_sbj", "col-1", "button_space", "btn", "btn-outline-secondary")
    plus_adj_sbj_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_sbj"));

    let new_subject = document.createElement("input");
    new_subject.type = "text";
    new_subject.placeholder = "subject";
    new_subject.maxLength = 50;
    new_subject.classList.add("subject", "col-sm", "form-control");

    let plus_adv_button = document.createElement("input")
    plus_adv_button.type = "button";
    plus_adv_button.value = "+adv";
    plus_adv_button.classList.add("add_adv", "col-1", "button_space", "btn", "btn-outline-secondary")
    plus_adv_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adv"));

    let new_action = document.createElement("input");
    new_action.type = "text";
    new_action.placeholder = "action";
    new_action.maxLength = 50;
    new_action.classList.add("action", "col-sm", "form-control");

    let plus_adj_obj_button = document.createElement("input")
    plus_adj_obj_button.type = "button";
    plus_adj_obj_button.value = "+adj";
    plus_adj_obj_button.classList.add("add_adj_obj", "col-1", "button_space", "btn", "btn-outline-secondary")
    plus_adj_obj_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_obj"));

    let new_object = document.createElement("input");
    new_object.type = "text";
    new_object.placeholder = "object";
    new_object.maxLength = 50;
    new_object.classList.add("object", "col-sm", "form-control");

    let new_threshold_button = document.createElement("input");
    new_threshold_button.type = "button";
    new_threshold_button.value = "scores>80%";
    new_threshold_button.classList.add("threshold_button", "col-sm", "button_space", "btn", "btn-secondary");
    new_threshold_button.style.display = "none";

    let new_box_selection_button = document.createElement("input");
    new_box_selection_button.type = "button";
    new_box_selection_button.value = "box(0,0,0,0)";
    new_box_selection_button.classList.add("box_selection_button", "col-sm", "button_space", "btn", "btn-secondary");
    new_box_selection_button.style.display = "none";
    
    new_sentence.appendChild(plus_adj_sbj_button);
    new_sentence.appendChild(new_subject);
    new_sentence.appendChild(plus_adv_button);
    new_sentence.appendChild(new_action);
    new_sentence.appendChild(plus_adj_obj_button);
    new_sentence.appendChild(new_object);
    new_sentence.appendChild(new_threshold_button);
    new_sentence.appendChild(new_box_selection_button);

    composite_query.appendChild(new_sentence);
};

/**
 * removes the bool operator line that was clicked and the sentence before it
 * @param {*} event assumed to be onclick event
 */
let remove_sentence = (event) => {
    let parent = event.target.parentNode;
    let sentence = parent.previousSibling;
    parent.remove();
    sentence.remove();
}

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
                    
    let display_button = document.createElement("input");
    display_button.type = "button";
    display_button.value = "show";
    display_button.style.display = "none";
    display_button.classList.add("utils", "btn", "btn-sm", "btn-outline-success", "col-1", "button_space");

    let or_button = document.createElement("input");
    or_button.type = "button";
    or_button.value = "OR";
    or_button.classList.add("bool_op", "or", "btn", "btn-sm", "btn-secondary", "col-1", "button_space");
    or_button.addEventListener("click", apply_boolean_operator);

    let and_button = document.createElement("input");
    and_button.type = "button";
    and_button.value = "AND";
    and_button.classList.add("bool_op", "and", "btn", "btn-sm", "btn-secondary", "col-1", "button_space");
    and_button.addEventListener("click", apply_boolean_operator);

    let minus_button = document.createElement("input");
    minus_button.type = "button";
    minus_button.value = "W/O";
    minus_button.classList.add("bool_op", "minus", "btn", "btn-sm", "btn-secondary", "col-1", "button_space");
    minus_button.addEventListener("click", apply_boolean_operator);

    let delete_button = document.createElement("input");
    delete_button.type = "button";
    delete_button.value = "delete";
    delete_button.style.display = "none";
    delete_button.classList.add("utils", "btn", "btn-sm", "btn-outline-danger", "col-1", "button_space");
    delete_button.addEventListener("click", remove_sentence);

    new_operators_list.appendChild(display_button);
    new_operators_list.appendChild(or_button);
    new_operators_list.appendChild(and_button);
    new_operators_list.appendChild(minus_button);
    new_operators_list.appendChild(delete_button);

    composite_query.appendChild(new_operators_list);
};

/**
 * hide every sibling element (same parent element)
 * @param {*} event assumed to be onclick target, used to recover the current element
 */
let hide_all_but_me = (event) => {
    let node = event.target;
    let parent = node.parentNode;
    parent.querySelectorAll(".bool_op").forEach(element => {
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
    parent.querySelectorAll(".bool_op").forEach(element => {
        element.style.display = "block";
    });
}

let modify_boolean_operator_onclick = (event) => {
    let node = event.target;
    let parent = node.parentNode;

    let bool_children = parent.querySelectorAll(".bool_op");
    let utils_children = parent.querySelectorAll(".utils");

    let sibling = (bool_children[0] == node)? bool_children[1] : bool_children[0];
    if (sibling.style.display == "none") { 
        show_all_my_bros(event);
        utils_children.forEach((element) => {
            element.style.display = "none";
        })
    }
    else if (sibling.style.display == "block") { 
        hide_all_but_me(event);
        utils_children.forEach((element) => {
            element.style.display = "block";
        })
    } 
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
    event.target.parentNode.querySelectorAll(".utils").forEach((element) => {
        element.style.display = "block";
    });

    //append new query line (sentence + new set of operators)
    let composite_query = document.getElementById("composite_text_query");
    add_new_sentence(composite_query);
    add_bool_operators(composite_query);

    //push search button to the end of the list (bottom of the element space)
    let text_search_button = document.getElementById("text_search_button").parentNode;
    composite_query.appendChild(text_search_button);

    //remove the ability to add new operators from current operators
    // and replace with operator modification process
    let node = event.target;
    let parent = node.parentNode;
    parent.querySelectorAll(".bool_op").forEach(element => {
        element.removeEventListener("click", apply_boolean_operator);
        element.addEventListener("click", modify_boolean_operator_onclick);
    });
};

/**
 * connect the query elements (sub, action, obj) in a CLIP understandable manner
 * @todo consider several queries and combine
 * @returns processed string query
 */
const parse_query = (sentence_element) => {
    const subject_input = sentence_element.getElementsByClassName("subject");
    const action_input = sentence_element.getElementsByClassName("action");
    const object_input = sentence_element.getElementsByClassName("object");

    let subject_str = "";
    let object_str = "";
    let action_str = "";
    
    sentence_element.querySelectorAll(".adj_sbj").forEach(element => {
        subject_str += element.value + " ";
    });
    sentence_element.querySelectorAll(".adj_obj").forEach(element => {
        object_str += element.value + " ";
    });
    sentence_element.querySelectorAll(".adv").forEach(element => {
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

let display_threshold_onclick = async (event) => {
    const sentence = event.target.parentNode;
    const query = parse_query(sentence);
}

//Text-based search, expecting an array of scores plus a reduction array from the server
text_search_button.addEventListener('click', async () => {
    try {
        let score_plot_loader = document.getElementById("score_plot_loader");
        let reduction_plot_loader = document.getElementById("reduction_plot_loader");
        let general_loader = document.getElementById("general_loader");
        score_plot_loader.style.display = "block";
        reduction_plot_loader.style.display = "block";
        general_loader.style.display = "block";

        let score_plot = document.getElementById("score_plot");
        const composite_text_query = document.getElementById("composite_text_query");
        const sentence_element = composite_text_query.getElementsByClassName("sentence")[0];
        const processed_query = parse_query(sentence_element); 
        if (parse_query == "") { return; }
        console.log("query: ", processed_query);

        //request similarity scores from the server
        const response = await fetch(`${server_url}/search?query=${processed_query}`);
        let body = await response.json();

        console.log(body);

        //only keep scores and tsne reduction values
        window.scores = body['scores'].map(function(value,index) { return value[1]; });

        const embeds_response = await fetch(`${server_url}/video/embeddings/${window.current_video}`);
        body = await embeds_response.json();

        console.log(body);

        //adjust the max value
        window.max_index = window.scores.length;

        //update component
        update_video(window.current_frame.src);

        //show buttons for toggling scores/reduction
        toggle_scores.style.display = "block";
        score_plot.addEventListener("click", (event) => update_frame_index_onclick(score_plot, 
            score_plot_offset_left, score_plot_offset_right, score_plot_offset_y, window.max_index, event));

        //update the curve plot
        update_scores(window.current_index);

        score_plot_loader.style.display = "none";
        reduction_plot_loader.style.display = "none";
        general_loader.style.display = "none";
    } 
    catch (error) {
        console.error("Error loading similarity scores: ", error);
    }
});

let toggle_text_based_search = document.getElementById("toggle_text_based_search");
toggle_text_based_search.addEventListener("click", (event) => {
    let composite_text_query = document.getElementById("composite_text_query");
    if (composite_text_query.style.display == "block") {
        composite_text_query.style.display = "none";
        event.target.value = "▲ Perform text-based search";
    }
    else {
        composite_text_query.style.display = "block";
        event.target.value = "▼ Perform text-based search";
    }
});

let image_div = document.getElementById("image_query_div");
image_div.style.display = "none";
let toggle_image_based_search = document.getElementById("toggle_image_based_search");
toggle_image_based_search.addEventListener("click", (event) => {
    let image_div = document.getElementById("image_query_div");
    if (image_div.style.display == "block") {
        image_div.style.display = "none";
        event.target.value = "▲ Perform image-based search";
    }
    else {
        image_div.style.display = "block";
        event.target.value = "▼ Perform image-based search";
    }
});

//initial onclick or/and/minus
document.querySelectorAll(".bool_op").forEach(element => {
    element.addEventListener("click", apply_boolean_operator);
});

//initiale the first sentence elements
document.querySelectorAll(".add_adj_sbj").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_sbj"));
});

document.querySelectorAll(".add_adv").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adv"));
});

document.querySelectorAll(".add_adj_obj").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_obj"));
});

document.querySelectorAll(".threshold_button").forEach(element => {
    element.style.display = "none";
});

document.querySelectorAll(".box_selection_button").forEach(element => {
    element.style.display = "none";
});

document.querySelectorAll(".utils").forEach((element) => {
    element.style.display = "none";
});

document.querySelectorAll(".utils.btn-outline-danger").forEach((element) => {
    element.addEventListener("click", remove_sentence);
});