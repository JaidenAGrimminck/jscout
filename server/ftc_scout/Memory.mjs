

var memory = {
    "teams": [],
    "events": [],
    "epa_model": [],
}

export default {
    set (key, value=null) {
        if (value == null) {
            memory = key;
            return;
        }

        memory[key] = value;
    },
    get (key=null) {
        if (key == null) {
            return memory;
        }

        return memory[key];
    },
}