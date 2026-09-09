// Taom rasmlarini yuklash. MVP uchun rasmlar shu serverning `uploads/`
// papkasida saqlanadi va `/uploads/...` orqali statik tarqatiladi.
// (Production'da S3 yoki shunga o'xshash obyekt-saqlagichga o'tkazish tavsiya etiladi.)

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', '..', 'uploads');
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // Har bir restoranning rasmlari o'z papkasida — aralashib ketmaydi
    const dir = path.join(UPLOAD_ROOT, req.restaurantSlug);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(req, file, cb) {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new Error('Faqat JPG, PNG, WEBP yoki GIF rasm yuklash mumkin'));
    }
    cb(null, true);
  },
});

router.post('/image', requireRole(['admin']), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Rasm yuborilmadi' });
    }
    res.status(201).json({ url: `/uploads/${req.restaurantSlug}/${req.file.filename}` });
  });
});

module.exports = router;
