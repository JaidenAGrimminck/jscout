"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import Link from "next/link";
import Menu from "../modules/menu/menu";
import getURL from "@/modules/server/Server";
import ConnectedToBackend from "@/modules/server/Connection";

export default function Home() {
    const [loadedTeams, setLoadedTeams] = useState([]);
    const [loadedEvents, setLoadedEvents] = useState([]);
    const [connected,  setConnected] = useState(false);

    useEffect(() => {
        fetch(`${getURL()}/v1/teams`)
            .then((response) => response.json())
            .then((data) => {
                setLoadedTeams(data);
            });
        fetch(`${getURL()}/v1/events`)
            .then((response) => response.json())
            .then((data) => {
                setLoadedEvents(data);
            });
        ConnectedToBackend().then((data) => {
            setConnected(data);
        });
        
    }, []);

    return (
        <div>
            <Menu></Menu>
            <div className={styles.home}>
                <h1>Home</h1>
                <span>
                    Loaded teams in memory: {loadedTeams.length}
                </span> <br/>
                <span>
                    Loaded events in memory: {loadedEvents.length}
                </span>
                <span> <br/> <br/>
                    Backend connected: {connected ? <b style={{ color: "var(--color-correct)"}}>Yes</b> : <b style={{ color: "var(--color-incorrect)"}}>No</b>}
                </span>
            </div>
        </div>
    );
}
