import { AsyncLocalStorage } from 'async_hooks';

export type RequestContext = {
    requestId?: string;
    userId?: string;
    salonId?: string;
    bookingId?: string;
};

const als = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(ctx: RequestContext, fn: () => T): T =>
    als.run({ ...ctx }, fn);

export const getRequestContext = (): RequestContext => als.getStore() || {};

export const setRequestContext = (patch: RequestContext) => {
    const store = als.getStore();
    if (!store) return;
    Object.assign(store, patch);
};
