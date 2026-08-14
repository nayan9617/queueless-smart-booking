import crypto from 'crypto';
import Razorpay from 'razorpay';

const getKeyId = () => process.env.RAZORPAY_KEY_ID || '';
const getKeySecret = () => process.env.RAZORPAY_KEY_SECRET || '';

export const isRazorpayConfigured = () => Boolean(getKeyId() && getKeySecret());

let razorpay: Razorpay | null = null;

const getClient = () => {
    if (!isRazorpayConfigured()) return null;
    if (!razorpay) {
        razorpay = new Razorpay({
            key_id: getKeyId(),
            key_secret: getKeySecret(),
        });
    }
    return razorpay;
};

export const createRazorpayOrder = async (amountInr: number, receipt: string) => {
    const client = getClient();
    if (!client) {
        throw new Error('Razorpay is not configured');
    }

    const amountPaise = Math.round(amountInr * 100);
    if (amountPaise < 100) {
        throw new Error('Minimum payable amount is ₹1');
    }

    return client.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: receipt.slice(0, 40),
        payment_capture: 1 as unknown as boolean,
    });
};

export const verifyRazorpaySignature = (
    orderId: string,
    paymentId: string,
    signature: string
) => {
    const expected = crypto
        .createHmac('sha256', getKeySecret())
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return expected === signature;
};

export const getRazorpayKeyId = () => getKeyId();
