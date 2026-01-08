export const parse_query = (input, regrouper_pairs, separators) => {
    const result = [];
    let i = 0;
    
    //build a map of opening chars to closing chars
    const regrouper_map = {};
    const all_openers = [];
    const all_closers = [];
    const all_regroupers = [];
    
    regrouper_pairs.forEach(([open, close]) => {
        regrouper_map[open] = close;
        all_openers.push(open);
        all_closers.push(close);
        all_regroupers.push(open, close);
    });
    
    //skip whitespace
    const skip_white_spaces = () => {
        while (i < input.length && /\s/.test(input[i])) {
            i++;
        }
    }
    
    //check if current position matches a separator
    const match_separator = () => {
        skip_white_spaces();

        //parentheses
        if (input[i] === "(" || input[i] === ")") {
            i++;
            return input[i - 1];
        }

        for (const sep of separators) {
            if (input.substr(i, sep.length) === sep) {
                //check it's a whole word (not part of another word)
                const after = i + sep.length;
                const regroupers_regex = new RegExp('[\\s' + all_regroupers.map(r => '\\' + r).join('') + ']');
                if (after >= input.length || regroupers_regex.test(input[after])) {
                    i += sep.length;
                    return sep;
                }
            }
        }
        return null;
    }
    
    //extract content within regroupers
    const extract_grouped = () => {
        skip_white_spaces();
        const char = input[i];
        
        //check if it's an opener
        if (all_openers.includes(char)) {
            const closing = regrouper_map[char];
            i++; //skip opening
            let content = '';
            
            while (i < input.length && input[i] !== closing) {
                content += input[i];
                i++;
            }
            
            if (i < input.length) i++; //skip closing
            return `${char}${content}${closing}`;
        }
        
        //check if it's a standalone closer (like closing parenthesis)
        if (all_closers.includes(char)) {
            i++;
            return char;
        }
        
        return null;
    }
    
    //extract ungrouped text until we hit a separator, grouper, or end
    const extract_ungrouped = () => {
        skip_white_spaces();
        let content = '';
        
        while (i < input.length) {
        //check if we're at a separator
            let found_sep = false;
            for (const sep of separators) {
                if (input.substr(i, sep.length) === sep) {
                    const after = i + sep.length;
                    const regroupers_regex = new RegExp('[\\s' + all_regroupers.map(r => '\\' + r).join('') + ']');
                    if (after >= input.length || regroupers_regex.test(input[after])) {
                        found_sep = true;
                        break;
                    }
                }
            }

            if (found_sep) { break; }

            //check if we're at a regrouper
            if (all_regroupers.includes(input[i])) { break; }

            content += input[i];
            i++;
        }
        
        content = content.trim();
        //use first regrouper pair for wrapping ungrouped text
        return content ? `${regrouper_pairs[0][0]}${content}${regrouper_pairs[0][1]}` : null;
    }
    
    while (i < input.length) {
        skip_white_spaces();
        if (i >= input.length) { break; }
        
        //try to match separator
        const sep = match_separator();
        if (sep) {
            result.push(sep);
            continue;
        }
        
        //try to extract grouped content
        const grouped = extract_grouped();
        if (grouped) {
            //exception 2.1: Insert OR between adjacent groups
            if (result.length > 0 && 
                !separators.includes(result[result.length - 1]) &&
                !all_openers.includes(result[result.length - 1]) &&
                !all_closers.includes(grouped)) {
                result.push(separators[0]); //use first separator as default
            }
            result.push(grouped);
            continue;
        }
        
        //extract ungrouped text (Exception 2.2)
        const ungrouped = extract_ungrouped();
        if (ungrouped) {
            //exception 2.1: Insert separator between adjacent groups
            if (result.length > 0 && 
                !separators.includes(result[result.length - 1]) &&
                !all_openers.includes(result[result.length - 1])) {
                result.push(separators[0]); //use first separator as default
            }
            result.push(ungrouped);
        }
    }

    return result;
};

