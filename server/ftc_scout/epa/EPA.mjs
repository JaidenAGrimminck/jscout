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

        this.matches = 0;
    }
    getK() {
        if (this.matches <= 2) {
            return 0.5;
        } else if (this.matches > 2 && this.matches <= 8) {
            return 0.5 - ((1/30) * (this.matches - 2));
        } else {
            return 0.3;
        }
    }
    getM() {
        if (this.matches <= 6) {
            return 0;
        } else if (this.matches > 4 && this.matches <= 12) {
            return (1/24) * (this.matches - 4);
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

    winProbability() {
        if (Region.Instance == null) {
            throw new Error("Region not loaded!");
        }

        let red1elo = Region.Instance.getTeam(this.red1).elo;
        let red2elo = Region.Instance.getTeam(this.red2).elo;
        let blue1elo = Region.Instance.getTeam(this.blue1).elo;
        let blue2elo = Region.Instance.getTeam(this.blue2).elo;

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
        
        for (let i = 0; i < (5 > matches.length ? matches.length : 5); i++) {
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

        for (let i = 0; i < (5 > matches.length ? matches.length : 5); i++) {
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

        for (let i = 0; i < (5 > matches.length ? matches.length : 5); i++) {
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

        for (let i = 0; i < (5 > matches.length ? matches.length : 5); i++) {
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

const championship_event = "NLCMP";

async function run_simulation() {
    let region = new Region();

    let eventsLoading = [];
    let teamsLoading = [];

    const loadingVerbose = false;
    const remakeFile = false;
    const stillFillOutMatches = false;
    const stopLikeAllMessages = true;

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
        let new_event = new Event(code, event.start, event.end, event.type);

        region.events.push(new_event);

        if (region.events.length % 10 == 0) {
            console.log("Loaded", region.events.length, "events!");
        }

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

    if (!stopLikeAllMessages) console.log("Loading teams...");
    let startTime = new Date().getTime();

    //check if there's a region.json file
    if (fs.existsSync("region.json") && !remakeFile) {
        region = JSON.parse(fs.readFileSync("region.json"));
        region = Region.fromJSON(region);
    } else {
        await loadEvent(championship_event);
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

    fs.writeFileSync("region.json", JSON.stringify(region, null, 4));

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

    let i = 0;

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

            // elo calculations
            let predScoreMargin = 0.0035 * ((red1.elo + red2.elo) - (blue1.elo + blue2.elo));

            let actualScoreMargin = (match.redScore - match.blueScore) / (region.getScoreStandardDeviation() * 1);

            let isQual = match.id < 1000;

            let K = isQual ? 12 : 3;

            let deltaR = K * (actualScoreMargin - predScoreMargin);

            red1.elo += deltaR * (isUnofficial ? 0.5 : 1);
            red2.elo += deltaR * (isUnofficial ? 0.5 : 1);
            blue1.elo -= deltaR * (isUnofficial ? 0.5 : 1);
            blue2.elo -= deltaR * (isUnofficial ? 0.5 : 1);

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
        }
    }

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

    //exit program
    //process.exit();
}

function getMatch(eventCode, id) {
    let event = Region.Instance.getEvent(eventCode);

    if (event == null) {
        return null;
    }

    return event.matches.find(match => match.id === id);
}

function getEPATeam(teamNumber) {
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

run_simulation();

export {
    getMatch,
    getEPATeam,
    predictMatch
}