"use client";

import React, { useEffect, useState } from "react";

import Menu from "@/modules/menu/menu";
import styles from "./team-slug.module.css";
import DateToReadable from "@/modules/misc/DateToReadable";
import EventMatches from "@/modules/matches/EventMatch";
import Link from "next/link";

const numTeams = 6808;

function BreakdownItem({ title, value, color }) {
    return (
        <span className={styles["breakdown-item"]} style={{ backgroundColor: color }}>
            <span>{title}: </span>
            <strong>{typeof value == "number" ? Math.round(value * 10) / 10 : value}</strong>
        </span>
    );
}

function RankingItem({ title, value }) {
    let valueString = "";

    if (value) {
        valueString = value.toString();
        let lastDigit = valueString.charAt(valueString.length - 1);

        if (lastDigit === "1") {
            valueString += "st";
        } else if (lastDigit === "2") {
            valueString += "nd";
        } else if (lastDigit === "3") {
            valueString += "rd";
        } else {
            valueString += "th";
        }
    }

    return (
        <div className={styles["ranking-item"]}>
            <strong>{valueString}</strong>
            <span>{title}</span>
            <span>out of {numTeams}</span>
        </div>
    )
}

function Event({ eventData, teamData }) {
    const [fullEventData, setFullEventData] = React.useState(null);

    const getEventData = async (eventCode) => {
        const req = await fetch(`${"http://localhost:3002"}/v1/events/${eventCode}`);
        const data = await req.json();

        setFullEventData(data);
    }

    React.useEffect(() => {
        getEventData(eventData.eventCode);
    }, []);

    if (fullEventData == null) {
        return (
            <div className={styles["event"]}>
                <div className={styles["event-header"]}>
                    <span>{eventData.eventCode}</span>
                </div>
                <div className={styles["event-body"]}>
                    <span>Loading, please wait...</span>
                </div>
            </div>
        );
    }
    
    const quickStats = eventData.stats;
    const awards = eventData.awards;

    const epa = null; //todo: implement

    return (
        <div className={styles["event"]}>
            <div className={styles["event-header"]}>
                <p><Link href={`/events/${fullEventData.code}`}>{fullEventData.name}</Link></p>
                <p>{DateToReadable(fullEventData.start)}</p>
                <p>Rank: <strong>{quickStats ? `${quickStats.rank} of ${fullEventData.teams.length}` : `DNC`}</strong></p>
                <p>Record: <strong>{quickStats ? `${quickStats.wins}-${quickStats.losses}-${quickStats.ties}` : "0-0-0"}</strong></p>
                <p>
                    <BreakdownItem title={"Auto"} value={epa !== null ? epa.auto : "N/A"} color={"rgb(31, 119, 180)"}/>
                    <BreakdownItem title={"Teleop"} value={epa !== null? epa.dc : "N/A"} color={"rgb(255, 127, 14)"}/>
                    <BreakdownItem title={"Endgame"} value={epa !== null ? epa.eg : "N/A"} color={"rgb(44, 160, 44)"}/>
                    <BreakdownItem title={"Total"} value={epa != null ? epa.tot : "N/A"} color={"rgb(214, 39, 40)"}/>
                </p>
            </div>
            <div className={styles["event-body"]}>
                <EventMatches matches={fullEventData.matches} filter={teamData.number} eventCode={fullEventData.code}></EventMatches>
            </div>
        </div>
    );
}

function Divider() {
    return (
        <div className={styles["divider"]}></div>
    );
}

function TeamOverview({ teamData }) {

    let wins = 0;
    let losses = 0;
    let ties = 0;

    if (teamData && teamData.matches !== undefined) {

        for (let match of teamData.matches) {
            let thisAlliance = match.alliance;
            let blueScore = match.match.scores.blue.totalPoints;
            let redScore = match.match.scores.red.totalPoints;

            if (thisAlliance === "Blue" && blueScore > redScore) {
                wins++;
            } else if (thisAlliance === "Red" && redScore > blueScore) {
                wins++;
            } else if (blueScore === redScore) {
                ties++;
            } else {
                losses++;
            }
        }
    }

    const quickStats = teamData && teamData.quickStats;

    if (teamData == null || quickStats == null) {
        return (
            <div className={styles["team-overview"]}>
                <div className={styles["team-overview-header"]}>
                    <span>
                        Loading, please wait...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles["team-overview"]}>
            <div className={styles["team-overview-header"]}>
                <span>
                    Team {teamData && teamData.number} ({teamData && teamData.name}) had a record of <b>{`${wins}-${losses}-${ties}`}</b> in this season {
                        teamData && teamData.events.length > 0 ? <span>across <b>{teamData.events.length}</b> events</span> : <span>across 0 events</span>
                    }
                    {
                        teamData && teamData.awards.length > 0 ? <span> and won <b>{teamData.awards.length}</b> awards</span> : ``
                    }.
                </span>
                <p>
                    OPR Breakdown: 
                    <BreakdownItem title={"Auto"} value={quickStats ? quickStats.auto.value : 0} color={"rgb(31, 119, 180)"}/>
                    <BreakdownItem title={"Teleop"} value={quickStats ? quickStats.dc.value : 0} color={"rgb(255, 127, 14)"}/>
                    <BreakdownItem title={"Endgame"} value={quickStats ? quickStats.eg.value : 0} color={"rgb(44, 160, 44)"}/>
                    <BreakdownItem title={"Total"} value={quickStats ? quickStats.tot.value : 0} color={"rgb(214, 39, 40)"}/>
                </p>
                <p>
                    EPA Breakdown: 
                    <BreakdownItem title={"Auto"} value={quickStats ? quickStats.auto.value : 0} color={"rgb(31, 119, 180)"}/>
                    <BreakdownItem title={"Teleop"} value={quickStats ? quickStats.dc.value : 0} color={"rgb(255, 127, 14)"}/>
                    <BreakdownItem title={"Endgame"} value={quickStats ? quickStats.eg.value : 0} color={"rgb(44, 160, 44)"}/>
                    <BreakdownItem title={"Total"} value={quickStats ? quickStats.tot.value : 0} color={"rgb(214, 39, 40)"}/>
                </p>
                <div className={styles["ranking"]}>
                    <RankingItem title={"Worldwide"} value={quickStats ? quickStats.tot.rank : 0}/>
                    <RankingItem title={"Auto"} value={quickStats ? quickStats.auto.rank : 0}/>
                    <RankingItem title={"Teleop"} value={quickStats ? quickStats.dc.rank : 0}/>
                    <RankingItem title={"Endgame"} value={quickStats ? quickStats.eg.rank : 0}/>
                </div>
                <Divider></Divider>
            </div>
            <div className={styles["team-events"]}>
                {
                    teamData && teamData.events.map((event) => {
                        return (
                            <Event key={event.eventCode} eventData={event} eventCode={event.eventCode} teamData={teamData}></Event>
                        )
                    })
                }
            </div>
        </div>
    )
}

function TeamMenuItem({ title, evt, active }) {
    const onClick = (e) => {
        //remove all other active classes
        const items = document.getElementsByClassName(styles["team-menu-item"]);
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove(styles["team-menu-item-active"]);
        }

        e.currentTarget.classList.add(styles["team-menu-item-active"]);

        if (evt) {
            evt();
        }
    }

    return (
        <div className={styles["team-menu-item"] + " " + (active ? styles["team-menu-item-active"] : "")} onClick={onClick}>
            <span>{title}</span>
        </div>
    );
}

function TeamDisplay({ teamData }) {
    const [teamDataDisplay, setTeamDataDisplay] = React.useState(null);
    
    const MenuTo = (evt) => {
        return () => {
            setTeamDataDisplay(evt);
        }
    }

    React.useEffect(() => {
        setTeamDataDisplay("Overview");
    }, []);

    return (
        <div className={styles["team-content"]}>
            <div className={styles["team-menu"]}>
                <TeamMenuItem title="Overview" evt={MenuTo("Overview")} active={true} />
                <TeamMenuItem title="Figures" evt={MenuTo("Figures")} />
            </div>
            {
                teamDataDisplay === "Overview" && <TeamOverview teamData={teamData}></TeamOverview>
            }
        </div>
    )
}

export default function Teams({ params }) {
    const [slug, setSlug] = React.useState(null);

    const [teamData, setTeamData] = React.useState({});

    const getTeamData = async (slug) => {
        const req = await fetch(`${"http://localhost:3002"}/v1/teams/${slug}`);
        const data = await req.json();

        setTeamData(data);
    }

    React.useEffect(() => {
            params.then(resolvedParams => {
                setSlug(resolvedParams.slug);
    
                getTeamData(resolvedParams.slug);
            });
    }, [params]);

    return (
        <div>
            <Menu></Menu>
            <div className={styles.page}>
                <div className={styles["team-header"]}>
                    <p>Team {slug}</p>
                    <p>{teamData && teamData.name}</p>
                </div>
                <TeamDisplay teamData={ teamData }></TeamDisplay>
            </div>
        </div>
    );
}