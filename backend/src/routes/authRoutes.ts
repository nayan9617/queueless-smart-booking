import express from 'express';
import {
    register,
    login,
    googleAuth,
    verifyEmail,
    resendVerification,
    getMe,
    updateProfile,
    testVerifyEmail,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { authLimiter } from '../middlewares/rateLimitMiddleware';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleAuth);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', authLimiter, resendVerification);
router.post('/test/verify-email', testVerifyEmail);
router.get('/me', protect, getMe);
router.patch('/me', protect, updateProfile);

export default router;
