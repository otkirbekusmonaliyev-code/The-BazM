// Buyurtma statuslari qanday ketma-ketlikda o'zgarishi mumkinligini
// bir joyda saqlaymiz — shu bilan noto'g'ri "sakrash"larning oldi olinadi
// (masalan "new"dan to'g'ridan-to'g'ri "delivered"ga o'tib ketolmaydi).
//
// DIQQAT: ready -> picked_up o'tishi bu jadvalda YO'Q, chunki u endi
// oddiy status o'zgartirish emas — ofitsiant taklifni QABUL QILGANDA
// avtomatik sodir bo'ladi (waiter.controller -> respondToAssignment).

const TRANSITIONS = {
  kitchen: {
    new: ['accepted'],
    accepted: ['preparing'],
    preparing: ['ready'],
  },
  waiter: {
    picked_up: ['delivered'],
  },
  admin: {
    // Admin har ikkala panelda ham ishlay oladi + istalgan bosqichda bekor qiladi
    new: ['accepted', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['cancelled'],
    picked_up: ['delivered', 'cancelled'],
    delivered: ['paid'],
  },
};

function isTransitionAllowed(role, currentStatus, nextStatus) {
  const roleMap = TRANSITIONS[role];
  if (!roleMap) return false;
  const allowed = roleMap[currentStatus];
  if (!allowed) return false;
  return allowed.includes(nextStatus);
}

// Oshxona taxtasida ko'rinadigan statuslar
const ACTIVE_KITCHEN_STATUSES = ['new', 'accepted', 'preparing'];

// Buyurtma "yopilgan" deb hisoblanadigan statuslar — stol bo'shmi yoki yo'qmi,
// ofitsiant bandmi yoki yo'qmi degan hisoblarda shular chetlab o'tiladi
const CLOSED_STATUSES = ['delivered', 'paid', 'cancelled'];

// Ofitsiantni "band" qiladigan tayinlash holatlari
const ACTIVE_ASSIGNMENT_STATUSES = ['pending', 'accepted'];

module.exports = {
  isTransitionAllowed,
  ACTIVE_KITCHEN_STATUSES,
  CLOSED_STATUSES,
  ACTIVE_ASSIGNMENT_STATUSES,
};
