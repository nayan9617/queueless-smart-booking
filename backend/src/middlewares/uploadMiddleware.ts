import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';

const uploadsRoot = process.env.VERCEL
    ? path.join(os.tmpdir(), 'queueless-uploads', 'salons')
    : path.join(__dirname, '../../uploads/salons');

const ensureUploadsRoot = () => {
    try {
        fs.mkdirSync(uploadsRoot, { recursive: true });
    } catch {
        // Read-only deploys skip local photo storage
    }
};

if (!process.env.VERCEL) {
    ensureUploadsRoot();
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        ensureUploadsRoot();
        cb(null, uploadsRoot);
    },
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (jpeg, png, webp, gif) are allowed'));
    }
};

export const salonImageUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 8 },
});

export const uploadsRootPath = uploadsRoot;
