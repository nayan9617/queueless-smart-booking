import express from 'express';
import { createBooking, getUserBookings, getSalonBookings, updateBookingStatus, rateBooking } from '../controllers/bookingController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/', protect, createBooking);
router.get('/my-bookings', protect, getUserBookings);
router.get('/salon-bookings', protect, getSalonBookings);
router.patch('/:id', protect, updateBookingStatus);
router.post('/:id/rate', protect, rateBooking);

export default router;
