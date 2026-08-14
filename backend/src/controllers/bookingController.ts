import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking';
import Salon from '../models/Salon';
import { predictWaitTime } from '../services/mlService';
import {
    sendBookingConfirmation,
    sendBookingUpdate,
    sendNewBookingNotification,
    sendBookingCompletion,
} from '../services/emailService';
import { getIO } from '../socket';
import { recalculateSalonQueue } from '../services/queueService';
import {
    createRazorpayOrder,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyRazorpaySignature,
} from '../services/paymentService';
import { claimChairSlot, releaseChairSlot } from '../services/chairCapacity';
import { logger } from '../utils/logger';
import { bump } from '../utils/betaCounters';
import { setRequestContext } from '../utils/requestContext';
import { isDangerousFlagEnabled } from '../utils/envSafety';
import { expireStalePendingBookings } from '../services/pendingExpiryService';

const finalizeConfirmedBooking = async (booking: any, salon: any) => {
    await recalculateSalonQueue(String(salon._id));

    // Recalc updates ETA in DB; reload so email + sockets match the dashboard
    const latest = (await Booking.findById(booking._id)) || booking;

    const io = getIO();
    io.to(String(salon._id)).emit('new_booking', latest);
    if (latest.userId) {
        io.to(`user:${String(latest.userId)}`).emit('booking_updated', {
            type: 'CONFIRMED',
            bookingId: latest._id,
            status: latest.status,
            estimatedWaitTime: latest.estimatedWaitTime,
            estimatedStartTime: latest.estimatedStartTime,
        });
    }

    setImmediate(async () => {
        try {
            await sendBookingConfirmation(latest, salon.name);
            const ownerEmail = (salon.ownerId as any)?.email;
            if (ownerEmail) {
                await sendNewBookingNotification(ownerEmail, booking);
            }
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }
    });
};

export const createBooking = async (req: Request, res: Response) => {
    try {
        await expireStalePendingBookings().catch(() => undefined);
        const { salonId, services, contactInfo, notes, clientRequestId } = req.body;
        // @ts-ignore
        const userId = req.user.id;
        const idempotencyKey =
            (typeof clientRequestId === 'string' && clientRequestId.trim()) ||
            (typeof req.headers['idempotency-key'] === 'string'
                ? String(req.headers['idempotency-key']).trim()
                : '');

        if (!mongoose.Types.ObjectId.isValid(salonId)) {
            return res.status(400).json({ message: 'Invalid Salon ID format' });
        }

        if (!contactInfo?.phone || !contactInfo?.email) {
            return res.status(400).json({ message: 'Phone and email are required' });
        }

        if (idempotencyKey) {
            const existing = await Booking.findOne({ userId, clientRequestId: idempotencyKey });
            if (existing) {
            bump('bookingIdempotencyConflict');
            logger.event('booking_idempotency_replay', {
                bookingId: String(existing._id),
                salonId,
            });
            return res.status(200).json({
                booking: existing,
                payment: {
                    provider: existing.paymentMethod || 'demo',
                    reused: true,
                    message: 'Idempotent replay — returning existing booking',
                },
            });
            }
        }

        // One active visit per customer per salon (pending unpaid counts for 15 min)
        const recentPendingCutoff = new Date(Date.now() - 15 * 60 * 1000);
        const activeForUser = await Booking.findOne({
            userId,
            salonId,
            $or: [
                { status: { $in: ['confirmed', 'in-progress'] }, paymentStatus: 'paid' },
                {
                    status: 'pending',
                    paymentStatus: 'pending',
                    createdAt: { $gte: recentPendingCutoff },
                },
            ],
        });
        if (activeForUser) {
            if (
                idempotencyKey &&
                activeForUser.clientRequestId &&
                activeForUser.clientRequestId === idempotencyKey
            ) {
                return res.status(200).json({
                    booking: activeForUser,
                    payment: {
                        provider: activeForUser.paymentMethod || 'demo',
                        reused: true,
                    },
                });
            }
            bump('bookingIdempotencyConflict');
            logger.event('booking_duplicate_blocked', {
                bookingId: String(activeForUser._id),
                salonId,
            });
            return res.status(409).json({
                message:
                    'You already have an active or unpaid booking at this salon. Complete or cancel it first.',
                bookingId: activeForUser._id,
            });
        }

        const salon = await Salon.findById(salonId).populate('ownerId');
        if (!salon) return res.status(404).json({ message: 'Salon not found' });

        if (salon.status === 'closed') {
            return res.status(400).json({ message: 'This salon is currently closed' });
        }
        if (salon.status === 'break') {
            return res.status(400).json({
                message: 'This salon is on a break. Please try again shortly.',
            });
        }

        if (!services || !Array.isArray(services) || services.length === 0) {
            return res.status(400).json({ message: 'No services selected' });
        }

        const totalDuration = services.reduce((acc: number, s: any) => acc + Number(s.duration || 0), 0);
        const totalAmount = services.reduce((acc: number, s: any) => acc + Number(s.price || 0), 0);

        if (totalAmount <= 0) {
            return res.status(400).json({ message: 'Invalid booking amount' });
        }

        const activeInQueue = await Booking.find({
            salonId,
            status: { $in: ['confirmed', 'in-progress'] },
            paymentStatus: 'paid',
        }).select('services status actualStartTime');

        const activeBookingsCount = activeInQueue.length;
        const now = new Date();
        // Remaining service minutes ahead (physics input for ML hybrid)
        const queueWorkload = activeInQueue.reduce((sum, b: any) => {
            const duration = (b.services || []).reduce(
                (acc: number, s: any) => acc + Number(s.duration || 0),
                0
            );
            const base = duration > 0 ? duration : 30;
            if (b.status === 'in-progress' && b.actualStartTime) {
                const elapsed = Math.max(0, (now.getTime() - new Date(b.actualStartTime).getTime()) / 60000);
                return sum + Math.max(0, base - elapsed);
            }
            return sum + base;
        }, 0);

        const timeOfDay = now.getHours() * 60 + now.getMinutes();
        // Align with Python weekday(): Monday=0 … Sunday=6 (JS getDay is Sunday=0)
        const dayOfWeek = (now.getDay() + 6) % 7;

        const activeStaffCount = salon.staff.filter((s: any) => s.isAvailable).length;
        const effectiveBarbers = activeStaffCount > 0 ? activeStaffCount : Math.max(1, salon.staff.length || 1);

        const prediction = await predictWaitTime({
            queue_length: activeBookingsCount,
            active_barbers: effectiveBarbers,
            service_duration_avg: totalDuration,
            time_of_day: timeOfDay,
            day_of_week: dayOfWeek,
            total_chairs: salon.chairs,
            queue_workload: queueWorkload,
        });

        const waitMinutes = Math.max(0, Number(prediction.waitTime) || 0);
        // Use one clock for bookingTime + estimate so start can never precede booking
        const bookingTime = new Date();
        const estimatedStartTime = new Date(bookingTime.getTime() + waitMinutes * 60000);

        const newBooking = new Booking({
            userId,
            salonId,
            services,
            totalAmount,
            contactInfo: {
                phone: contactInfo.phone,
                email: contactInfo.email,
                name: contactInfo.name || services[0]?.guestName,
            },
            notes: notes || '',
            paymentStatus: 'pending',
            status: 'pending',
            bookingTime,
            clientRequestId: idempotencyKey || null,
            estimatedWaitTime: waitMinutes,
            predictedWaitMinutes: waitMinutes,
            predictionConfidence: prediction.confidence,
            mlMethod: prediction.method,
            dataOrigin: 'organic',
            mlSnapshot: {
                queue_length: activeBookingsCount,
                active_barbers: effectiveBarbers,
                avg_duration: totalDuration,
                total_chairs: salon.chairs,
                time_of_day: timeOfDay,
                day_of_week: dayOfWeek,
                queue_workload: queueWorkload,
            },
            estimatedStartTime,
        });

        try {
            await newBooking.save();
        } catch (saveErr: any) {
            // Race on unique idempotency index
            if (saveErr?.code === 11000 && idempotencyKey) {
                const existing = await Booking.findOne({ userId, clientRequestId: idempotencyKey });
                if (existing) {
                    bump('bookingIdempotencyConflict');
                    logger.event('booking_idempotency_replay', {
                        bookingId: String(existing._id),
                        salonId,
                    });
                    return res.status(200).json({
                        booking: existing,
                        payment: { provider: existing.paymentMethod || 'demo', reused: true },
                    });
                }
            }
            throw saveErr;
        }

        setRequestContext({ bookingId: String(newBooking._id), salonId: String(salonId) });
        logger.event('booking_created', {
            bookingId: String(newBooking._id),
            salonId: String(salonId),
            predictedWait: waitMinutes,
            mlMethod: prediction.method,
        });

        if (isRazorpayConfigured() && !isDangerousFlagEnabled('ALLOW_DEMO_PAY')) {
            try {
                const order = await createRazorpayOrder(totalAmount, `bk_${String(newBooking._id)}`);
                newBooking.razorpayOrderId = order.id;
                newBooking.paymentMethod = 'razorpay';
                await newBooking.save();
                logger.event('payment_initiated', {
                    bookingId: String(newBooking._id),
                    salonId: String(salonId),
                    provider: 'razorpay',
                    orderId: order.id,
                });

                return res.status(201).json({
                    booking: newBooking,
                    payment: {
                        provider: 'razorpay',
                        keyId: getRazorpayKeyId(),
                        orderId: order.id,
                        amount: order.amount,
                        currency: order.currency,
                    },
                });
            } catch (paymentError: any) {
                logger.error('payment_order_failed', {
                    bookingId: String(newBooking._id),
                    salonId: String(salonId),
                    message: paymentError.message,
                });
                newBooking.paymentStatus = 'failed';
                await newBooking.save();
                return res.status(502).json({
                    message: paymentError.message || 'Could not start payment. Try again.',
                    bookingId: newBooking._id,
                });
            }
        }

        newBooking.paymentMethod = 'demo';
        await newBooking.save();
        logger.event('payment_initiated', {
            bookingId: String(newBooking._id),
            salonId: String(salonId),
            provider: 'demo',
        });

        res.status(201).json({
            booking: newBooking,
            payment: {
                provider: 'demo',
                message: isDangerousFlagEnabled('ALLOW_DEMO_PAY')
                    ? 'Demo payment enabled (ALLOW_DEMO_PAY).'
                    : 'Razorpay keys not configured. Complete payment in demo mode.',
            },
        });
    } catch (error: any) {
        console.error('Booking Error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const {
            bookingId,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            demo = false,
        } = req.body;
        // @ts-ignore
        const userId = req.user.id;

        const booking = await Booking.findById(bookingId).populate({
            path: 'salonId',
            populate: { path: 'ownerId', select: 'email name' },
        });

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.userId.toString() !== userId) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        setRequestContext({
            bookingId: String(booking._id),
            salonId: String(booking.salonId?._id || booking.salonId),
        });

        if (booking.paymentStatus === 'paid' && ['confirmed', 'in-progress', 'completed'].includes(booking.status)) {
            logger.event('payment_already_confirmed', { bookingId: String(booking._id) });
            return res.json({ message: 'Already paid', booking });
        }

        if (['cancelled', 'no-show'].includes(booking.status)) {
            logger.event('payment_verification_failed', {
                bookingId: String(booking._id),
                reason: 'terminal_status',
                status: booking.status,
            });
            bump('paymentVerifyFailed');
            return res.status(400).json({ message: 'Booking is no longer payable' });
        }

        const allowDemoPay =
            isDangerousFlagEnabled('ALLOW_DEMO_PAY') ||
            !isRazorpayConfigured() ||
            booking.paymentMethod === 'demo';

        if (demo || booking.paymentMethod === 'demo') {
            if (!allowDemoPay) {
                return res.status(400).json({
                    message: 'Demo payment not allowed when Razorpay is configured',
                });
            }

            const confirmed = await Booking.findOneAndUpdate(
                {
                    _id: bookingId,
                    userId,
                    status: 'pending',
                    paymentStatus: { $in: ['pending', 'failed'] },
                },
                {
                    $set: {
                        paymentStatus: 'paid',
                        status: 'confirmed',
                        paymentMethod: 'demo',
                    },
                },
                { new: true }
            ).populate({
                path: 'salonId',
                populate: { path: 'ownerId', select: 'email name' },
            });

            if (!confirmed) {
                const latest = await Booking.findById(bookingId);
                if (latest?.paymentStatus === 'paid') {
                    logger.event('payment_already_confirmed', { bookingId: String(bookingId) });
                    return res.json({ message: 'Already paid', booking: latest });
                }
                bump('paymentVerifyFailed');
                logger.event('payment_verification_failed', {
                    bookingId: String(bookingId),
                    reason: 'cannot_confirm',
                    status: latest?.status,
                    paymentStatus: latest?.paymentStatus,
                });
                return res.status(409).json({ message: 'Booking cannot be confirmed' });
            }

            bump('paymentVerifySucceeded');
            logger.event('payment_verification_succeeded', {
                bookingId: String(confirmed._id),
                provider: 'demo',
            });
            logger.event('booking_confirmed', { bookingId: String(confirmed._id) });
            await finalizeConfirmedBooking(confirmed, confirmed.salonId as any);
            return res.json({ message: 'Payment successful (demo)', booking: confirmed });
        }

        if (!isRazorpayConfigured()) {
            return res.status(500).json({ message: 'Razorpay is not configured' });
        }

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing Razorpay payment fields' });
        }

        if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({ message: 'Order mismatch' });
        }

        const valid = verifyRazorpaySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!valid) {
            booking.paymentStatus = 'failed';
            await booking.save();
            bump('paymentVerifyFailed');
            logger.event('payment_verification_failed', {
                bookingId: String(booking._id),
                reason: 'invalid_signature',
            });
            return res.status(400).json({ message: 'Payment verification failed' });
        }

        const confirmed = await Booking.findOneAndUpdate(
            {
                _id: bookingId,
                userId,
                status: 'pending',
                paymentStatus: { $in: ['pending', 'failed'] },
            },
            {
                $set: {
                    paymentStatus: 'paid',
                    status: 'confirmed',
                    paymentMethod: 'razorpay',
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                },
            },
            { new: true }
        ).populate({
            path: 'salonId',
            populate: { path: 'ownerId', select: 'email name' },
        });

        if (!confirmed) {
            const latest = await Booking.findById(bookingId);
            if (latest?.paymentStatus === 'paid') {
                logger.event('payment_already_confirmed', { bookingId: String(bookingId) });
                return res.json({ message: 'Already paid', booking: latest });
            }
            bump('paymentVerifyFailed');
            logger.event('payment_verification_failed', {
                bookingId: String(bookingId),
                reason: 'cannot_confirm',
                status: latest?.status,
                paymentStatus: latest?.paymentStatus,
            });
            return res.status(409).json({ message: 'Booking cannot be confirmed' });
        }

        bump('paymentVerifySucceeded');
        logger.event('payment_verification_succeeded', {
            bookingId: String(confirmed._id),
            provider: 'razorpay',
        });
        logger.event('booking_confirmed', { bookingId: String(confirmed._id) });
        await finalizeConfirmedBooking(confirmed, confirmed.salonId as any);
        res.json({ message: 'Payment verified', booking: confirmed });
    } catch (error: any) {
        console.error('Verify payment error:', error);
        res.status(500).json({ message: error.message });
    }
};

export const cancelBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // @ts-ignore
        const userId = req.user.id;

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.userId.toString() !== userId) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        if (!['pending', 'confirmed'].includes(booking.status)) {
            return res.status(400).json({ message: 'Only pending or confirmed bookings can be cancelled' });
        }

        booking.status = 'cancelled';
        if (booking.paymentStatus === 'pending') {
            booking.paymentStatus = 'failed';
        }
        await booking.save();
        logger.event('booking_cancelled', {
            bookingId: String(booking._id),
            salonId: String(booking.salonId),
            actor: 'customer',
        });

        await recalculateSalonQueue(String(booking.salonId));
        getIO().to(String(booking.salonId)).emit('booking_updated', {
            type: 'CANCELLED',
            booking,
        });
        getIO().to(`user:${String(booking.userId)}`).emit('booking_updated', {
            type: 'CANCELLED',
            bookingId: booking._id,
            status: 'cancelled',
        });

        res.json({ message: 'Booking cancelled', booking });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getUserBookings = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.user.id;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const filter = { userId };
        const [total, bookings] = await Promise.all([
            Booking.countDocuments(filter),
            Booking.find(filter)
                .populate('salonId', 'name address images _id')
                .sort({ bookingTime: -1 })
                .skip(skip)
                .limit(limit),
        ]);

        const data = bookings.map((b: any) => ({
            ...b.toObject(),
            salonId: b.salonId || { name: 'Salon unavailable', address: '' },
        }));

        res.json({
            data,
            pagination: {
                page,
                limit,
                total,
                hasNext: skip + data.length < total,
            },
        });
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

        const salon = await Salon.findById(booking.salonId);
        // @ts-ignore
        if (!salon || salon.ownerId.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized to update this booking' });
        }

        if (status) {
            const allowed = ['confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'];
            if (!allowed.includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            // Terminal / transition guards
            if (['completed', 'cancelled', 'no-show'].includes(booking.status)) {
                return res.status(400).json({
                    message: `Cannot change status from ${booking.status}`,
                });
            }
            if (status === 'in-progress' && booking.status !== 'confirmed') {
                return res.status(400).json({ message: 'Only confirmed bookings can be started' });
            }
            if (status === 'no-show' && !['confirmed', 'pending'].includes(booking.status)) {
                return res.status(400).json({
                    message: 'Only waiting customers can be marked no-show',
                });
            }
            if (status === 'completed' && booking.status === 'no-show') {
                return res.status(400).json({ message: 'No-show bookings cannot be completed' });
            }

            // Soft capacity lock replaced by atomic chair claim below for in-progress
            if (status === 'in-progress' && salon) {
                const claimed = await claimChairSlot(salon._id);
                if (!claimed) {
                    return res.status(409).json({
                        message: 'All chairs are busy. Complete a service before starting another.',
                    });
                }

                const started = await Booking.findOneAndUpdate(
                    {
                        _id: id,
                        status: 'confirmed',
                        paymentStatus: 'paid',
                    },
                    {
                        $set: {
                            status: 'in-progress',
                            actualStartTime: new Date(),
                        },
                    },
                    { new: true }
                ).populate('salonId');

                if (!started) {
                    await releaseChairSlot(salon._id);
                    return res.status(400).json({
                        message: 'Only confirmed paid bookings can be started',
                    });
                }

                setImmediate(async () => {
                    try {
                        await recalculateSalonQueue(String(salon._id));
                        getIO().to(String(salon._id)).emit('booking_updated', {
                            type: 'STATUS_CHANGE',
                            booking: started,
                        });
                        getIO().to(`user:${String(started.userId)}`).emit('booking_updated', {
                            type: 'STATUS_CHANGE',
                            bookingId: started._id,
                            status: started.status,
                            estimatedWaitTime: started.estimatedWaitTime,
                            estimatedStartTime: started.estimatedStartTime,
                        });
                    } catch (err) {
                        logger.error('Queue update failed after start', {
                            bookingId: String(started._id),
                            salonId: String(salon._id),
                        });
                    }
                });

                logger.event('service_started', {
                    bookingId: String(started._id),
                    salonId: String(salon._id),
                });
                return res.json(started);
            }

            const previousStatus = booking.status;
            booking.status = status;
            const now = new Date();
            if (status === 'completed') {
                booking.actualEndTime = now;
                if (booking.bookingTime && booking.actualStartTime) {
                    booking.actualWaitMinutes = Math.max(
                        0,
                        Math.round(
                            (new Date(booking.actualStartTime).getTime() -
                                new Date(booking.bookingTime).getTime()) /
                                60000
                        )
                    );
                }
                logger.event('service_completed', {
                    bookingId: String(booking._id),
                    salonId: String(salon._id),
                    predictedWait: booking.predictedWaitMinutes ?? booking.estimatedWaitTime,
                    actualWait: booking.actualWaitMinutes,
                });
                setImmediate(async () => {
                    try {
                        const salonName = (booking.salonId as any)?.name || 'Salon';
                        await sendBookingCompletion(booking, salonName);
                    } catch (emailError) {
                        console.error('Failed to send completion email:', emailError);
                    }
                });
            } else if (status === 'no-show') {
                booking.actualEndTime = now;
                logger.event('customer_marked_no_show', {
                    bookingId: String(booking._id),
                    salonId: String(salon._id),
                });
            } else if (status === 'cancelled') {
                logger.event('booking_cancelled', {
                    bookingId: String(booking._id),
                    salonId: String(salon._id),
                    actor: 'owner',
                });
            }

            if (
                previousStatus === 'in-progress' &&
                ['completed', 'cancelled', 'no-show'].includes(status) &&
                salon
            ) {
                await releaseChairSlot(salon._id);
            }
        }

        if (estimatedWaitTime !== undefined) {
            const waitTimeNum = Math.max(0, Number(estimatedWaitTime) || 0);
            const bookedAt = booking.bookingTime
                ? new Date(booking.bookingTime).getTime()
                : Date.now();
            const startMs = Math.max(bookedAt, Date.now() + waitTimeNum * 60000);
            booking.estimatedWaitTime = waitTimeNum;
            booking.isTimeOverridden = true;
            booking.estimatedStartTime = new Date(startMs);
            logger.event('queue_modified', {
                bookingId: String(booking._id),
                salonId: String(salon?._id || booking.salonId),
                estimatedWaitTime: waitTimeNum,
            });

            setImmediate(async () => {
                try {
                    const salonName = (booking.salonId as any)?.name || 'Salon';
                    await sendBookingUpdate(booking, salonName, waitTimeNum);
                } catch (emailError) {
                    console.error('Failed to send update email:', emailError);
                }
            });
        }

        await booking.save();

        if (booking.salonId) {
            const salonIdStr = (booking.salonId as any)._id
                ? (booking.salonId as any)._id.toString()
                : booking.salonId.toString();

            setImmediate(async () => {
                try {
                    await recalculateSalonQueue(salonIdStr);
                    getIO().to(salonIdStr).emit('booking_updated', {
                        type: 'STATUS_CHANGE',
                        booking,
                    });
                    getIO().to(`user:${String(booking.userId)}`).emit('booking_updated', {
                        type: 'STATUS_CHANGE',
                        bookingId: booking._id,
                        status: booking.status,
                        estimatedWaitTime: booking.estimatedWaitTime,
                        estimatedStartTime: booking.estimatedStartTime,
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
                {
                    status: { $in: ['confirmed', 'in-progress'] },
                    paymentStatus: 'paid',
                },
                {
                    status: 'pending',
                    paymentStatus: 'paid',
                },
                {
                    status: { $in: ['completed', 'cancelled', 'no-show'] },
                    updatedAt: { $gte: twentyFourHoursAgo },
                },
            ],
        })
            .populate('userId', 'name phone email')
            .sort({ bookingTime: -1 })
            .limit(100);

        res.json({ salon, bookings });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/** Lightweight owner MVP analytics for today (local calendar day). */
export const getSalonAnalytics = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const salon = await Salon.findOne({ ownerId: req.user.id });
        if (!salon) {
            return res.status(404).json({ message: 'Salon not found for this user' });
        }

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const todays = await Booking.find({
            salonId: salon._id,
            bookingTime: { $gte: start, $lte: end },
        }).select('status estimatedWaitTime services paymentStatus');

        const count = (status: string) => todays.filter((b) => b.status === status).length;
        const completed = todays.filter((b) => b.status === 'completed');
        const avgWait =
            todays.length > 0
                ? todays.reduce((s, b) => s + (b.estimatedWaitTime || 0), 0) / todays.length
                : 0;
        const avgDuration =
            completed.length > 0
                ? completed.reduce((s, b) => {
                      const d = (b.services || []).reduce(
                          (a, x: any) => a + Number(x.duration || 0),
                          0
                      );
                      return s + d;
                  }, 0) / completed.length
                : 0;

        res.json({
            salonId: salon._id,
            date: start.toISOString().slice(0, 10),
            totals: {
                bookings: todays.length,
                completed: count('completed'),
                cancelled: count('cancelled'),
                noShow: count('no-show'),
                inProgress: count('in-progress'),
                confirmed: count('confirmed'),
                pending: count('pending'),
            },
            averages: {
                estimatedWaitMinutes: Math.round(avgWait * 10) / 10,
                completedServiceDurationMinutes: Math.round(avgDuration * 10) / 10,
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const rateBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        const score = Number(rating);
        if (!Number.isFinite(score) || score < 1 || score > 5) {
            return res.status(400).json({ message: 'Invalid rating (1-5)' });
        }

        const booking = await Booking.findById(id).populate('salonId', 'name rating reviewCount');
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // @ts-ignore
        if (booking.userId.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        if (booking.status !== 'completed') {
            return res.status(400).json({ message: 'Only completed bookings can be rated' });
        }

        if (booking.isRated) {
            return res.status(400).json({ message: 'Booking already rated' });
        }

        booking.isRated = true;
        booking.customerRating = score;
        logger.event('rating_submitted', {
            bookingId: String(booking._id),
            rating: score,
        });
        if (typeof comment === 'string' && comment.trim()) {
            booking.customerReview = comment.trim().slice(0, 500);
        }
        await booking.save();

        const salonId =
            (booking.salonId as any)?._id || booking.salonId;
        const salon = await Salon.findById(salonId);
        if (salon) {
            const currentTotalScore = (salon.rating || 0) * (salon.reviewCount || 0);
            const newReviewCount = (salon.reviewCount || 0) + 1;
            const newRating = (currentTotalScore + score) / newReviewCount;

            salon.rating = parseFloat(newRating.toFixed(1));
            salon.reviewCount = newReviewCount;
            await salon.save();
        }

        const salonName =
            typeof booking.salonId === 'object' && booking.salonId && 'name' in (booking.salonId as any)
                ? (booking.salonId as any).name
                : salon?.name || 'Salon';

        res.json({
            message: 'Rating submitted successfully',
            salonName,
            rating: score,
            salonRating: salon?.rating,
            reviewCount: salon?.reviewCount,
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
