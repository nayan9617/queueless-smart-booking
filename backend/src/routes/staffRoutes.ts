import express from 'express';
import { addStaff, removeStaff, updateStaffAvailability, getStaff } from '../controllers/staffController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/')
    .get(protect, getStaff)
    .post(protect, addStaff);

router.route('/:staffId')
    .delete(protect, removeStaff);

router.route('/:staffId/availability')
    .patch(protect, updateStaffAvailability);

export default router;
