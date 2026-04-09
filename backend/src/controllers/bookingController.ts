import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking';
import Salon from '../models/Salon';
import { predictWaitTime } from '../services/mlService';
import { sendBookingConfirmation, sendBookingUpdate, sendNewBookingNotification, sendBookingCompletion } from '../services/emailService';
import { getIO } from '../socket';
import { recalculateSalonQueue } from '../services/queueService';

export const createBooking = async (req: Request, res: Response) => {
    try {
        const { salonId, services, paymentDetails, contactInfo } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(salonId)) {
            return res.status(400).json({ message: 'Invalid Salon ID format' });
        }

        const salon = await Salon.findById(salonId).populate('ownerId');
        if (!salon) return res.status(404).json({ message: 'Salon not found' });

        // Validate services
        if (!services || !Array.isArray(services) || services.length === 0) {
            return res.status(400).json({ message: 'No services selected' });
        }

        // Calculate totals
        const totalDuration = services.reduce((acc: number, s: any) => acc + s.duration, 0);
        const totalAmount = services.reduce((acc: number, s: any) => acc + s.price, 0);

        // 2. Calculate Queue Parameters
        const activeBookingsCount = await Booking.countDocuments({
            salonId,
            status: { $in: ['pending', 'in-progress', 'confirmed'] }
        });

        const now = new Date();
        const timeOfDay = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = now.getDay(); // 0-6

        // 3. Get ML Prediction
        // Calculate active staff based on availability
        const activeStaffCount = salon.staff.filter((s: any) => s.isAvailable).length;
        const effectiveBarbers = activeStaffCount > 0 ? activeStaffCount : Math.max(1, salon.staff.length);

        const prediction = await predictWaitTime({
            queue_length: activeBookingsCount,
            active_barbers: effectiveBarbers,
            service_duration_avg: totalDuration, // Use total duration of this booking
            time_of_day: timeOfDay,
            day_of_week: dayOfWeek,
            total_chairs: salon.chairs
        });

        // 4. Create Booking
        const newBooking = new Booking({
            userId,
            salonId,
            services,
            totalAmount,
            contactInfo,
            paymentStatus: 'paid', // Mock payment success
            status: 'confirmed',
            estimatedWaitTime: prediction.waitTime,
            estimatedStartTime: new Date(now.getTime() + prediction.waitTime * 60000)
        });

        await newBooking.save();

        // Recalculate queue for accuracy
        await recalculateSalonQueue(salonId);

        // 5. Notify via Socket.IO
        getIO().to(salonId).emit('new_booking', newBooking);

        // 6. Send Emails
        // 6. Send Emails (Non-blocking)
        setImmediate(async () => {
            try {
                await sendBookingConfirmation(newBooking, salon.name);
                // Notify owner
                // @ts-ignore
                const ownerEmail = (salon.ownerId as any)?.email;
                if (ownerEmail) {
                    await sendNewBookingNotification(ownerEmail, newBooking);
                }
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
            }
        });

        res.status(201).json(newBooking);
    } catch (error: any) {
        console.error('Booking Error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const getUserBookings = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const bookings = await Booking.find({ userId: req.user.id })
            .populate('salonId', 'name address')
            .sort({ bookingTime: -1 });
        res.json(bookings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateBookingStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, estimatedWaitTime } = req.body;

        const booking = await Booking.findById(id).populate('salonId');
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Check if the user is the owner of the salon
        const salon = await Salon.findById(booking.salonId);
        // @ts-ignore
        if (!salon || salon.ownerId.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized to update this booking' });
        }

        if (status) {
            // @ts-ignore
            booking.status = status;
            const now = new Date();
            // @ts-ignore
            if (status === 'in-progress') booking.actualStartTime = now;
            // @ts-ignore
            // @ts-ignore
            else if (status === 'completed') {
                // @ts-ignore
                booking.actualEndTime = now;

                // Send completion email (Non-blocking)
                setImmediate(async () => {
                    // @ts-ignore
                    try {
                        // @ts-ignore
                        const salonName = (booking.salonId as any)?.name || 'Salon';
                        await sendBookingCompletion(booking, salonName);
                    } catch (emailError) {
                        console.error('Failed to send completion email:', emailError);
                    }
                });
            }
        }

        if (estimatedWaitTime !== undefined) {
            const waitTimeNum = Number(estimatedWaitTime);
            // @ts-ignore
            booking.estimatedWaitTime = waitTimeNum;
            // @ts-ignore
            booking.isTimeOverridden = true;
            // @ts-ignore
            booking.estimatedStartTime = new Date(Date.now() + waitTimeNum * 60000);

            // Send email non-blocking
            setImmediate(async () => {
                // @ts-ignore
                try {
                    // @ts-ignore
                    const salonName = (booking.salonId as any)?.name || 'Salon';
                    await sendBookingUpdate(booking, salonName, waitTimeNum);
                } catch (emailError) {
                    console.error('Failed to send update email:', emailError);
                }
            });
        }

        console.log('Saving booking updates...');

        await booking.save();

        if (booking.salonId) {
            const salonIdStr = (booking.salonId as any)._id ? (booking.salonId as any)._id.toString() : booking.salonId.toString();

            // Non-blocking queue update
            setImmediate(async () => {
                console.log('Recalculating queue for salon:', salonIdStr);
                try {
                    await recalculateSalonQueue(salonIdStr);
                    // Emit live update
                    // @ts-ignore
                    getIO().to(salonIdStr).emit('booking_updated', {
                        type: 'STATUS_CHANGE',
                        booking
                    });
                } catch (err) {
                    console.error('Queue update failed:', err);
                }
            });
        }

        res.json(booking);
    } catch (error: any) {
        console.error('Update Booking Error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const getSalonBookings = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const salon = await Salon.findOne({ ownerId: req.user.id });
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found for this user' });
        }

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const bookings = await Booking.find({
            salonId: salon._id,
            $or: [
                { status: { $in: ['pending', 'confirmed', 'in-progress'] } },
                {
                    status: { $in: ['completed', 'cancelled'] },
                    updatedAt: { $gte: twentyFourHoursAgo }
                }
            ]
        })
            .populate('userId', 'name')
            .sort({ bookingTime: -1 });

        res.json({ salon, bookings });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const rateBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { rating } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Invalid rating (1-5)' });
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // @ts-ignore
        if (booking.userId.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // @ts-ignore
        if (booking.isRated) {
            return res.status(400).json({ message: 'Booking already rated' });
        }

        // Update booking
        // @ts-ignore
        booking.isRated = true;
        await booking.save();

        // Update Salon Rating
        const salon = await Salon.findById(booking.salonId);
        if (salon) {
            const currentTotalScore = (salon.rating || 0) * (salon.reviewCount || 0);
            const newReviewCount = (salon.reviewCount || 0) + 1;
            const newRating = (currentTotalScore + rating) / newReviewCount;

            salon.rating = parseFloat(newRating.toFixed(1));
            salon.reviewCount = newReviewCount;
            await salon.save();
        }

        res.json({ message: 'Rating submitted successfully' });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
