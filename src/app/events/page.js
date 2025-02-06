"use client";

import React, { useEffect, useState } from "react";
import Menu from "@/modules/menu/menu";
import styles from "./events.module.css";
import Link from "next/link";

export default function Event() {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        fetch(`${"http://localhost:3002"}/v1/events`)
            .then((response) => response.json())
            .then((data) => setEvents(data))
    }, []);

    return (
        <div>
            <Menu></Menu>
            <div className={styles.page}>
                <h1 className={styles["loaded-events-title"]}>Loaded Events</h1>
                <ul className={styles["loaded-events-list"]}>
                {
                    events.map((event) => {
                        return (
                            <li key={event.code}>
                                <p><Link href={`/events/${event.code}`}>({event.code}) {event.name}</Link></p>
                            </li>
                        );
                    })
                }
                </ul>
            </div>
        </div>
    );
}