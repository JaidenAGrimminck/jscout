"use client";
import Menu from "@/modules/menu/menu";
import React from "react";

import styles from "./schedule.module.css";

const heightPerHour = 200;

const schedule = [
    {
        start: [8, 15],
        end: [8, 45],
        name: "Team Registration - Pits Open",
        column: 1
    },
    {
        start: [9, 0],
        end: [9, 15],
        name: "Drivers Meeting",
        location: "Game Arena",
        column: 1
    },
    {
        start: [9, 15],
        end: [9, 30],
        name: "Coach Meeting",
        location: "Game Arena",
        column: 1
    },
    {
        start: [9, 30],
        end: [11, 0],
        name: "Robot Inspections (23014 at 9:50 - 10:10)",
        location: "Game Arena",
        column: 1
    },
    {
        start: [9, 30],
        end: [11, 0],
        name: "Judge Interviews (23014 at 10:30 - 10:50)",
        location: "Open X ground floors",
        column: 2
    },
    {
        start: [10, 0],
        end: [17, 0],
        name: "Tech Square Open",
        location: "Discovery Zone",
        column: 3
    },
    {
        start: [11, 15],
        end: [11, 30],
        name: "Opening Ceremony",
        location: "Game Arena",
        column: 1
    },
    {
        start: [11, 30],
        end: [12, 30],
        name: "Qualification Matches",
        location: "Game Arena",
        column: 1
    },
    {
        start: [12, 30],
        end: [13, 0],
        name: "Lunch Break",
        column: 1
    },
    {
        start: [13, 0],
        end: [14, 30],
        name: "Qualification Matches",
        location: "Game Arena",
        column: 1
    },
    {
        start: [13, 0],
        end: [16, 0],
        name: "Pit Visits by Judges",
        location: "Pits",
        column: 1
    },
    {
        start: [14, 30],
        end: [14, 45],
        name: "Coffee Break",
        column: 1
    },
    {
        start: [14, 45],
        end: [16, 0],
        name: "Qualification Matches",
        location: "Game Arena",
        column: 1
    },
    {
        start: [16, 15],
        end: [16, 45],
        name: "Alliance Selection",
        location: "Game Arena",
        column: 1
    },
    {
        start: [16, 30],
        end: [18, 0],
        name: "Dinner Break",
        column: 2
    },
    {
        start: [18, 0],
        end: [20, 0],
        name: "Playoff Matches",
        location: "Game Arena",
        column: 1
    },
    {
        start: [20, 0],
        end: [20, 30],
        name: "Pits Close",
        location: "Pits",
        column: 1
    }
]

function EventItem({ event, prevEvent, startTime }) {
    const height = (event.end[0] - event.start[0]) * heightPerHour + (event.end[1] - event.start[1]) * heightPerHour / 60;

    const startStr = `${event.start[0] > 12 ? event.start[0] - 12 : event.start[0]}:${event.start[1].toString().length < 2 ? `0${event.start[1]}` : event.start[1]}${event.start[0] >= 12 ? "pm" : "am"}`;
    const endStr = `${event.end[0] > 12 ? event.end[0] - 12 : event.end[0]}:${event.end[1].toString().length < 2 ? `0${event.end[1]}` : event.end[1]}${event.end[0] >= 12 ? "pm" : "am"}`;

    let marginTop = prevEvent ? (event.start[0] - prevEvent.end[0]) * heightPerHour + (event.start[1] - prevEvent.end[1]) * heightPerHour / 60 : 0;

    if (!prevEvent && (event.start[0] > startTime[0] || event.start[1] > startTime[1])) {
        marginTop = ((event.start[0] - startTime[0]) * heightPerHour) + ((event.start[1] - startTime[1]) * heightPerHour / 60);
    }

    return (
        <div className={styles["event-item"]} style={{ height, marginTop }}>
            <p>{event.name} — {startStr} - {endStr} {event.location && <span>({event.location})</span>}</p>
            
        </div>
    );
}


export default function EventSchedule() {
    const columnCount = 3;
    const columns = Array.from({ length: columnCount }, () => []);
    schedule.forEach((event) => {
        columns[event.column - 1].push(event);
    });

    return (
        <div>
            <Menu />
            <div className={styles["schedule-container"]}>
                <h1>Event Schedule</h1>
                <div className={styles["time-tell-container"]}>
                    <div className={styles["time-tell"]} style={{ marginTop: ((new Date().getHours() - schedule[0].start[0]) * heightPerHour + (new Date().getMinutes() - schedule[0].start[1]) * heightPerHour / 60) + 130 }}>
                    </div>
                </div>
                <div className={styles["column-container"]}>
                    {columns.map((column, i) => {
                        return (
                            <div className={styles["column"]} key={i}>
                                {column.map((event, j) => {
                                    return <EventItem key={j} event={event} prevEvent={j > 0 ? column[j - 1] : null} startTime={schedule[0].start} />
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}