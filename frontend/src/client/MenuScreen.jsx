import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ThemeToggle } from '../lib/theme';
import { haptic } from '../lib/sound';
import { money } from '../lib/format';
import DishPlate from './DishPlate';
import { flyToCart } from './flyToCart';

// Ekran 2 — MENYU.
//
// Oddiy, bitta ustunli ro'yxat: eng tez va eng tushunarli ko'rinish.
// "Wow" hissi bezakdan emas, harakatdan keladi:
//
//   - taomlar aylantirilganda bittalab suzib chiqadi,
//   - savatga qo'shilganda taom rasmi savat tugmasiga UCHIB boradi,
//   - savat paneli prujinali chiqadi va raqami "sakraydi",
//   - bo'lim tugmalari scroll bilan o'z-o'zidan faollashadi.

export default function MenuScreen({
  animClass,
  menu,
  restaurantName,
  session,
  cart,
  api,
  onAdd,
  onSetQuantity,
  onOpenCart,
  onOpenTrack,
}) {
  const [term, setTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(null);
  const [sheetItem, setSheetItem] = useState(null);
  const [countPop, setCountPop] = useState(false);

  const sectionRefs = useRef({});
  const searchRef = useRef(null);
  const pillsRef = useRef(null);
  const headerRef = useRef(null);
  const cartRef = useRef(null);
  const scrollingByClick = useRef(false);
  const toast = useToast();

  const totalCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  // Qidiruv: bo'limlar saqlanadi, faqat mos taomlar qoladi
  const filtered = useMemo(() => {
    if (!menu) return [];
    const q = term.trim().toLowerCase();
    if (!q) return menu;
    return menu
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [menu, term]);

  const searching = term.trim().length > 0;
  const found = filtered.reduce((n, c) => n + c.items.length, 0);

  useEffect(() => {
    if (menu && menu.length > 0 && !activeCat) setActiveCat(menu[0].id);
  }, [menu, activeCat]);

  useEffect(() => {
    if (totalCount === 0) return undefined;
    setCountPop(true);
    const t = setTimeout(() => setCountPop(false), 260);
    return () => clearTimeout(t);
  }, [totalCount]);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  // ---- Taomlar ko'rinishga kirganda suzib chiqadi ----
  //
  // YO'NALISH TESKARI: taom standart holatda KO'RINADI. Ekrandan pastda
  // qolganlariga JS `pending` klassini qo'yadi va ko'rinishga kirganda
  // oladi. Shu sababli JS, kuzatuvchi yoki animatsiya ishlamay qolsa,
  // eng yomon holatda effekt yo'qoladi — MENYU EMAS.
  //
  // Avval teskarisi edi (CSS'da yashirin, JS ochadi) va shu sababli
  // 22 ta taomdan 18 tasi ko'rinmay qolgan holat yuz bergan.
  useEffect(() => {
    const dishes = [...document.querySelectorAll('.c-dish')];
    if (dishes.length === 0) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const show = (el) => el.classList.remove('pending');
    const inView = (el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight + 60 && r.bottom > -60;
    };

    // Ekrandan pastdagilarni yashiramiz — ko'rinib turganlariga tegmaymiz,
    // shuning uchun hech qanday "miltillash" bo'lmaydi
    dishes.forEach((el) => {
      if (!inView(el)) el.classList.add('pending');
    });

    const sweep = () => {
      document.querySelectorAll('.c-dish.pending').forEach((el) => {
        if (inView(el)) show(el);
      });
    };

    let observer = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              show(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -5% 0px', threshold: 0.04 }
      );
      document.querySelectorAll('.c-dish.pending').forEach((el) => observer.observe(el));
    }

    // Zaxira: kuzatuvchi jim qolsa, oddiy scroll hodisasi ochadi
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      setTimeout(() => {
        sweep();
        ticking = false;
      }, 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // Oxirgi himoya: 4 soniyadan keyin nima qolgan bo'lsa ham ochiladi.
    // Effektni yo'qotamiz, lekin mijoz menyuni ko'rmay qolmaydi.
    const failsafe = setTimeout(() => {
      document.querySelectorAll('.c-dish.pending').forEach(show);
    }, 4000);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      clearTimeout(failsafe);
    };
  }, [filtered]);

  // ---- Scroll bilan bo'lim tugmasi o'z-o'zidan faollashadi ----
  //
  // Sticky sarlavha ostida bir piksellik "sezgich chizig'i" tasavvur qilamiz
  // va shu chiziqni kesib turgan bo'limni faol deb belgilaymiz.
  useEffect(() => {
    if (!menu || menu.length === 0 || searching) return undefined;

    let observer = null;
    const build = () => {
      if (observer) observer.disconnect();
      const offset = (headerRef.current ? headerRef.current.offsetHeight : 110) + 12;
      const bottom = Math.max(0, window.innerHeight - offset - 1);

      observer = new IntersectionObserver(
        (entries) => {
          if (scrollingByClick.current) return;
          const hit = entries.find((e) => e.isIntersecting);
          if (hit) {
            const id = hit.target.dataset.categoryId;
            setActiveCat((prev) => (prev === id ? prev : id));
          }
        },
        { rootMargin: `-${offset}px 0px -${bottom}px 0px`, threshold: 0 }
      );

      menu.forEach((cat) => {
        const el = sectionRefs.current[cat.id];
        if (el) observer.observe(el);
      });
    };

    build();
    window.addEventListener('resize', build);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', build);
    };
  }, [menu, searching]);

  // Faol tugma gorizontal ro'yxatdan chiqib ketmasin
  useEffect(() => {
    if (!activeCat || !pillsRef.current) return;
    const pill = pillsRef.current.querySelector(`[data-pill="${activeCat}"]`);
    if (pill) pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCat]);

  const scrollToCategory = useCallback((categoryId) => {
    setActiveCat(categoryId);
    scrollingByClick.current = true;
    haptic('impact');
    const el = sectionRefs.current[categoryId];
    if (el) {
      const offset = (headerRef.current ? headerRef.current.offsetHeight : 110) + 8;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setTimeout(() => {
      scrollingByClick.current = false;
    }, 700);
  }, []);

  // ---- Savatga qo'shish: rasm savat tugmasiga uchib boradi ----
  const quickAdd = useCallback(
    (item, sourceEl) => {
      onAdd(item, 1, '');
      haptic('impact');
      flyToCart(sourceEl, cartRef.current);
    },
    [onAdd]
  );

  const cartLineFor = (itemId) => cart.find((c) => c.menuItemId === itemId && !c.note);

  async function callWaiter() {
    try {
      await api.post('/client/call-waiter');
      toast.success('Ofitsiant chaqirildi ✓');
      haptic('success');
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!menu) {
    return (
      <div className={`c-screen ${animClass}`}>
        <div className="c-loading">
          <span className="spinner spinner-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={`c-screen ${animClass}${totalCount > 0 ? ' has-cart' : ''}`}>
      <header className="c-header" ref={headerRef}>
        <div className="c-header-top">
          <div className="grow">
            <div className="c-header-title">{restaurantName || 'Menyu'}</div>
            <div className="c-header-sub">
              {session.table && session.table.tableNumber
                ? `${session.table.tableNumber}-stol · `
                : ''}
              {session.clientName}
            </div>
          </div>

          <button
            type="button"
            className={`c-icon-btn${searchOpen ? ' active' : ''}`}
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setTerm('');
              haptic('impact');
            }}
            aria-label="Taom qidirish"
          >
            ⌕
          </button>

          {onOpenTrack && (
            <button
              type="button"
              className="c-icon-btn"
              onClick={onOpenTrack}
              aria-label="Buyurtma holati"
            >
              🧾
            </button>
          )}
          <ThemeToggle />
        </div>

        {searchOpen && (
          <div className="c-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Taom nomi yoki tarkibi…"
              aria-label="Taom qidirish"
            />
            {term && (
              <button type="button" onClick={() => setTerm('')} aria-label="Tozalash">
                ✕
              </button>
            )}
          </div>
        )}

        {!searching && (
          <div className="c-pills" ref={pillsRef}>
            {menu.map((cat) => (
              <button
                key={cat.id}
                type="button"
                data-pill={cat.id}
                className={`c-pill${activeCat === cat.id ? ' active' : ''}`}
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {searching && (
          <div className="c-search-count">
            {found > 0 ? `${found} ta taom topildi` : 'Hech narsa topilmadi'}
          </div>
        )}
      </header>

      <div className="c-menu">
        {menu.length === 0 && (
          <div className="c-error-box" style={{ margin: '20px 0' }}>
            Menyu hali to‘ldirilmagan.
          </div>
        )}

        {searching && found === 0 && (
          <div className="c-empty-search">
            <div className="c-empty-icon" aria-hidden="true">🍽</div>
            <b>“{term}” topilmadi</b>
            <span>Boshqa so‘z bilan urinib ko‘ring</span>
          </div>
        )}

        {filtered.map((cat) => (
          <section
            key={cat.id}
            data-category-id={cat.id}
            ref={(el) => {
              sectionRefs.current[cat.id] = el;
            }}
          >
            <h2 className="c-cat-title">{cat.name}</h2>

            {cat.items.map((item) => {
              const line = cartLineFor(item.id);
              return (
                <article className={`c-dish${item.isAvailable ? '' : ' unavailable'}`} key={item.id}>
                  <button
                    type="button"
                    className="c-dish-photo"
                    onClick={() => item.isAvailable && setSheetItem(item)}
                    aria-label={`${item.name} — batafsil`}
                    disabled={!item.isAvailable}
                  >
                    <DishPlate item={item} size="row" />
                    {!item.isAvailable && <span className="c-sold-tag">Tugagan</span>}
                  </button>

                  <div className="c-dish-body">
                    <div
                      className="c-dish-tap"
                      onClick={() => item.isAvailable && setSheetItem(item)}
                      role={item.isAvailable ? 'button' : undefined}
                      tabIndex={item.isAvailable ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (item.isAvailable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setSheetItem(item);
                        }
                      }}
                    >
                      <div className="c-dish-name">{item.name}</div>
                      {item.description && <div className="c-dish-desc">{item.description}</div>}
                      <div className="c-dish-price">{money(item.price)}</div>
                    </div>

                    {item.isAvailable &&
                      (line ? (
                        <div className="c-stepper c-stepper-lg">
                          <button
                            type="button"
                            onClick={() => onSetQuantity(item.id, '', line.quantity - 1)}
                            aria-label="Kamaytirish"
                          >
                            −
                          </button>
                          <span className="c-stepper-count">
                            <span key={line.quantity}>{line.quantity}</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              onSetQuantity(item.id, '', line.quantity + 1);
                              haptic('impact');
                              flyToCart(e.currentTarget.closest('.c-dish'), cartRef.current);
                            }}
                            aria-label="Ko‘paytirish"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="c-add-btn"
                          onClick={(e) => quickAdd(item, e.currentTarget.closest('.c-dish'))}
                        >
                          <span className="c-add-plus" aria-hidden="true">+</span>
                          Savatga
                        </button>
                      ))}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>

      <button type="button" className="c-fab" onClick={callWaiter}>
        🔔 Ofitsiant
      </button>

      {totalCount > 0 && (
        <div className="c-cart-bar">
          <button type="button" className="c-btn" onClick={onOpenCart} ref={cartRef}>
            <span className={`c-cart-count${countPop ? ' pop' : ''}`}>{totalCount}</span>
            Savatni ko‘rish
            <span style={{ marginLeft: 'auto', fontWeight: 800 }}>{money(totalPrice)}</span>
          </button>
        </div>
      )}

      <DishSheet
        item={sheetItem}
        onClose={() => setSheetItem(null)}
        onAdd={(item, quantity, note) => {
          onAdd(item, quantity, note);
          haptic('impact');
          setSheetItem(null);
        }}
      />
    </div>
  );
}

function DishSheet({ item, onClose, onAdd }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setNote('');
    }
  }, [item]);

  return (
    <Sheet open={!!item} onClose={onClose} className="c-dish-sheet">
      {item && (
        <>
          <div className="c-sheet-handle" />
          <DishPlate item={item} size="hero" className="c-sheet-plate" />

          <div className="c-sheet-body">
            <div className="c-sheet-name">{item.name}</div>
            {item.description && <div className="c-sheet-desc">{item.description}</div>}
            <div className="c-sheet-price">{money(item.price)}</div>

            <textarea
              className="c-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Izoh (masalan: achchiq bo‘lmasin, tuzsiz)"
              maxLength={200}
            />

            <div className="row" style={{ marginTop: 16, gap: 14 }}>
              <div className="c-stepper c-stepper-lg" style={{ padding: 5 }}>
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="c-stepper-count">
                  <span key={quantity}>{quantity}</span>
                </span>
                <button type="button" onClick={() => setQuantity((q) => Math.min(30, q + 1))}>
                  +
                </button>
              </div>
              <button
                type="button"
                className="c-btn grow"
                onClick={() => onAdd(item, quantity, note.trim())}
              >
                Savatga qo‘shish · {money(item.price * quantity)}
              </button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
