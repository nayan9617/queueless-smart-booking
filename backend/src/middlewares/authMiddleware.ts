import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { setRequestContext } from '../utils/requestContext';

export const protect = (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('JWT_SECRET is not configured');
        return res.status(500).json({ message: 'Server auth misconfigured' });
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, secret) as { id?: string; role?: string };
        // @ts-ignore
        req.user = decoded;
        if (decoded?.id) setRequestContext({ userId: String(decoded.id) });
        return next();
    } catch {
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};
