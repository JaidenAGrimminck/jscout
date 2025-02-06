import express from "express";
import { getTeam, getLoadedTeams, getEvent } from "../ftc_scout/FTCScoutComms.mjs";
import bodyParser from "body-parser";

const router = express.Router();

router.use(bodyParser.json());

router.get('/', async (req, res) => {
    res.json({
        "matches": true
    })
});

router.post('/', async (req, res) => {
    const matchIds = req.body.matchIds;
    const eventCode = req.body.eventCode;

    if (typeof eventCode !== "string") {
        res.status(400).json({
            "error": "eventCode must be a string, not " + req.body.eventCode
        });

        return;
    }

    if (!Array.isArray(matchIds)) {
        res.status(400).json({
            "error": "matchIds must be an array, not " + req.body.matchIds
        });

        return;
    }

    if (matchIds.length === 0) {
        res.json([]);
        return;
    }

    let eventData = await getEvent(eventCode);

    if (eventData === null) {
        res.status(404).json({
            "error": "Event not found"
        });
        return;
    }

    let matches = eventData["matches"];

    let matchesData = [];

    for (let matchId of matchIds) {
        let match = matches.find((match) => {
            return (match.id) === parseInt(matchId);
        });

        if (match === undefined) {
            res.status(404).json({
                "error": "Match not found"
            });
            return;
        }

        let team1 = await getTeam(match.teams[0].teamNumber);

        if (team1 === null) {
            matchesData.push(match);
            continue;
        }

        //get match
        let matchTeam = team1.matches.find((match) => {
            return match.matchId == matchId && match.eventCode == eventCode;
        });

        if (matchTeam === undefined) {
            matchesData.push(match);
            continue;
        }

        matchesData.push(Object.assign(match, matchTeam.match));
    }

    res.json(matchesData);
});

router.get('/:eventCode/:matchId', async (req, res) => {
    const eventCode = req.params.eventCode;
    const matchId = req.params.matchId;

    if (typeof eventCode !== "string") {
        res.status(400).json({
            "error": "eventCode must be a string, not " + req.params.eventCode
        });

        return;
    }

    if (isNaN(parseInt(matchId))) {
        res.status(400).json({
            "error": "matchId must be a number, not " + req.params.matchId
        });

        return;
    }

    let eventData = await getEvent(eventCode);

    if (eventData === null) {
        res.status(404).json({
            "error": "Event not found"
        });
        return;
    }

    let match = eventData["matches"].find((match) => {
        return (match.id) === parseInt(matchId);
    });

    if (match === undefined) {
        res.status(404).json({
            "error": "Match not found"
        });
        return;
    }

    let team1 = await getTeam(match.teams[0].teamNumber);

    if (team1 === null) {
        res.json(match)
        return;
    }

    //get match
    let matchTeam = team1.matches.find((match) => {
        return match.matchId == matchId && match.eventCode == eventCode;
    });

    if (matchTeam === undefined) {
        res.json(match)
        return;
    }

    res.json(Object.assign(match, matchTeam.match));
});

export { router };