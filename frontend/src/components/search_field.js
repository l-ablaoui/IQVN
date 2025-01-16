import '../App.css';

import Image_crop_area from './image_crop_area'
import { fetch_query_scores, fetch_image_scores } from '../utilities/api_methods';

import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImages, faCrop, faSearch } from '@fortawesome/free-solid-svg-icons';

const Search_field = ({video_ref, set_scores}) => {
    const text_input_ref = useRef(null);
    const image_input_ref = useRef(null);
    const image_crop_ref = useRef(null);
    const search_button_ref = useRef(null);
    const image_file_input_ref = useRef(null);
    const crop_area_ref = useRef(null);

    const [selection_top_left, set_selection_top_left] = useState({x: 0, y: 0});
    const [selection_bot_right, set_selection_bot_right] = useState({x: 0, y: 0});

    /** video absolute top left corner, used to limit the cropping area */
    const [video_top_left, set_video_top_left] = useState({x: 0, y: 0});

    /** video absolute bottom right corner, used to limit the cropping area */
    const [video_bot_right, set_video_bot_right] = useState({x: 0, y: 0});

    /** highjack click to the file input when clicking on the icon */
    const handle_image_upload_click = () => {
        image_file_input_ref.current.click();
    };

    const handle_image_file_input_change = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            fetch_image_scores(files[0]).then((scores) =>
                set_scores(scores)
            );
        }
    };

    const handle_image_crop_click = (event) => {
        const video = video_ref.current;

        //stop the video if its currently running
        video.pause();

        // get video dimensions to limit the cropping area
        const video_width = video.offsetWidth;
        const video_height = video.offsetHeight;

        const rect = video.getBoundingClientRect();
        const video_left = rect.left;
        const video_top = rect.top;

        set_video_top_left({x: video_left, y: video_top});
        set_video_bot_right({x: video_left + video_width, y: video_top + video_height});

        // make the cropping area visible and set it to the window's dimensions
        let crop_area = crop_area_ref.current;
        crop_area.width = window.innerWidth;
        crop_area.height = window.innerHeight;
        crop_area.className = "d-block image_crop_area";
        crop_area.zIndex = 1000;

        // overriding the top_left bot_right corners of selection once to trigger the rendering
        set_selection_top_left({x: video_left, y: video_top});
        set_selection_bot_right({x: video_left, y: video_top});
    };

    /**
     * @todo fix firefox error "operation is insecure" when trying to render the video element in canvas 
     * (access to server storage and not just local browser storage)
     */
    const apply_image_search = async () => {
        const video = video_ref.current;
        const video_width = video.offsetWidth;
        const video_height = video.offsetHeight;

        const rect = video.getBoundingClientRect();
        const video_left = rect.left;
        const video_top = rect.top;

        let crop_area = crop_area_ref.current;
        crop_area.left = video_left;
        crop_area.top = video_top;
        crop_area.width = video_width;
        crop_area.height = video_height;

        let ctx = crop_area.getContext("2d", { alpha: true });
        ctx.clearRect(0, 0, video_width, video_height);
        ctx.drawImage(video, 0, 0, video_width, video_height);

        const crop_width = Math.abs(selection_top_left.x - selection_bot_right.x);
        const crop_height = Math.abs(selection_top_left.y - selection_bot_right.y);

        const cropped_image = ctx.getImageData(
            selection_top_left.x - video_left,
            selection_top_left.y - video_top,
            crop_width,
            crop_height
        );

        crop_area.width = crop_width;
        crop_area.height = crop_height;
        ctx.putImageData(cropped_image, 0, 0);

        const extracted_cropped_image = await new Promise((resolve, reject) => {
            crop_area.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Canvas toBlob failed"));
                }
            }, "image/png");
        });

        fetch_image_scores(extracted_cropped_image).then((scores) => {
            set_scores(scores);
        });
    };
    
    const handle_search_click = (event) => {
        const query_input = text_input_ref.current.value;

        if (query_input.length > 0) {
            fetch_query_scores(query_input).then((scores) => {
                if (scores?.length > 0) { 
                    set_scores(scores); 
                } 
            });
        }
    };

    return (
        <div className="row search_field">
            <div className="col-8">
                <input 
                    type={"text"} 
                    placeholder={"search in video"} 
                    maxLength={300}
                    ref={text_input_ref}
                    className="form-control"
                />
            </div>
            <button
                onClick={handle_image_upload_click}
                ref={image_input_ref}
                className="col-1 btn"
            >
                <FontAwesomeIcon icon={faImages} />
                <input 
                    type="file" 
                    class="d-none" 
                    ref={image_file_input_ref}
                    onChange={handle_image_file_input_change}
                    accept="image/png, image/jpeg, image/gif" 
                />
            </button>
            <button
                onClick={handle_image_crop_click}
                ref={image_crop_ref}
                className="col-1 btn"
            >
                <FontAwesomeIcon icon={faCrop}/>
            </button>
            <button
                onClick={handle_search_click}
                ref={search_button_ref}
                className="col-2 btn"
            >
                <FontAwesomeIcon icon={faSearch} />
            </button>
            <Image_crop_area 
                crop_area_ref={crop_area_ref}
                selection_top_left={selection_top_left}
                selection_bot_right={selection_bot_right}
                set_selection_top_left={set_selection_top_left}
                set_selection_bot_right={set_selection_bot_right}
                video_top_left={video_top_left}
                video_bot_right={video_bot_right}
                apply_effect={apply_image_search}
            />
        </div>
    );
};

export default Search_field;