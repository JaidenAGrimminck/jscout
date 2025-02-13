"use client";

import React from "react";

import styles from "./playoffs.module.css";
import Menu from "@/modules/menu/menu";
import Link from "next/link";
import getURL from "@/modules/server/Server";

const playoffStructure = [
    [ // round 1
        {
            match: [1, 1],
            teams: [
                ["alliance", 1], //red
                ["alliance", 4] //blue
            ]
        },
        {
            match: [1, 2],
            teams: [
                ["alliance", 2], //red
                ["alliance", 3] //blue
            ]
        }
    ],
    [ // round 2
        {
            match: [2, 1],
            teams: [
                ["loser", [1, 1]], //red
                ["loser", [1, 2]] //blue
            ]
        },
        {
            match: [2, 2],
            teams: [
                ["winner", [1, 1]], //red
                ["winner", [1, 2]] //blue
            ]
        }
    ],
    [ // round 3
        {
            match: [3, 1],
            teams: [
                ["loser", [2, 2]], //red
                ["winner", [2, 1]] //blue
            ]
        }
    ],
    [ // round 4
        {
            match: [4, 1],
            teams: [
                ["winner", [2, 2]], //red
                ["winner", [3, 1]] //blue
            ]
        }
    ]
];

function LinkAlt({ href, children, id }) {
    return (
        <a href={href} id={id}>{children}</a>
    )
}

function Playoff(props) {
    const skipToBottom = props.skipToBottom || false;
    const centered = props.centered || false;

    const k = props.k || [0, 0];

    function PlayoffSide({ isRed, k }) {
        return (
            <div className={styles["playoff-side"]}>
                <div className={styles["playoff-teams"]}>
                    <div className={styles["playoff-team"]} style={{
                        backgroundColor: isRed ? "var(--color-red-bg)" : "var(--color-blue-bg)"
                    }}>
                        <LinkAlt href={`/teams/`} id={`pf-${k[0]}-${k[1]}-${isRed ? "red" : "blue"}-1`}>{"n/a"}</LinkAlt>
                    </div>
                    <div className={styles["playoff-team"]} style={{
                        backgroundColor: isRed ? "var(--color-red-bg)" : "var(--color-blue-bg)"
                    }}>
                        <LinkAlt href={`/teams/`} id={`pf-${k[0]}-${k[1]}-${isRed ? "red" : "blue"}-2`}>{"n/a"}</LinkAlt>
                    </div>
                </div>
                <div className={styles["playoff-prediction"]} style={{
                    //bg is the color scaled between 0 and 100 (var(--color-correct) and var(--color-incorrect))
                    //backgroundColor: percentage == 50 ? "var(--color-neutral)" : (percentage > 50 ? `var(--color-correct)` : `var(--color-incorrect)`),
                }}>
                    <span id={`pf-${k[0]}-${k[1]}-${isRed ? "red" : "blue"}-chance`}>{"n/a"}%</span>
                </div>
            </div>
        )
    }

    return (
        <div className={styles["playoff"]  + " " + (centered ? styles["centered"] : "") + " " + (skipToBottom ? styles["skip-to-bottom"] : "")}>
            <PlayoffSide k={k} isRed={true} />
            <PlayoffSide k={k} isRed={false} />
        </div>
    )
}

export default function Playoffs() {
    const [alliances, setAlliances] = React.useState([
        [0,0],
        [0,0],
        [0,0],
        [0,0]
    ]);


    function AllianceSelection({ alliance, onTeamChange }) {

        const onClick = (e) => {
            const parent = e.target.parentElement;
            
            const team1 = parent.querySelector(".team-select-1").value;
            const team2 = parent.querySelector(".team-select-2").value;

            if (team1.length < 4 || team2.length < 4) {
                alert("Please enter a valid team number");
                return;
            }

            onTeamChange(alliance, team1, team2);
        }

        return (
            <div className={styles["alliance-selection"]}>
                <div className={styles["alliance-selection-title"]}>
                    <p>Alliance { alliance }</p>
                </div>
                <div className={styles["alliance-selection-teams"]}>
                    <input type="number" placeholder="00000" className="team-select-1"></input>
                    <input type="number" placeholder="99999" className="team-select-2"></input>
                    <button onClick={onClick}>Update</button>
                </div>
            </div>
        );
    }

    const predictMatch = async (red1, red2, blue1, blue2) => {
        const req = await fetch(`${getURL()}/v1/matches/predict/${red1}/${red2}/${blue1}/${blue2}`);
        const data = await req.json();

        return data["predicted_red_win_probability"];
    }

    const predictMatches = async () => {
        let structure = [];
        
        for (let round of playoffStructure) {
            structure.push([]);

            for (let match of round) {
                structure[structure.length - 1].push({
                    winner: null,
                    loser: null,
                    winPercentage: 0,
                    key: match.match,
                    redWin: false
                });
            }
        }

        let getPredictedRounds = (n) => {
            return structure[n[0] - 1][n[1] - 1];
        }

        /**
         * 
         * @returns {Array} [team1, team2]
         */
        let getTeam = (type, n) => {
            if (type == "alliance") {
                return alliances[n - 1];
            } else if (type == "loser") {
                return getPredictedRounds(n).loser;
            } else if (type == "winner") {
                return getPredictedRounds(n).winner;
            } else {
                return null;
            }
        }

        for (let round of playoffStructure) {
            for (let playoff of round) {
                let redAlliance = getTeam(playoff.teams[0][0], playoff.teams[0][1]);
                let blueAlliance = getTeam(playoff.teams[1][0], playoff.teams[1][1]);

                let chance = await predictMatch(
                    redAlliance[0], redAlliance[1],
                    blueAlliance[0], blueAlliance[1]
                );

                let structPlayoff = getPredictedRounds(playoff.match);

                if (chance >= 0.5) {
                    structPlayoff.winner = redAlliance;
                    structPlayoff.loser = blueAlliance;
                    structPlayoff.winPercentage = chance;
                } else {
                    structPlayoff.winner = blueAlliance;
                    structPlayoff.loser = redAlliance;
                    structPlayoff.winPercentage = 1 - chance;
                }

                structPlayoff.redWin = chance >= 0.5;
            }
        }

        for (let round of structure) {
            for (let playoff of round) {
                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-red-1`).innerText = playoff.winner[0];
                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-red-1`).href = `/teams/${playoff.winner[0]}`;

                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-red-2`).innerText = playoff.winner[1];
                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-red-2`).href = `/teams/${playoff.winner[1]}`;

                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-blue-1`).innerText = playoff.loser[0];
                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-blue-1`).href = `/teams/${playoff.loser[0]}`;

                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-blue-2`).innerText = playoff.loser[1];
                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-blue-2`).href = `/teams/${playoff.loser[1]}`;

                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-red-chance`).innerText = `${Math.round(playoff.winPercentage * 100)}%`;
                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-red-chance`).parentElement.style.backgroundColor = playoff.winPercentage >= 0.5 ? "var(--color-correct)" : "var(--color-incorrect)";

                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-blue-chance`).innerText = `${Math.round((1 - playoff.winPercentage) * 100)}%`;
                document.querySelector(`#pf-${playoff.key[0]}-${playoff.key[1]}-blue-chance`).parentElement.style.backgroundColor = playoff.winPercentage < 0.5 ? "var(--color-correct)" : "var(--color-incorrect)";
            }
        }
    }

    const onTeamChange = (alliance, team1, team2) => {
        let currentAlliances = alliances;
        currentAlliances[alliance - 1] = [parseInt(team1), parseInt(team2)];
        setAlliances(currentAlliances);

        //set teams in the first row of the playoff structure
        let round1 = playoffStructure[0];
        for (let playoff of round1) {
            let is0th = playoff.teams[0][1] == alliance;
            let is1st = playoff.teams[1][1] == alliance;

            if (is0th || is1st) {
                document.querySelector(`#pf-${playoff.match[0]}-${playoff.match[1]}-${is0th ? "red" : "blue"}-1`).innerText = team1;
                document.querySelector(`#pf-${playoff.match[0]}-${playoff.match[1]}-${is0th ? "red" : "blue"}-1`).href = `/teams/${team1}`;

                document.querySelector(`#pf-${playoff.match[0]}-${playoff.match[1]}-${is0th ? "red" : "blue"}-2`).innerText = team2;
                document.querySelector(`#pf-${playoff.match[0]}-${playoff.match[1]}-${is0th ? "red" : "blue"}-2`).href = `/teams/${team2}`;
            }
        }

        //check if all alliances have been selected
        let allSelected = true;
        for (let i = 0; i < alliances.length; i++) {
            if (alliances[i][0] == 0 || alliances[i][1] == 0) {
                allSelected = false;
            }
        }

        if (allSelected) {
            predictMatches();
        }
    }

    return (
        <div>
            <Menu />
            <div className={styles["playoff-container"]}>
                <div className={styles["alliance-selection-container"]}>
                    <AllianceSelection alliance={1} onTeamChange={onTeamChange} />
                    <AllianceSelection alliance={2} onTeamChange={onTeamChange} />
                    <AllianceSelection alliance={3} onTeamChange={onTeamChange} />
                    <AllianceSelection alliance={4} onTeamChange={onTeamChange} />
                </div>
                <div className={styles["playoff-titles"]}>
                    <p>Round 1</p>
                    <p>Round 2</p>
                    <p>Round 3</p>
                    <p>Finals</p>
                </div>
                <div className={styles["playoff-structure"]}>
                    <div className={styles["playoff-round"]}>
                        <Playoff 
                            k={[1,1]} />
                        <Playoff 
                            k={[1,2]} />
                    </div>
                    <div className={styles["playoff-round"]}>
                        <Playoff k={[2,1]} />
                        <Playoff k={[2,2]} />
                    </div>
                    <div className={styles["playoff-round"]}>
                        <Playoff k={[3,1]} skipToBottom={true} />
                    </div>
                    <div className={styles["playoff-round"]}>
                        <Playoff k={[4,1]} centered={true} />
                    </div>
                </div>
            </div>
        </div>
    );
}