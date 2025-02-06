"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import Link from "next/link";
import Menu from "../modules/menu/menu";

export default function Home() {
    const [loadedTeams, setLoadedTeams] = useState([]);
    const [loadedEvents, setLoadedEvents] = useState([]);

    useEffect(() => {
        fetch(`${"http://localhost:3002"}/v1/teams`)
            .then((response) => response.json())
            .then((data) => {
                setLoadedTeams(data);
            });
        fetch(`${"http://localhost:3002"}/v1/events`)
            .then((response) => response.json())
            .then((data) => {
                setLoadedEvents(data);
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
            </div>
        </div>
    );
}
