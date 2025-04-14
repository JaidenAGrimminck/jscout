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

// max number of teams per request
const maxTeams = 25;

const url = "https://api.ftcscout.org/graphql";

const delay_before_update = 1000 * 60 * 60 * 24 * 7 * 10; // 1 week

//atomic variable
let fileCurrentlyBeingAccessed = false;

/**
 * Gets the team data for a team number
 * @param {Number} teamNumber The team number to get data for
 * @return {Promise} A promise that resolves with the team data
 */
async function getTeam(teamNumber, reload=false) {
    while (fileCurrentlyBeingAccessed) {
        await Wait(100);
    }

    //if array
    if (typeof teamNumber === "object" && teamNumber.length > 0) {

        let teams = [];
        for (let team of teamNumber) {
            teams.push(await getTeam(team, reload));
        }

        return teams;
    }

    if (typeof teamNumber !== "number") {
        throw new Error("teamNumber must be a number");
    }

    fileCurrentlyBeingAccessed = true;

    loadData();

    const team = Memory.get("teams").find(team => team["number"] === teamNumber);

    if (reload && team !== undefined) {
        //first, remove the old team data
        Memory.set("teams", Memory.get("teams").filter(team => team["number"] !== teamNumber));

        //then, update the team data
        await updateTeam(teamNumber);

        fileCurrentlyBeingAccessed = false;

        return Memory.get("teams").find(team => team["number"] === teamNumber);
    }

    if (team === undefined) {
        await updateTeam(teamNumber);

        console.log("updated new team data for team " + teamNumber);

        fileCurrentlyBeingAccessed = false;
        
        return Memory.get("teams").find(team => team["number"] === teamNumber);
    } else if (team["last_updated"] + delay_before_update < new Date().getTime()) {
        //first, remove the old team data
        Memory.set("teams", Memory.get("teams").filter(team => team["number"] !== teamNumber));

        //then, update the team data
        await updateTeam(teamNumber);

        console.log("updated stale team data for team " + teamNumber);

        fileCurrentlyBeingAccessed = false;

        return Memory.get("teams").find(team => team["number"] === teamNumber);
    }

    fileCurrentlyBeingAccessed = false;

    return team;
}

/**
 * Loads a list of teams from the API in a single graphQL request
 * @param {Array} teamNumbers The team numbers to load
 * @return {Promise} A promise that resolves with the team data
 * @throws {Error} If the team numbers are not an array
 */
async function getTeams(teams, ignoreFileAccess=false) {
    if (!Array.isArray(teams)) {
        throw new Error("teams must be an array");
    }

    let toLoad = teams;
    let alreadyLoaded = [];

    while (fileCurrentlyBeingAccessed && !ignoreFileAccess) {
        await Wait(1);
    }

    fileCurrentlyBeingAccessed = true;

    loadData();

    await Wait(10);

    Memory.get("teams").forEach(team => {
        if (toLoad.includes(team["number"])) {
            toLoad = toLoad.filter(teamNumber => teamNumber !== team["number"]);
            alreadyLoaded.push(team["number"]);
        }
    });

    console.log("to load / ", toLoad.length, "already loaded / ", alreadyLoaded.length);


    if (toLoad.length === 0) {
        fileCurrentlyBeingAccessed = false;

        //console.log(teams);

        return Memory.get("teams").filter(team => toLoad.includes(team["number"]) || alreadyLoaded.includes(team["number"]));
    }

    let otherReqs = [];

    console.log(toLoad, teams);

    for (let i = 0; i < toLoad.length; i += maxTeams) {
        otherReqs.push([]);
        for (let j = i; j < i + maxTeams && j < toLoad.length; j++) {
            otherReqs[otherReqs.length - 1].push(toLoad[j]);
        }
    }

    toLoad = otherReqs[0];

    if (otherReqs.length > 1) {
        console.log("splitting teams into", otherReqs.length, "requests");

        for (let j = 1; j < otherReqs.length; j++) {
            console.log("requesting", otherReqs[j].length, "teams");
            await getTeams(otherReqs[j], true);
        }
    }

    let r = fs.readFileSync(path.join(__dirname, "/team_request.gql"), "utf-8");
    // only do not the first line or the last line
    r = r.split("\n").filter((line, index) => {
        return index !== 0 && index !== r.split("\n").length - 1;
    });

    r = r.join("\n").replaceAll("{{season}}", 2024).replaceAll("{{SEASON}}", 2024);

    let req = "{\n";

    console.log("requesting # of teams", toLoad.length);

    for (let team of toLoad) {
        if (team === undefined || typeof team === "undefined") {
            console.log("team is undefined");
            continue;
        }
        if (team === null) {
            console.log("team is null");
            continue;
        }

        req = req.concat(`\tteam${team}: ${r.replaceAll("{{teamNumber}}", team)}`);
    }
    req = req.concat("\n}");
    req = gql`${req}`;

    
    const q = await request(url, req);

    //console.log(Object.keys(q));

    const newData = Object.values(q).map(team => {
        return Object.assign(team, {
            last_updated: new Date().getTime()
        });
    });

    const currentTeams = Memory.get("teams");
    currentTeams.push(...newData);
    Memory.set("teams", currentTeams);
    console.log("added teams " + toLoad.join(", ") + " to memory");
    await Wait(10);
    saveData(false);


    await Wait(10);
    loadData();
    console.log("loaded teams " + toLoad.join(", ") + " into memory");
    fileCurrentlyBeingAccessed = false;
    return Memory.get("teams").filter(team => teams.includes(team["number"]));
}

/**
 * Gets the event data for an event code
 * @param {String} eventCode The event code to get data for
 * @return {Promise} A promise that resolves with the event data
 */
async function getEvent(eventCode, reload=false) {
    while (fileCurrentlyBeingAccessed) {
        await Wait(100);
    }

    if (typeof eventCode !== "string") {
        throw new Error("eventCode must be a string");
    }

    fileCurrentlyBeingAccessed = true;

    eventCode = eventCode.toUpperCase();

    loadData();
    
    const event = Memory.get("events").find(event => event["code"] === eventCode);

    if (reload && event !== undefined) {
        //first, remove the old event data
        Memory.set("events", Memory.get("events").filter(event => event["code"] !== eventCode));

        console.log("reloading event data for", eventCode);

        //then, update the event data
        await updateEvent(eventCode);

        fileCurrentlyBeingAccessed = false;

        return Memory.get("events").find(event => event["code"] === eventCode);
    }

    if (event === undefined) {
        await updateEvent(eventCode);

        console.log("updated new event data for event " + eventCode);

        fileCurrentlyBeingAccessed = false;
        
        return Memory.get("events").find(event => event["code"] === eventCode);
    } else if (event["last_updated"] + delay_before_update < new Date().getTime()) {
        //first, remove the old event data
        Memory.set("events", Memory.get("events").filter(event => event["code"] !== eventCode));

        //then, update the event data
        await updateEvent(eventCode);

        console.log("updated stale event data for event " + eventCode);

        fileCurrentlyBeingAccessed = false;

        return Memory.get("events").find(event => event["code"] === eventCode);
    }

    fileCurrentlyBeingAccessed = false;

    return event;
}

/**
 * Gets the event data for an array of event codes using a multi graphql request
 * @param {Array} eventCode The event code to get data for
 * @return {Promise} A promise that resolves with the event data
 */
async function getEvents(eventCode) {
    if (!Array.isArray(eventCode)) {
        throw new Error("eventCode must be an array");
    }

    let toLoad = eventCode;
    let alreadyLoaded = [];

    while (fileCurrentlyBeingAccessed) {
        await Wait(1);
    }

    fileCurrentlyBeingAccessed = true;

    loadData();
    Memory.get("events").forEach(event => {
        if (toLoad.includes(event["code"])) {
            toLoad = toLoad.filter(eventCode => eventCode !== event["code"]);
            alreadyLoaded.push(event["code"]);
        }
    });

    if (toLoad.length === 0) {
        fileCurrentlyBeingAccessed = false;
        return Memory.get("events").filter(event => toLoad.includes(event["code"]) || alreadyLoaded.includes(event["code"]));
    }

    let r = fs.readFileSync(path.join(__dirname, "/event_request.gql"), "utf-8");
    // only do not the first line or the last line
    r = r.split("\n").filter((line, index) => {
        return index !== 0 && index !== r.split("\n").length - 1;
    });

    r = r.join("\n").replaceAll("{{season}}", 2024).replaceAll("{{SEASON}}", 2024);;

    let req = "{\n";

    console.log("requesting # of events", toLoad.length);

    for (let event of toLoad) {
        req = req.concat(`\t${event}: ${r.replaceAll("{{EVENT_CODE}}", event)}`);
    }
    req = req.concat("\n}");
    req = gql`${req}`;
    
    const q = await request(url, req);

    const newData = Object.values(q).map(event => {
        return Object.assign(event, {
            last_updated: new Date().getTime()
        });
    });

    const currentEvents = Memory.get("events");
    currentEvents.push(...newData);
    Memory.set("events", currentEvents);
    
    console.log("added events " + toLoad.join(", ") + " to memory");
    
    await Wait(10);
    
    saveData(false);

    
    await Wait(10);
    
    loadData();
    
    console.log("loaded events " + toLoad.join(", ") + " into memory");
    
    fileCurrentlyBeingAccessed = false;
    
    return Memory.get("events").filter(event => toLoad.includes(event["code"]) || alreadyLoaded.includes(event["code"]));
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

    try {
        await queryEventData(query);
    } catch (err) {
        console.log("error for event", eventCode, ":", err);
    }
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
            if (data == null || data["eventByCode"] == null) {
                reject("no data");
                return;
            }

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

export { getTeam, getLoadedTeams, getEvent, getLoadedEvents, getMemory, saveToMemory, pruneMemory, saveData, getTeams, getEvents };