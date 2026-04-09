import mongoose, { Schema, Document } from 'mongoose';

export interface IService {
    name: string;
    durationMin: number;
    price: number;
}

export interface ISalon extends Document {
    ownerId: mongoose.Types.ObjectId;
    name: string;
    address: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    chairs: number;
    services: IService[];
    status: 'open' | 'closed' | 'break';
    images: string[];
    rating: number;
    reviewCount: number;
    staff: {
        _id: mongoose.Types.ObjectId;
        name: string;
        role: 'barber' | 'manager';
        isAvailable: boolean;
        currentBookingId?: mongoose.Types.ObjectId;
    }[];
}

const SalonSchema: Schema = new Schema({
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    chairs: { type: Number, required: true, min: 1 },
    services: [{
        name: { type: String, required: true },
        durationMin: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    status: { type: String, enum: ['open', 'closed', 'break'], default: 'open' },
    images: [{ type: String }],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    staff: [{
        name: { type: String, required: true },
        role: { type: String, enum: ['barber', 'manager'], default: 'barber' },
        isAvailable: { type: Boolean, default: true },
        currentBookingId: { type: Schema.Types.ObjectId, ref: 'Booking' }
    }]
}, { timestamps: true });

export default mongoose.model<ISalon>('Salon', SalonSchema);
