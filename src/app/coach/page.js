"use client";

import React from "react";

import styles from "./coach.module.css";
import getURL from "@/modules/server/Server";

function NumInputsWithButtons({ id, value, abs }) {
    const increment = () => {
        const input = document.getElementById(id);
        input.value = parseInt(input.value) + 1;
    }

    const decrement = () => {
        const input = document.getElementById(id);
        input.value = parseInt(input.value) - 1;
        if (parseInt(input.value) < 0 && abs) {
            input.value = 0;
        }
    }

    return (
        <div className={styles["num-inputs-with-buttons"]}>
            <button className={styles["ni-neg"]} onClick={decrement}>-</button>
            <input type="number" className={styles["ni-input"]} id={id} value={value}
                onChange={(e) => {
                    if (parseInt(e.target.value) < 0) {
                        e.target.value = 0;
                    }
                }}
            ></input>
            <button className={styles["ni-pos"]} onClick={increment}>+</button>
        </div>
    )
}

function ConnectedToInternet() {
    const checkIfConnected = async () => {
        let req;
        try {
            req = await fetch(`https://example.com`);
        } catch (e) {
            document.getElementById("connected").innerText = "No";
            document.getElementById("connected").style.color = "var(--color-incorrect)";
            return;
        }

        const data = await req.text();

        if (data) {
            document.getElementById("connected").innerText = "Yes";
            document.getElementById("connected").style.color = "var(--color-correct)";
        } else {
            document.getElementById("connected").innerText = "No";
            document.getElementById("connected").style.color = "var(--color-incorrect)";
        }
    }

    React.useEffect(() => {
        //continually check if connected
        //setInterval(checkIfConnected, 500);
        checkIfConnected();
    });

    return (
        <div className={styles["connected-to-internet"]}>
            <p>Connected To Internet? <span id="connected"></span></p>
            <button onClick={checkIfConnected}>Reload</button>
        </div>
    )
}

function CoachEntry({ onFinish }) {
    function TeamInput({ red }) {
        return (
            <div className={styles["team-input"]} style={{
                backgroundColor: red ? "var(--color-red-bg)" : "var(--color-blue-bg)"
            }}>
                <input type="text" id={"coach-entry-team-" + (red ? "red" : "blue") + "-1"} placeholder={red ? "Red 1" : "Blue 1"}></input>
                <input type="text" id={"coach-entry-team-" + (red ? "red" : "blue") + "-2"} placeholder={red ? "Red 2" : "Blue 2"}></input>
            </div>
        );
    }

    const finish = () => {
        const red1 = document.getElementById("coach-entry-team-red-1").value;
        const red2 = document.getElementById("coach-entry-team-red-2").value;
        const blue1 = document.getElementById("coach-entry-team-blue-1").value;
        const blue2 = document.getElementById("coach-entry-team-blue-2").value;

        onFinish(red1, red2, blue1, blue2);
    }

    return (
        <div className={styles["coach-entry"]} id="coach-entry">
            <div className={styles["team-inputs-title"]}>
                <h1>Enter Team Numbers</h1>
            </div>
            <div className={styles["team-inputs"]}>
                <TeamInput red={true}></TeamInput>
                <TeamInput red={false}></TeamInput>
            </div>
            <div className={styles["team-inputs-button-container"]}>
                <button onClick={finish}>Continue</button>
            </div>
        </div>
    )
}

function PreTeleOp({ onFinish }) {
    return (
        <div className={styles["pre-teleop"]} id="pre-teleop">
            <div className={styles["pre-teleop-title"]}>
                <h1>Pre-TeleOp</h1>
            </div>
            <div className={styles["pre-teleop-predictions"]}>
                <div>
                    <p>Predicted Win Chance (Red):</p>
                    <p id="pred-chance">n/a</p>
                </div>
                <div>
                    <p>Predicted Win Chance (Blue):</p>
                    <p id="pred-chance-opp">n/a</p>
                </div>
            </div>
            <div className={styles["pre-teleop-connected"]}>
                <ConnectedToInternet></ConnectedToInternet>
            </div>
            <div className={styles["pre-teleop-predictions-button-container"]}>
                <p>
                    # Spec HP has:
                </p>
                    <NumInputsWithButtons id={"hp-spec"} value={0} abs={true}></NumInputsWithButtons>
            </div>
            <div className={styles["pre-teleop-button-container"]}>
                <button onClick={onFinish}>Start!</button>
            </div>
            
        </div>
    )
}

function TeleOp({ topClick, bottomClick }) {
    return (
        <div className={styles["teleop"]} id="teleop">
            <div className={styles["teleop-divison"]}>
                <div className={styles["teleop-top"]} onClick={topClick}>
                    <div>
                        <p>Currently have: <b id="spec-count">0</b> specimen.</p>
                        <p>Avg Time Per: <b id="current-avg">0</b> seconds</p>
                    </div>

                    <div>
                        <p>Current Cycle Run: <b id="current-lap">0</b> seconds</p>
                        <p>SWITCH AT <b id="switch-time">0:00</b></p>
                        <p><b id="spec-left">0</b> SPECIMENT LEFT (<b id="max-spec">0</b> spec max)</p>
                    </div>
                </div>
                <div className={styles["teleop-bottom"]} onClick={bottomClick}>
                    <p>
                        Time to score all: <b id="score-all">0</b> seconds
                    </p>
                </div>
            </div>
            <div className={styles["teleop-overlay"]}>
                <p id="current-time-left">0:00</p>
            </div>
        </div>
    )
}


export default function Coach() {
    const teams = {
        red1: null,
        red2: null,
        blue1: null,
        blue2: null
    }

    const matchData = {
        inTeleOp: false,
        specHpHas: 0,
        pred_prob: 0
    };

    React.useEffect(() => {
        const coachEntry = document.getElementById("coach-entry");
        const preTeleOp = document.getElementById("pre-teleop");
        const teleOp = document.getElementById("teleop");

        const query = new URLSearchParams(window.location.search);

        if (query.has("skipEntry")) {
            coachEntry.style.display = "none";
            preTeleOp.style.display = "flex";
            teleOp.style.display = "none";
        } else {
            coachEntry.style.display = "flex";
            preTeleOp.style.display = "none";
            teleOp.style.display = "none";
        }

        

        //onSwitchToTeleop();
    })

    const onCoachEntryFinish = async (red1, red2, blue1, blue2) => {
        teams.red1 = parseInt(red1);
        teams.red2 = parseInt(red2);
        teams.blue1 = parseInt(blue1);
        teams.blue2 = parseInt(blue2);

        const predict = await fetch(`${getURL()}/v1/matches/predict/${teams.red1}/${teams.red2}/${teams.blue1}/${teams.blue2}`);
        let predictData;
        try {
            predictData = await predict.json();
        } catch (e) {
            predictData = {
                predicted_red_win_probability: -1
            }
        }

        matchData.pred_prob = predictData.predicted_red_win_probability;

        const coachEntry = document.getElementById("coach-entry");
        const preTeleOp = document.getElementById("pre-teleop");
        const teleOp = document.getElementById("teleop");

        const predChance = document.getElementById("pred-chance");
        const predChanceOpp = document.getElementById("pred-chance-opp");

        predChance.innerText = `${Math.round(matchData.pred_prob * 10000) / 100}%`;
        predChanceOpp.innerText = `${Math.round((1 - matchData.pred_prob) * 10000) / 100}%`;

        coachEntry.style.display = "none";
        preTeleOp.style.display = "flex";
        teleOp.style.display = "none";
    }

    const onPreTeleOpFinish = () => {
        const coachEntry = document.getElementById("coach-entry");
        const preTeleOp = document.getElementById("pre-teleop");
        const teleOp = document.getElementById("teleop");

        coachEntry.style.display = "none";
        preTeleOp.style.display = "none";
        teleOp.style.display = "flex";

        onSwitchToTeleop();
    }

    let scoredSoFar = 0;
    let lastLap = 0;
    let timeStart = 0;
    let scoredLaps = [];

    const onSwitchToTeleop = () => {
        lastLap = new Date().getTime();
        scoredSoFar = 0;
        timeStart = new Date().getTime();

        setInterval(() => {
            document.getElementById("current-lap").textContent = Math.round((new Date().getTime() - lastLap) / 1000 * 100) / 100;
            document.getElementById("current-time-left").textContent = `${Math.floor((120 - (new Date().getTime() - timeStart) / 1000) / 60)}:${Math.floor((120 - (new Date().getTime() - timeStart) / 1000) % 60)}`;
        })

        let prescored = parseInt(document.getElementById("hp-spec").value);

        document.getElementById("spec-count").textContent = scoredSoFar + prescored;
    }

    const topClick = () => {
        scoredSoFar++;
        
        scoredLaps.push(
            (new Date().getTime() - lastLap) / 1000
        )
        lastLap = new Date().getTime();

        let sum = 0;
        scoredLaps.forEach(e => {
            sum += e;
        })

        document.getElementById("current-avg").textContent = Math.round(sum * 100 / scoredLaps.length) / 100;

        let totalTime = 108;
        let prescored = parseInt(document.getElementById("hp-spec").value);


        document.getElementById("spec-count").textContent = scoredSoFar + prescored;

        let avgCycle = sum / scoredLaps.length;
        let avgScore = 5.8;

        let max = 0;

        for (let i = 0; i < 12; i++) {
            let tot = avgCycle + avgScore;

            let tottime = tot * i + (avgScore * prescored);

            if (totalTime - tottime > 0) {
                max = i;
            } else {
                break;
            }
        }

        let timeAdded = 120 - totalTime;

        document.getElementById("spec-left").textContent = max - scoredLaps.length;
        document.getElementById("switch-time").textContent = `${Math.floor((max * avgCycle + timeAdded) / 60)}:${Math.floor((max * avgCycle + timeAdded) % 60)}`;
        document.getElementById("max-spec").textContent = max;
        document.getElementById("score-all").textContent = Math.floor(avgScore * (max + prescored));

        
    }

    const bottomClick = () => {
        
    }



    return (
        <div className={styles["coach-page"]}>
            <CoachEntry onFinish={onCoachEntryFinish}></CoachEntry>
            <PreTeleOp onFinish={onPreTeleOpFinish}></PreTeleOp>
            <TeleOp topClick={topClick} bottomClick={bottomClick}></TeleOp>
        </div>
    )
}