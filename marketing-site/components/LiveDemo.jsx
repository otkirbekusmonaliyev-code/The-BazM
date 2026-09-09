'use client';

import { useEffect, useRef, useState } from 'react';

// Saytdagi JONLI DEMO: chapda mijoz telefoni, o'ngda oshxona ekrani.
//
// Taom bosilganda u telefondan oshxona ekraniga "uchib" o'tadi va u yerda
// buyurtma kartochkasi paydo bo'ladi — haqiqiy mahsulotdagi real-time
// oqimning aynan o'zi. Odam o'qimaydi, ko'radi va o'zi bosib sinaydi.
//
// Butunlay mustaqil: hech qanday API'ga murojaat qilmaydi.

const money = (v) => `${new Intl.NumberFormat('ru-RU').format(v)} so'm`;

// Buyurtma bosqichlari: yangi → qabul qilingan → tayyorlanmoqda → tayyor
const STAGES = ['new', 'accepted', 'preparing', 'ready'];

export default function LiveDemo({ c }) {
  const [cart, setCart] = useState([]);
  const [stage, setStage] = useState(0);
  const [flying, setFlying] = useState([]);
  const [pulse, setPulse] = useState(false);
  const timer = useRef(null);
  const flightId = useRef(0);

  // Buyurtma tushgach, bosqichlar o'z-o'zidan siljiydi — mahsulotdagi
  // oqim shunday: oshpaz bosadi, mijoz ekranida darhol yangilanadi
  useEffect(() => {
    if (cart.length === 0) return undefined;
    if (stage >= STAGES.length - 1) return undefined;
    timer.current = setTimeout(() => setStage((s) => s + 1), 2400);
    return () => clearTimeout(timer.current);
  }, [cart.length, stage]);

  function addDish(dish, event) {
    // "Uchayotgan" nusxa: bosilgan joydan o'ngdagi ekran tomon
    const rect = event.currentTarget.getBoundingClientRect();
    const id = (flightId.current += 1);
    setFlying((list) => [...list, { id, name: dish.name, top: rect.top, left: rect.left }]);
    setTimeout(() => setFlying((list) => list.filter((f) => f.id !== id)), 700);

    setTimeout(() => {
      setCart((list) => {
        const found = list.find((x) => x.name === dish.name);
        return found
          ? list.map((x) => (x.name === dish.name ? { ...x, qty: x.qty + 1 } : x))
          : [...list, { ...dish, qty: 1 }];
      });
      setStage(0);
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
    }, 420);
  }

  function reset() {
    clearTimeout(timer.current);
    setCart([]);
    setStage(0);
  }

  const total = cart.reduce((sum, x) => sum + x.price * x.qty, 0);
  const stageName = STAGES[stage];
  const actionLabel =
    stageName === 'new' ? c.accept : stageName === 'accepted' ? c.preparing : c.ready;

  return (
    <div className="demo">
      {/* ---------- Chap: mijoz telefoni ---------- */}
      <div className="demo-side" data-reveal>
        <div className="demo-label">{c.client}</div>

        <div className="demo-phone glass">
          <div className="demo-phone-notch" />
          <div className="demo-phone-head">
            <span className="demo-phone-title">Delish</span>
            <span className="demo-phone-sub">7-{c.table}</span>
          </div>

          <div className="demo-dishes">
            {c.dishes.map((dish) => {
              const line = cart.find((x) => x.name === dish.name);
              return (
                <button
                  type="button"
                  className="demo-dish"
                  key={dish.name}
                  onClick={(e) => addDish(dish, e)}
                >
                  <span className="demo-dish-thumb" aria-hidden="true">
                    🍲
                  </span>
                  <span className="demo-dish-body">
                    <span className="demo-dish-name">{dish.name}</span>
                    <span className="demo-dish-price">{money(dish.price)}</span>
                  </span>
                  <span className={`demo-dish-add${line ? ' has' : ''}`}>
                    {line ? line.qty : '+'}
                  </span>
                </button>
              );
            })}
          </div>

          {cart.length > 0 && (
            <div className="demo-phone-bar">
              <span>{cart.reduce((s, x) => s + x.qty, 0)}</span>
              {money(total)}
            </div>
          )}
        </div>
      </div>

      {/* ---------- O'ng: oshxona ekrani ---------- */}
      <div className="demo-side" data-reveal data-delay="2">
        <div className="demo-label">{c.kitchen}</div>

        <div className={`demo-kitchen${pulse ? ' pulse' : ''}`}>
          <div className="demo-kitchen-bar">
            <span className="demo-kitchen-title">OSHXONA</span>
            <span className="demo-live">JONLI</span>
          </div>

          {cart.length === 0 ? (
            <div className="demo-kitchen-empty">
              <div style={{ fontSize: 30, marginBottom: 10 }}>🍽</div>
              <div>{c.empty}</div>
              <div className="demo-kitchen-hint">{c.emptyHint}</div>
            </div>
          ) : (
            <article className={`demo-card stage-${stageName}`}>
              <div className="demo-card-head">
                <span className="demo-card-table">7</span>
                <span className="demo-card-client">Dilnoza</span>
                <span className="demo-card-timer">0′</span>
              </div>
              <div className="demo-card-items">
                {cart.map((x) => (
                  <div className="demo-card-item" key={x.name}>
                    <span>×{x.qty}</span>
                    <span>{x.name}</span>
                  </div>
                ))}
              </div>
              <div className={`demo-card-action stage-${stageName}`}>{actionLabel}</div>
            </article>
          )}
        </div>

        {cart.length > 0 && (
          <button type="button" className="demo-reset" onClick={reset}>
            ↺ {c.reset}
          </button>
        )}
      </div>

      {/* Telefondan ekranga uchayotgan nusxalar */}
      {flying.map((f) => (
        <span
          key={f.id}
          className="demo-fly"
          style={{ top: f.top, left: f.left }}
          aria-hidden="true"
        >
          {f.name}
        </span>
      ))}
    </div>
  );
}
