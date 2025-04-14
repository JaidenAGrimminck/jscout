import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


const epa_mem = JSON.parse(fs.readFileSync("regiondata.json"))

function getTeam() {} // local mem parse, pass, then use.