import express from 'express';
import { getSalons, getSalonById, createSalon, updateSalon } from '../controllers/salonController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', getSalons);
router.get('/:id', getSalonById);
router.post('/', protect, createSalon);
router.patch('/:id', protect, updateSalon);

export default router;
