import express from "express";
import { getTeam, getLoadedTeams, getEvent, getTeams } from "../ftc_scout/FTCScoutComms.mjs";
import bodyParser from "body-parser";
import { getEPATeam } from "../ftc_scout/epa/local_epa.mjs";

const router = express.Router();

router.use(bodyParser.json());
// parse params

router.get('/', async (req, res) => {
    res.json(getLoadedTeams());
})

router.get('/multi/:teamNumbers', async (req, res) => {
    const teamNumbers = req.params.teamNumbers.split(",").map(Number);

    if (teamNumbers.some(isNaN)) {
        res.status(400).json({
            "error": "teamNumbers must be a comma separated list of numbers, not " + req.params.teamNumbers
        });

        return;
    }

    let teamData = await getTeams(teamNumbers);

    for (let i = 0; i < teamData.length; i++) {
        let epa = getEPATeam(teamNumbers[i]);

        if (epa !== null) {
            try {
            teamData[i]["epa"] = epa;
            } catch (e) {
                console.error("Error adding EPA data for team", teamNumbers[i], e);
            }
        }
    }
    
    res.json(teamData);
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
        try {
        teamData["epa"] = epa;
        } catch (e) {
            console.error("Error adding EPA data for team", teamNumber, e);
        }
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