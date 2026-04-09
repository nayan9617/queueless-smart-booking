import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

interface PredictionParams {
    queue_length: number;
    active_barbers: number;
    service_duration_avg: number;
    time_of_day: number; // Minutes from midnight
    day_of_week: number; // 0-6
    total_chairs: number;
}

export const predictWaitTime = async (params: PredictionParams): Promise<{ waitTime: number; confidence: number }> => {
    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, params);
        return {
            waitTime: response.data.estimated_wait_time,
            confidence: response.data.confidence_score
        };
    } catch (error) {
        console.error('ML Service Error:', error);
        // Fallback if ML service is down
        const activeBarbers = Math.max(1, params.active_barbers || 1);
        const queueLength = params.queue_length || 0;
        const avgDuration = params.service_duration_avg || 30;
        // params.total_chairs is available but not used in simple fallback

        return {
            waitTime: (queueLength * avgDuration) / activeBarbers,
            confidence: 0
        };
    }
};
