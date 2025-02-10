import getURL from "./Server";

export default async function ConnectedToBackend() {
    const req = await fetch(`${getURL()}/v1`);
    const data = await req.json();

    if (data["api_version"] == "1.0") {
        return true;
    } else {
        return false;
    }
}