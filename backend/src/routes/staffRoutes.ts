import express from 'express';
import { addStaff, removeStaff, updateStaffAvailability, getStaff } from '../controllers/staffController';
import { protect } from '../middlewares/authMiddleware';
import { requireSalonOwner } from '../middlewares/roleMiddleware';

const router = express.Router();

router.route('/')
    .get(protect, requireSalonOwner, getStaff)
    .post(protect, requireSalonOwner, addStaff);

router.route('/:staffId')
    .delete(protect, requireSalonOwner, removeStaff);

router.route('/:staffId/availability')
    .patch(protect, requireSalonOwner, updateStaffAvailability);

export default router;
