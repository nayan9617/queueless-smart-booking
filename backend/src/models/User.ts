import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    role: 'customer' | 'admin' | 'salon_owner';
    phone?: string;
    address?: string;
    city?: string;
    googleId?: string;
    emailVerified: boolean;
    emailVerificationToken?: string | null;
    emailVerificationExpires?: Date | null;
    location?: {
        lat: number;
        lng: number;
    };
    comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: {
        type: String,
        required: function (this: IUser) {
            return !this.googleId;
        },
    },
    role: { type: String, enum: ['customer', 'admin', 'salon_owner'], default: 'customer' },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    googleId: { type: String, sparse: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    location: {
        lat: { type: Number },
        lng: { type: Number },
    },
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    const user = this as unknown as IUser;
    if (!user.password || !user.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    if (!this.password) return false;
    return await bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
