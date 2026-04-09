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
    contactInfo?: {
        phone: string;
        email: string;
    };
    status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
    bookingTime: Date;
    estimatedStartTime?: Date;
    estimatedWaitTime?: number;
    actualStartTime?: Date;
    actualEndTime?: Date;
    isRated?: boolean;
    isTimeOverridden?: boolean;
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
    contactInfo: {
        phone: String,
        email: String
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    bookingTime: { type: Date, default: Date.now },
    estimatedStartTime: { type: Date },
    estimatedWaitTime: { type: Number }, // In minutes
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    isRated: { type: Boolean, default: false },
    isTimeOverridden: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IBooking>('Booking', BookingSchema);
