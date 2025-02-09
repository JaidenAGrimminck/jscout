"use client";

import React from "react";
import Link from "next/link";
import styles from "./menu.module.css";
import { useRouter } from 'next/navigation';
//import Event from "@/app/pages/event/[event]";

function MenuItem(props) {
    return (
        <div className={styles["menu-item"]}>
            {!Object.keys(props).includes("href") && <span>{props.title}</span>}
            {Object.keys(props).includes("href") && <Link href={props.href}>{props.title}</Link>}
        </div>
    );
}

function SearchbarDropdownItem(props) {
    const router = useRouter();
    return (
        <div className={styles["menu-searchbar-dropdown-item"]} onClick={() => router.push(`/teams/${props.number}`)}>
                
            <span>{props.number}</span>
            <div className={styles["menu-searchbar-dropdown-item-title-divider"]}><span style={{color: "white"}}>.</span></div>
            <span>{props.name}</span>
        </div>
    );
}

function MenuSearchbar(props) {
    const [isDropdownVisible, setDropdownVisible] = React.useState(false);
    const [teamData, setTeamData] = React.useState([]);

    const handleFocus = () => {
        setDropdownVisible(true);
    };

    const handleBlur = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDropdownVisible(false);
        }
    };

    const loadFromBackend = async () => {
        const req = await fetch(`${"http://localhost:3002"}/v1/teams`);
        const data = await req.json();

        setTeamData(data);
    }

    React.useEffect(() => {
        loadFromBackend();
    }, []);

    const [queryTeamData, setQueryTeamData] = React.useState([]);
    
    const handleInputChange = (e) => {
        const query = e.target.value;

        let filteredData = teamData.filter((team) => {
            return team["number"].toString().includes(query);
        });

        filteredData = filteredData.slice(0, 9);

        setQueryTeamData(filteredData);
    }

    return (
        <div className={styles["menu-item"]} onBlur={handleBlur} tabIndex={-1}>
            <div className={styles["menu-searchbar"]}>
                <input 
                    type="text" 
                    placeholder="Search..." 
                    onFocus={handleFocus} 
                    onChange={handleInputChange}
                />
                {isDropdownVisible && (
                    <div className={styles["menu-searchbar-dropdown"]}>
                        {queryTeamData.map((team) => (
                            <SearchbarDropdownItem key={team.number} number={team.number} name={team.name} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Menu() {
    return (
        <div className={styles.menu}>
            <div className={styles["menu-division"]}>
                <span className={styles["menu-title"]}>
                    <Link href="/">jscout</Link></span>
                <div style={{marginLeft: "30px"}}></div>

                <MenuItem title="Teams" href="/teams" />
                <MenuItem title="Events" href="/events" />
                <MenuItem title="Schedule" href="/schedule" />
            </div>
            <div className={styles["menu-division"]}>
                <MenuItem title="Playoffs Sim" href="/playoffs" />
                <MenuSearchbar />
            </div>
        </div>
    );
}

export default Menu;