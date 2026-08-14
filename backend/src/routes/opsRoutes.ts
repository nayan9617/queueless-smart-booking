import express from 'express';
import { getHealth, getBetaStats, expirePending } from '../controllers/opsController';

const router = express.Router();

router.get('/health', getHealth);
router.get('/expire-pending', (req, res, next) => {
    expirePending(req, res).catch(next);
});
router.get('/beta-stats', (req, res, next) => {
    const secret = process.env.BETA_OPS_SECRET;
    const provided = req.header('x-beta-ops-key');
    if (!secret || provided !== secret) {
        return res.status(404).json({ message: 'Not found' });
    }
    return getBetaStats(req, res).catch(next);
});

export default router;
