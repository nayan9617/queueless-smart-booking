import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../../../.env');

dotenv.config({ path: envPath });

let connecting: Promise<typeof mongoose> | null = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }

    if (!connecting) {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/queueless';
        connecting = mongoose
            .connect(mongoURI, { dbName: process.env.DB_NAME || 'queueless' })
            .then((m) => {
                console.log('MongoDB Connected Successfully');
                return m;
            })
            .catch((error) => {
                connecting = null;
                console.error('MongoDB Connection Error:', error);
                throw error;
            });
    }

    return connecting;
};

export default connectDB;
