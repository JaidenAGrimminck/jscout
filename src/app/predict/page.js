"use client";

import { useState } from "react";

import Menu from "@/modules/menu/menu";
import styles from "./predict.module.css";
import getURL from "@/modules/server/Server";


export default function Predict() {
    const [inputsFilled, setInputsFilled] = useState(false);

    const checkIfAllFilled = () => {
        const red1 = document.getElementById("red1").value;
        const red2 = document.getElementById("red2").value;
        const blue1 = document.getElementById("blue1").value;
        const blue2 = document.getElementById("blue2").value;

        if (red1 && red2 && blue1 && blue2) {
            setInputsFilled(true);
        } else {
            setInputsFilled(false);
        }
    }

    const widdleDown = (str, n) => {
        if (str.length > n) {
            return str.substring(0, n);
        } else {
            return str;
        }
    }
    
    const predict = () => {
        let red1 = document.getElementById("red1").value;
        let red2 = document.getElementById("red2").value;
        let blue1 = document.getElementById("blue1").value;
        let blue2 = document.getElementById("blue2").value;
        
        red1 = parseInt(red1);
        red2 = parseInt(red2);
        blue1 = parseInt(blue1);
        blue2 = parseInt(blue2);

        if (isNaN(red1) || isNaN(red2) || isNaN(blue1) || isNaN(blue2)) {
            alert("All team numbers must be numbers");
            return;
        }
        
        fetch(`${getURL()}/v1/matches/predict/${red1}/${red2}/${blue1}/${blue2}`)
            .then((response) => response.json())
            .then((data) => {
                document.getElementById("red-win-probability").innerText = `${widdleDown(Math.round(data.predicted_red_win_probability * 10000) / 100, 5)}%`;
                document.getElementById("blue-win-probability").innerText = `${widdleDown(Math.round((1 - data.predicted_red_win_probability) * 10000) / 100, 5)}%`;

                if (data.predicted_red_win_probability > 0.5) {
                    document.getElementById("red-result").style.backgroundColor = "var(--color-correct)";
                    document.getElementById("blue-result").style.backgroundColor = "var(--color-incorrect)";
                } else {
                    document.getElementById("red-result").style.backgroundColor = "var(--color-incorrect)";
                    document.getElementById("blue-result").style.backgroundColor = "var(--color-correct)";
                }
            });
    }

    return (
        <div>
            <Menu></Menu>
            <div className={styles["predict-page"]}>
                <div className={styles["predict-title"]}>
                    <h1>Predict</h1>
                </div>
                <div className={styles["predict-teams"]}>
                    <div className={styles["predict-team"]}>
                        <div className={styles["predict-team-title"]}>
                            <h2>Red Alliance</h2>
                        </div>
                        <div className={styles["predict-team-inputs"]}>
                            <input id="red1" type="number" onChange={checkIfAllFilled}></input>
                            <input id="red2" type="number" onChange={checkIfAllFilled}></input>
                        </div>
                    </div>
                    <div className={styles["predict-team"]}>
                        <div className={styles["predict-team-title"]}>
                            <h2>Blue Alliance</h2>
                        </div>
                        <div className={styles["predict-team-inputs"]}>
                            <input id="blue1" type="number" onChange={checkIfAllFilled}></input>
                            <input id="blue2" type="number" onChange={checkIfAllFilled}></input>
                        </div>
                    </div>
                </div>
                <div className={styles["predict-button-container"]}>
                    <button disabled={!inputsFilled} onClick={predict}>Predict</button>
                </div>

                <div className={styles["results-center-container"]}>
                    <div className={styles["predict-results-container"]}>
                        <div className={styles["predict-results"]} id={"red-result"}>
                            <div className={styles["predict-results-title"]}>
                                <span>Red Win Probability:</span>
                            </div>
                            <div className={styles["predict-results-value"]}>
                                <span id="red-win-probability">{"n/a"}%</span>
                            </div>
                        </div>
                        <div className={styles["predict-results"]} id={"blue-result"}>
                            <div className={styles["predict-results-title"]}>
                                <span>Blue Win Probability:</span>
                            </div>
                            <div className={styles["predict-results-value"]}>
                                <span id="blue-win-probability">{"n/a"}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}