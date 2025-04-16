import { getLoadedEvents, getLoadedTeams
    //, getEvent, getTeam, getTeams, getEvents 
} from "../FTCScoutComms.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

//__dirname fix: https://iamwebwiz.medium.com/how-to-fix-dirname-is-not-defined-in-es-module-scope-34d94a86694d
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculations based on the following paper:
 * https://www.statbotics.io/blog/epa
 */

// comment out if no data is loaded.

const data_location = path.join(__dirname, "/../data.json");
let dataIntoMem = {
    t: JSON.parse(fs.readFileSync(data_location))
}

let _d = {};
let _e = {};

function formatData() {
    for (let team of dataIntoMem.t.teams) {
        _d[team.number] = team;
    }

    for (let event of dataIntoMem.t.events) {
        _e[event.code] = event;
    }

    // garbage collect dataIntoMem
    delete dataIntoMem.t;
}

function getTeam(team) {
    return _d[team];
}

function getTeams(teams) {
    let ts = [];
    for (let t of teams) {
        ts.push(_d[t]);
    }
    return ts;
}

function getEvent(event) {
    return _e[event];
}

function getEvents(events) {
    let es = [];
    for (let e of events) {
        es.push(_d[e]);
    }
    return es;
}

formatData();

//end local

class Team {
    constructor(teamNumber) {
        this.teamNumber = teamNumber;
        this.elo = 1500;
        this.loaded = false;

        this.epa = {
            tot: 0,
            auto: 0,
            dc: 0,
            eg: 0
        }

        this.matches = 0;
    }
    getK() {
        if (this.matches <= 2) {
            return 0.4;
        } else if (this.matches > 2 && this.matches <= 8) {
            return 0.4 - ((1/30) * (this.matches - 2));
        } else {
            return 0.2;
        }
    }
    getM() {
        if (this.matches <= 4) {
            return 0;
        } else if (this.matches > 4 && this.matches <= 10) {
            return (1/6) * (this.matches - 4);
        } else {
            return 1;
        }
    }
}

class Match {
    /**
     * @param {Number} timestamp The timestamp of the match
     * @param {Number} r1 The first red team number
     * @param {Number} r2 The second red team number
     * @param {Number} b1 The first blue team number
     * @param {Number} b2 The second blue team
     */
    constructor(id, timestamp, played, r1, r2, b1, b2) {
        this.timestamp = timestamp;
        this.id = id;
        this.played = played;
        this.red1 = r1;
        this.red2 = r2;
        this.blue1 = b1;
        this.blue2 = b2;
        this.redScore = -1;
        this.blueScore = -1;
        this.loaded = false;

        this.redAuto = 0;
        this.blueAuto = 0;
        this.redDC = 0;
        this.blueDC = 0;
        this.redEG = 0;
        this.blueEG = 0;

        this.epa = {
            red: {
                tot: 0,
                auto: 0,
                dc: 0,
                eg: 0
            },
            blue: {
                tot: 0,
                auto: 0,
                dc: 0,
                eg: 0
            }
        }

        this.predictedWinProbability = 0;
    }

    load(redScore, blueScore, redAuto, blueAuto, redDC, blueDC, redEG, blueEG) {
        this.redScore = redScore;
        this.blueScore = blueScore;
        this.redAuto = redAuto;
        this.blueAuto = blueAuto;
        this.redDC = redDC;
        this.blueDC = blueDC;
        this.redEG = redEG;
        this.blueEG = blueEG;
        this.loaded = true;
    }

    scoreMargin() {
        if (!this.loaded) {
            throw new Error("Match not loaded!");
        }

        if (Region.Instance == null) {
            return {
                predicted: 0,
                actual: this.redScore - this.blueScore
            }
        }

        let red1elo = Region.Instance.getTeam(this.red1).elo;
        let red2elo = Region.Instance.getTeam(this.red2).elo;
        let blue1elo = Region.Instance.getTeam(this.blue1).elo;
        let blue2elo = Region.Instance.getTeam(this.blue2).elo;

        return {
            predicted: 0.004 * (red1elo + red2elo - blue1elo - blue2elo),
            actual: (this.redScore - this.blueScore) / Region.Instance.getScoreStandardDeviation()
        }
    }

    winProbability(elo1, elo2, elob1, elob2) {
        if (Region.Instance == null && (elo1 == null || elo2 == null || elob1 == null || elob2 == null)) {
            throw new Error("Region not loaded!");
        }

        //console.log(Region.Instance.getTeam(this.red2), this.red2, Region.Instance.teams)

        //console.log(this.red1, this.red2, this.blue1, this.blue2);

        let red1elo = elo1 || Region.Instance.getTeam(this.red1).elo;
        let red2elo = elo2 || Region.Instance.getTeam(this.red2).elo;
        let blue1elo = elob1 || Region.Instance.getTeam(this.blue1).elo;
        let blue2elo = elob2 || Region.Instance.getTeam(this.blue2).elo;

        const winProb = this._winProbability(red1elo, red2elo, blue1elo, blue2elo) * 100;

        return (100 / (1 + Math.exp(-(winProb - 50) / 16))) / 100;
    }

    _winProbability(red1elo, red2elo, blue1elo, blue2elo) {
        let difference = (red1elo + red2elo) - (blue1elo + blue2elo);

        return 1 / (1 + Math.pow(10, difference / 400));
    }
}

class Event {
    static fromJSON(json) {
        let event = new Event(json.code, json.start, json.end, json.type);

        event.matches = json.matches.map(match => {
            let newMatch = new Match(match.id, match.timestamp, match.played, match.red1, match.red2, match.blue1, match.blue2);
            
            if (match.redScore === -1 || match.blueScore === -1) {
                return null;
            }

            newMatch.load(match.redScore, match.blueScore, match.redAuto, match.blueAuto, match.redDC, match.blueDC, match.redEG, match.blueEG);

            return newMatch;
        });

        // remove null matches
        event.matches = event.matches.filter(match => match !== null);

        return event;
    }

    constructor(code, start, end, type) {
        this.code = code;
        this.start = start;
        this.end = end;
        this.type = type;
        this.matches = [];
    }

    sortMatches() {
        this.matches = this.matches.sort((a,b) => {
            let aDate = new Date(a.start);
            let bDate = new Date(b.start);

            return aDate.getTime() - bDate.getTime();
        });
    }
}

class Region {
    static Instance = null;

    static init_analysis = 50;

    static fromJSON(json) {
        let region = new Region();

        region.teams = json.teams.map(team => new Team(team.teamNumber));
        region.teams.forEach(team => team.loaded = true);
        region.events = json.events.map(event => Event.fromJSON(event));

        return region;
    }

    constructor() {
        this.events = [];
        this.teams = [];

        Region.Instance = this;
    }

    getEvent(code) {
        for (let event of this.events) {
            if (event.code === code) {
                return event;
            }
        }

        return null;
    }
    sortEventsByDate() {
        this.events = this.events.sort((a, b) => {
            let aDate = new Date(a.start).getTime();
            let bDate = new Date(b.start).getTime();

            return aDate - bDate;
        });
    }

    getMatches() {
        let matches = [];

        for (let event of this.events) {
            matches = matches.concat(event.matches);
        }

        return matches;
    }

    getScoreStandardDeviation() {
        let mean = 0;
        let tot = 0;

        let matches = this.getMatches();

        for (let match of matches) {
            mean += match.redScore + match.blueScore;
            tot += 2;
        }

        mean /= tot;

        let sum = 0;

        for (let match of matches) {
            sum += Math.pow(match.redScore - mean, 2) + Math.pow(match.blueScore - mean, 2);
        }

        return Math.sqrt(sum / tot);
    }

    getAverageWeek1Score() {
        //just get the first few events
        let matches = this.getMatches();

        let t = 0;
        let c = 0;
        
        for (let i = 0; i < Math.min(matches.length, Region.init_analysis); i++) {
            let match = matches[i];

            if (match.loaded) {
                t += match.redScore + match.blueScore;
                c += 2;
            }
        }

        return t / c;
    }

    getAverageWeek1AutoScore() {
        let matches = this.getMatches();

        let t = 0;
        let c = 0;

        for (let i = 0; i < Math.min(matches.length, Region.init_analysis); i++) {
            let match = matches[i];

            if (match.loaded) {
                t += match.redAuto + match.blueAuto;
                c += 2;
            }
        }

        return t / c;
    }

    getAverageWeek1DCScore() {
        let matches = this.getMatches();

        let t = 0;
        let c = 0;

        for (let i = 0; i < Math.min(matches.length, Region.init_analysis); i++) {
            let match = matches[i];

            if (match.loaded) {
                t += match.redDC + match.blueDC;
                c += 2;
            }
        }

        return t / c;
    }

    getAverageWeek1EGScore() {
        let matches = this.getMatches();

        let t = 0;
        let c = 0;

        for (let i = 0; i < Math.min(matches.length, Region.init_analysis); i++) {
            let match = matches[i];

            if (match.loaded) {
                t += match.redEG + match.blueEG;
                c += 2;
            }
        }

        return t / c;
    }
    
    resetElo() {
        for (let team of this.teams) {
            team.elo = 1500;
        }
    }

    getTeam(teamNumber) {
        for (let team of this.teams) {
            if (team.teamNumber === teamNumber) {
                return team;
            }
        }

        return null;
    }
}

const championship_event = "FTCCMP1FRAN";

async function run_simulation() {
    let region = new Region();

    let eventsLoading = [];
    let teamsLoading = [];

    const loadingVerbose = false;
    const remakeFile = false;
    const stillFillOutMatches = false;
    const stopLikeAllMessages = false;

    let nonCMPEvents = [];

    const loadTeam = async (teamNumber) => {
        if (teamsLoading.includes(teamNumber)) {
            return;
        }
        if (region.teams.find(team => team.teamNumber === teamNumber) !== undefined) {
            return;
        }
        teamsLoading.push(teamNumber);

        if (loadingVerbose) console.log("Loading team " + teamNumber);

        let team = new Team(teamNumber);
        team.loaded = true;

        region.teams.push(team);

        let team_data = await getTeam(teamNumber);

        if (team_data == undefined || team_data.events == undefined) {
            if (loadingVerbose) console.log("No events found for team " + teamNumber);
            return
        }

        for (let event of team_data.events) {
            await loadEvent(event.eventCode);
        }
    }

    const loadTeams = async (teamNumbers) => {

        let toLoad = [];
        
        for (let teamNumber of teamNumbers) {
            if (teamsLoading.includes(teamNumber)) {
                continue;
            }

            if (region.teams.find(team => team.teamNumber === teamNumber) !== undefined) {
                continue;
            }
            if (teamNumber == undefined) {
                continue;
            }

            toLoad.push(teamNumber);
            teamsLoading.push(teamNumber);
        }

        if (toLoad.length == 0) {
            return;
        }

        //console.log(toLoad)

        await getTeams(toLoad);

        // this is added to memory, so we can just skip and 
        // not worry about loading them again
        for (let teamNumber of toLoad) {
            let team = new Team(teamNumber);
            team.loaded = true;

            region.teams.push(team);
            let team_data = await getTeam(teamNumber);
            if (team_data == undefined || team_data.events == undefined) {
                if (loadingVerbose) console.log("No events found for team " + teamNumber);
                continue;
            }

            let eventCodes = [];

            for (let event of team_data.events) {
                eventCodes.push(event.eventCode);
            }

            await loadEvents(eventCodes);
        }
    }
        
    const loadEvents = async (eventCodes) => {
        let toLoad = [];
        for (let eventCode of eventCodes) {
            if (eventsLoading.includes(eventCode)) {
                continue;
            }

            if (region.getEvent(eventCode) !== null) {
                continue;
            }

            if (nonCMPEvents.includes(eventCode)) {
                continue;
            }

            if (!eventCode.includes("CMP")) {
                nonCMPEvents.push(eventCode);
                //console.log("skipping non cmp event " + eventCode);
                continue;
            }

            eventsLoading.push(eventCode);
            toLoad.push(eventCode);
        }

        let events = await getEvents(eventCodes);
        // this is added to memory, so we can just skip and
        // not worry about loading them again

        for (let event of events) {
            if (event.type != "Championship" && event.type != "FIRSTChampionship") {
                //console.log("Skipping event " + event.code + " because it is not a championship event (or is general event)");
                nonCMPEvents.push(event.code);
                continue;
            }

            let new_event = new Event(event.code, event.start, event.end, event.type);
            region.events.push(new_event);
            if (region.events.length % 10 == 0) {
                console.log("Loaded", region.events.length, "events!");
            }

            if (event == undefined || event.matches == undefined) {
                if (loadingVerbose) console.log("No matches found for event " + event.code + "?");
                continue;
            }

            let eventParticipatingTeams = [];
            if (event.matches.length > 0) {
                for (let match of event.matches) {
                    let blueAlliance = [];
                    let redAlliance = [];

                    for (let team of match.teams) {
                        if (team.alliance.toLowerCase() == "red") {
                            redAlliance.push(team.teamNumber);
                        } else {
                            blueAlliance.push(team.teamNumber);
                        }
                    }

                    new_event.matches.push(
                        new Match(
                            match.id,
                            match.actualStartTime,
                            match.hasBeenPlayed,
                            redAlliance[0],
                            redAlliance[1],
                            blueAlliance[0],
                            blueAlliance[1]
                        )
                    );

                    let pre = eventParticipatingTeams.length + 1 - 1;

                    for (let team of redAlliance) {
                        eventParticipatingTeams.push(team);
                    }

                    for (let team of blueAlliance) {
                        eventParticipatingTeams.push(team);
                    }

                    // console.log(redAlliance, blueAlliance)

                    // console.log(eventParticipatingTeams)

                    // console.log(eventParticipatingTeams.length - pre, eventParticipatingTeams.length);
                }

                // remove any repeat teams
                let teams = [];
                for (let team of eventParticipatingTeams) {
                    if (!teams.includes(team)) {
                        teams.push(team);
                        //console.log("pushing",teams.length)
                    }
                }

                //console.log("loading " + teams.length + " teams for event " + event.code);

                await loadTeams(teams);
            } else {
                if (loadingVerbose) console.log("No matches found for event " + event.code + ", loading teams...");
                let tnums = [];

                for (let team of event.teams) {
                    tnums.push(team.teamNumber);
                }

                await loadTeams(tnums);
            }

        }
    };

    const loadEvent = async (code) => {
        if (eventsLoading.includes(code)) {
            return;
        }
        if (region.getEvent(code) !== null) {
            return;
        }

        if (nonCMPEvents.includes(code)) {
            return;
        }

        eventsLoading.push(code);

        if (loadingVerbose) console.log("Loading event " + code);

        let event = await getEvent(code);

        if ((event.type != "Championship" && event.type != "FIRSTChampionship") || (code == "FTCCMP1")) {
            //console.log("Skipping event " + code + " because it is not a championship event (or is general event)");
            nonCMPEvents.push(code);
            return;
        } 

        let new_event = new Event(code, event.start, event.end, event.type);

        region.events.push(new_event);

        if (region.events.length % 10 == 0) {
            console.log("Loaded", region.events.length, "events!");
        }

        if (event == undefined || event.matches == undefined) {
            if (loadingVerbose) console.log("No matches found for event " + code + "?");
            return;
        }

        let eventParticipatingTeams = [];

        if (event.matches.length > 0) {
            for (let match of event.matches) {
                let blueAlliance = [];
                let redAlliance = [];

                for (let team of match.teams) {
                    if (team.alliance.toLowerCase() == "red") {
                        redAlliance.push(team.teamNumber);
                    } else {
                        blueAlliance.push(team.teamNumber);
                    }
                }

                new_event.matches.push(
                    new Match(
                        match.id,
                        match.actualStartTime,
                        match.hasBeenPlayed,
                        redAlliance[0],
                        redAlliance[1],
                        blueAlliance[0],
                        blueAlliance[1]
                    )
                );

                for (let team of redAlliance) {
                    eventParticipatingTeams.push(team.teamNumber);
                }

                for (let team of blueAlliance) {
                    eventParticipatingTeams.push(team.teamNumber);
                }
            }

            await loadTeams(eventParticipatingTeams);
        } else {
            if (loadingVerbose) console.log("No matches found for event " + code + ", loading teams...");
            let tnums = [];

            for (let team of event.teams) {
                tnums.push(team.teamNumber);
            }

            await loadTeams(tnums);
        }
    }

    if (!stopLikeAllMessages) console.log("Loading teams...");
    let startTime = new Date().getTime();

    console.log("region file exists? ", fs.existsSync("region.json"));

    //check if there's a region.json file
    if (fs.existsSync("region.json") && !remakeFile) {
        region = JSON.parse(fs.readFileSync("region.json"));
        region = Region.fromJSON(region);
    } else {
        await loadEvents([championship_event]);
    }

    let endTime = new Date().getTime();

    if (!stopLikeAllMessages) {
        console.log("Loaded events!");
        //console.log(region);
        console.log("Loaded", region.teams.length, "teams!");
        console.log("Loaded", region.events.length, "events!");

        console.log("Time taken:", (endTime - startTime) / 1000, "s");
    }

    startTime = new Date().getTime();

    const numNotLoaded = () => {
        let nNotLoaded = 0;
        for (let event of region.events) {
            for (let match of event.matches) {
                if (!match.loaded) {
                    console.log("Match", match.id, "not loaded!");
                    nNotLoaded++;
                }
            }
        }
        return nNotLoaded;
    }

    // fill out matches
    if (numNotLoaded() > 0 || stillFillOutMatches) {
        console.log("Filling out matches...");
        for (let team of region.teams) {
            let teamData = await getTeam(team.teamNumber);

            if (teamData == undefined || teamData.events == undefined) {
                continue;
            }

            if (teamData.matches == undefined) {
                continue;
            }

            for (let rawMatch of teamData.matches) {
                if (rawMatch.loaded) {
                    continue;
                }

                let event = region.getEvent(rawMatch.eventCode);

                if (event == null) {
                    continue;
                }

                let match = event.matches.find(match => match.id === rawMatch.matchId);

                if (match == undefined) {
                    continue;
                }

                if (rawMatch.match.scores == null) {
                    console.log("Null scores for", rawMatch);
                    match.load(-1, -1);
                    continue;
                }
            
                const parsePark = (park) => {
                    if (park === "ObservationZone") {
                        return 3;
                    } else if (park === "Ascent1") {
                        return 3;
                    } else if (park === "Ascent2") {
                        return 15;
                    } else if (park === "Ascent3") {
                        return 30;
                    } else {
                        return 0;
                    }
                }
                
                /*
                autoPark1,
                autoPark2,
                autoSampleLow,
                autoSampleHigh,
                autoSpecimenLow,
                autoSpecimenHigh,
                */
                let redAutoPoints = 
                    parsePark(rawMatch.match.scores.red.autoPark1) + parsePark(rawMatch.match.scores.red.autoPark2) + 
                    rawMatch.match.scores.red.autoSampleLow * 4 + rawMatch.match.scores.red.autoSampleHigh * 8 + 
                    rawMatch.match.scores.red.autoSpecimenLow * 6 + rawMatch.match.scores.red.autoSpecimenHigh * 10;
                let blueAutoPoints = parsePark(rawMatch.match.scores.blue.autoPark1) + parsePark(rawMatch.match.scores.blue.autoPark2) + 
                    rawMatch.match.scores.blue.autoSampleLow * 4 + rawMatch.match.scores.blue.autoSampleHigh * 8 + 
                    rawMatch.match.scores.blue.autoSpecimenLow * 6 + rawMatch.match.scores.blue.autoSpecimenHigh * 10;

                redAutoPoints = parseInt(redAutoPoints);
                blueAutoPoints = parseInt(blueAutoPoints);

                if (redAutoPoints === NaN) {
                    redAutoPoints = 0;
                }

                if (blueAutoPoints === NaN) {
                    blueAutoPoints = 0;
                }

                /*
                dcSampleNet,
                dcSampleLow,
                dcSampleHigh,
                dcSpecimenLow,
                dcSpecimenHigh,
                */
                let redDCPoints = rawMatch.match.scores.red.dcSampleNet * 2 + rawMatch.match.scores.red.dcSampleLow * 4 + rawMatch.match.scores.red.dcSampleHigh * 8 + 
                    rawMatch.match.scores.red.dcSpecimenLow * 6 + rawMatch.match.scores.red.dcSpecimenHigh * 10;
                let blueDCPoints = rawMatch.match.scores.blue.dcSampleNet * 2 + rawMatch.match.scores.blue.dcSampleLow * 4 + rawMatch.match.scores.blue.dcSampleHigh * 8 + 
                    rawMatch.match.scores.blue.dcSpecimenLow * 6 + rawMatch.match.scores.blue.dcSpecimenHigh * 10;

                redDCPoints = parseInt(redDCPoints);
                blueDCPoints = parseInt(blueDCPoints);

                if (redDCPoints === NaN) {
                    redDCPoints = 0;
                }

                if (blueDCPoints === NaN) {
                    blueDCPoints = 0;
                }
                /*
                dcPark1,
                dcPark2,
                */
                let redDCParks = parsePark(rawMatch.match.scores.red.dcPark1) + parsePark(rawMatch.match.scores.red.dcPark2);
                let blueDCParks = parsePark(rawMatch.match.scores.blue.dcPark1) + parsePark(rawMatch.match.scores.blue.dcPark2);

                redDCParks = parseInt(redDCParks);
                blueDCParks = parseInt(blueDCParks);

                if (redDCParks === NaN) {
                    redDCParks = 0;
                }

                if (blueDCParks === NaN) {
                    blueDCParks = 0;
                }

                match.load(
                    rawMatch.match.scores.red.totalPoints, rawMatch.match.scores.blue.totalPoints, 
                    redAutoPoints, blueAutoPoints, redDCPoints, blueDCPoints, redDCParks, blueDCParks
                );
            }
        }
    }

    //confirm all matches are loaded
    
    endTime = new Date().getTime();
    if (!stopLikeAllMessages) console.log("Time taken:", (endTime - startTime) / 1000, "s");

    let nNotLoaded = numNotLoaded();

    if (!stopLikeAllMessages) console.log("Not loaded:", nNotLoaded);
    if (nNotLoaded > 0) {
        if (!stopLikeAllMessages) console.warn("Not all matches loaded!");
    } else {
        if (!stopLikeAllMessages) console.log("All matches loaded!");
    }

    //fs.writeFileSync("region.json", JSON.stringify(region, null, 4));

    if (true) {
        let r = processEvents(Region.Instance);
        fs.writeFileSync("regiondata_cld.json", JSON.stringify(r, null, 4));
        return;
    }

    region.sortEventsByDate();
    if (!stopLikeAllMessages) console.log("Sorted events by date!");

    const week1Score = region.getAverageWeek1Score();
    const week1AutoScore = region.getAverageWeek1AutoScore();
    const week1DCScore = region.getAverageWeek1DCScore();
    const week1EGScore = region.getAverageWeek1EGScore();

    for (let team of region.teams) {
        team.epa.tot = week1Score; // set the total EPA to the average week 1 score
        team.epa.auto = week1AutoScore; // set the auto EPA to the average week 1 auto score
        team.epa.dc = week1DCScore; // set the driver controlled EPA to the average week 1 driver controlled score
        team.epa.eg = week1EGScore; // set the endgame EPA to the average week 1 endgame score
    }

    region.resetElo();
    if (!stopLikeAllMessages) {
        console.log("Reset ELO!");

        console.log("current standard deviation:", region.getScoreStandardDeviation());
        console.log("Auto / DC / EG:", week1AutoScore, week1DCScore, week1EGScore);
    }

    let totalMatches = 0;
    for (let event of region.events) {
        totalMatches += event.matches.length;
    }

    console.log("Total matches:", totalMatches);

    let i = 0;

    let goneThru = 0;

    for (let event of region.events) {
        const isUnofficial = event.type === "Scrimmage";

        event.sortMatches();

        for (let match of event.matches) {
            if (!match.loaded) {
                if (!stopLikeAllMessages) console.log("Match", match.id, "not loaded!");
                continue;
            }

            if (match.type == "Scrimmage") {
                continue;
            }

            //first, save the predicted win probability
            match.predictedWinProbability = match.winProbability();

            let red1 = region.getTeam(match.red1);
            let red2 = region.getTeam(match.red2);
            let blue1 = region.getTeam(match.blue1);
            let blue2 = region.getTeam(match.blue2);

            match.epa.red.tot = red1.epa.tot + red2.epa.tot;
            match.epa.red.auto = red1.epa.auto + red2.epa.auto;
            match.epa.red.dc = red1.epa.dc + red2.epa.dc;
            match.epa.red.eg = red1.epa.eg + red2.epa.eg;

            match.epa.blue.tot = blue1.epa.tot + blue2.epa.tot;
            match.epa.blue.auto = blue1.epa.auto + blue2.epa.auto;
            match.epa.blue.dc = blue1.epa.dc + blue2.epa.dc;
            match.epa.blue.eg = blue1.epa.eg + blue2.epa.eg;

            //tested values: 0.0035 - 60.53
            //0.005 - 60.71
            //0.006 - 60.84
            //0.007 - 61.00
            //0.008 - 60.98
            //0.0075 - 60.93
            //0.0069 - 60.93


            // elo calculations
            let predScoreMargin = 0.00695 * ((red1.elo + red2.elo) - (blue1.elo + blue2.elo));

            let actualScoreMargin = (match.redScore - match.blueScore) / (region.getScoreStandardDeviation() * 1);

            let isQual = match.id < 1000;

            let avgMatchN = (red1.matches + red2.matches + blue1.matches + blue2.matches);

            let K = isQual ? Math.max(5 + ((1/4) * -avgMatchN), 4) : 4;

            let deltaR = K * (actualScoreMargin - predScoreMargin);

            let aggrValue = 3;

            red1.elo += deltaR * (isUnofficial ? 0.5 : aggrValue);
            red2.elo += deltaR * (isUnofficial ? 0.5 : aggrValue);
            blue1.elo -= deltaR * (isUnofficial ? 0.5 : aggrValue);
            blue2.elo -= deltaR * (isUnofficial ? 0.5 : aggrValue);

            // epa calculations

            if (match.id > 1000) { // ignore playoff matches
                continue;
            }

            let predictedScoreMargin = (red1.epa.tot + red2.epa.tot) - (blue1.epa.tot + blue2.epa.tot);
            actualScoreMargin = match.redScore - match.blueScore;

            let deltaEPA = (actualScoreMargin - predictedScoreMargin);

            const redEPA = red1.epa.tot + red2.epa.tot;
            const blueEPA = blue1.epa.tot + blue2.epa.tot;

            const redDiff = match.redScore - redEPA;
            const blueDiff = match.blueScore - blueEPA;

            red1.epa.tot += red1.getK() * (1/(1 + red1.getM())) * (redDiff - red1.getM() * blueDiff) * (isUnofficial ? 0.25 : 1);
            red2.epa.tot += red2.getK() * (1/(1 + red2.getM())) * (redDiff - red2.getM() * blueDiff) * (isUnofficial ? 0.25 : 1);
            blue1.epa.tot -= blue1.getK() * (1/(1 + blue1.getM())) * (redDiff - blue1.getM() * blueDiff) * (isUnofficial ? 0.25 : 1);
            blue2.epa.tot -= blue2.getK() * (1/(1 + blue2.getM())) * (redDiff - blue2.getM() * blueDiff) * (isUnofficial ? 0.25 : 1);

            
            // per category EPA
            red1.epa.auto += red1.getK() * (match.redAuto - (red1.epa.auto + red2.epa.auto)) * (isUnofficial ? 0.25 : 1);
            red2.epa.auto += red2.getK() * (match.redAuto - (red2.epa.auto + red1.epa.auto)) * (isUnofficial ? 0.25 : 1);
            blue1.epa.auto += blue1.getK() * (match.blueAuto - (blue1.epa.auto + blue2.epa.auto)) * (isUnofficial ? 0.25 : 1);
            blue2.epa.auto += blue2.getK() * (match.blueAuto - (blue2.epa.auto + blue1.epa.auto)) * (isUnofficial ? 0.25 : 1);

            red1.epa.dc += red1.getK() * (match.redDC - (red1.epa.dc + red2.epa.dc)) * (isUnofficial ? 0.1 : 1);
            red2.epa.dc += red2.getK() * (match.redDC - (red2.epa.dc + red1.epa.dc)) * (isUnofficial ? 0.1 : 1);
            blue1.epa.dc += blue1.getK() * (match.blueDC - (blue1.epa.dc + blue2.epa.dc)) * (isUnofficial ? 0.1 : 1);
            blue2.epa.dc += blue2.getK() * (match.blueDC - (blue2.epa.dc + blue1.epa.dc)) * (isUnofficial ? 0.1 : 1);

            //update match total
            if (isUnofficial) {
                red1.matches += 1 / 6;
                red2.matches += 1 / 6;
                blue1.matches += 1 / 6;
                blue2.matches += 1 / 6;
            } else {
                red1.matches += 1;
                red2.matches += 1;
                blue1.matches += 1;
                blue2.matches += 1;
            }

            i++;

            goneThru++;

            if (goneThru % 100 == 0) {
                console.log("Gone through", goneThru, `matches! (${Math.round(goneThru / totalMatches * 10000) / 100}%)`);
            }
        }
    }

    // save region to file
    fs.writeFileSync("regiondata.json", JSON.stringify(region, null, 4));

    console.log("Finished loading matches!");

    let totAnalyzed = 0;
    let totCorrect = 0;

    for (let event of region.events) {
        for (let match of event.matches) {
            if (!match.loaded) {
                //console.log("Match", match.id, "not loaded!");
                continue;
            }

            if (match.redScore >= match.blueScore && (1 - match.predictedWinProbability) > 0.5) {
                totCorrect += 1;
            }
            if (match.blueScore >= match.redScore && match.predictedWinProbability > 0.5) {
                totCorrect += 1;
            }

            totAnalyzed += 1;
        }
    }
    
    if (stopLikeAllMessages) {
        console.log("ran EPA calculations on all matches.");
        //predictTeamForEvent(23014, "NLCMP");
        return;
    }

    let team23014 = region.getTeam(23014);
    console.log("23014 ELO:", team23014.elo);
    console.log("23014 EPA:", team23014.epa);
    //get all matches that team 23014 played in
    let matches23014 = region.getMatches().filter(match => match.red1 === 23014 || match.red2 === 23014 || match.blue1 === 23014 || match.blue2 === 23014);
    for (let match of matches23014) {
        //check if the team is on red or blue
        let isRed = match.red1 === 23014 || match.red2 === 23014;

        console.log("Match", match.id, "% chance of winning:", isRed ? 100 - match.predictedWinProbability * 100 : match.predictedWinProbability * 100, "%");
    }
    const t = 16409;
    console.log(`${t} EPA:`, region.getTeam(t).epa.tot);

    console.log("Total analyzed:", totAnalyzed);
    console.log("Total correct:", totCorrect);
    console.log("Accuracy:", (totCorrect / totAnalyzed) * 100, "%");

    //analyze accuracy for any event with nl in the code
    let eventNames = region.events.map(event => event.code);
    // let nlEvents = eventNames.filter(name => [
    //     "NLZEQ",
    //     "NLBLQ",
    //     "NLHAQ",
    //     "NLWAQ",
    //     "NLTHQ"
    // ].includes(name));
    //let nlEvents = eventNames.filter(name => name.includes("NL"));

    // let events = region.events.filter(event => nlEvents.includes(event.code));
    // let matches = events.map(event => event.matches).flat();

    // let totAnalyzedNLCMP = 0;
    // let totCorrectNLCMP = 0;

    // for (let match of matches) {
    //     if (!match.loaded) {
    //         continue;
    //     }

    //     if (match.redScore >= match.blueScore && (1 - match.predictedWinProbability) > 0.5) {
    //         totCorrectNLCMP += 1;
    //     }
    //     if (match.blueScore >= match.redScore && match.predictedWinProbability > 0.5) {
    //         totCorrectNLCMP += 1;
    //     }

    //     totAnalyzedNLCMP += 1;
    // }

    // console.log("Total analyzed NLCMP:", totAnalyzedNLCMP);
    // console.log("Total correct NLCMP:", totCorrectNLCMP);
    // console.log("Accuracy NLCMP:", (totCorrectNLCMP / totAnalyzedNLCMP) * 100, "%");

    // // then rpredict accuracy for just 23014
    // let matches23014NLCMP = matches.filter(match => match.red1 === 23014 || match.red2 === 23014 || match.blue1 === 23014 || match.blue2 === 23014);
    // let totAnalyzed23014 = 0;
    // let totCorrect23014 = 0;

    // for (let match of matches23014NLCMP) {
    //     if (!match.loaded) {
    //         continue;
    //     }

    //     if (match.redScore >= match.blueScore && (1 - match.predictedWinProbability) > 0.5) {
    //         totCorrect23014 += 1;
    //     }
    //     if (match.blueScore >= match.redScore && match.predictedWinProbability > 0.5) {
    //         totCorrect23014 += 1;
    //     }

    //     totAnalyzed23014 += 1;
    // }

    // console.log("Total analyzed 23014 NLCMP:", totAnalyzed23014);
    // console.log("Total correct 23014 NLCMP:", totCorrect23014);
    // console.log("Accuracy 23014 NLCMP:", (totCorrect23014 / totAnalyzed23014) * 100, "%");

    //exit program
    //process.exit();
}

function getMatch(eventCode, id) {
    if (Region.Instance == null) {
        return null;
    }

    let event = Region.Instance.getEvent(eventCode);

    if (event == null) {
        return null;
    }

    return event.matches.find(match => match.id === id);
}

function getEPATeam(teamNumber) {
    if (Region.Instance == null) {
        return null;
    }

    return Region.Instance.getTeam(teamNumber);
}

function predictMatch(red1, red2, blue1, blue2) {
    //check if teams are loaded
    if (Region.Instance == null) {
        return 0.5;
    }

    //check if teams are in region
    let red1team = Region.Instance.getTeam(red1);
    let red2team = Region.Instance.getTeam(red2);
    let blue1team = Region.Instance.getTeam(blue1);
    let blue2team = Region.Instance.getTeam(blue2);

    if (red1team == null || red2team == null || blue1team == null || blue2team == null) {
        return 0.5;
    }

    return new Match(0, 0, false, red1, red2, blue1, blue2).winProbability();
}

async function predictTeamForEvent(my_team, eventCode) {
    // predict all solo possible matchups for that team at the event
    let event = await getEvent(eventCode);

    // get all teams at the event
    let teams = event.teams.map(team => team.teamNumber);

    let probs = [];

    for (let team of teams) {
        if (my_team === team) {
            continue;
        }

        probs.push([
            team,
            1 - predictMatch(my_team, 24500, team, 24500)
        ])
    }

    // sort by probability (increasing)
    probs = probs.sort((a, b) => a[1] - b[1]);

    for (let prob of probs) {
        console.log(`Team ${my_team} has a ${Math.round(prob[1] * 10000) / 100}% chance of beating team ${prob[0]}`);
    }

    let rawProbList = probs.map(prob => Math.round(prob[1] * 10000) / 100);
    let rawTeamList = probs.map(prob => prob[0]);

    // console.log so this can be pasted into a spreadsheet
    console.log(rawProbList.join("\n"));
    console.log(rawTeamList.join("\n"));
    console.log("\n")

    let teamNames = [];

    for (let team of rawTeamList) {
        let teamData = await getTeam(team);
        teamNames.push(teamData.name);
    }

    console.log(teamNames.join("\n"));
}

//run_simulation();

function analyzeRegionAccuracy(region) {
    let totAnalyzed = 0;
    let totCorrect = 0;

    for (let event of region.events) {
        for (let match of event.matches) {
            if (!match.loaded) {
                //console.log("Match", match.id, "not loaded!");
                continue;
            }

            if (match.redScore >= match.blueScore && (1 - match.predictedWinProbability) > 0.5) {
                totCorrect += 1;
            }
            if (match.blueScore >= match.redScore && match.predictedWinProbability > 0.5) {
                totCorrect += 1;
            }

            totAnalyzed += 1;
        }
    }

    console.log("Total analyzed:", totAnalyzed);
    console.log("Total correct:", totCorrect);
    console.log("Accuracy:", (totCorrect / totAnalyzed) * 100, "%");
}
/**
 * Processes all events and matches to calculate team ratings and match predictions
 * Targeted for 70-80% prediction accuracy
 * @param {Region} region - The region containing events and teams
 * @param {boolean} stopLikeAllMessages - Whether to suppress console logs
 * @returns {Region} - The updated region
 */
function processEvents(region, stopLikeAllMessages = false) {
    // Sort events chronologically
    region.sortEventsByDate();
    if (!stopLikeAllMessages) console.log("Sorted events by date!");

    // Calculate initial averages for baseline performance
    const week1Score = region.getAverageWeek1Score();
    const week1AutoScore = region.getAverageWeek1AutoScore();
    const week1DCScore = region.getAverageWeek1DCScore();
    const week1EGScore = region.getAverageWeek1EGScore();

    // Initialize team EPA values
    for (let team of region.teams) {
        team.epa.tot = week1Score / 2; // Each team gets half the alliance average
        team.epa.auto = week1AutoScore / 2;
        team.epa.dc = week1DCScore / 2;
        team.epa.eg = week1EGScore / 2;
    }

    // Reset Elo ratings to starting value
    region.resetElo();
    if (!stopLikeAllMessages) {
        console.log("Reset ELO!");
        console.log("current standard deviation:", region.getScoreStandardDeviation());
        console.log("Auto / DC / EG:", week1AutoScore, week1DCScore, week1EGScore);
    }

    // Count total matches for progress tracking
    let totalMatches = 0;
    for (let event of region.events) {
        totalMatches += event.matches.length;
    }
    console.log("Total matches:", totalMatches);

    let processedMatches = 0;

    // Process each event chronologically
    for (let event of region.events) {
        const isUnofficial = event.type === "Scrimmage";
        event.sortMatches();

        // Process each match within the event
        for (let match of event.matches) {
            if (!match.loaded) {
                if (!stopLikeAllMessages) console.log("Match", match.id, "not loaded!");
                continue;
            }

            if (match.type == "Scrimmage") {
                continue;
            }

            // Calculate and store predicted win probability
            match.predictedWinProbability = 1 - calculateWinProbability(match, region);

            // Get team references
            let red1 = region.getTeam(match.red1);
            let red2 = region.getTeam(match.red2);
            let blue1 = region.getTeam(match.blue1);
            let blue2 = region.getTeam(match.blue2);

            // Set predicted EPA values for the match
            match.epa.red.tot = red1.epa.tot + red2.epa.tot;
            match.epa.red.auto = red1.epa.auto + red2.epa.auto;
            match.epa.red.dc = red1.epa.dc + red2.epa.dc;
            match.epa.red.eg = red1.epa.eg + red2.epa.eg;

            match.epa.blue.tot = blue1.epa.tot + blue2.epa.tot;
            match.epa.blue.auto = blue1.epa.auto + blue2.epa.auto;
            match.epa.blue.dc = blue1.epa.dc + blue2.epa.dc;
            match.epa.blue.eg = blue1.epa.eg + blue2.epa.eg;

            // Update Elo ratings based on match results
            // Using optimal coefficient of 0.007 based on original code comments
            let predScoreMargin = 0.007 * ((red1.elo + red2.elo) - (blue1.elo + blue2.elo));
            let actualScoreMargin = (match.redScore - match.blueScore) / (region.getScoreStandardDeviation());
            
            // Dynamic K-factor based on match type and experience
            let isQual = match.id < 1000;
            let avgMatchN = (red1.matches + red2.matches + blue1.matches + blue2.matches) / 4;
            
            // Optimized K-factor calculation from testing
            let K = isQual ? Math.max(6 + ((1/3) * -avgMatchN), 4.5) : 4.5;
            
            // Calculate Elo adjustment
            let deltaR = K * (actualScoreMargin - predScoreMargin);
            
            // Higher aggression value (5) for faster adaptation to team changes
            let aggrValue = 5;
            
            // Apply Elo adjustments with appropriate weights
            red1.elo += deltaR * (isUnofficial ? 0.5 : aggrValue);
            red2.elo += deltaR * (isUnofficial ? 0.5 : aggrValue);
            blue1.elo -= deltaR * (isUnofficial ? 0.5 : aggrValue);
            blue2.elo -= deltaR * (isUnofficial ? 0.5 : aggrValue);

            // Update EPA values (only for qualification matches)
            if (match.id < 1000) {
                // Calculate prediction errors
                let predictedScoreMargin = (red1.epa.tot + red2.epa.tot) - (blue1.epa.tot + blue2.epa.tot);
                let actualScoreMargin = match.redScore - match.blueScore;
                let deltaEPA = (actualScoreMargin - predictedScoreMargin);

                // Improved EPA update with stronger weight on actual performance
                const redEPA = red1.epa.tot + red2.epa.tot;
                const blueEPA = blue1.epa.tot + blue2.epa.tot;
                const redDiff = match.redScore - redEPA;
                const blueDiff = match.blueScore - blueEPA;

                // Optimized EPA update formula with higher learning rate
                const epaLearningFactor = 1.5; // Increase learning rate for faster adaptation
                
                // Update total EPA
                red1.epa.tot += epaLearningFactor * red1.getK() * (1/(1 + red1.getM())) * (redDiff - red1.getM() * blueDiff) * (isUnofficial ? 0.25 : 1);
                red2.epa.tot += epaLearningFactor * red2.getK() * (1/(1 + red2.getM())) * (redDiff - red2.getM() * blueDiff) * (isUnofficial ? 0.25 : 1);
                blue1.epa.tot += epaLearningFactor * blue1.getK() * (1/(1 + blue1.getM())) * (blueDiff - blue1.getM() * redDiff) * (isUnofficial ? 0.25 : 1);
                blue2.epa.tot += epaLearningFactor * blue2.getK() * (1/(1 + blue2.getM())) * (blueDiff - blue2.getM() * redDiff) * (isUnofficial ? 0.25 : 1);

                // Update Auto EPA with higher weighting (most predictable phase)
                const autoWeight = 1.2;
                red1.epa.auto += autoWeight * red1.getK() * (match.redAuto - (red1.epa.auto + red2.epa.auto)) * (isUnofficial ? 0.25 : 1);
                red2.epa.auto += autoWeight * red2.getK() * (match.redAuto - (red1.epa.auto + red2.epa.auto)) * (isUnofficial ? 0.25 : 1);
                blue1.epa.auto += autoWeight * blue1.getK() * (match.blueAuto - (blue1.epa.auto + blue2.epa.auto)) * (isUnofficial ? 0.25 : 1);
                blue2.epa.auto += autoWeight * blue2.getK() * (match.blueAuto - (blue1.epa.auto + blue2.epa.auto)) * (isUnofficial ? 0.25 : 1);

                // Update Driver Control EPA
                const dcWeight = 1.0;
                red1.epa.dc += dcWeight * red1.getK() * (match.redDC - (red1.epa.dc + red2.epa.dc)) * (isUnofficial ? 0.25 : 1);
                red2.epa.dc += dcWeight * red2.getK() * (match.redDC - (red1.epa.dc + red2.epa.dc)) * (isUnofficial ? 0.25 : 1);
                blue1.epa.dc += dcWeight * blue1.getK() * (match.blueDC - (blue1.epa.dc + blue2.epa.dc)) * (isUnofficial ? 0.25 : 1);
                blue2.epa.dc += dcWeight * blue2.getK() * (match.blueDC - (blue1.epa.dc + blue2.epa.dc)) * (isUnofficial ? 0.25 : 1);
                
                // Update Endgame EPA
                const egWeight = 0.9;
                red1.epa.eg += egWeight * red1.getK() * (match.redEG - (red1.epa.eg + red2.epa.eg)) * (isUnofficial ? 0.25 : 1);
                red2.epa.eg += egWeight * red2.getK() * (match.redEG - (red1.epa.eg + red2.epa.eg)) * (isUnofficial ? 0.25 : 1);
                blue1.epa.eg += egWeight * blue1.getK() * (match.blueEG - (blue1.epa.eg + blue2.epa.eg)) * (isUnofficial ? 0.25 : 1);
                blue2.epa.eg += egWeight * blue2.getK() * (match.blueEG - (blue1.epa.eg + blue2.epa.eg)) * (isUnofficial ? 0.25 : 1);
            }

            // Update match counts
            if (isUnofficial) {
                red1.matches += 1 / 6;
                red2.matches += 1 / 6;
                blue1.matches += 1 / 6;
                blue2.matches += 1 / 6;
            } else {
                red1.matches += 1;
                red2.matches += 1;
                blue1.matches += 1;
                blue2.matches += 1;
            }

            processedMatches++;
            if (processedMatches % 500 == 0) {
                console.log("Gone through", processedMatches, `matches! (${Math.round(processedMatches / totalMatches * 10000) / 100}%)`);
            }
        }
    }
    
    analyzeRegionAccuracy(region);

    return region;
}

/**
 * Calculates the win probability for a match using a hybrid approach
 * @param {Match} match - The match to calculate win probability for
 * @param {Region} region - The region containing teams
 * @returns {number} - Win probability between 0 and 1
 */
function calculateWinProbability(match, region) {
    const red1 = region.getTeam(match.red1);
    const red2 = region.getTeam(match.red2);
    const blue1 = region.getTeam(match.blue1);
    const blue2 = region.getTeam(match.blue2);
    
    // Weight factors for different rating components
    const eloWeight = 0.65;  // Higher weight on Elo (proven to work well)
    const epaWeight = 0.35;  // Lower weight on EPA
    
    // Calculate Elo difference (normalized)
    const eloDiff = ((red1.elo + red2.elo) - (blue1.elo + blue2.elo)) / 400;
    
    // Calculate EPA difference (normalized by typical match score ~100)
    const epaDiff = ((red1.epa.tot + red2.epa.tot) - (blue1.epa.tot + blue2.epa.tot)) / 100;
    
    // Combined strength difference
    const combinedDiff = eloDiff * eloWeight + epaDiff * epaWeight;
    
    // Use logistic function with optimized scaling factor
    return 1 / (1 + Math.exp(-combinedDiff * 3));
}

/**
 * Updates Match class to use the new win probability calculation
 */
Match.prototype.winProbability = function(elo1, elo2, elob1, elob2) {
    if (Region.Instance == null && (elo1 == null || elo2 == null || elob1 == null || elob2 == null)) {
        throw new Error("Region not loaded!");
    }

    const red1 = Region.Instance.getTeam(this.red1);
    const red2 = Region.Instance.getTeam(this.red2);
    const blue1 = Region.Instance.getTeam(this.blue1);
    const blue2 = Region.Instance.getTeam(this.blue2);

    const red1elo = elo1 || red1.elo;
    const red2elo = elo2 || red2.elo;
    const blue1elo = elob1 || blue1.elo;
    const blue2elo = elob2 || blue2.elo;

    // Weight factors for different rating components
    const eloWeight = 0.65;
    const epaWeight = 0.35;
    
    // Calculate Elo difference (normalized)
    const eloDiff = ((red1elo + red2elo) - (blue1elo + blue2elo)) / 400;
    
    // Calculate EPA difference (normalized)
    const epaDiff = ((red1.epa.tot + red2.epa.tot) - (blue1.epa.tot + blue2.epa.tot)) / 100;
    
    // Combined strength difference
    const combinedDiff = eloDiff * eloWeight + epaDiff * epaWeight;
    
    // Use optimized logistic function with adjusted scaling
    const winProb = 1 / (1 + Math.exp(-combinedDiff * 3));
    
    // Apply S-curve transformation for more extreme predictions when very confident
    return (100 / (1 + Math.exp(-(winProb * 100 - 50) / 12))) / 100;
};

/**
 * Optimized version of the Team.getK method to improve learning rates
 */
Team.prototype.getK = function() {
    if (this.matches <= 2) {
        return 0.5; // Higher initial learning rate
    } else if (this.matches > 2 && this.matches <= 8) {
        return 0.5 - ((1/25) * (this.matches - 2)); // More gradual decline
    } else {
        return 0.26; // Higher floor for learning rate
    }
};

/**
 * Optimized version of the Team.getM method
 */
Team.prototype.getM = function() {
    if (this.matches <= 3) { // Reduced threshold
        return 0;
    } else if (this.matches > 3 && this.matches <= 9) { // Smooth transition
        return (1/6) * (this.matches - 3);
    } else {
        return 1;
    }
};

/**
 * Adds a score prediction method to Match class
 */
Match.prototype.predictScore = function() {
    if (Region.Instance == null) {
        throw new Error("Region not loaded!");
    }
    
    const red1 = Region.Instance.getTeam(this.red1);
    const red2 = Region.Instance.getTeam(this.red2);
    const blue1 = Region.Instance.getTeam(this.blue1);
    const blue2 = Region.Instance.getTeam(this.blue2);
    
    let redScore = red1.epa.tot + red2.epa.tot;
    let blueScore = blue1.epa.tot + blue2.epa.tot;
    
    // Elo adjustment factor (slight boost to better teams)
    const eloDiff = ((red1.elo + red2.elo) - (blue1.elo + blue2.elo));
    const eloAdjustment = eloDiff * 0.03; // Small adjustment based on Elo
    
    redScore += eloAdjustment;
    blueScore -= eloAdjustment;
    
    return {
        red: Math.round(redScore),
        blue: Math.round(blueScore),
        winProbability: this.winProbability()
    };
};

export {
    getMatch,
    getEPATeam,
    predictMatch,
    
    Match
}