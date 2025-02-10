import express from "express";
import { getTeam, getLoadedTeams, getEvent } from "../ftc_scout/FTCScoutComms.mjs";
import bodyParser from "body-parser";
import { getEPATeam } from "../ftc_scout/epa/EPA.mjs";

const router = express.Router();

router.use(bodyParser.json());
// parse params

router.get('/', async (req, res) => {
    res.json(getLoadedTeams());
})

router.get('/:teamNumber', async (req, res) => {
    const teamNumber = parseInt(req.params.teamNumber);

    if (isNaN(teamNumber)) {
        res.status(400).json({
            "error": "teamNumber must be a number, not " + req.params.teamNumber
        });

        return;
    }

    let teamData = await getTeam(teamNumber);

    let epa = getEPATeam(teamNumber);

    if (epa !== null) {
        teamData["epa"] = epa;
    }

    res.json(teamData);
})

router.get('/reload/:teamNumber', async (req, res) => {
    const teamNumber = parseInt(req.params.teamNumber);

    if (isNaN(teamNumber)) {
        res.status(400).json({
            "error": "teamNumber must be a number, not " + req.params.teamNumber
        });

        return;
    }

    let teamData = await getTeam(teamNumber, true);
    
    console.log("reloading team data for", teamNumber);

    res.json(teamData);
});

router.get('/at/:eventCode', async (req, res) => {
    const eventCode = req.params.eventCode;

    if (typeof eventCode !== "string") {
        res.status(400).json({
            "error": "eventCode must be a string, not " + req.params.eventCode
        });

        return;
    }

    let eventData = await getEvent(eventCode);

    if (eventData === null) {
        res.status(404).json({
            "error": "Event not found"
        });
    }

    const teams = eventData["teams"];

    let only_numbers = [];

    teams.forEach(team => {
        only_numbers.push(team["teamNumber"]);
    });

    res.json(only_numbers);
})

router.get('/reload/at/:eventCode', async (req, res) => {
    const eventCode = req.params.eventCode;

    if (typeof eventCode !== "string") {
        res.status(400).json({
            "error": "eventCode must be a string, not " + req.params.eventCode
        });

        return;
    }

    let eventData = await getEvent(eventCode);

    if (eventData === null) {
        res.status(404).json({
            "error": "Event not found"
        });
    }

    const teams = eventData["teams"];


    let only_numbers = [];

    teams.forEach(team => {
        only_numbers.push(team["teamNumber"]);
    });

    console.log("reloading team data for", only_numbers);
    
    let teamData = await getTeam(only_numbers, true);

    res.json(teamData);
});

export { router };