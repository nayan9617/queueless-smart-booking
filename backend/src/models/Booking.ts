import mongoose, { Schema, Document } from 'mongoose';

interface IServiceBooking {
    name: string;
    price: number;
    duration: number;
    guestName?: string;
}

export interface IBooking extends Document {
    userId: mongoose.Types.ObjectId;
    salonId: mongoose.Types.ObjectId;
    services: IServiceBooking[];
    totalAmount: number;
    paymentStatus: 'pending' | 'paid' | 'failed';
    paymentMethod?: 'razorpay' | 'demo' | null;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    razorpaySignature?: string | null;
    notes?: string;
    contactInfo?: {
        phone: string;
        email: string;
        name?: string;
    };
    status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
    bookingTime: Date;
    estimatedStartTime?: Date;
    estimatedWaitTime?: number;
    predictionConfidence?: number;
    /** Features at booking time for ML retrain (written by createBooking). */
    mlSnapshot?: {
        queue_length: number;
        active_barbers: number;
        avg_duration: number;
        total_chairs: number;
        time_of_day: number;
        day_of_week: number;
        queue_workload: number;
    };
    actualStartTime?: Date;
    actualEndTime?: Date;
    isRated?: boolean;
    customerRating?: number;
    customerReview?: string;
    isTimeOverridden?: boolean;
    /** Client idempotency key to prevent double-submit duplicates */
    clientRequestId?: string | null;
    /** organic = real user; synthetic = ML seed / demo history */
    dataOrigin?: 'organic' | 'synthetic';
    predictedWaitMinutes?: number;
    actualWaitMinutes?: number;
    mlMethod?: string;
}

const BookingSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    services: [{
        name: { type: String, required: true },
        price: { type: Number, required: true },
        duration: { type: Number, required: true },
        guestName: String
    }],
    totalAmount: { type: Number, required: true },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['razorpay', 'demo', null],
        default: null
    },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },
    notes: { type: String, default: '' },
    contactInfo: {
        phone: String,
        email: String,
        name: String
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
        default: 'pending'
    },
    bookingTime: { type: Date, default: Date.now },
    estimatedStartTime: { type: Date },
    estimatedWaitTime: { type: Number },
    predictionConfidence: { type: Number },
    mlSnapshot: {
        queue_length: Number,
        active_barbers: Number,
        avg_duration: Number,
        total_chairs: Number,
        time_of_day: Number,
        day_of_week: Number,
        queue_workload: Number,
    },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    isRated: { type: Boolean, default: false },
    customerRating: { type: Number, min: 1, max: 5 },
    customerReview: { type: String, default: '' },
    isTimeOverridden: { type: Boolean, default: false },
    clientRequestId: { type: String, default: null },
    dataOrigin: { type: String, enum: ['organic', 'synthetic'], default: 'organic' },
    predictedWaitMinutes: { type: Number },
    actualWaitMinutes: { type: Number },
    mlMethod: { type: String },
}, { timestamps: true });

BookingSchema.index({ userId: 1, bookingTime: -1 });
BookingSchema.index({ salonId: 1, status: 1, paymentStatus: 1, bookingTime: 1 });
BookingSchema.index({ salonId: 1, status: 1, actualStartTime: 1 });
BookingSchema.index(
    { userId: 1, clientRequestId: 1 },
    { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);
export default mongoose.model<IBooking>('Booking', BookingSchema);
