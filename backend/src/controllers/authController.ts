import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { isDangerousFlagEnabled } from '../utils/envSafety';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import User from '../models/User';
import { sendVerificationEmail, sendWelcomeEmail } from '../services/emailService';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const VERIFY_SECRET = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }
    return `${secret}:email-verify`;
};

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['customer', 'salon_owner']).optional(),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    address: z.string().min(5, 'Address must be at least 5 characters'),
    city: z.string().min(2, 'City is required'),
    location: z
        .object({
            lat: z.number(),
            lng: z.number(),
        })
        .optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

const googleSchema = z.object({
    credential: z.string().min(10),
    role: z.enum(['customer', 'salon_owner']).optional(),
});

const createToken = (user: { _id: unknown; role: string }) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }
    return jwt.sign({ id: user._id, role: user.role }, secret, {
        expiresIn: '30d',
    });
};

const createVerifyToken = (userId: unknown) =>
    jwt.sign({ id: String(userId), purpose: 'email_verify' }, VERIFY_SECRET(), {
        expiresIn: '24h',
    });

const publicUser = (user: any) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    address: user.address,
    city: user.city,
    emailVerified: user.emailVerified,
    location: user.location,
});

const queueMail = (task: () => Promise<unknown>) => {
    void task().catch((err) => console.error('Background email failed:', err));
};

const issueVerification = async (user: any) => {
    const rawToken = createVerifyToken(user._id);
    user.emailVerificationToken = rawToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    // Fire-and-forget so registration / resend stays fast; Gmail can still take a moment to deliver
    queueMail(() => sendVerificationEmail(user.email, user.name, rawToken));
    return rawToken;
};

export const register = async (req: Request, res: Response) => {
    try {
        const validatedData = registerSchema.parse(req.body);

        const existingUser = await User.findOne({ email: validatedData.email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            ...validatedData,
            email: validatedData.email.toLowerCase(),
            emailVerified: false,
        });

        await issueVerification(user);
        logger.event('signup', { userId: String(user._id), role: user.role });

        res.status(201).json({
            message: 'Account created. Please check your email to verify your account before signing in.',
            requiresVerification: true,
            email: user.email,
        });
    } catch (error: any) {
        res.status(400).json({ message: error.errors || error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.emailVerified === false) {
            return res.status(403).json({
                message: 'Please verify your email before signing in. Check your inbox for the verification link.',
                requiresVerification: true,
                email: user.email,
            });
        }

        const token = createToken(user);
        logger.event('login', { userId: String(user._id), role: user.role });
        res.json({ token, user: publicUser(user) });
    } catch (error: any) {
        res.status(400).json({ message: error.errors || error.message });
    }
};

export const googleAuth = async (req: Request, res: Response) => {
    try {
        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({ message: 'Google sign-in is not configured on the server' });
        }

        const { credential, role } = googleSchema.parse(req.body);
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload?.email || !payload.sub) {
            return res.status(400).json({ message: 'Invalid Google credential' });
        }

        if (payload.email_verified === false) {
            return res.status(400).json({ message: 'Google email is not verified' });
        }

        const email = payload.email.toLowerCase();
        let user = await User.findOne({
            $or: [{ googleId: payload.sub }, { email }],
        });

        if (user) {
            if (!user.googleId) user.googleId = payload.sub;
            user.emailVerified = true;
            user.emailVerificationToken = null;
            user.emailVerificationExpires = null;
            if (!user.name && payload.name) user.name = payload.name;
            await user.save();
        } else {
            user = await User.create({
                name: payload.name || email.split('@')[0],
                email,
                googleId: payload.sub,
                role: role || 'customer',
                emailVerified: true,
            });
            const welcomeEmail = user.email;
            const welcomeName = user.name;
            const welcomeRole = user.role;
            queueMail(() => sendWelcomeEmail(welcomeEmail, welcomeName, welcomeRole));
        }

        const token = createToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (error: any) {
        console.error('Google auth error:', error);
        res.status(400).json({ message: error.message || 'Google authentication failed' });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const token = String(req.query.token || req.body.token || '').trim();
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        let payload: { id?: string; purpose?: string };
        try {
            payload = jwt.verify(token, VERIFY_SECRET()) as { id?: string; purpose?: string };
        } catch {
            return res.status(400).json({
                message: 'Invalid or expired verification link. Request a new one from the login page.',
            });
        }

        if (payload.purpose !== 'email_verify' || !payload.id) {
            return res.status(400).json({ message: 'Invalid verification link' });
        }

        const user = await User.findById(payload.id);
        if (!user) {
            return res.status(400).json({ message: 'Account not found for this verification link' });
        }

        const alreadyVerified = user.emailVerified === true;

        if (!alreadyVerified) {
            user.emailVerified = true;
            user.emailVerificationToken = null;
            user.emailVerificationExpires = null;
            await user.save();
            queueMail(() => sendWelcomeEmail(user.email, user.name, user.role));
        }

        const authToken = createToken(user);
        res.json({
            message: alreadyVerified ? 'Email already verified' : 'Email verified successfully',
            token: authToken,
            user: publicUser(user),
        });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const resendVerification = async (req: Request, res: Response) => {
    try {
        const email = String(req.body.email || '').toLowerCase();
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ message: 'If that account exists, a verification email has been sent.' });
        }

        if (user.emailVerified) {
            return res.json({ message: 'Email is already verified. You can sign in.' });
        }

        await issueVerification(user);
        res.json({ message: 'Verification email sent. Please check your inbox.' });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

const updateProfileSchema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    address: z.string().min(5).optional(),
    city: z.string().min(2).optional(),
    location: z
        .object({
            lat: z.number(),
            lng: z.number(),
        })
        .optional(),
});

export const getMe = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const user = await User.findById(req.user.id).select('-password -emailVerificationToken');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user: publicUser(user) });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const data = updateProfileSchema.parse(req.body);
        // @ts-ignore
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (data.name !== undefined) user.name = data.name;
        if (data.phone !== undefined) user.phone = data.phone;
        if (data.address !== undefined) user.address = data.address;
        if (data.city !== undefined) user.city = data.city;
        if (data.location !== undefined) user.location = data.location;

        await user.save();
        res.json({
            message: 'Profile updated',
            user: publicUser(user),
        });
    } catch (error: any) {
        res.status(400).json({ message: error.errors || error.message });
    }
};

/**
 * Deterministic email verification for automated E2E only.
 * Gated by ALLOW_TEST_EMAIL_VERIFY=true — never enable in public production.
 */
export const testVerifyEmail = async (req: Request, res: Response) => {
    if (!isDangerousFlagEnabled('ALLOW_TEST_EMAIL_VERIFY')) {
        return res.status(404).json({ message: 'Not found' });
    }
    try {
        const email = String(req.body.email || '').toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        res.json({ message: 'Verified for test', email: user.email });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
