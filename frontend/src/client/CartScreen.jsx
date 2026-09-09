import { useState } from 'react';
import { useToast } from '../components/Toast';
import { haptic } from '../lib/sound';
import { money } from '../lib/format';

// Ekran 3 — savat.

export default function CartScreen({ animClass, cart, onBack, onSetQuantity, onSubmit }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const count = cart.reduce((sum, c) => sum + c.quantity, 0);

  async function submit() {
    setLoading(true);
    try {
      await onSubmit();
      // Muvaffaqiyatda tugma qisqa vaqt yashil "flash" qiladi
      setSuccess(true);
      haptic('success');
    } catch (err) {
      toast.error(err.message);
      setLoading(false);
    }
  }

  return (
    <div className={`c-screen ${animClass}`}>
      <header className="c-header">
        <div className="c-header-top">
          <button type="button" className="c-back" onClick={onBack} aria-label="Orqaga">
            ←
          </button>
          <div className="grow">
            <div className="c-header-title">Savat</div>
            <div className="c-header-sub">{count} ta taom</div>
          </div>
        </div>
      </header>

      <div className="c-cart-list">
        {cart.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🧺</div>
            Savat bo'sh
          </div>
        )}

        {cart.map((line) => (
          <div className="c-cart-item" key={`${line.menuItemId}-${line.note}`}>
            {line.imageUrl ? (
              <img className="c-dish-img" style={{ width: 64, height: 56 }} src={line.imageUrl} alt="" />
            ) : (
              <div className="c-dish-img placeholder" style={{ width: 64, height: 56, fontSize: 22 }}>
                🍲
              </div>
            )}

            <div className="grow">
              <div className="c-cart-item-name">{line.name}</div>
              {line.note && <div className="c-cart-item-note">{line.note}</div>}
              <div className="c-dish-price" style={{ marginTop: 5 }}>
                {money(line.price * line.quantity)}
              </div>
            </div>

            <div className="c-stepper">
              <button type="button" onClick={() => onSetQuantity(line.menuItemId, line.note, line.quantity - 1)}>
                −
              </button>
              <span className="c-stepper-count">
                <span key={line.quantity}>{line.quantity}</span>
              </span>
              <button type="button" onClick={() => onSetQuantity(line.menuItemId, line.note, line.quantity + 1)}>
                +
              </button>
            </div>
          </div>
        ))}

        {cart.length > 0 && (
          <div className="c-summary">
            <div className="c-summary-row">
              <span>Taomlar</span>
              <span>{count} ta</span>
            </div>
            <div className="c-summary-row">
              <span>Xizmat haqi</span>
              <span>Kiritilmagan</span>
            </div>
            <div className="c-summary-total">
              <span>Jami</span>
              <b>{money(total)}</b>
            </div>
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="c-cart-bar">
          <button
            type="button"
            className={`c-btn${success ? ' flash-success' : ''}`}
            onClick={submit}
            disabled={loading}
          >
            {loading && !success ? <span className="spinner" /> : success ? '✓ Yuborildi' : 'Buyurtma qilish'}
          </button>
        </div>
      )}
    </div>
  );
}
