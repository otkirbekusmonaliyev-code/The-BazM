const { z } = require('zod');

// ============ MIJOZ UCHUN (ochiq, public) ============
// Barcha kategoriyalar va taomlarni qaytaradi (tugagan taomlar ham ko'rinadi,
// lekin isAvailable=false bilan — frontend ularni kulrang qilib ko'rsatadi)
async function getPublicMenu(req, res, next) {
  try {
    const tenantDb = req.tenantDb;
    const categories = await tenantDb.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { name: 'asc' } } },
    });
    res.json(categories.filter((c) => c.items.length > 0));
  } catch (err) {
    next(err);
  }
}

// ============ ADMIN UCHUN ============
async function getAdminMenu(req, res, next) {
  try {
    const tenantDb = req.tenantDb;
    const categories = await tenantDb.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { name: 'asc' } } },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

// ---- Kategoriya ----
const categorySchema = z.object({
  name: z.string().min(2),
  sortOrder: z.number().int().optional(),
});

async function createCategory(req, res, next) {
  try {
    const data = categorySchema.parse(req.body);
    const category = await req.tenantDb.menuCategory.create({ data });
    res.status(201).json(category);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const data = categorySchema.partial().parse(req.body);
    const category = await req.tenantDb.menuCategory.update({
      where: { id: req.params.id },
      data,
    });
    res.json(category);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Kategoriya topilmadi' });
    }
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    // Ichida taom bo'lsa, avval ularni o'chirish yoki boshqa kategoriyaga
    // ko'chirish kerak — shu bilan tasodifiy ma'lumot yo'qotishning oldi olinadi
    const itemsCount = await req.tenantDb.menuItem.count({
      where: { categoryId: req.params.id },
    });
    if (itemsCount > 0) {
      return res.status(409).json({
        error: `Bu kategoriyada ${itemsCount} ta taom bor. Avval ularni o'chiring yoki boshqa kategoriyaga ko'chiring.`,
      });
    }
    await req.tenantDb.menuCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Kategoriya topilmadi' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Bu kategoriya ishlatilmoqda — o\'chirib bo\'lmaydi' });
    }
    next(err);
  }
}

// ---- Taom ----
const itemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().max(500).optional().or(z.literal('')).nullable(),
  isAvailable: z.boolean().optional(),
});

async function createItem(req, res, next) {
  try {
    const data = itemSchema.parse(req.body);
    const item = await req.tenantDb.menuItem.create({ data });
    res.status(201).json(item);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Ko\'rsatilgan kategoriya mavjud emas' });
    }
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const data = itemSchema.partial().parse(req.body);
    const item = await req.tenantDb.menuItem.update({
      where: { id: req.params.id },
      data,
    });
    res.json(item);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Ma\'lumotlar noto\'g\'ri', details: err.errors });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Taom topilmadi' });
    }
    next(err);
  }
}

// Oshpaz yoki admin — taom tugaganda/qaytadan mavjud bo'lganda bosadigan tugma
async function toggleAvailability(req, res, next) {
  try {
    const existing = await req.tenantDb.menuItem.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Taom topilmadi' });
    }
    const item = await req.tenantDb.menuItem.update({
      where: { id: req.params.id },
      data: { isAvailable: !existing.isAvailable },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    // Taom allaqachon sotilgan bo'lsa, uni o'chirish buyurtmalar tarixini
    // buzadi (eski cheklarda taom nomi yo'qolib qoladi). Bunday holatda
    // o'chirmaymiz — admin uni "tugagan" deb belgilashi kifoya.
    const soldCount = await req.tenantDb.orderItem.count({
      where: { menuItemId: req.params.id },
    });
    if (soldCount > 0) {
      return res.status(409).json({
        error:
          `Bu taom ${soldCount} ta buyurtmada bor — o'chirsak, buyurtmalar tarixi buziladi. ` +
          'Uning o\'rniga "tugagan" deb belgilang: u menyuda ko\'rinmay qoladi.',
        soldCount,
      });
    }

    await req.tenantDb.menuItem.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Taom topilmadi' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Bu taom buyurtmalarda ishlatilgan — o\'chirib bo\'lmaydi. "Tugagan" deb belgilang.',
      });
    }
    next(err);
  }
}

module.exports = {
  getPublicMenu,
  getAdminMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  toggleAvailability,
  deleteItem,
};
