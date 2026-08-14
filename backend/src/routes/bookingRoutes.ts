import express from 'express';
import {
    createBooking,
    getUserBookings,
    getSalonBookings,
    getSalonAnalytics,
    updateBookingStatus,
    rateBooking,
    verifyPayment,
    cancelBooking,
} from '../controllers/bookingController';
import { protect } from '../middlewares/authMiddleware';
import { requireSalonOwner } from '../middlewares/roleMiddleware';
import { bookingCreateLimiter } from '../middlewares/rateLimitMiddleware';

const router = express.Router();

router.post('/', protect, bookingCreateLimiter, createBooking);
router.post('/verify-payment', protect, verifyPayment);
router.get('/my-bookings', protect, getUserBookings);
router.get('/salon-bookings', protect, requireSalonOwner, getSalonBookings);
router.get('/salon-analytics', protect, requireSalonOwner, getSalonAnalytics);
router.patch('/:id', protect, requireSalonOwner, updateBookingStatus);
router.post('/:id/cancel', protect, cancelBooking);
router.post('/:id/rate', protect, rateBooking);

export default router;
