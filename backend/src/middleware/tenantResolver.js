// Har bir tenant so'rovida (masalan delish.sizning-saas.uz yoki
// header: X-Restaurant-Slug orqali — development bosqichida qulay)
// qaysi restoranga tegishli ekanini aniqlaydi va req.tenantDb ga
// tegishli Prisma client'ni biriktiradi.

const { getTenantClient } = require('../config/tenantDb');

function extractSlug(req) {
  // Production: subdomain orqali (masalan delish.sizning-saas.uz -> "delish")
  const host = req.headers.host || '';
  const subdomain = host.split('.')[0];

  // Development qulayligi uchun: header orqali ham berish mumkin
  const headerSlug = req.headers['x-restaurant-slug'];

  return headerSlug || subdomain;
}

async function tenantResolver(req, res, next) {
  try {
    const slug = extractSlug(req);

    if (!slug) {
      return res.status(400).json({ error: 'Restoran aniqlanmadi (slug yo\'q)' });
    }

    req.restaurantSlug = slug;

    // TO'LOV YO'LLARI TO'XTATILGANDA HAM OCHIQ.
    //
    // Aks holda qarzi bor muassasa to'lash uchun ham kira olmasdi va bu
    // boshi berk ko'cha bo'lardi: xizmat yopiq, chunki to'lanmagan;
    // to'lab bo'lmaydi, chunki xizmat yopiq.
    const billingPath = req.path.startsWith('/billing');
    req.tenantDb = await getTenantClient(slug, { allowSuspended: billingPath });
    next();
  } catch (err) {
    if (err.code === 'SUBSCRIPTION_SUSPENDED') {
      return res.status(403).json({
        error: 'SUBSCRIPTION_SUSPENDED',
        message: 'Xizmat vaqtincha to\'xtatilgan. Administratsiya bilan bog\'laning.',
      });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Restoran topilmadi' });
    }
    next(err);
  }
}

module.exports = tenantResolver;
