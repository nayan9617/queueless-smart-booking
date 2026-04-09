import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || '';
        await mongoose.connect(mongoURI, { dbName: 'queueless' });
        console.log('MongoDB Connected Successfully');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

export default connectDB;
