"use client";

import React from "react";
import Menu from "@/modules/menu/menu";
import styles from "./event-slug.module.css";
import Link from "next/link";
import getColor from "@/modules/misc/ColorScale";

function EventOverview({ eventData }) {
    const [teamData, setTeamData] = React.useState({});

    const getTeamData = async () => {
        if (eventData == null) return;
        if (eventData.teams == null) return;

        if (Object.keys(teamData).length > 0) {
            return;
        }

        const _teamData = {};

        await eventData.teams.forEach(async (team) => {
            const req = await fetch(`${"http://localhost:3002"}/v1/teams/${team.teamNumber}`);
            const data = await req.json();

            _teamData[team.teamNumber] = data;
        });

        //setTeamData(_teamData);

        while (Object.keys(_teamData).length < eventData.teams.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        setTeamData(_teamData);
        console.log(_teamData)
    }

    React.useEffect(() => {
        getTeamData();
    }, [eventData]);

    const compareRankingPoints = (a, b) => {
        if (teamData[a.teamNumber] == null) {
            return 0;
        }

        if (teamData[b.teamNumber] == null) {
            return 0;
        }

        let aStats = teamData[a.teamNumber].events.filter((event) => event.eventCode == eventData.code)[0].stats;
        let bStats = teamData[b.teamNumber].events.filter((event) => event.eventCode == eventData.code)[0].stats;

        if (aStats == null && bStats == null) {
            return compareTotOPR(b,a);
        }

        if (aStats == null) {
            aStats = { rank: 1000 };
        } 
        if (bStats == null) {
            bStats = { rank: 1000 };
        }

        return aStats.rank - bStats.rank;
    }

    const compareTotOPR = (a, b) => {
        if (teamData[a.teamNumber] == null) {
            return 0;
        }

        if (teamData[b.teamNumber] == null) {
            return 0;
        }

        let aQuick = teamData[a.teamNumber].quickStats;
        let bQuick = teamData[b.teamNumber].quickStats;

        if (aQuick == null) {
            aQuick = {tot: {value: 0}};
        }

        if (bQuick == null) {
            bQuick = {tot: {value: 0}};
        }

        let aStats = aQuick.tot;
        let bStats = bQuick.tot;

        if (aStats == null) {
            aStats = {value: 0};
        } 
        if (bStats == null) {
            bStats = {value: 0};
        }

        return aStats.value - bStats.value;
    }

    const eventOccurred = eventData ? eventData.matches.length > 0 : false;

    return (
        <div className={styles["event-overview"] + " " + styles["event-data"]}>
            <div key={"event-overview-title"} className={styles["event-overview-title"]}>
                <span>Team Insights</span>
            </div>
            <div key={"event-overview-teams"} className={styles["event-overview-teams"]}>
                <div className={styles["event-overview-team"]}>
                    <span>
                        Number
                    </span>
                    <span>
                        Teams
                    </span>
                    <span>
                        Rank
                    </span>
                    <span>
                        Ranking Points
                    </span>
                    <span>
                        Record
                    </span>
                    <span>
                        Tot. OPR
                    </span>
                    <span>
                        Tot. Auto
                    </span>
                    <span>
                        Tot. DC
                    </span>
                    <span>
                        Tot. EG
                    </span>

                    <span>
                        {eventOccurred && "Evt. "}Avg. Spec. High
                    </span>
                    <span>
                        {eventOccurred && "Evt. "}Avg. Spec. Low
                    </span>

                    <span>
                        {eventOccurred && "Evt. "}Avg. Samp. High
                    </span>
                    <span>
                        {eventOccurred && "Evt. "}Avg. Samp. Low
                    </span>

                    <span>
                        {eventOccurred && "Evt. "}Avg. Auto Spec. High
                    </span>
                    <span>
                        {eventOccurred && "Evt. "}Avg. Auto Spec. Low
                    </span>

                    <span>
                        {eventOccurred && "Evt. "}Avg. Auto Samp. High
                    </span>
                    <span>
                        {eventOccurred && "Evt. "}Avg. Auto Samp. Low
                    </span>
                    
                </div>
                {
                    eventData && (teamData ? eventData.teams.sort(compareRankingPoints) : eventData.teams.sort(compareTotOPR)).map((team) => {
                        const _teamData = teamData[team.teamNumber];

                        if (_teamData == null) {
                            return (
                                <div key={team.teamNumber} id={`${team.teamNumber}-info`} className={styles["event-overview-team"]}>
                                    <span key={team.teamNumber + "-num"}>{team.teamNumber}</span>
                                    <span key={team.teamNumber + "-name"}>Loading...</span>

                                    <span key={team.teamNumber + "-rank"}>Loading...</span>
                                    <span key={team.teamNumber + "-points"}>Loading...</span>
                                    <span key={team.teamNumber + "-record"}>Loading...</span>

                                    <span key={team.teamNumber + "-tot-opr"}>Loading...</span>
                                    <span key={team.teamNumber + "-tot-auto"}>Loading...</span>
                                    <span key={team.teamNumber + "-tot-dc"}>Loading...</span>
                                    <span key={team.teamNumber + "-tot-eg"}>Loading...</span>

                                    <span key={team.teamNumber + "-spec-high"}>Loading...</span>
                                    <span key={team.teamNumber + "-spec-low"}>Loading...</span>
                                    <span key={team.teamNumber + "-samp-high"}>Loading...</span>
                                    <span key={team.teamNumber + "-samp-low"}>Loading...</span>

                                    <span key={team.teamNumber + "-auto-spec-high"}>Loading...</span>
                                    <span key={team.teamNumber + "-auto-spec-low"}>Loading...</span>
                                    <span key={team.teamNumber + "-auto-samp-high"}>Loading...</span>
                                    <span key={team.teamNumber + "-auto-samp-low"}>Loading...</span>
                                </div>
                            )
                        }

                        let thisEventStats = _teamData.events.filter((event) => !eventOccurred || event.eventCode == eventData.code)[0].stats;

                        let thisEventGames = _teamData.matches.filter((match) => !eventOccurred || match.eventCode == eventData.code);
                        
                        let avgSamples = {
                            high: 0,
                            low: 0,
                            autoHigh: 0,
                            autoLow: 0,
                        }

                        let avgSpecimen = {
                            high: 0,
                            low: 0,
                            autoHigh: 0,
                            autoLow: 0
                        }

                        if (thisEventGames.length > 0) {
                            for (let i = 0; i < thisEventGames.length; i++) {
                                const alliance = thisEventGames[i].alliance;
                                const scores = thisEventGames[i].match.scores[alliance.toLowerCase()];

                                avgSamples.high += scores.dcSampleHigh// + scores.autoSampleHigh;
                                avgSamples.low += scores.dcSampleLow //+ scores.autoSampleLow;

                                avgSpecimen.high += scores.dcSpecimenHigh //+ scores.autoSpecimenHigh;
                                avgSpecimen.low += scores.dcSpecimenLow//+ scores.autoSpecimenLow;

                                avgSamples.autoHigh += scores.autoSampleHigh;
                                avgSamples.autoLow += scores.autoSampleLow;

                                avgSpecimen.autoHigh += scores.autoSpecimenHigh;
                                avgSpecimen.autoLow += scores.autoSpecimenLow;
                            }

                            avgSamples.high /= thisEventGames.length;
                            avgSamples.low /= thisEventGames.length;
                            
                            avgSpecimen.high /= thisEventGames.length;
                            avgSpecimen.low /= thisEventGames.length;

                            avgSamples.autoHigh /= thisEventGames.length;
                            avgSamples.autoLow /= thisEventGames.length;

                            avgSpecimen.autoHigh /= thisEventGames.length;
                            avgSpecimen.autoLow /= thisEventGames.length
                        }

                        return (
                            <div key={team.teamNumber} id={`${team.teamNumber}-info`} className={styles["event-overview-team"]}>
                                <span key={team.teamNumber + "-num"}>{team.teamNumber}</span>
                                <span><Link href={`/teams/${team.teamNumber}`} key={team.teamNumber + "-name"}>{_teamData.name}</Link> (<a href={`http://ftcscout.org/teams/${team.teamNumber}`} target="_blank">SCT</a>)</span>
                                <span key={team.teamNumber + "-rank"}>{thisEventStats ? (thisEventStats.rank == 0 ? "DNC" : thisEventStats.rank) : "DNC"}</span>
                                <span key={team.teamNumber + "-points"}>{thisEventStats ? Math.round(thisEventStats.rp * 100) / 100 : 0}</span>
                                <span key={team.teamNumber + "-record"}>{thisEventStats ? `${thisEventStats.wins}-${thisEventStats.losses}-${thisEventStats.ties}` : "0-0-0"}</span>
                                <span key={team.teamNumber + "-tot-opr"}>
                                    {`${_teamData.quickStats ? Math.round(_teamData.quickStats.tot.value * 100) / 100 : 0} `}
                                    <span style={{ color: getColor(_teamData.quickStats ? _teamData.quickStats.tot.rank / 6430 : 1), fontWeight: (_teamData.quickStats ? (_teamData.quickStats.tot.rank < 100 ? "bold" : "normal") : "normal") }}>{`(${_teamData.quickStats ? _teamData.quickStats.tot.rank : 0})`}</span>
                                </span>
                                <span key={team.teamNumber + "-tot-auto"}>
                                    {`${_teamData.quickStats ? Math.round(_teamData.quickStats.auto.value * 100) / 100 : 0} `}
                                    <span style={{ color: getColor(_teamData.quickStats ? _teamData.quickStats.auto.rank / 6430 : 1), fontWeight: (_teamData.quickStats ? (_teamData.quickStats.auto.rank < 100 ? "bold" : "normal") : "normal") }}>{`(${_teamData.quickStats ? _teamData.quickStats.auto.rank : 0})`}</span>
                                </span>
                                <span key={team.teamNumber + "-tot-dc"}>
                                    {`${_teamData.quickStats ? Math.round(_teamData.quickStats.dc.value * 100) / 100 : 0} `}
                                    <span style={{ color: getColor(_teamData.quickStats ? _teamData.quickStats.dc.rank / 6430 : 1), fontWeight: (_teamData.quickStats ? (_teamData.quickStats.dc.rank < 100 ? "bold" : "normal") : "normal") }}>{`(${_teamData.quickStats ? _teamData.quickStats.dc.rank : 0})`}</span>
                                </span>
                                <span key={team.teamNumber + "-tot-eg"}>
                                    {`${_teamData.quickStats ? Math.round(_teamData.quickStats.eg.value * 100) / 100 : 0} `}
                                    <span style={{ color: getColor(_teamData.quickStats ? _teamData.quickStats.eg.rank / 6430 : 1), fontWeight: (_teamData.quickStats ? (_teamData.quickStats.eg.rank < 100 ? "bold" : "normal") : "normal") }}>{`(${_teamData.quickStats ? _teamData.quickStats.eg.rank : 0})`}</span>
                                </span>

                                <span key={team.teamNumber + "-spec-high"}>
                                    {`${Math.round(avgSpecimen.high * 100) / 100} `}
                                </span>
                                <span key={team.teamNumber + "-spec-low"}>
                                    {`${Math.round(avgSpecimen.low * 100) / 100} `}
                                </span>

                                <span key={team.teamNumber + "-samp-high"}>
                                    {`${Math.round(avgSamples.high * 100) / 100} `}
                                </span>
                                <span key={team.teamNumber + "-samp-low"}>
                                    {`${Math.round(avgSamples.autoLow * 100) / 100} `}
                                </span>

                                <span key={team.teamNumber + "-auto-spec-high"}>
                                    {`${Math.round(avgSpecimen.autoHigh * 100) / 100} `}
                                </span>
                                <span key={team.teamNumber + "-auto-spec-low"}>
                                    {`${Math.round(avgSpecimen.autoLow * 100) / 100} `}
                                </span>

                                <span key={team.teamNumber + "-auto-samp-high"}>
                                    {`${Math.round(avgSamples.autoHigh * 100) / 100} `}
                                </span>
                                <span key={team.teamNumber + "-auto-samp-low"}>
                                    {`${Math.round(avgSamples.autoLow * 100) / 100} `}
                                </span>
                            </div>
                        )
                    })
                }
            </div>
        </div>
    );
}

function EventMenuItem({ title, evt, active }) {
    const onClick = (e) => {
        //remove all other active classes
        const items = document.getElementsByClassName(styles["event-menu-item"]);
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove(styles["event-menu-item-active"]);
        }

        e.currentTarget.classList.add(styles["event-menu-item-active"]);

        if (evt) {
            evt();
        }
    }

    return (
        <div className={styles["event-menu-item"] + " " + (active ? styles["event-menu-item-active"] : "")} onClick={onClick}>
            <span>{title}</span>
        </div>
    );
}


function EventDisplay({ eventData}) {
    const [eventDataDisplay, setEventDataDisplay] = React.useState(null);

    const MenuTo = (evt) => {
        return () => {
            setEventDataDisplay(evt);
        }
    }

    React.useEffect(() => {
        setEventDataDisplay("Overview");
    }, []);

    return (
        <div className={styles["event-display"]}>
            <div className={styles["event-title"]}>
                {Object.keys(eventData || {}).includes("name") && <h1>{eventData.name}</h1>}
            </div>
            <div className={styles["event-content"]}>
                <div className={styles["event-menu"]}>
                    <EventMenuItem title="Overview" evt={MenuTo("Overview")} active={true}></EventMenuItem>
                    <EventMenuItem title="Qual Matches" evt={MenuTo("Qual Matches")}></EventMenuItem>
                    <EventMenuItem title="Breakdown" evt={MenuTo("Breakdown")}></EventMenuItem>
                </div>
                {
                    eventDataDisplay == "Overview" && <EventOverview eventData={eventData}></EventOverview>
                }
            </div>
        </div>
    );
}

function EventSlug({ params }) {
    const [eventData, setEventData] = React.useState(null);
    const [slug, setSlug] = React.useState(null);

    const getEvent = async (slug) => {
        if (eventData) {
            return;
        }

        const req = await fetch(`${"http://localhost:3002"}/v1/events/${slug}`);
        const data = await req.json();

        setEventData(data);
    }

    React.useEffect(() => {
        params.then(resolvedParams => {
            setSlug(resolvedParams.slug);

            getEvent(resolvedParams.slug);
        });
    }, [params]);
    
    return (
        <div>
            <Menu></Menu>
            <EventDisplay eventData={eventData}></EventDisplay>
        </div>
    )
}

export default EventSlug;