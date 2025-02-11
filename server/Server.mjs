import express from 'express';
import bodyParser from 'body-parser';
import { getTeam } from './ftc_scout/FTCScoutComms.mjs';
import { router as v1 } from './v1/Apiv1.mjs';

const port = 3734;

const app = express();

app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.json({
        "api_versions": ["v1"]
    });
});

app.use('/v1', v1);

app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
});