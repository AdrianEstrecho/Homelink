import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Search, X, ImageOff, UploadCloud } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import PromptDialog from '../../components/PromptDialog';
import ConfirmDialog from '../../components/ConfirmDialog';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_MB = 5;

const emptyForm = {
  name: '', brand: '', description: '',
  mainCategoryId: '', subcategoryId: '',
  status: 'active',
  stock: '', addStock: '', clerkCode: '',
  price: '', discount: '',
  image: '', featured: false,
};

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

export default function AdminProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState(searchParams.get('tab') === 'archived' ? 'archived' : 'active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [subcategoryPromptOpen, setSubcategoryPromptOpen] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => {
    api.get('/admin/products').then(setProducts).catch(() => {});
    api.get('/admin/categories').then(setCategories).catch(() => {});
  };
  useEffect(load, []);

  useEffect(() => {
    const p = searchParams.get('search');
    if (p) setSearch(p);
  }, [searchParams]);

  const mainCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const subcategoriesOf = (mainId) => categories.filter(c => c.parent_id === mainId);

  const byTabAndSearch = useMemo(() => {
    return products
      .filter(p => (tab === 'archived' ? p.archived : !p.archived))
      .filter(p => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [products, tab, search]);

  const categoryCounts = useMemo(() => {
    const c = { '': byTabAndSearch.length };
    mainCategories.forEach(mc => { c[mc.id] = byTabAndSearch.filter(p => p.main_category_id === mc.id).length; });
    return c;
  }, [byTabAndSearch, mainCategories]);

  const filtered = categoryFilter ? byTabAndSearch.filter(p => p.main_category_id === categoryFilter) : byTabAndSearch;

  const activeCount = products.filter(p => !p.archived).length;
  const archivedCount = products.filter(p => p.archived).length;

  const startAdd = () => { setForm(emptyForm); setEditingId(null); setError(''); setShowForm(true); };
  const startEdit = (p) => {
    setForm({
      name: p.name, brand: p.brand || '', description: p.description || '',
      mainCategoryId: p.main_category_id || '', subcategoryId: p.category_parent_id ? p.category_id : '',
      status: p.status === 'inactive' ? 'inactive' : 'active',
      stock: p.stock, addStock: '', clerkCode: '',
      price: p.price, discount: p.discount || 0,
      image: p.image || '', featured: !!p.featured,
    });
    setEditingId(p.id);
    setError('');
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setError(''); setDragActive(false); };

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) { setError('Please upload a JPG, PNG, WebP, or GIF image.'); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { setError(`Image must be smaller than ${MAX_IMAGE_MB}MB.`); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result }));
    reader.readAsDataURL(file);
  };
  const handleDrop = (e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0]); };

  const handleSubcategoryChange = (value) => {
    if (value !== '__new__') { setForm(f => ({ ...f, subcategoryId: value })); return; }
    setSubcategoryPromptOpen(true);
  };

  const confirmNewSubcategory = async (label) => {
    const slug = `${slugify(label)}-${Date.now().toString(36)}`;
    try {
      const { id } = await api.post('/admin/categories', { name: label, slug, parentId: form.mainCategoryId });
      await api.get('/admin/categories').then(setCategories);
      setForm(f => ({ ...f, subcategoryId: id }));
    } catch (err) { setError(err.message); }
    setSubcategoryPromptOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.mainCategoryId) { setError('Select a main category.'); return; }
    const categoryId = form.subcategoryId || form.mainCategoryId;
    const addQty = Number(form.addStock) || 0;
    if (editingId && addQty > 0 && !form.clerkCode.trim()) {
      setError('Enter the inventory clerk code to authorize this stock addition.');
      return;
    }
    const payload = {
      name: form.name, categoryId, description: form.description,
      price: Number(form.price), image: form.image,
      brand: form.brand, discount: Number(form.discount) || 0, status: form.status,
      featured: form.featured, specifications: {},
    };
    if (editingId) {
      payload.addStock = addQty;
      payload.clerkCode = form.clerkCode.trim();
    } else {
      payload.stock = Number(form.stock);
    }
    try {
      if (editingId) await api.put(`/admin/products/${editingId}`, payload);
      else await api.post('/admin/products', { ...payload, slug: slugify(form.name) });
      cancelForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const archive = async (id) => { await api.put(`/admin/products/${id}/archive`); load(); };
  const restore = async (id) => { await api.put(`/admin/products/${id}/restore`); load(); };
  const remove = async (id) => { await api.delete(`/admin/products/${id}`); load(); };

  const confirmArchive = () => { archive(confirmArchiveId); setConfirmArchiveId(null); };
  const confirmDelete = () => { remove(confirmDeleteId); setConfirmDeleteId(null); };

  return (
    <AdminLayout title="Products" subtitle="View and manage your product catalog.">
      <PromptDialog
        open={subcategoryPromptOpen}
        title="New Subcategory"
        message="Enter a name for the new subcategory."
        placeholder="e.g. Split Type"
        onConfirm={confirmNewSubcategory}
        onCancel={() => setSubcategoryPromptOpen(false)}
      />

      <ConfirmDialog
        open={!!confirmArchiveId}
        icon={Archive}
        tone="archive"
        title="Archive this product?"
        message="It will be hidden from customers but can be restored later from the Archived tab."
        confirmLabel="Archive"
        onConfirm={confirmArchive}
        onCancel={() => setConfirmArchiveId(null)}
      />
      <ConfirmDialog
        open={!!confirmDeleteId}
        icon={Trash2}
        tone="delete"
        title="Permanently delete this product?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {tab !== 'archived' && (
            <TabButton active={tab === 'active'} onClick={() => setTab('active')}>All Active ({activeCount})</TabButton>
          )}
          <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>Archived ({archivedCount})</TabButton>
        </div>
        {!showForm && tab !== 'archived' && (
          <button onClick={startAdd} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Product</button>
        )}
      </div>


      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={cancelForm} />
          <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 fade-up">
            <div className="md:col-span-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-lg">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            {error && <p className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <Field label="Product Name" required>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
            </Field>
            <Field label="Material / Maker">
              <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="input-field" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Description" required>
                <textarea required rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
              </Field>
            </div>

            <Field label="Main Category" required>
              <Select
                value={form.mainCategoryId}
                onChange={v => setForm(f => ({ ...f, mainCategoryId: v, subcategoryId: '' }))}
                placeholder="Select Main Category"
                options={mainCategories.map(c => ({ value: c.id, label: c.name }))}
              />
            </Field>
            <Field label="Subcategory">
              <Select
                value={form.subcategoryId}
                onChange={handleSubcategoryChange}
                disabled={!form.mainCategoryId}
                options={[
                  { value: '', label: form.mainCategoryId ? 'None' : 'Select main category first' },
                  ...subcategoriesOf(form.mainCategoryId).map(c => ({ value: c.id, label: c.name })),
                  ...(form.mainCategoryId ? [{ value: '__new__', label: '+ Add new subcategory...' }] : []),
                ]}
              />
            </Field>

            <Field label="Status" required>
              <Select
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              />
            </Field>
            <div />

            {!editingId ? (
              <Field label="Current Stock" required>
                <input type="number" min="0" required value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="input-field" />
              </Field>
            ) : (
              <>
                <Field label="Current Stock">
                  <input type="number" value={form.stock} disabled className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
                </Field>
                <Field label="Add Stock">
                  <input type="number" min="0" placeholder="Additional" value={form.addStock} onChange={e => setForm(f => ({ ...f, addStock: e.target.value }))} className="input-field" />
                </Field>
                <div className="md:col-span-2">
                  <Field label={Number(form.addStock) > 0 ? 'Clerk Code (required to add stock)' : 'Clerk Code'}>
                    <input
                      placeholder="e.g. IC001"
                      value={form.clerkCode}
                      onChange={e => setForm(f => ({ ...f, clerkCode: e.target.value.toUpperCase() }))}
                      className="input-field"
                    />
                    <p className="text-xs text-gray-400 mt-1">Stock additions must be verified with an inventory clerk's staff code.</p>
                  </Field>
                </div>
              </>
            )}

            <Field label="Selling Price (₱)" required>
              <input type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-field" />
            </Field>
            <Field label="Discount (%)">
              <input type="number" min="0" max="100" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="input-field" />
            </Field>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Product Cover Image</label>
              {form.image ? (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                  <img src={form.image} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, image: '' }))} className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-gray-600 hover:bg-white shadow"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition ${dragActive ? 'border-brand-orange bg-orange-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}
                >
                  <UploadCloud className="w-8 h-8 text-gray-400" />
                  <p className="text-sm font-medium text-gray-600">Click or drag &amp; drop to upload</p>
                  <p className="text-xs text-gray-400">Accepted: JPG, PNG, WebP, GIF (Max 5MB)</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            <label className="md:col-span-2 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} /> Featured product
            </label>

            <button type="submit" className="btn-primary md:col-span-2">{editingId ? 'Save Changes' : 'Save Product'}</button>
          </form>
        </div>
      )}

      <div className="card overflow-visible p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSearchParams(e.target.value ? { search: e.target.value } : {}); }}
            placeholder="Search products..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          className="w-56"
          options={[
            { value: '', label: `All Categories (${categoryCounts[''] || 0})` },
            ...mainCategories.map(mc => ({ value: mc.id, label: `${mc.name} (${categoryCounts[mc.id] || 0})` })),
          ]}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Brand</th>
              <th className="p-3 font-medium">Price</th>
              <th className="p-3 font-medium">Stock</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No products {tab === 'archived' ? 'archived' : 'found'}.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-gray-100" onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><ImageOff className="w-4 h-4 text-gray-300" /></div>
                    )}
                    <span className="font-medium text-gray-800">{p.name}</span>
                  </div>
                </td>
                <td className="p-3 text-gray-600">
                  {p.category_name ? (
                    <>
                      <p>{p.category_name}</p>
                      {p.subcategory_name && <p className="text-xs text-gray-400">{p.main_category_name}</p>}
                    </>
                  ) : '—'}
                </td>
                <td className="p-3 text-gray-600">{p.brand || '—'}</td>
                <td className="p-3 text-gray-600">
                  {formatPrice(p.price)}
                  {p.discount > 0 && <span className="ml-1.5 badge bg-orange-100 text-brand-orange">-{p.discount}%</span>}
                </td>
                <td className="p-3 text-gray-600">{p.stock <= 5 ? <span className="text-red-600 font-medium">{p.stock}</span> : p.stock}</td>
                <td className="p-3">
                  <span className={`badge ${p.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                    {p.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {p.archived ? (
                      <button onClick={() => restore(p.id)} title="Unarchive" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <>
                        <button onClick={() => startEdit(p)} title="Edit" className="p-1.5 rounded-lg bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20 transition"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmArchiveId(p.id)} title="Archive" className="p-1.5 rounded-lg bg-orange-50 text-brand-orange hover:bg-orange-100 transition"><Archive className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDeleteId(p.id)} title="Delete permanently" className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}
