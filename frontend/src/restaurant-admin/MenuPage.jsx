import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { money } from '../lib/format';

export default function MenuPage({ api }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemModal, setItemModal] = useState(null); // { item?, categoryId }
  const [catModal, setCatModal] = useState(null); // { category? }
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await api.get('/menu/admin'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // toast identifikatori har renderda o'zgarmaydi, lekin bog'liqlikka
    // qo'shsak ham zarar yo'q — shu sababli ataylab tashlab ketilgan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic UI: javobni kutmasdan holatni almashtiramiz, xato bo'lsa qaytaramiz
  async function toggleAvailability(item) {
    const previous = item.isAvailable;
    setCategories((cats) =>
      cats.map((c) => ({
        ...c,
        items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: !previous } : i)),
      }))
    );
    try {
      await api.patch(`/menu/admin/items/${item.id}/toggle-availability`);
    } catch (err) {
      setCategories((cats) =>
        cats.map((c) => ({
          ...c,
          items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: previous } : i)),
        }))
      );
      toast.error(err.message);
    }
  }

  async function deleteItem(item) {
    if (!window.confirm(`"${item.name}" o'chirilsinmi?`)) return;
    try {
      await api.del(`/menu/admin/items/${item.id}`);
      toast.success('O\'chirildi');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`"${category.name}" kategoriyasi o'chirilsinmi?`)) return;
    try {
      await api.del(`/menu/admin/categories/${category.id}`);
      toast.success('O\'chirildi');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22 }}>Menyu</h1>
        <div className="row">
          <button type="button" className="btn btn-ghost" onClick={() => setCatModal({})}>
            + Kategoriya
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={categories.length === 0}
            onClick={() => setItemModal({ categoryId: categories[0] && categories[0].id })}
          >
            + Yangi taom qo'shish
          </button>
        </div>
      </div>

      {loading && (
        <div className="dl-list-empty">
          <span className="spinner" /> Yuklanmoqda…
        </div>
      )}

      {!loading && categories.length === 0 && (
        <div className="dl-panel">
          <div className="dl-list-empty">
            Menyu bo'sh. Avval kategoriya qo'shing (masalan "Issiq taomlar"), keyin taomlarni kiriting.
          </div>
        </div>
      )}

      {categories.map((cat) => (
        <div className="dl-menu-cat" key={cat.id}>
          <div className="dl-menu-cat-head">
            <h3>{cat.name}</h3>
            <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{cat.items.length} ta taom</span>
            <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItemModal({ categoryId: cat.id })}>
                + Taom
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCatModal({ category: cat })}>
                Tahrirlash
              </button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteCategory(cat)}>
                O'chirish
              </button>
            </div>
          </div>

          {cat.items.length === 0 && <div className="dl-list-empty">Bu kategoriyada taom yo'q</div>}

          {cat.items.map((item) => (
            <div className="dl-item-row" key={item.id}>
              {item.imageUrl ? (
                <img className="dl-item-thumb" src={item.imageUrl} alt="" />
              ) : (
                <div className="dl-item-thumb placeholder">🍲</div>
              )}
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 14.5, opacity: item.isAvailable ? 1 : 0.5 }}>
                  {item.name}
                </div>
                {item.description && (
                  <div style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 2 }}>{item.description}</div>
                )}
              </div>
              <div className="mono" style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap' }}>
                {money(item.price)}
              </div>
              <button
                type="button"
                className={`dl-toggle${item.isAvailable ? ' on' : ''}`}
                onClick={() => toggleAvailability(item)}
                aria-label={item.isAvailable ? 'Tugadi deb belgilash' : 'Mavjud deb belgilash'}
                title={item.isAvailable ? 'Mavjud' : 'Tugagan'}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItemModal({ item, categoryId: cat.id })}>
                Tahrir
              </button>
              <button type="button" className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => deleteItem(item)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      ))}

      <CategoryModal
        api={api}
        state={catModal}
        onClose={() => setCatModal(null)}
        onSaved={() => {
          setCatModal(null);
          load();
        }}
      />
      <ItemModal
        api={api}
        state={itemModal}
        categories={categories}
        onClose={() => setItemModal(null)}
        onSaved={() => {
          setItemModal(null);
          load();
        }}
      />
    </>
  );
}

function CategoryModal({ api, state, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    setName(state.category ? state.category.name : '');
    setSortOrder(state.category ? state.category.sortOrder : 0);
    setError('');
  }, [state]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = { name: name.trim(), sortOrder: Number(sortOrder) || 0 };
      if (state.category) await api.patch(`/menu/admin/categories/${state.category.id}`, body);
      else await api.post('/menu/admin/categories', body);
      toast.success('Saqlandi');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!state} onClose={onClose} className="bazm-modal">
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>{state && state.category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label>Nomi *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Issiq taomlar" required minLength={2} />
          </div>
          <div className="field">
            <label>Tartib raqami (kichigi yuqorida turadi)</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Saqlash'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ItemModal({ api, state, categories, onClose, onSaved }) {
  const empty = { categoryId: '', name: '', description: '', price: '', imageUrl: '' };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    const item = state.item;
    setForm({
      categoryId: item ? item.categoryId : state.categoryId || (categories[0] && categories[0].id) || '',
      name: item ? item.name : '',
      description: item && item.description ? item.description : '',
      price: item ? String(item.price) : '',
      imageUrl: item && item.imageUrl ? item.imageUrl : '',
    });
    setError('');
  }, [state, categories]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function upload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { url } = await api.upload('/uploads/image', fd);
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success('Rasm yuklandi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        categoryId: form.categoryId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Number(form.price),
        imageUrl: form.imageUrl || null,
      };
      if (!body.price || body.price <= 0) throw new Error('Narx 0 dan katta bo\'lsin');

      if (state.item) await api.patch(`/menu/admin/items/${state.item.id}`, body);
      else await api.post('/menu/admin/items', body);
      toast.success('Saqlandi');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!state} onClose={onClose} className="bazm-modal">
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>{state && state.item ? 'Taomni tahrirlash' : 'Yangi taom'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="field">
            <label>Kategoriya *</label>
            <select value={form.categoryId} onChange={set('categoryId')} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Taom nomi *</label>
            <input value={form.name} onChange={set('name')} placeholder="Qozon kabob" required minLength={2} />
          </div>

          <div className="field">
            <label>Tavsif</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Qo'y go'shti, kartoshka, piyoz halqalari" />
          </div>

          <div className="field">
            <label>Narxi (so'm) *</label>
            <input type="number" min="0" step="1000" value={form.price} onChange={set('price')} placeholder="55000" required />
          </div>

          <div className="field">
            <label>Rasm</label>
            <div className="row">
              {form.imageUrl && <img className="dl-item-thumb" src={form.imageUrl} alt="" />}
              <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{ height: 'auto', padding: 8 }} />
              {uploading && <span className="spinner" />}
            </div>
            {form.imageUrl && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8 }}
                onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
              >
                Rasmni olib tashlash
              </button>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Saqlash'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
