import express from "express";
import { getEvent, getEvents, getLoadedEvents } from "../ftc_scout/FTCScoutComms.mjs";
import bodyParser from "body-parser";

const router = express.Router();

router.use(bodyParser.json());
// parse params

router.get('/', async (req, res) => {
    res.json(getLoadedEvents());
})

router.get("/multi/:eventCodes", async (req, res) => {
    const eventCodes = req.params.eventCodes.split(",");

    if (eventCodes.some(isNaN)) {
        res.status(400).json({
            "error": "eventCodes must be a comma separated list of strings, not " + req.params.eventCodes
        });

        return;
    }

    let eventData = await getEvents(eventCodes);
    if (eventData === null) {
        res.status(404).json({
            "error": "Event not found"
        });
        return;
    }

    for (let i = 0; i < eventData.length; i++) {
        if (eventData[i] === null) {
            res.status(404).json({
                "error": "Some event not found"
            });
            return;
        }
    }

    res.json(eventData);
})

router.get('/:eventCode', async (req, res) => {
    const eventCode = req.params.eventCode;

    if (typeof eventCode !== "string") {
        res.status(400).json({
            "error": "eventCode must be a string, not " + req.params.eventCode
        });

        return;
    }

    if (eventCode == "null") {
        res.status(400).json({
            "error": "eventCode must not be null"
        });

        return;
    }

    let eventData = await getEvent(eventCode);

    if (eventData === null) {
        res.status(404).json({
            "error": "Event not found"
        });
    }

    res.json(eventData);
})

router.get('/reload/:eventCode', async (req, res) => {
    const eventCode = req.params.eventCode;

    if (typeof eventCode !== "string") {
        res.status(400).json({
            "error": "eventCode must be a string, not " + req.params.eventCode
        });

        return;
    }

    if (eventCode == "null") {
        res.status(400).json({
            "error": "eventCode must not be null"
        });

        return;
    }

    let eventData = await getEvent(eventCode, true);
    
    console.log("reloading event data for", eventCode);

    res.json(eventData);
});

export { router };