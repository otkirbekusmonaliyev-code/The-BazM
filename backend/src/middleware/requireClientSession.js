const jwt = require('jsonwebtoken');

// Mijoz QR skanerlab, ism kiritgach oladigan vaqtinchalik token'ni tekshiradi
function requireClientSession(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sessiya topilmadi. Qaytadan QR kodni skanerlang.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'client' || payload.restaurantSlug !== req.restaurantSlug) {
      return res.status(403).json({ error: 'Sessiya yaroqsiz' });
    }
    req.clientSession = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessiya muddati tugagan. Qaytadan QR kodni skanerlang.' });
  }
}

module.exports = requireClientSession;
