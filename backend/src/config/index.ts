import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(__dirname, '../../../.env');

dotenv.config({ path: envPath });

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/queueless';
        await mongoose.connect(mongoURI, { dbName: 'queueless' });
        console.log('MongoDB Connected Successfully');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

export default connectDB;
