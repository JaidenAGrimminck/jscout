
export default function getURL() {
    const isProduction = process.env.NODE_ENV === "production";

    return !isProduction ? "http://localhost:3734" : "https://api.jaiden.hackclub.app";
}