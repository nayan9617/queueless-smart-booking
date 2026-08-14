/** Resolve salon image paths (absolute URL, data URL, or /uploads/...). */
export const mediaUrl = (src?: string | null): string => {
    if (!src) return '';
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const origin = apiBase.replace(/\/api\/?$/, '');
    return `${origin}${src.startsWith('/') ? src : `/${src}`}`;
};
