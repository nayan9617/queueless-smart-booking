import express from 'express';
import {
    getSalons,
    getSalonById,
    getSalonWaitEstimate,
    createSalon,
    updateSalon,
    uploadSalonImages,
} from '../controllers/salonController';
import { protect } from '../middlewares/authMiddleware';
import { requireSalonOwner } from '../middlewares/roleMiddleware';
import { salonImageUpload } from '../middlewares/uploadMiddleware';

const router = express.Router();

router.get('/', getSalons);
router.get('/:id/wait-estimate', getSalonWaitEstimate);
router.get('/:id', getSalonById);
router.post('/', protect, requireSalonOwner, createSalon);
router.patch('/:id', protect, requireSalonOwner, updateSalon);
router.post(
    '/:id/images',
    protect,
    requireSalonOwner,
    salonImageUpload.array('images', 8),
    uploadSalonImages
);

export default router;
