
import styles from "./Notice.module.css";

export function Notice({ children }) {
    return (
        // yellow background and border, warning color
        <div className={styles["notice"]}>
            <div style={{
            
            }}>
                <h1 className="bold">Warning Notice</h1>
                <p style={{
                    marginTop: "10px",
                }}>Due to the large data complexity with Worlds, the dataset is currently restricted to <span style={{ fontWeight: "bold" }}>championships</span> and <span style={{ fontWeight: "bold" }}>FIRST World Championship (Franklin Division)</span>. Thank you for your understanding.</p> <br/>
                <h2>Alternatives</h2>
                <ul style={{
                    paddingLeft: "20px",
                    marginBottom: "10px",
                }}>
                    <li><a href="https://match.ftc20077.org/">https://match.ftc20077.org/</a> (Match Predictor)</li>
                </ul>
                <p>Additionally, the website is better suited for <span style={{ fontWeight: "bold" }}>laptop</span>.</p>
            </div>
        </div>
    );
}