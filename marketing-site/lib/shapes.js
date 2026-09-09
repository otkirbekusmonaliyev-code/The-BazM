// 3D sahnadagi zarrachalar uchun uchta "shakl": QR kod, telefon va oshxona ekrani.
//
// Uchalasi ham BIR XIL sondagi nuqtadan tuzilgan — shuning uchun ular orasida
// silliq morflanish (bir shakldan ikkinchisiga oqib o'tish) mumkin bo'ladi.
// Har bir shakl [x, y] juftliklari ro'yxatini qaytaradi, koordinatalar
// taxminan -1..1 oralig'ida normallashtiriladi.

// Takrorlanadigan (deterministik) tasodifiy sonlar — QR naqshi har safar
// bir xil chiqishi uchun. Math.random() ishlatilsa, sahifa har ochilganda
// boshqa naqsh chiqib, morflanish ham beqaror bo'lardi.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Nuqtalar sonini AYNAN `n` ta qilish: ko'p bo'lsa siyraklashtiradi,
// kam bo'lsa mavjudlarini takrorlaydi
function fit(points, n) {
  if (points.length === 0) return Array.from({ length: n }, () => [0, 0]);
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = points[Math.floor((i * points.length) / n) % points.length];
  }
  return out;
}

// Markazlashtirib, [-1, 1] oralig'iga siqish
function normalize(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const scale = 2 / Math.max(maxX - minX, maxY - minY, 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale]);
}

// ---------- 1) QR kod ----------
// 21x21 modul: uchta burchakdagi "ko'z" belgisi + tasodifiy modullar
export function qrShape(n) {
  const SIZE = 21;
  const grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));

  // Burchakdagi qidiruv belgilari (7x7): tashqi ramka + ichki to'ldirilgan kvadrat
  const finder = (ox, oy) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) grid[oy + y][ox + x] = 1;
      }
    }
  };
  finder(0, 0);
  finder(SIZE - 7, 0);
  finder(0, SIZE - 7);

  // Vaqt chizig'i (timing pattern)
  for (let i = 8; i < SIZE - 8; i += 1) {
    if (i % 2 === 0) {
      grid[6][i] = 1;
      grid[i][6] = 1;
    }
  }

  // Qolgan maydonni "ma'lumot" modullari bilan to'ldiramiz
  const rand = seededRandom(20260908);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const inFinder =
        (x < 8 && y < 8) || (x >= SIZE - 8 && y < 8) || (x < 8 && y >= SIZE - 8);
      if (inFinder || x === 6 || y === 6) continue;
      if (rand() > 0.52) grid[y][x] = 1;
    }
  }

  const points = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (grid[y][x]) points.push([x, SIZE - 1 - y]);
    }
  }
  return fit(normalize(points), n);
}

// ---------- 2) Telefon (mijoz ilovasi) ----------
// Tashqi ramka + ekrandagi menyu qatorlari
export function phoneShape(n) {
  const W = 11;
  const H = 21;
  const points = [];

  // Korpus konturi
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      // Burchaklarni yumaloqlaymiz
      const corner =
        (x <= 1 && y <= 1) ||
        (x >= W - 2 && y <= 1) ||
        (x <= 1 && y >= H - 2) ||
        (x >= W - 2 && y >= H - 2);
      if (edge && !corner) points.push([x, H - 1 - y]);
    }
  }

  // Yuqoridagi "notch"
  for (let x = 4; x <= 6; x += 1) points.push([x, H - 1 - 1]);

  // Menyu qatorlari: har bir taom — rasm kvadrati + matn chiziqlari
  const rows = [4, 8, 12, 16];
  for (const ry of rows) {
    for (let x = 2; x <= 3; x += 1) {
      for (let dy = 0; dy <= 1; dy += 1) points.push([x, H - 1 - (ry + dy)]);
    }
    for (let x = 5; x <= 8; x += 1) points.push([x, H - 1 - ry]);
    for (let x = 5; x <= 7; x += 1) points.push([x, H - 1 - (ry + 1)]);
  }

  return fit(normalize(points), n);
}

// ---------- 3) Oshxona ekrani ----------
// Keng monitor + ichida uchta buyurtma kartochkasi
export function kitchenShape(n) {
  const W = 25;
  const H = 15;
  const points = [];

  // Monitor konturi
  for (let x = 0; x < W; x += 1) {
    points.push([x, H - 1]);
    points.push([x, 3]);
  }
  for (let y = 3; y < H; y += 1) {
    points.push([0, y]);
    points.push([W - 1, y]);
  }
  // Oyoq va tagligi
  for (let y = 1; y <= 2; y += 1) {
    points.push([12, y]);
    points.push([13, y]);
  }
  for (let x = 9; x <= 16; x += 1) points.push([x, 0]);

  // Uchta buyurtma kartochkasi
  const cards = [2, 10, 18];
  for (const cx of cards) {
    const cw = 5;
    const top = H - 3;
    const bottom = 5;
    for (let x = cx; x < cx + cw; x += 1) {
      points.push([x, top]);
      points.push([x, bottom]);
      points.push([x, top - 1]); // sarlavha paneli (to'ldirilgan)
    }
    for (let y = bottom; y <= top; y += 1) {
      points.push([cx, y]);
      points.push([cx + cw - 1, y]);
    }
    // Ichidagi taom qatorlari
    for (let i = 0; i < 3; i += 1) {
      for (let x = cx + 1; x < cx + cw - 1; x += 1) points.push([x, top - 3 - i * 2]);
    }
  }

  return fit(normalize(points), n);
}

// Sahnada nechta zarracha bo'lishi. Uchala shakl ham shu songa moslanadi.
export const PARTICLE_COUNT = 420;
