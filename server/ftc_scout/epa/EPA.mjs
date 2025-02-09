import { getEvent, getLoadedEvents, getLoadedTeams, getTeam } from "../FTCScoutComms.mjs";
import fs from "fs";

/**
 * Calculations based on the following paper:
 * https://www.statbotics.io/blog/epa
 */

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

        this.predictedWinProbability = 0;
    }

    load(redScore, blueScore) {
        this.redScore = redScore;
        this.blueScore = blueScore;
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

    winProbability() {
        if (Region.Instance == null) {
            throw new Error("Region not loaded!");
        }

        let red1elo = Region.Instance.getTeam(this.red1).elo;
        let red2elo = Region.Instance.getTeam(this.red2).elo;
        let blue1elo = Region.Instance.getTeam(this.blue1).elo;
        let blue2elo = Region.Instance.getTeam(this.blue2).elo;

        return this._winProbability(red1elo, red2elo, blue1elo, blue2elo);
    }

    _winProbability(red1elo, red2elo, blue1elo, blue2elo) {
        let difference = (red1elo + red2elo) - (blue1elo + blue2elo);

        return 1 / (1 + Math.pow(10, difference / 400));
    }
}

class Event {
    static fromJSON(json) {
        let event = new Event(json.code, json.start, json.end);

        event.matches = json.matches.map(match => {
            let newMatch = new Match(match.id, match.timestamp, match.played, match.red1, match.red2, match.blue1, match.blue2);
            newMatch.load(match.redScore, match.blueScore);
            return newMatch;
        });

        return event;
    }

    constructor(code, start, end) {
        this.code = code;
        this.start = start;
        this.end = end;
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
            let aDate = new Date(a.start);
            let bDate = new Date(b.start);

            return bDate - aDate;
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
        
        for (let i = 0; i < (5 > matches.length ? matches.length : 5); i++) {
            let match = matches[i];

            if (match.loaded) {
                t += match.redScore + match.blueScore;
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

const championship_event = "NLCMP";

async function run_simulation() {
    let region = new Region();

    let eventsLoading = [];
    let teamsLoading = [];

    const loadingVerbose = false;

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

    const loadEvent = async (code) => {
        if (eventsLoading.includes(code)) {
            return;
        }
        if (region.getEvent(code) !== null) {
            return;
        }

        eventsLoading.push(code);

        if (loadingVerbose) console.log("Loading event " + code);

        let event = await getEvent(code);
        let new_event = new Event(code);

        new_event.start = event.start;
        new_event.end = event.end;

        region.events.push(new_event);

        if (event == undefined || event.matches == undefined) {
            if (loadingVerbose) console.log("No matches found for event " + code + "?");
            return;
        }

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
                    await loadTeam(team);
                }

                for (let team of blueAlliance) {
                    await loadTeam(team);
                }
            }
        } else {
            if (loadingVerbose) console.log("No matches found for event " + code + ", loading teams...");
            for (let team of event.teams) {
                await loadTeam(team.teamNumber);
            }
        }
    }

    console.log("Loading teams...");
    let startTime = new Date().getTime();

    //check if there's a region.json file
    if (fs.existsSync("region.json")) {
        region = JSON.parse(fs.readFileSync("region.json"));
        region = Region.fromJSON(region);
    } else {
        await loadEvent(championship_event);
    }

    let endTime = new Date().getTime();
    
    console.log("Loaded events!");
    //console.log(region);
    console.log("Loaded", region.teams.length, "teams!");
    console.log("Loaded", region.events.length, "events!");

    console.log("Time taken:", (endTime - startTime) / 1000, "s");

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

    if (numNotLoaded() > 0) {
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
            
                match.load(rawMatch.match.scores.red.totalPoints, rawMatch.match.scores.blue.totalPoints);
            }
        }
    }

    //confirm all matches are loaded
    
    endTime = new Date().getTime();
    console.log("Time taken:", (endTime - startTime) / 1000, "s");

    let nNotLoaded = numNotLoaded();

    console.log("Not loaded:", nNotLoaded);
    if (nNotLoaded > 0) {
        console.warn("Not all matches loaded!");
    } else {
        console.log("All matches loaded!");
    }

    fs.writeFileSync("region.json", JSON.stringify(region, null, 4));

    region.sortEventsByDate();
    console.log("Sorted events by date!");

    const week1Score = region.getAverageWeek1Score();

    for (let team of region.teams) {
    }

    region.resetElo();
    console.log("Reset ELO!");

    console.log("current standard deviation:", region.getScoreStandardDeviation());

    for (let event of region.events) {
        event.sortMatches();

        for (let match of event.matches) {
            if (!match.loaded) {
                console.log("Match", match.id, "not loaded!");
                continue;
            }

            //first, save the predicted win probability
            match.predictedWinProbability = match.winProbability();

            let red1 = region.getTeam(match.red1);
            let red2 = region.getTeam(match.red2);
            let blue1 = region.getTeam(match.blue1);
            let blue2 = region.getTeam(match.blue2);

            // elo calculations
            let predScoreMargin = 0.004 * ((red1.elo + red2.elo) - (blue1.elo + blue2.elo));

            let actualScoreMargin = (match.redScore - match.blueScore) / region.getScoreStandardDeviation();

            let isQual = match.id < 1000;

            let K = isQual ? 12 : 3;

            let deltaR = K * (actualScoreMargin - predScoreMargin);

            red1.elo += deltaR;
            red2.elo += deltaR;
            blue1.elo -= deltaR;
            blue2.elo -= deltaR;
        }
    }
    
    let team23014 = region.getTeam(23014);
    console.log("23014 ELO:", team23014.elo);

    //exit program
    //process.exit();
}

run_simulation();