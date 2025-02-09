"use client";

import React from "react";

import styles from "./playoffs.module.css";
import Menu from "@/modules/menu/menu";
import Link from "next/link";

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

function Playoff(props) {
    const skipToBottom = props.skipToBottom || false;
    const centered = props.centered || false;

    const redWinPercentage = props.winPercentage || 49;

    function PlayoffSide({ team1, team2, percentage, isRed }) {
        return (
            <div className={styles["playoff-side"]}>
                <div className={styles["playoff-teams"]}>
                    <div className={styles["playoff-team"]} style={{
                        backgroundColor: isRed ? "var(--color-red-bg)" : "var(--color-blue-bg)"
                    }}>
                        <span><Link href={`/teams/${typeof team1 == "number" ? team1 : ""}`}>{team1}</Link></span>
                    </div>
                    <div className={styles["playoff-team"]} style={{
                        backgroundColor: isRed ? "var(--color-red-bg)" : "var(--color-blue-bg)"
                    }}>
                        <span><Link href={`/teams/${typeof team2 == "number" ? team2 : ""}`}>{team2}</Link></span>
                    </div>
                </div>
                <div className={styles["playoff-prediction"]} style={{
                    //bg is the color scaled between 0 and 100 (var(--color-correct) and var(--color-incorrect))
                    backgroundColor: percentage == 50 ? "var(--color-neutral)" : (percentage > 50 ? `var(--color-correct)` : `var(--color-incorrect)`),
                }}>
                    <span>{percentage}%</span>
                </div>
            </div>
        )
    }

    return (
        <div className={styles["playoff"]  + " " + (centered ? styles["centered"] : "") + " " + (skipToBottom ? styles["skip-to-bottom"] : "")}>
            <PlayoffSide team1={"XXXXX"} team2={"XXXXX"} percentage={redWinPercentage} isRed={true} />
            <PlayoffSide team1={"XXXXX"} team2={"XXXXX"} percentage={100 - redWinPercentage} isRed={false} />
        </div>
    )
}

export default function Playoffs() {

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

    const onTeamChange = (alliance, team1, team2) => {
        console.log(`Alliance ${alliance} updated to ${team1} and ${team2}`);
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
                        <Playoff />
                        <Playoff />
                    </div>
                    <div className={styles["playoff-round"]}>
                        <Playoff />
                        <Playoff />
                    </div>
                    <div className={styles["playoff-round"]}>
                        <Playoff skipToBottom={true} />
                    </div>
                    <div className={styles["playoff-round"]}>
                        <Playoff centered={true} />
                    </div>
                </div>
            </div>
        </div>
    );
}