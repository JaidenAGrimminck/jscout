import express from 'express';
import cors from 'cors';
import { router as teams } from './teams.mjs';
import { router as events } from './events.mjs';
import { router as matches } from './matches.mjs';
import { pruneMemory, saveData } from '../ftc_scout/FTCScoutComms.mjs';

const router = express.Router();

router.use(cors());

router.get('/', (req, res) => {
    res.json({
        "api_version": "1.0",
    });
});

router.get('/prune', (req, res) => {
    pruneMemory();
    saveData();

    res.json({
        "success": true,
    });
})

router.use('/teams', teams);
router.use('/events', events);
router.use('/matches', matches);

export { router };