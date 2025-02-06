

export default function Wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

