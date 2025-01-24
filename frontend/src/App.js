import './App.css';
//import { App_provider } from './App_context';
import Video_player from './components/video_player';
import Timeline from './components/timeline';
import Semantic_plot from './components/semantic_plot'
import Search_field from './components/search_field';

import { useRef, useState } from 'react';

function App() {
    const [current_index, set_current_index] = useState(0);
    const [max_index, set_max_index] = useState(0);
    const [selected_points, set_selected_points] = useState([]);
    const [scores, set_scores] = useState([]);

    const [video_src, set_video_src] = useState('');
    const video_ref = useRef(null);
    const fps = 10;

    const update_time = (current_index) => {
        if (video_ref.current) {
            set_current_index(current_index);

            const time_value = current_index / fps;
            video_ref.current.currentTime = time_value;
        }
    };

    return (
       // <App_provider>
            <div className="App container-fluid row">
                <div className="col-7">
                    <Video_player 
                        className="row" 
                        video_ref={video_ref}
                        video_src={video_src}
                        set_video_src={set_video_src}
                        set_current_index={set_current_index}
                        set_max_index={set_max_index}
                        fps={fps}
                    />
                    <Timeline 
                        className="row"
                        current_index={current_index}
                        update_time={update_time}
                        max_index={max_index}
                        fps={fps}
                        set_selected_points={set_selected_points}
                        selected_points={selected_points}
                        scores={scores}
                    />
                </div>
                <div className="col-5">
                    <Search_field 
                        className="row"
                        set_scores={set_scores}
                        video_ref={video_ref}
                    />
                    <Semantic_plot 
                        className="row"
                        scores={scores} 
                        current_index={current_index} 
                        update_time={update_time}
                        max_index={max_index}
                        video_src={video_src}
                        set_selected_points={set_selected_points}
                        selected_points={selected_points}
                    />
                </div>
            </div>
       // </App_provider>
    );
}

export default App;
