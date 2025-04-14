
const username = process.env.username;
const auth = process.env.auth;

function getAuth() {
    return Buffer.from(`${username}:${auth}`).toString('base64');
}

async function request(api_path) {
    const url = `https://ftc-api.firstinspires.org/v2.0/${api_path}`;

    return await fetch(url, {
        headers: {
            'Authorization': `Basic ${getAuth()}`,
            'Accept': 'application/json'
        }
    });
}

async function getInfo() {
    return await request("");
}

