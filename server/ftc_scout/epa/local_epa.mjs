import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Match } from './EPA.mjs';


const epa_mem = JSON.parse(fs.readFileSync("regiondata_cld.json"));

const t_ = epa_mem.teams;
const e_ = epa_mem.events;

function getTeam(teamId) {
    return t_.find(team => team.teamNumber === teamId);
}

function getEvent(eventId) {
    return e_.find(event => event.code === eventId);
}

function getMatch(eventCode, id) {
    let event = getEvent(eventCode);

    if (event == null) {
        return null;
    }

    return event.matches.find(match => match.id === id);
}

function getEPATeam(teamNumber) {
    return getTeam(teamNumber);
}

function predictMatch(red1, red2, blue1, blue2) {
    //check if teams are in region
    let red1team = getTeam(red1);
    let red2team = getTeam(red2);
    let blue1team = getTeam(blue1);
    let blue2team = getTeam(blue2);

    if (red1team == null || red2team == null || blue1team == null || blue2team == null) {
        return 0.5;
    }

    return new Match(0, 0, false, red1, red2, blue1, blue2).winProbability(red1team.elo, red2team.elo, blue1team.elo, blue2team.elo);
}

export {
    getMatch,
    getEPATeam,
    predictMatch
};