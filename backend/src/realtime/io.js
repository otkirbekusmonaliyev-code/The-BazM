// Socket.io — real-vaqtdagi barcha xabarlar shu yerdan o'tadi.
//
// Ulanish: io(url, { auth: { token: JWT } })
// Server token'ni tekshiradi va foydalanuvchini rolига qarab xonalarga qo'shadi:
//   kitchen | admin  -> {slug}_kitchen
//   waiter  | admin  -> {slug}_waiters          (umumiy)
//   waiter           -> {slug}_waiter_{userId}  (shaxsiy — faqat unga tayinlangan takliflar)
//   client           -> {slug}_table_{tableId}
//
// Controller'lar bu modulni require qilib, emit* funksiyalarini chaqiradi.
// Agar Socket.io hali ishga tushmagan bo'lsa (masalan testda) — emit'lar
// jimgina e'tiborsiz qoldiriladi, ilova qulab tushmaydi.

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token yuborilmadi'));
    }
    try {
      socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (err) {
      next(new Error('Token yaroqsiz yoki muddati tugagan'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const slug = user.restaurantSlug;

    // Super Admin real-vaqt oqimidan foydalanmaydi — uni ham
    // ulanishga qo'yamiz, lekin hech qanday tenant xonasiga qo'shmaymiz.
    if (user.role === 'super_admin') {
      socket.emit('connected', { role: user.role });
      return;
    }

    if (!slug) {
      socket.emit('auth_error', 'Restoran aniqlanmadi');
      return socket.disconnect(true);
    }

    if (user.role === 'kitchen' || user.role === 'admin') {
      socket.join(`${slug}_kitchen`);
    }
    if (user.role === 'waiter' || user.role === 'admin') {
      socket.join(`${slug}_waiters`);
    }
    if (user.role === 'waiter') {
      socket.join(`${slug}_waiter_${user.userId}`);
    }
    if (user.role === 'client') {
      socket.join(`${slug}_table_${user.tableId}`);
    }

    socket.emit('connected', { role: user.role, restaurantSlug: slug });
  });

  console.log('   Socket.io tayyor');
  return io;
}

function emitTo(room, event, payload) {
  if (!io) return;
  io.to(room).emit(event, payload);
}

// ---- Qulaylik uchun nomlangan emitter'lar (controller'lar shularni chaqiradi) ----

const emitNewOrder = (slug, order) => emitTo(`${slug}_kitchen`, 'new_order', order);

const emitOrderStatusChanged = (slug, order) => {
  emitTo(`${slug}_table_${order.tableId}`, 'order_status_changed', order);
  // Admin panelidagi "jonli buyurtmalar" ro'yxati ham shu bilan yangilanadi
  emitTo(`${slug}_kitchen`, 'order_updated', order);
};

const emitOrderReady = (slug, order) => emitTo(`${slug}_kitchen`, 'order_ready', order);

const emitOrderAssigned = (slug, waiterId, order) =>
  emitTo(`${slug}_waiter_${waiterId}`, 'order_assigned', order);

// Taklif bekor qilinganda (oshpaz boshqa ofitsiantni tanlaganda) —
// eski ofitsiantning ekranidagi modal yopilishi kerak
const emitAssignmentRevoked = (slug, waiterId, orderId) =>
  emitTo(`${slug}_waiter_${waiterId}`, 'assignment_revoked', { orderId });

const emitWaiterResponse = (slug, payload) => emitTo(`${slug}_kitchen`, 'waiter_response', payload);

const emitWaiterStatusChanged = (slug, payload) =>
  emitTo(`${slug}_kitchen`, 'waiter_status_changed', payload);

const emitTableClaimed = (slug, payload) => {
  emitTo(`${slug}_kitchen`, 'table_claimed', payload);
  emitTo(`${slug}_waiters`, 'table_claimed', payload);
};

const emitTableReleased = (slug, payload) => {
  emitTo(`${slug}_kitchen`, 'table_released', payload);
  emitTo(`${slug}_waiters`, 'table_released', payload);
};

const emitNewReservation = (slug, reservation) =>
  emitTo(`${slug}_kitchen`, 'new_reservation', reservation);

const emitReservationUpdated = (slug, reservation) =>
  emitTo(`${slug}_kitchen`, 'reservation_updated', reservation);

module.exports = {
  initSocket,
  emitTo,
  emitNewOrder,
  emitOrderStatusChanged,
  emitOrderReady,
  emitOrderAssigned,
  emitAssignmentRevoked,
  emitWaiterResponse,
  emitWaiterStatusChanged,
  emitTableClaimed,
  emitTableReleased,
  emitNewReservation,
  emitReservationUpdated,
};
