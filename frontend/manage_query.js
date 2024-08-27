const delete_parent_onclick = (event) => {
    event.target.parentNode.remove();
};

const focus_my_sentence_onclick = (event) => {
    try {
        // Locate the clicked sentence or its parent node that has the class 'sentence'
        const sentence = event.target.closest(".sentence");
        const composite_query = document.getElementById("composite_text_query");
        const all_sentences = composite_query.querySelectorAll(".sentence");

        for (let i = 0;i < all_sentences.length;++i) {
            if (sentence === all_sentences[i]) {
                window.focused_sentence = i;
                window.scores = window.all_scores[i];
                update_scores(window.current_index);
                console.log("sentence: ", window.focused_sentence);
                return;
            }
        } 
    }
    catch (error) {
        console.error("Error while recovering text areas for focus: ", error); 
    }
};

/**
 * onclick handler to inserts qualificator element (adjective or adverb) on the right 
 * of the clicked button
 * @param {*} event used to get the clicked element (assumed button)
 * @param {*} qualificator_type accepted values: adj_sbj, adj_obj, adv
 */
const add_qualificator_onclick = (event, qualificator_type) => {
    if (qualificator_type != "adv" && qualificator_type != "adj_sbj" && qualificator_type != "adj_obj") {
        console.error("Incorrect qualificator type. Accepted values: [adj_sbj, adj_obj, adv], ", 
            "you provided: ", qualificator_type);
        return;
    }

    try {
        let new_element = document.createElement("div");
        event.target.after(new_element);
        new_element.classList.add("qualificator_container", "button_space", "col-sm");

        let new_text_input = document.createElement("input");
        new_text_input.type = "text";
        new_text_input.placeholder = (qualificator_type == "adj_sbj")? "little" :
            (qualificator_type == "adv")? "happily" : "red";
        new_text_input.maxLength = 50;
        new_text_input.classList.add(qualificator_type, "adaptable", "form-control", "row");
        new_text_input.addEventListener("click", focus_my_sentence_onclick);
        new_element.appendChild(new_text_input);

        let new_delete_button = document.createElement("input");
        new_delete_button.type = "button";
        new_delete_button.value = "x";
        new_delete_button.classList.add("exit_button");
        new_delete_button.addEventListener("click", delete_parent_onclick);
        new_delete_button.addEventListener("click", focus_my_sentence_onclick);
        new_element.appendChild(new_delete_button);
    }
    catch(error) {
        console.error("Failed creating a new qualificator element: ", error);
    }
};

/**
 * helper function, appends a simple sentence structure to the composite_query div element
 * along with every listener needed for adding qualificators
 * @param {*} composite_query div element 
 */
const add_new_sentence = (composite_query) => {
    try {
        let new_sentence = document.createElement("div");
        new_sentence.classList.add("sentence", "row", "x_adaptable");

        let plus_adj_sbj_button = document.createElement("input")
        plus_adj_sbj_button.type = "button";
        plus_adj_sbj_button.value = "+adj";
        plus_adj_sbj_button.classList.add("add_adj_sbj", "col-1", "button_space", "btn", "btn-outline-info")
        plus_adj_sbj_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_sbj"));
        plus_adj_sbj_button.addEventListener("click", focus_my_sentence_onclick);

        let new_subject = document.createElement("input");
        new_subject.type = "text";
        new_subject.maxLength = 50;
        new_subject.classList.add("subject", "col-sm", "form-control");
        new_subject.addEventListener("click", focus_my_sentence_onclick);

        let plus_adv_button = document.createElement("input")
        plus_adv_button.type = "button";
        plus_adv_button.value = "+adv";
        plus_adv_button.classList.add("add_adv", "col-1", "button_space", "btn", "btn-outline-info")
        plus_adv_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adv"));
        plus_adv_button.addEventListener("click", focus_my_sentence_onclick);

        let new_action = document.createElement("input");
        new_action.type = "text";
        new_action.maxLength = 50;
        new_action.classList.add("action", "col-sm", "form-control");
        new_action.addEventListener("click", focus_my_sentence_onclick);

        let plus_adj_obj_button = document.createElement("input")
        plus_adj_obj_button.type = "button";
        plus_adj_obj_button.value = "+adj";
        plus_adj_obj_button.classList.add("add_adj_obj", "col-1", "button_space", "btn", "btn-outline-info")
        plus_adj_obj_button.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_obj"));
        plus_adj_obj_button.addEventListener("click", focus_my_sentence_onclick);

        let new_object = document.createElement("input");
        new_object.type = "text";
        new_object.maxLength = 50;
        new_object.classList.add("object", "col-sm", "form-control");
        new_object.addEventListener("click", focus_my_sentence_onclick);

        let new_threshold_button = document.createElement("input");
        new_threshold_button.type = "button";
        new_threshold_button.value = ">80%";
        new_threshold_button.classList.add("threshold_button", "col-1", "button_space", "btn", "btn-secondary");
        new_threshold_button.addEventListener("click", focus_my_sentence_onclick);
        new_threshold_button.addEventListener("click", display_threshold_onclick);

        let new_box_selection_button = document.createElement("input");
        new_box_selection_button.type = "button";
        new_box_selection_button.value = "(0,0,0,0)";
        new_box_selection_button.classList.add("box_selection_button", "col-1","button_space", "btn", "btn-secondary");
        new_box_selection_button.addEventListener("click", focus_my_sentence_onclick);
        new_box_selection_button.addEventListener("click", display_bounding_box_onclick);
        
        new_sentence.appendChild(plus_adj_sbj_button);
        new_sentence.appendChild(new_subject);
        new_sentence.appendChild(plus_adv_button);
        new_sentence.appendChild(new_action);
        new_sentence.appendChild(plus_adj_obj_button);
        new_sentence.appendChild(new_object);
        new_sentence.appendChild(new_threshold_button);
        new_sentence.appendChild(new_box_selection_button);

        composite_query.appendChild(new_sentence);

        window.all_scores.push([]);
        window.all_thresholds.push(0.8);
        window.all_boxes.push([10, 10, 40, 40]);
    }
    catch(error) {
        console.log("failed to create a new sentence element: ", error);
    }
};

/**
 * removes the bool operator line that was clicked and the sentence before it
 * @param {*} event assumed to be onclick event
 */
const remove_sentence = (event) => {
    let parent = event.target.parentNode;
    let sentence = parent.previousElementSibling;

    console.log(sentence);

    const all_sentences = document.getElementById("composite_text_query").querySelectorAll(".sentence");
    for (let i = 0;i < all_sentences.length;++i) {
        if (all_sentences[i] === sentence) {
            let index = window.all_boxes.indexOf(i);
            if (index > -1) { window.all_boxes.remove(index); }
            index = all_scores.indexOf(i);
            if (index > -1) { window.all_scores.remove(index); }
            index = all_thresholds.indexOf(i);
            if (index > -1) { window.all_thresholds.remove(index); }
            index = window.operators.indexOf(i);
            if (index > -1) { window.operators.remove(index); }
        }

        if (i == all_sentences.length - 1 && i == window.focused_sentence) { --window.focused_sentence; }
    }

    parent.remove();
    sentence.remove();
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
const add_bool_operators = (composite_query) => {
    let new_operators_list = document.createElement("div");
    new_operators_list.classList.add("connector", "row", "justify-content-center", "x_adaptable");
                    
    let display_button = document.createElement("input");
    display_button.type = "button";
    display_button.value = "show";
    display_button.style.display = "block";
    display_button.classList.add("utils", "btn", "btn-sm", "btn-outline-success", "col-1", "button_space");
    display_button.addEventListener("click", focus_my_sentence_onclick);

    let or_button = document.createElement("input");
    or_button.type = "button";
    or_button.value = "OR";
    or_button.classList.add("bool_op", "or", "btn", "btn-sm", "btn-secondary", "col-1", "button_space");
    or_button.addEventListener("click", apply_boolean_operator);
    or_button.addEventListener("click", focus_my_sentence_onclick);

    let and_button = document.createElement("input");
    and_button.type = "button";
    and_button.value = "AND";
    and_button.classList.add("bool_op", "and", "btn", "btn-sm", "btn-secondary", "col-1", "button_space");
    and_button.addEventListener("click", apply_boolean_operator);
    and_button.addEventListener("click", focus_my_sentence_onclick);

    let minus_button = document.createElement("input");
    minus_button.type = "button";
    minus_button.value = "W/O";
    minus_button.classList.add("bool_op", "minus", "btn", "btn-sm", "btn-secondary", "col-1", "button_space");
    minus_button.addEventListener("click", apply_boolean_operator);
    minus_button.addEventListener("click", focus_my_sentence_onclick);

    let delete_button = document.createElement("input");
    delete_button.type = "button";
    delete_button.value = "delete";
    delete_button.style.display = "none";
    delete_button.classList.add("utils", "btn", "btn-sm", "btn-outline-danger", "col-1", "button_space");
    delete_button.addEventListener("click", remove_sentence);
    delete_button.addEventListener("click", focus_my_sentence_onclick);

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
const hide_all_but_me = (event) => {
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
const show_all_my_bros = (event) => {
    let node = event.target;
    let parent = node.parentNode;
    parent.querySelectorAll(".bool_op").forEach(element => {
        element.style.display = "block";
    });
};

/**
 * used by operators buttons (or/and/minus), toggles between hiding every other operator
 * and displaying util buttons (show query result and delete sentence) And showing all 
 * operators to select a new one eventually
 * @param {*} event used to get the clicked element and its value (assumed button)
 */
const modify_boolean_operator_onclick = (event) => {
    let node = event.target;
    let parent = node.parentNode;

    let bool_children = parent.querySelectorAll(".bool_op");
    //let utils_children = parent.querySelectorAll(".btn-outline-danger");

    let sibling = (bool_children[0] == node)? bool_children[1] : bool_children[0];
    if (sibling.style.display == "none") { 
        show_all_my_bros(event);
        /*utils_children.forEach((element) => {
            element.style.display = "none";
        })*/
    }
    else if (sibling.style.display == "block") { 
        //finding the index of the current operator to modify it
        const operators = document.getElementById("composite_text_query").querySelectorAll(".connector");
        for (let i = 0;i < operators.length;++i) {
            if (parent === operators[i]) {
                window.operators[i] = node.value;
                break;
            }
        }

        hide_all_but_me(event);
        /*utils_children.forEach((element) => {
            element.style.display = "block";
        });*/
    } 
};

/**
 * used by operators buttons (or/and/minus), hides every other operator
 * and add a new sentence with a new set of button that will have the *
 * same function as an onclick event
 * then remove initial onlick functionality and add modification of 
 * bool operation
 * @param {*} event used to get the clicked element and its value (assumed button)
 */
const apply_boolean_operator = (event) => {
    window.operators.push(event.target.value);

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

/**
 * parse every sentence and return parsing for server processing
 * @returns array of processed queries
 */
const process_text_query = () => {
    const composite_text_query = document.getElementById("composite_text_query");
    let processed_queries = [];
    composite_text_query.querySelectorAll(".sentence").forEach((sentence) => {
        processed_queries.push(parse_query(sentence));
    });

    console.log(processed_queries);
    return processed_queries;
};

/**
 * parse every sentence and return parsing for display/log
 * @returns string of composite query
 */
const parse_text_query = () => {
    const query_array = process_text_query();
    if (query_array.length == 1) { return query_array[0]; }
    if (query_array.length == 0) { return "<empty string>"; }

    let operators = [];
    const composite_text_query = document.getElementById("composite_text_query");
    const visible_operators = Array.from(composite_text_query.querySelectorAll(".bool_op"));
    operators.push(...visible_operators);
   
    let parsed_query = query_array[0];
    for (let i = 1;i < query_array.length;++i) {
        console.log(operators, query_array.length, operators.length, i - 1);
        parsed_query += " " + (operators[i - 1].value) + " " +  query_array[i];
    }

    return parsed_query;
}

/**
 * display threshold results on clicked element's sentence query results alone
 * without considering other sentence queries or reduction plot selection
 * @param {*} event used to get the clicked element (assumed button)
 */
const display_threshold_onclick = (event) => {
    if (window.all_scores == null) { return; }
    try {
        // Locate the clicked sentence or its parent node that has the class 'sentence'
        const sentence = event.target.closest(".sentence");
        const composite_query = document.getElementById("composite_text_query");
        const all_sentences = composite_query.querySelectorAll(".sentence");

        for (let i = 0;i < all_sentences.length;++i) {
            if (sentence === all_sentences[i]) {
                const percent = event.target.value.substring(1);
                const new_threshold = parseInt(percent.substring(0, percent.length - 1)) / 100.0;

                threshold = new_threshold;

                window.selected_points = get_scores_above_threshold(window.all_scores[i], threshold);

                window.scores = window.all_scores[i];
                update_scores(window.current_index);
                return;
            }
        } 
    }
    catch (error) {
        console.error("Error while recovering text areas: ", error); 
    }
};

const update_focused_threshold = () => {
    try {
        // Locate the clicked sentence or its parent node that has the class 'sentence'
        const composite_query = document.getElementById("composite_text_query");
        const all_sentences = composite_query.querySelectorAll(".sentence");

        for (let i = 0;i < all_sentences.length;++i) {
            if (i == window.focused_sentence) {
                all_sentences[i].querySelectorAll(".threshold_button").forEach((element) => {
                    const percent = Math.trunc(window.all_thresholds[window.focused_sentence] * 100);
                    element.value = ">" + percent + "%";
                });
                return;
            }
        } 
    }
    catch (error) {
        console.error("Error while recovering text areas for threshold update: ", error); 
    }
}; 

/**
 * display bounding box selection on clicked element's sentence query results alone
 * without considering other sentence queries or reduction plot selection
 * @param {*} event used to get the clicked element (assumed button)
 * @returns 
 */
const display_bounding_box_onclick = (event) => {
    if (window.displayed_reduction == null) { return; }
    try {
        // Locate the clicked sentence or its parent node that has the class 'sentence'
        const sentence = event.target.closest(".sentence");
        const composite_query = document.getElementById("composite_text_query");
        const all_sentences = composite_query.querySelectorAll(".sentence");

        for (let i = 0;i < all_sentences.length;++i) {
            if (sentence === all_sentences[i]) {
                const box = event.target.value;
                const numbers = box.match(/\d+/g).map(Number);

                console.log(numbers);

                window.selection_top_left = { x: numbers[0], y: numbers[1]}; 
                window.selection_bot_right = { x: numbers[2], y: numbers[3]}; 

                window.selected_points = update_selected(window.current_index, window.selection_top_left,
                    window.selection_bot_right);
                update_scores(window.current_index);
                return;
            }
        } 
    }
    catch (error) {
        console.error("Error while recovering text areas: ", error); 
    }
};

/**
 * when clicking on an element of a query parent, update (logically, not the DOM) 
 * the focus of the sentence on that of the clicked element 
 */
const update_focused_box = () => {
    try {
        // Locate the clicked sentence or its parent node that has the class 'sentence'
        const composite_query = document.getElementById("composite_text_query");
        const all_sentences = composite_query.querySelectorAll(".sentence");

        for (let i = 0;i < all_sentences.length;++i) {
            if (i == window.focused_sentence) {
                all_sentences[i].querySelectorAll(".box_selection_button").forEach((element) => {
                    element.value = "(" + window.all_boxes[window.focused_sentence][0] 
                        + ", " + window.all_boxes[window.focused_sentence][1]  
                        + ", " + window.all_boxes[window.focused_sentence][2]  
                        + ", " + window.all_boxes[window.focused_sentence][3] + ")";
                });
                return;
            }
        } 
    }
    catch (error) {
        console.error("Error while recovering text areas for bbox update: ", error); 
    }
}; 

/**
 * used when displaying query result by pressing "show" of the respective query sentence
 * apply OR on threshold selection and bbox selection and returns all selected points 
 * @param {*} index currently displayed image, needed for bbox selection
 * @returns all selected points by either thresholding or bbox selection (array of ints)
 */
const get_sentence_result = (index) => {
    //initial sentence processed (in case its the only one)
    const thresold_results = get_scores_above_threshold(window.all_scores[index], window.all_thresholds[index]);
    const top_left = {x: window.all_boxes[index][0], y: window.all_boxes[index][1]};
    const bot_right = {x: window.all_boxes[index][2], y: window.all_boxes[index][3]};
    const bounding_box_selection = update_selected(window.current_index, top_left, bot_right);

    //considering default operator between threshold and box result to be a union
    return union(thresold_results, bounding_box_selection);
};

/**
 * applies all threshold/box selections and all boolean operators and places the 
 * result in selected_points
 */
let get_full_composition = () => {
    if (window.all_scores.length != window.all_boxes.length 
        || window.all_scores.length != window.all_thresholds.length) {
        console.log("mismatch between scores, thresholds and box arrays. respectives sizes: ",
            window.all_scores.length, window.all_boxes.length, window.all_thresholds.length);
    }

    let selected_points = get_sentence_result(0);
    
    //combining the other sentences, applying bool operators according to their apparition order
    for (let i = 1;i < window.all_scores;++i) {
        let sentence_result = get_sentence_result(i);

        const operator = (window.operators[i - 1] == "OR")? union : 
            (window.operators[i - 1] == "AND")? intersection : difference;

        selected_points = operator(selected_points, sentence_result);
    }

    return selected_points;
};

let display_composition = document.getElementById("display_composition");
display_composition.addEventListener("click", () => {
    window.selected_points = get_full_composition();
    update_video(window.current_frame);
    update_scores(window.current_index);
});

//Text-based search, expecting an array of scores plus a reduction array from the server
text_search_button.addEventListener("click", async () => {
    let score_plot_loader = document.getElementById("score_plot_loader");
    let reduction_plot_loader = document.getElementById("reduction_plot_loader");
    let general_loader = document.getElementById("general_loader");
    score_plot_loader.style.display = "block";
    reduction_plot_loader.style.display = "block";
    general_loader.style.display = "block";

    try {
        let score_plot = document.getElementById("score_plot");
        const processed_queries = process_text_query();

        //request similarity scores from the server
        for (let i = 0;i < processed_queries.length;++i) {
            const response = await fetch(`${server_url}/search?query=${processed_queries[i]}`);
            const body = await response.json();
            console.log(body);
            window.all_scores[i] = body['scores'].map(function(value,index) { return value[1]; });
        }

        //adjust the max value
        window.max_index = window.all_scores[0].length;

        window.scores = window.all_scores[0];

        //update component
        update_video(window.current_frame.src);

        //show buttons for toggling scores/reduction
        toggle_scores.style.display = "block";
        score_plot.addEventListener("click", (event) => update_frame_index_onclick(score_plot, 
            score_plot_offset_left, score_plot_offset_right, score_plot_offset_y, window.max_index, event));

        //update the curve plot
        update_scores(window.current_index);

        let display_composition = document.getElementById("display_composition");
        display_composition.style.display = "block";

        const today = new Date;
        const time_log = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()} `
            + `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()} : `
            + ` search with query: ${parse_text_query()}`;

        await fetch (`${server_url}/log/`, {
            method: 'POST', 
            body: JSON.stringify({interaction_log: time_log}),
            headers: {'Content-Type': 'application/json'}
        });
    } 
    catch (error) {
        console.error("Error loading similarity scores for text query: ", error);
    }

    score_plot_loader.style.display = "none";
    reduction_plot_loader.style.display = "none";
    general_loader.style.display = "none";
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

let composite_text_query = document.getElementById("composite_text_query");

//initial focus click
composite_text_query.childNodes.forEach(element => {
    element.addEventListener("click", focus_my_sentence_onclick);
});

//initial onclick or/and/minus
composite_text_query.querySelectorAll(".bool_op").forEach(element => {
    element.addEventListener("click", apply_boolean_operator);
});

//initiale the first sentence elements
composite_text_query.querySelectorAll(".add_adj_sbj").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_sbj"));
});

composite_text_query.querySelectorAll(".add_adv").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adv"));
});

composite_text_query.querySelectorAll(".add_adj_obj").forEach(element => {
    element.addEventListener("click", (event) => add_qualificator_onclick(event, "adj_obj"));
});

composite_text_query.querySelectorAll(".threshold_button").forEach(element => {
    //element.style.display = "none";
    element.addEventListener("click", display_threshold_onclick);
});

composite_text_query.querySelectorAll(".box_selection_button").forEach(element => {
    element.addEventListener("click", display_bounding_box_onclick);
});

composite_text_query.querySelectorAll(".utils").forEach((element) => {
    element.style.display = "none";
});

composite_text_query.querySelectorAll(".utils.btn-outline-danger").forEach((element) => {
    element.addEventListener("click", remove_sentence);
});