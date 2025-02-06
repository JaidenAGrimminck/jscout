"use client";

import Menu from '@/modules/menu/menu';
import React, { useState, useEffect } from 'react';

import styles from './teams.module.css';
import Link from 'next/link';

export default function Teams() {
    const [loadedTeams, setLoadedTeams] = useState([]);

    useEffect(() => {
        fetch(`${"http://localhost:3002"}/v1/teams`)
            .then(response => {
                return response.json();
            })
            .then(data => {
                setLoadedTeams(data);
            });
    }, []);

    return (
        <div>
            <Menu></Menu>
            <div className={styles.page}>
                <h1>Teams</h1>
                <ul className={styles["teams-list"]}>
                    {loadedTeams.sort((a,b) => {
                        return a.number - b.number;
                    }).map(team => (
                        <li key={team.number} className={styles["teams-list-item"]}>
                            <Link href={`/teams/${team.number}`}>{team.number} - {team.name}</Link>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}