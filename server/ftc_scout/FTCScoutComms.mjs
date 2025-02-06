import { gql, request } from 'graphql-request';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Memory from './Memory.mjs';
import Wait from '../misc/Wait.mjs';

//__dirname fix: https://iamwebwiz.medium.com/how-to-fix-dirname-is-not-defined-in-es-module-scope-34d94a86694d
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data_location = path.join(__dirname, "/data.json");
const blank_data = {
    "teams": [],
    "events": [],
    "epa_model": [],
}

const url = "https://api.ftcscout.org/graphql";

const delay_before_update = 1000 * 60 * 60 * 24 * 7; // 1 week

/**
 * Gets the team data for a team number
 * @param {Number} teamNumber The team number to get data for
 * @return {Promise} A promise that resolves with the team data
 */
async function getTeam(teamNumber) {
    if (typeof teamNumber !== "number") {
        throw new Error("teamNumber must be a number");
    }

    loadData();

    const team = Memory.get("teams").find(team => team["number"] === teamNumber);

    if (team === undefined) {
        await updateTeam(teamNumber);

        console.log("updated new team data for team " + teamNumber);
        
        return Memory.get("teams").find(team => team["number"] === teamNumber);
    } else if (team["last_updated"] + delay_before_update < new Date().getTime()) {
        //first, remove the old team data
        Memory.set("teams", Memory.get("teams").filter(team => team["number"] !== teamNumber));

        //then, update the team data
        await updateTeam(teamNumber);

        console.log("updated stale team data for team " + teamNumber);

        return Memory.get("teams").find(team => team["number"] === teamNumber);
    }

    return team;
}

/**
 * Gets the event data for an event code
 * @param {String} eventCode The event code to get data for
 * @return {Promise} A promise that resolves with the event data
 */
async function getEvent(eventCode) {
    if (typeof eventCode !== "string") {
        throw new Error("eventCode must be a string");
    }

    eventCode = eventCode.toUpperCase();

    loadData();
    
    const event = Memory.get("events").find(event => event["code"] === eventCode);

    if (event === undefined) {
        await updateEvent(eventCode);

        console.log("updated new event data for event " + eventCode);
        
        return Memory.get("events").find(event => event["code"] === eventCode);
    } else if (event["last_updated"] + delay_before_update < new Date().getTime()) {
        await updateEvent(eventCode);

        console.log("updated stale event data for event " + eventCode);

        return Memory.get("events").find(event => event["code"] === eventCode);
    }

    return event;
}

async function updateTeam(teamNumber, season=2024) {
    if (typeof teamNumber !== "number") {
        throw new Error("teamNumber must be a number");
    }

    if (typeof season !== "number") {
        throw new Error("season must be a number");
    }

    const rawGQL = fs.readFileSync(path.join(__dirname, "/team_request.gql"), "utf-8");

    const query = gql`${rawGQL.replaceAll("{{teamNumber}}", teamNumber).replaceAll("{{season}}", season)}`;

    try {
        await queryTeamData(query);
    } catch (err) {
        console.error(err);
    }
}

async function updateEvent(eventCode, season=2024) {
    if (typeof eventCode !== "string") {
        throw new Error("eventCode must be a string");
    }

    if (typeof season !== "number") {
        throw new Error("season must be a number");
    }

    const rawGQL = fs.readFileSync(path.join(__dirname, "/event_request.gql"), "utf-8");

    const query = gql`${rawGQL.replaceAll("{{EVENT_CODE}}", eventCode).replaceAll("{{SEASON}}", season)}`;

    await queryEventData(query);
}

/**
 * Queries the FTC Scout API for team data
 * @param {Object} query The query to send to the API
 * @returns {Promise} A promise that resolves when the data is saved
 */
function queryTeamData(query) {
    return new Promise((resolve, reject) => {
        request(url, query).then(async data => {
            const newData = Object.assign(data["teamByNumber"], {
                last_updated: new Date().getTime()
            })

            const currentTeams = Memory.get("teams");

            currentTeams.push(newData);

            Memory.set("teams", currentTeams);

            console.log("added team " + data["teamByNumber"]["number"] + " to memory");

            //console.log(data)

            await Wait(100);

            //console.log(Memory.get("teams").filter(team => team["number"] === data["teamByNumber"]["number"]).length + " teams in memory");

            saveData(false);

            await Wait(100);

            loadData();

            //console.log(Memory.get("teams").filter(team => team["number"] === data["teamByNumber"]["number"]).length + " teams in memory22");

            //find the team in the memory
            let found = false;
            for (let i = 0; i < Memory.get("teams").length; i++) {
                if (Memory.get("teams")[i]["number"] === data["teamByNumber"]["number"]) {
                    console.log("confirmed found team " + data["teamByNumber"]["number"] + " in memory");
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log("catching error: team " + data["teamByNumber"]["number"] + " not found in memory");
                reject("team " + data["teamByNumber"]["number"] + " not found in memory");
            }
            

            resolve();
        }).catch(err => {
            reject(err);
        });
    });
}

/**
 * Queries the FTC Scout API for event data
 * @param {Object} query The query to send to the API
 * @returns {Promise} A promise that resolves when the data is saved
 */
function queryEventData(query) {
    return new Promise((resolve, reject) => {
        request(url, query).then(async data => {
            const newObject = Object.assign(data["eventByCode"], {
                last_updated: new Date().getTime()
            });

            const currentEvents = Memory.get("events");

            currentEvents.push(newObject);
            
            Memory.set("events", currentEvents);

            console.log("added event " + data["eventByCode"]["code"] + " to memory");

            await Wait(100);
            saveData(false);
            await Wait(100);
            loadData();

            let found = false;

            for (let i = 0; i < Memory.get("events").length; i++) {
                if (Memory.get("events")[i]["code"] === data["eventByCode"]["code"]) {
                    console.log("confirmed found event " + data["eventByCode"]["code"] + " in memory");
                    found = true;
                    break;
                }
            }

            if (!found) {
                console.log("catching error: event " + data["eventByCode"]["code"] + " not found in memory");
                reject("event " + data["eventByCode"]["code"] + " not found in memory");
                return;
            }

            resolve();
        }).catch(err => {
            reject(err);
        });
    });
}

/**
 * Gets the memory object
 * @returns {Object} The memory object
 */
function getMemory() {
    loadData();

    return Memory.get();
}

/**
 * Saves changes to the memory object
 * @param {*} changes The changes to save
 */
function saveToMemory(changes) {
    loadData();

    let currentMemory = Memory.get();

    currentMemory = Object.assign(currentMemory, changes);

    Memory.set(currentMemory);
    
    saveData();
}

function pruneMemory() {
    //double check for copies
    loadData();

    let new_memory = {
        "teams": [],
        "events": [],
        "epa_model": [],
    }

    let teamCopies = {};

    Memory.get("teams").forEach(team => {
        if (Object.keys(teamCopies).includes(team["number"])) {
            console.log("Pruning team " + team["number"]);
            if (team["last_updated"] > teamCopies[team["number"]]["last_updated"]) {
                teamCopies[team["number"]] = team;
            }
        } else {
            teamCopies[team["number"]] = team;
        }
    });

    let eventCopies = {};

    Memory.get("events").forEach(event => {
        if (Object.keys(eventCopies).includes(event["code"])) {
            console.log("Pruning event " + event["code"]);
            if (event["last_updated"] > eventCopies[event["code"]]["last_updated"]) {
                eventCopies[event["code"]] = event;
            }
        } else {
            eventCopies[event["code"]] = event;
        }
    });

    new_memory["teams"] = Object.values(teamCopies);
    new_memory["events"] = Object.values(eventCopies);

    Memory.set("teams", new_memory["teams"]);
    Memory.set("events", new_memory["events"]);
}

/**
 * Saves the data in memory to a file
 */
function saveData(prune=true) {
    if (!fs.existsSync(data_location)) {
        fs.writeFileSync(data_location, JSON.stringify(blank_data));
    }

    if (prune) pruneMemory();

    fs.writeFileSync(data_location, JSON.stringify(Memory.get()));   
}

/**
 * Loads the data from the file into memory
 */
function loadData() {
    if (!fs.existsSync(data_location)) {
        fs.writeFileSync(data_location, JSON.stringify(blank_data));
    }

    Memory.set(JSON.parse(fs.readFileSync(data_location)));

    let added_keys = false;

    for (let key in blank_data) {
        if (!Object.keys(Memory.get()).includes(key)) {
            Memory.set(key, blank_data[key]);
            added_keys = true;
            console.log("added key " + key + " to memory");
        }
    }

    if (added_keys) saveData();
}

/**
 * Returns what events have been loaded into memory
 * @returns {Array} An array of objects with the event and the last time it was updated
 */
function getLoadedEvents() {
    loadData();

    let event_date_pair = [];

    Memory.get("events").forEach(event => {
        event_date_pair.push({
            "code": event["code"],
            "name": event["name"],
            "last_updated": new Date(event["last_updated"])
        });
    });

    return event_date_pair;
}

/**
 * Returns what teams have been loaded into memory
 * @returns {Array} An array of objects with the team and the last time it was updated
 */
function getLoadedTeams() {
    loadData();
    
    let team_date_pair = [];

    Memory.get("teams").forEach(team => {
        team_date_pair.push({
            "number": team["number"],
            "name": team["name"],
            "last_updated": new Date(team["last_updated"])
        });
    });

    return team_date_pair;
}

export { getTeam, getLoadedTeams, getEvent, getLoadedEvents, getMemory, saveToMemory, pruneMemory, saveData };