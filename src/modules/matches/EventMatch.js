import React, { useEffect, useState } from 'react';
import styles from "./evtmatches.module.css";
import Link from 'next/link';
import getURL from '../server/Server';

export default function EventMatches({ matches, filter, eventCode }) {
    const [matchData, setMatchData] = useState([]);

    const qualificationMatches = [];
    const playoffMatches = [];

    const teamInMatch = (match, teamNum) => {
        for (let team of match.teams) {
            if (team.teamNumber == teamNum) {
                return true;
            }
        }
        return false;
    }

    const allMatchIds = [];

    for (let match of matches) {
        if (!(filter == undefined || filter == null) && !teamInMatch(match, filter)) {
            continue;
        }

        if ((match.matchId === undefined ? match.id : match.matchId) < 200) {
            qualificationMatches.push(match);
        } else {
            playoffMatches.push(match);
        }

        allMatchIds.push(match.matchId === undefined ? match.id : match.matchId);
    }

    React.useEffect(() => {     
        if (allMatchIds.length > 0) {
            fetch(`${getURL()}/v1/matches`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    eventCode,
                    matchIds: allMatchIds
                })
            })
                .then((data) => data.json())
                .then((data) => {
                    setMatchData(data);
                    console.log(data)
                });
        }
    }, []);

    const widdleDown = (n1, l) => {
        let toStr = n1.toString();
        let n2 = toStr.substring(0, l);
        return n2;
    }

    if (matchData.length !== allMatchIds.length) {
        return (
            <div className={styles["event-matches"]}>
                <div className={styles["table-text"] + " " + styles["table-header"]}>
                    <span>Match</span>
                    <span>Red Alliance</span>
                    <span>Blue Alliance</span>
                    <span>Scores</span>
                    <span>Scores Preds</span>
                    <span>Win Preds</span>
                </div>
                <div className={styles["table-text"]}>
                    <span>Loading...</span>
                </div>
            </div>
        )
    }
    
    if (matchData.length == 0) {
        return (
            <div className={styles["event-matches"]}>
                <div className={styles["table-text"] + " " + styles["table-header"]}>
                </div>
                <div className={styles["table-text"]}>
                    <span>No matches found</span>
                </div>
            </div>
        )
    }

    return (
        <div className={styles["event-matches"]}>
            <div className={styles["table-text"] + " " + styles["table-header"]}>
                <span>Match</span>
                <span>Red Alliance</span>
                <span>Blue Alliance</span>
                <span>Scores</span>
                <span>Scores Preds</span>
                <span>Win Preds</span>
            </div>
            <div className={styles["table-text"]}>
                <span>Qualifications</span>
            </div>
            <div key={"table-matches-quals"} className={styles["table-matches"]}>
                {
                    qualificationMatches.map((match) => {
                        let scores = matchData.find((matchData) => {
                            return matchData.id === (match.matchId === undefined ? match.id : match.matchId);
                        });
                        
                        let omatch = null;

                        if (scores !== undefined && scores !== null) {
                            omatch = scores;
                            scores = scores.scores;
                        }

                        let redWin = scores ? (scores.red.totalPoints > scores.blue.totalPoints) : false;

                        let onRed = false;

                        if (match.teams[0].teamNumber == filter || match.teams[1].teamNumber == filter) {
                            onRed = true;
                        }
                        
                        let pred = omatch ? Math.round(omatch.predicted_red_win_probability * 1000) / 10 : "n/a";

                        if (filter) {
                            if (!onRed) {
                                pred = 100 - pred;
                            }
                        }

                        let correctPred = false;

                        if (scores) {
                            correctPred = (scores.red.totalPoints > scores.blue.totalPoints) == (omatch.predicted_red_win_probability > 0.5);
                        }

                        let predRedEPA = -1;
                        let predBlueEPA = -1;

                        if (omatch) {
                            if (omatch.epa) {
                                predRedEPA = omatch.epa.red.tot;
                                predBlueEPA = omatch.epa.blue.tot;
                            }
                        }

                        return (
                            <div key={(match.matchId === undefined ? match.id : match.matchId) + "-match-" + Math.random()} className={styles["table-match"]}>
                                <div>
                                <Link href={`/matches/${eventCode}:${(match.matchId === undefined ? match.id : match.matchId)}`}><span>Qualification {match.id}</span></Link>
                                </div>
                                <div>
                                    <span className={(match.teams[0].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[0].teamNumber}`}>{match.teams[0].teamNumber}</Link></span>
                                    <span className={(match.teams[1].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[1].teamNumber}`}>{match.teams[1].teamNumber}</Link></span>
                                </div>
                                <div>
                                    <span className={(match.teams[2].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (!redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[2].teamNumber}`}>{match.teams[2].teamNumber}</Link></span>
                                    <span className={(match.teams[3].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (!redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[3].teamNumber}`}>{match.teams[3].teamNumber}</Link></span>
                                </div>
                                <div>
                                    <span className={scores ? (scores.red.totalPoints > scores.blue.totalPoints ? styles["strong"] : "") : ""}>{scores ? scores.red.totalPoints : "n/a"} {scores ? (scores.red.totalPointsNp < scores.red.totalPoints ? `(${scores.red.totalPointsNp}+${scores.red.totalPoints - scores.red.totalPointsNp})` : ``) : "" }</span>
                                </div>
                                <div>
                                    <span className={scores ? (scores.blue.totalPoints > scores.red.totalPoints ? styles["strong"] : "") : ""}>{scores ? scores.blue.totalPoints : "n/a"} {scores ? (scores.blue.totalPointsNp < scores.blue.totalPoints ? `(${scores.blue.totalPointsNp}+${scores.blue.totalPoints - scores.blue.totalPointsNp})` : ``) : "" }</span>
                                </div>
                                <div>
                                    <span className={scores ? (scores.red.totalPoints > scores.blue.totalPoints ? styles["strong"] : "") : ""}>
                                        {predRedEPA > -1 ? Math.round(predRedEPA / 2) : "n/a"}
                                    </span>
                                </div>
                                <div>
                                    <span className={scores ? (scores.blue.totalPoints > scores.red.totalPoints ? styles["strong"] : "") : ""}>
                                        {predBlueEPA > -1 ? Math.round(predBlueEPA / 2) : "n/a"}
                                    </span>
                                </div>
                                <div style={{
                                    backgroundColor: (typeof pred === "number" ? (correctPred ? "var(--color-correct)" : "var(--color-incorrect)") : "var(--color-neutral)")
                                }}>
                                    <span>{widdleDown(pred, 4)}% {typeof pred === "number" ? `(${pred > 50 ? "Win" : pred == 50 ? "Tie" : "Loss"})` : ``}</span>
                                </div>
                            </div>
                        );
                    })
                }
            </div>
            {
                playoffMatches.length > 0 &&
                <>
                    <div key={"table-playoff-matches-text"} className={styles["table-text"] + " " + styles["table-text-top-border"]}>
                        <span>Playoffs</span>
                    </div>
                    <div key={"table-playoff-matches"} className={styles["table-matches"]}>
                        {
                            playoffMatches.map((match) => {
                                let scores = matchData.find((matchData) => {
                                    return matchData.id === (match.matchId === undefined ? match.id : match.matchId);
                                });

                                let omatch = null;

                                if (scores !== undefined && scores !== null) {
                                    omatch = scores;
                                    scores = scores.scores;
                                }

                                let redWin = scores ? (scores.red.totalPoints > scores.blue.totalPoints) : false;

                                let onRed = false;

                                if (match.teams[0].teamNumber == filter || match.teams[1].teamNumber == filter) {
                                    onRed = true;
                                }
                                
                                let pred = omatch ? Math.round(omatch.predicted_red_win_probability * 1000) / 10 : "n/a";

                                if (filter) {
                                    if (!onRed) {
                                        pred = 100 - pred;
                                    }
                                }

                                let correctPred = false;

                                if (scores) {
                                    correctPred = (scores.red.totalPoints > scores.blue.totalPoints) == (omatch.predicted_red_win_probability > 0.5);
                                }

                                let predRedEPA = -1;
                                let predBlueEPA = -1;

                                if (omatch) {
                                    if (omatch.epa) {
                                        predRedEPA = omatch.epa.red.tot;
                                        predBlueEPA = omatch.epa.blue.tot;
                                    }
                                }

                                return (
                                    <div key={(match.matchId === undefined ? match.id : match.matchId) + "-match-" + Math.random()} className={styles["table-match"]}>
                                        <div>
                                            <Link href={`/matches/${eventCode}:${(match.matchId === undefined ? match.id : match.matchId)}`}><span>Playoff {Math.floor((match.id - 20000) / 1000)}-{match.id - (Math.floor(match.id / 1000) * 1000)}</span></Link>
                                        </div>
                                        <div>
                                            <span className={(match.teams[0].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[0].teamNumber}`}>{match.teams[0].teamNumber}</Link></span>
                                            <span className={(match.teams[1].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[1].teamNumber}`}>{match.teams[1].teamNumber}</Link></span>
                                        </div>
                                        <div>
                                            <span className={(match.teams[2].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (!redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[2].teamNumber}`}>{match.teams[2].teamNumber}</Link></span>
                                            <span className={(match.teams[3].teamNumber == filter ? styles["underline"] : "") + " " + (scores ? (!redWin ? styles["strong"] : "") : "")}><Link href={`/teams/${match.teams[3].teamNumber}`}>{match.teams[3].teamNumber}</Link></span>
                                        </div>
                                        <div>
                                            <span className={scores ? (scores.red.totalPoints > scores.blue.totalPoints ? styles["strong"] : "") : ""}>{scores ? scores.red.totalPoints : "n/a"}</span>
                                        </div>
                                        <div>
                                            <span className={scores ? (scores.blue.totalPoints > scores.red.totalPoints ? styles["strong"] : "") : ""}>{scores ? scores.blue.totalPoints : "n/a"}</span>
                                        </div>
                                        <div>
                                            <span className={scores ? (scores.red.totalPoints > scores.blue.totalPoints ? styles["strong"] : "") : ""}>
                                                {predRedEPA > -1 ? Math.round(predRedEPA) : "n/a"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className={scores ? (scores.blue.totalPoints > scores.red.totalPoints ? styles["strong"] : "") : ""}>
                                                {predBlueEPA > -1 ? Math.round(predBlueEPA) : "n/a"}
                                            </span>
                                        </div>
                                        <div style={{
                                            backgroundColor: (typeof pred === "number" ? (correctPred ? "var(--color-correct)" : "var(--color-incorrect)") : "var(--color-neutral)")
                                        }}>
                                            <span>{widdleDown(pred, 4)}% {typeof pred === "number" ? `(${pred > 50 ? "Win" : "Loss"})` : ``}</span>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </>
            }
        </div>
    );
}