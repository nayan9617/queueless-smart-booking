import axios from 'axios';
import { logger } from '../utils/logger';
import { bump } from '../utils/betaCounters';

const ML_SERVICE_URL = () => process.env.ML_SERVICE_URL || 'http://localhost:8000';

export interface PredictionParams {
    queue_length: number;
    active_barbers: number;
    service_duration_avg: number;
    time_of_day: number;
    day_of_week: number;
    total_chairs: number;
    queue_workload?: number;
}

export const predictWaitTime = async (
    params: PredictionParams
): Promise<{ waitTime: number; confidence: number; method?: string }> => {
    bump('mlRequested');
    try {
        const response = await axios.post(`${ML_SERVICE_URL()}/predict`, params, { timeout: 8000 });
        const waitTime = Number(response.data?.estimated_wait_time);
        if (!Number.isFinite(waitTime)) {
            throw new Error('invalid_ml_output');
        }
        bump('mlSucceeded');
        logger.event('ml_prediction_succeeded', {
            method: response.data.method,
            waitTime,
        });
        return {
            waitTime,
            confidence: Number(response.data.confidence_score) || 0,
            method: response.data.method,
        };
    } catch (error: unknown) {
        bump('mlFallback');
        const reason =
            axios.isAxiosError(error) && !error.response
                ? 'ml_unavailable'
                : error instanceof Error
                  ? error.message
                  : 'ml_error';
        logger.warn('ml_prediction_fallback', { reason });

        const activeBarbers = Math.max(1, params.active_barbers || 1);
        const avgDuration = params.service_duration_avg || 30;
        const workload =
            typeof params.queue_workload === 'number'
                ? params.queue_workload
                : (params.queue_length || 0) * avgDuration;

        return {
            waitTime: workload / activeBarbers,
            confidence: 0.3,
            method: 'physics_fallback',
        };
    }
};

export const probeMlHealth = async (): Promise<{ ok: boolean; modelLoaded?: boolean }> => {
    try {
        const res = await axios.get(`${ML_SERVICE_URL()}/health`, { timeout: 2500 });
        return {
            ok: Boolean(res.data?.ok),
            modelLoaded: Boolean(res.data?.model_loaded),
        };
    } catch {
        return { ok: false };
    }
};
