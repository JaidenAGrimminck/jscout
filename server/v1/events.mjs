import express from "express";
import { getEvent, getLoadedEvents } from "../ftc_scout/FTCScoutComms.mjs";
import bodyParser from "body-parser";

const router = express.Router();

router.use(bodyParser.json());
// parse params

router.get('/', async (req, res) => {
    res.json(getLoadedEvents());
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

export { router };