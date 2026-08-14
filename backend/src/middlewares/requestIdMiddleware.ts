import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { runWithRequestContext, setRequestContext } from '../utils/requestContext';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    const id =
        typeof incoming === 'string' && incoming.length > 0 ? incoming.slice(0, 64) : randomUUID();
    (req as Request & { requestId?: string }).requestId = id;
    res.setHeader('x-request-id', id);

    runWithRequestContext({ requestId: id }, () => {
        // @ts-ignore
        if (req.user?.id) setRequestContext({ userId: String(req.user.id) });
        next();
    });
};
