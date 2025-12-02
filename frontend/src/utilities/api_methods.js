import { BACKEND_SERVER_URL } from "./constants";

/** gets a list of video paths available in the server
 * @returns list of strings representing relative paths to videos
 * in the server */
export const fetch_server_videos_list = async () => {
    try {
        const response = await fetch(`${BACKEND_SERVER_URL}videos/`);
        const video_names = await response.json();
        console.log("fetch video list results: ", video_names);
        return video_names;
    }
    catch (error) {
        console.error("Error retrieving available videos: ", error);
    }
};

/** checks if the relative server path of video_name is a correct 
 * path to an actual video and returns the server relative path 
 * to the video if it exists
 * @param {*} video_name expected string representing the name of
 * the video (what comes after http://server_path:server_port/video/)
 * @returns server path to the video with video_name (string) */
export const fetch_video = async (video_name) => {
    try {
        await fetch(`${BACKEND_SERVER_URL}videos/${video_name}/`);   
        return `${BACKEND_SERVER_URL}videos/${video_name}/`;
    }
    catch (error) {
        console.error("Error retrieving video ", video_name, " : ", error);
    }
};

export const fetch_compound_query_scores = async (video_name, compound_query) => {
    try {
        //loop over each node in the compound array
        for (let i = 0; i < compound_query.length; i++) {
            const node = compound_query[i];

            if (node.image_query) {
                const matched_file = node.image_query;
                const data_URL = await get_data_URL(matched_file); //convert File → base64 via get_data_URL
                compound_query[i] = { "image_query": //overwrite the entry with the backend-friendly structure
                    { "image_data": data_URL } 
                };
            }
        }
        
        const response = await fetch(`${BACKEND_SERVER_URL}videos/${video_name}/search/compound/`, 
            {method: "POST", body: JSON.stringify(compound_query), 
            headers: {"Content-Type": "application/json"}});
        const body = await response.json();
        console.log("fetch compound query scores result: ", body);
        const scores = body["scores"];
        return scores;
    }
    catch (error) {
        console.error("Error retrieving compound query scores for query", compound_query, " : ", error);
    }
};

/** calls text similarity score endpoint in the server 
 * @param {*} query_input expected string representing the textual query input
 * @returns expected array of floats between 0 and 1 representing similarity scores */
export const fetch_text_query_scores = async (video_name, query_input) => {
    try {
        console.log("video_name:", video_name, " query_input:", query_input);
        const response = await fetch(`${BACKEND_SERVER_URL}videos/${video_name}/search/?query=${query_input}`);
        const body = await response.json();
        console.log("fetch query scores result: ", body);
        return body['scores'].map(function(value, _) { return value[1]; });
    }
    catch (error) {
        console.error("Error retrieving query scores for query", query_input, " : ", error);
    }
};

/** calls image similarity score endpoint in the server
 * @param {*} image_input expected image file input
 * @param {*} video_name expected string representing an mp4 video name
 * @returns expected array of floats between 0 and 1 representing similarity scores */
export const fetch_image_scores = async (video_name, image_input) => {
    try {
        const data_URL = await get_data_URL(image_input); 
        const response = await fetch(`${BACKEND_SERVER_URL}videos/${video_name}/search/image/`, 
            {method: "POST", body: JSON.stringify({image_data: data_URL}), 
            headers: {"Content-Type": "application/json"}});
        const body = await response.json();
        const scores = body["scores"].map(function(value, _) { return value[1]; });
        return scores;
    }
    catch (error) {
        console.error("Error retrieving image scores : ", error);
    }
};

/** calls crop similarity score endpoint in the server
 * @param {*} current_index expected integer, currently displayed video frame
 * @param {*} crop_box expected array of four integers (x, y, w, h)
 * @returns expected array of floats between 0 and 1 representing similarity scores */
export const fetch_crop_scores = async (video_name, current_index, crop_box) => {
    try {
        const response = await fetch(`${BACKEND_SERVER_URL}videos/${video_name}/search/crop/`, 
            {method: "POST", body: JSON.stringify({ current_index: current_index, crop_box: crop_box }), 
            headers: {"Content-Type": "application/json"}});
        const body = await response.json();
        if (body["query"] == "ERROR") {
            console.error("Error retrieving crop scores for frame ", current_index, " : ", body["error"]);
        }
        const scores = body["scores"].map(function(value, _) { return value[1]; });
        return scores;
    }
    catch (error) {
        console.error("Error retrieving crop scores for frame ", current_index, " : ", error);
    }
};

/** calls dimension reduction endpoint in the server
 * @param {*} video_name expected string representing an mp4 video name
 * @returns expected dictionnary with three fields:
 * - tsne_reduction: array of 2D float points representing the reduced embeddings
 * - tsne_clusters: array of integers representing the DBSCAN cluster assignment of each point
 * - tsne_cluster_frames: array of tuples containing the frame number and the URL of the cluster centroids */
export const fetch_video_semantic_representation = async (video_name) => {
    try {
        const name_decomposed = video_name.split("/");
        const name_processed = name_decomposed[name_decomposed.length - 1];//.split(".")[0]; 
        const embeds_response = await fetch(`${BACKEND_SERVER_URL}videos/${name_processed}/embeddings/`);
        const body = await embeds_response.json();
        console.log("fetch semantic representation result: ", body);

        let tsne_reduction = body['tsne'];
        let tsne_clusters = body['tsne_clusters'];
        let tsne_cluster_frames = [];

        //fetching frames corresponding to each cluster's centroid fort-sne reduction algorithm
        const name_processed_no_ext = name_processed.split(".")[0];
        let cluster_frames = body['tsne_cluster_frames'];
        for (let i = 0;i < cluster_frames.length;++i) {
            const cf_response = await fetch(
                `${BACKEND_SERVER_URL}videos/${name_processed_no_ext}/images/${cluster_frames[i]["centroid"]}.png/`
            );
            const cf_blob = await cf_response.blob();
            const cf_url = URL.createObjectURL(cf_blob);

            tsne_cluster_frames.push([cluster_frames[i]["centroid"], cf_url]);
        }

        return {
            tsne_reduction: tsne_reduction, 
            tsne_clusters: tsne_clusters, 
            tsne_cluster_frames: tsne_cluster_frames
        };
    }
    catch(error) {
        console.error("Error fetching 2D reduced embeddings: ", error);
    }
};

/** convert file input into server-compatible URL
 * @param {*} file expected file input */
const get_data_URL = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};
