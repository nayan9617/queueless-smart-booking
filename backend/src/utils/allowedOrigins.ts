/** Browser origins allowed for CORS and Socket.IO. */
export const allowedOrigins = (): string[] => {
    const extra = (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return Array.from(
        new Set(
            [
                process.env.CLIENT_URL || 'http://localhost:5173',
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                ...extra,
            ].filter(Boolean)
        )
    );
};
