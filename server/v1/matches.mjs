import express from "express";
import { getTeam, getLoadedTeams, getEvent } from "../ftc_scout/FTCScoutComms.mjs";
import { getMatch, predictMatch } from "../ftc_scout/epa/local_epa.mjs";
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

        if (team1 === null || team1 == undefined) {
            matchesData.push(match);
            continue;
        }

        if (team1.matches === undefined) {
            matchesData.push(match);
            continue;
        }

        //get match
        let matchTeam = team1.matches.find((match) => {
            return match.matchId == matchId && match.eventCode == eventCode;
        });

        if (matchTeam === undefined) {
            const epa = getMatch(eventCode, matchId);

            if (epa !== undefined && epa !== null && Object.keys(epa).includes("predictedWinProbability")) {
                match["predicted_red_win_probability"] = 1 - epa.predictedWinProbability;
            } else {
                match["predicted_red_win_probability"] = 1 - predictMatch(match.teams[0].teamNumber, match.teams[1].teamNumber, match.teams[2].teamNumber, match.teams[3].teamNumber);
            }

            if (epa !== undefined && epa !== null) {
                if (Object.keys(epa).includes("epa")) {
                    match["epa"] = epa.epa;
                }
            }

            matchesData.push(match);
            continue;
        }

        let n_matchData = Object.assign(match, matchTeam.match);
        
        const epa = getMatch(eventCode, matchId);

        if (epa != undefined && epa != null && Object.keys(epa).includes("predictedWinProbability")) {
            n_matchData["predicted_red_win_probability"] = 1 - epa.predictedWinProbability;
        } else {
            n_matchData["predicted_red_win_probability"] = 1 - predictMatch(match.teams[0], match.teams[1], match.teams[2], match.teams[3]);
        }

        if (epa !== undefined && epa !== null) {
            if (Object.keys(epa).includes("epa")) {
                match["epa"] = epa.epa;
            }
        }

        matchesData.push(n_matchData);
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

    let n_matchData = Object.assign(match, matchTeam.match);
        
    const epa = getMatch(eventCode, matchId);

    if (epa != undefined && epa != null && Object.keys(epa).includes("predictedWinProbability")) {
        n_matchData["predicted_red_win_probability"] = 1 - epa.predictedWinProbability;
    } else {
        n_matchData["predicted_red_win_probability"] = 1 - predictMatch(match.teams[0], match.teams[1], match.teams[2], match.teams[3]);
    }

    if (epa !== undefined && epa !== null) {
        if (Object.keys(epa).includes("epa")) {
            match["epa"] = epa.epa;
        }
    }


    res.json(n_matchData);
});

router.get('/predict/:red1/:red2/:blue1/:blue2', async (req, res) => {
    const red1 = req.params.red1;
    const red2 = req.params.red2;
    const blue1 = req.params.blue1;
    const blue2 = req.params.blue2;

    if (isNaN(parseInt(red1)) || isNaN(parseInt(red2)) || isNaN(parseInt(blue1)) || isNaN(parseInt(blue2))) {
        res.status(400).json({
            "error": "All team numbers must be numbers"
        });

        return;
    }

    res.json({
        "predicted_red_win_probability": 1 - predictMatch(
            parseInt(red1),
            parseInt(red2),
            parseInt(blue1),
            parseInt(blue2)
        )
    });
});

export { router };