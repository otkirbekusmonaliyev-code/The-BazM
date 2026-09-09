'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

// Foyda kalkulyatori: stol soni va kunlik buyurtma sonini surgich bilan
// tanlaysiz — natija darhol o'zgaradi va raqamlar silliq "aylanadi".
//
// Hisob mantiqi ochiq va halol: bitta buyurtmani qo'lda qabul qilish
// o'rtacha 3 daqiqa (kelish, yozib olish, oshxonaga aytish, qaytish).
// Tizim shu vaqtni butunlay oladi. Tejalgan vaqt ofitsiantning soatlik
// tannarxiga ko'paytiriladi.

const MINUTES_PER_ORDER = 3;
const WAITER_HOURLY_COST = 22000; // so'm — o'rtacha
const DAYS_PER_MONTH = 30;

// Raqamni bo'sh joy bilan ajratib yozish
const fmt = (v) => new Intl.NumberFormat('ru-RU').format(Math.round(v));

export default function Calculator({ c, applyPath, ctaLabel }) {
  const [tables, setTables] = useState(14);
  const [perTable, setPerTable] = useState(4);

  const result = useMemo(() => {
    const ordersPerDay = tables * perTable;
    const minutesSaved = ordersPerDay * MINUTES_PER_ORDER;
    const hoursSaved = minutesSaved / 60;
    const moneySaved = hoursSaved * WAITER_HOURLY_COST * DAYS_PER_MONTH;
    // Tejalgan vaqtning yarmi qo'shimcha xizmatga aylanadi deb hisoblaymiz
    const extraOrders = Math.round((ordersPerDay * 0.12) * DAYS_PER_MONTH);
    return { hoursSaved, moneySaved, extraOrders };
  }, [tables, perTable]);

  return (
    <div className="calc glass" data-reveal data-tilt>
      <div className="calc-controls">
        <label className="calc-field">
          <span className="calc-label">
            {c.tables}
            <b>{tables}</b>
          </span>
          <input
            type="range"
            min="4"
            max="60"
            step="1"
            value={tables}
            onChange={(e) => setTables(Number(e.target.value))}
            style={{ '--fill': `${((tables - 4) / 56) * 100}%` }}
          />
        </label>

        <label className="calc-field">
          <span className="calc-label">
            {c.perTable}
            <b>{perTable}</b>
          </span>
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            value={perTable}
            onChange={(e) => setPerTable(Number(e.target.value))}
            style={{ '--fill': `${((perTable - 1) / 11) * 100}%` }}
          />
        </label>
      </div>

      <div className="calc-results">
        <div className="calc-result">
          <b key={result.hoursSaved} className="calc-value">
            {result.hoursSaved.toFixed(1)}
            <i>{c.hours}</i>
          </b>
          <span>{c.resultTime}</span>
        </div>

        <div className="calc-result calc-result-main">
          <b key={result.moneySaved} className="calc-value">
            {fmt(result.moneySaved)}
          </b>
          <span>{c.resultMoney}</span>
        </div>

        <div className="calc-result">
          <b key={result.extraOrders} className="calc-value">
            +{fmt(result.extraOrders)}
          </b>
          <span>{c.resultOrders}</span>
        </div>
      </div>

      <p className="calc-note">{c.note}</p>

      <Link href={applyPath} className="btn btn-primary btn-lg calc-cta">
        <span>{ctaLabel}</span>
      </Link>
    </div>
  );
}
