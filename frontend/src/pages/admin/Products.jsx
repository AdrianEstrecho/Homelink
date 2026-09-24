import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Search, X, ImageOff, UploadCloud, Info, FolderTree, Tag, ListChecks, Sparkles, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import PromptDialog from '../../components/PromptDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';
import { specEntries, toHighlights, presetsForCategory } from '../../utils/catalogSpecs';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_MB = 5;
const PAGE_SIZE = 10;

// Specifications and highlights are edited as ordered rows, but stored as a label -> value
// object and a string array respectively. Rows carry a client-only id so React keeps inputs
// focused while rows above them are added or removed (an index key would not).
let rowSeq = 0;
const specRow = (label = '', value = '') => ({ id: `s${++rowSeq}`, label, value });
const highlightRow = (value = '') => ({ id: `h${++rowSeq}`, value });

// A factory rather than a shared constant — the form holds arrays, and reusing one object
// across resets would let two edits mutate the same rows.
const createEmptyForm = () => ({
  name: '', brand: '', model: '', description: '',
  mainCategoryId: '', subcategoryId: '',
  status: 'active',
  stock: '', addStock: '',
  price: '', discount: '',
  specs: [specRow()], highlights: [highlightRow()], warranty: '',
  image: '', featured: false,
});

function requestLabel(r, products) {
  if (r.payload?.name) return r.payload.name;
  return products.find(p => p.id === r.entity_id)?.name || 'this product';
}

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function Field({ label, required, hint, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// Groups the form into labelled blocks so a long product record reads as a few short
// sections instead of one flat run of inputs.
function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white/60">
      <header className="flex items-start gap-2.5 px-4 pt-4 pb-3">
        <span className="mt-0.5 w-7 h-7 rounded-lg bg-brand-navy/10 text-brand-navy flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
          {description && <p className="text-xs text-gray-400 leading-snug">{description}</p>}
        </div>
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

export default function AdminProducts() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isClerk = user?.position === 'inventory_clerk';
  const isGeneralStaff = user?.position === 'general_staff';
  const canManageArchive = isAdmin || isClerk || isGeneralStaff;
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState(searchParams.get('tab') === 'archived' ? 'archived' : 'active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pageError, setPageError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [subcategoryPromptOpen, setSubcategoryPromptOpen] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const fileInputRef = useRef(null);

  const load = () => {
    api.get('/admin/products').then(setProducts).catch(() => {});
    api.get('/admin/categories').then(setCategories).catch(() => {});
  };
  const loadMyRequests = () => {
    if (!isGeneralStaff) return;
    api.get('/admin/approvals/mine').then(rows => setMyRequests(rows.filter(r => r.entity_type === 'product' && r.status === 'pending'))).catch(() => {});
  };
  useEffect(load, []);
  useEffect(loadMyRequests, [isGeneralStaff]);

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

  useEffect(() => { setPage(1); }, [tab, search, categoryFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Archiving or deleting from this very table can shrink the list past the page being read, so
  // the page in use is clamped to one that still exists rather than left pointing at nothing.
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = products.filter(p => !p.archived).length;
  const archivedCount = products.filter(p => p.archived).length;

  const startAdd = () => { setForm(createEmptyForm()); setEditingId(null); setError(''); setNotice(''); setShowForm(true); };
  const startEdit = (p) => {
    // specEntries humanizes legacy camelCase keys ("energyRating" -> "Energy Rating"), so
    // re-saving an older product also tidies up how its labels are stored.
    const specs = specEntries(p.specifications).map(s => specRow(s.label, s.value));
    const highlights = toHighlights(p.highlights).map(h => highlightRow(h));
    setForm({
      name: p.name, brand: p.brand || '', model: p.model || '', description: p.description || '',
      mainCategoryId: p.main_category_id || '', subcategoryId: p.category_parent_id ? p.category_id : '',
      status: p.status === 'inactive' ? 'inactive' : 'active',
      stock: p.stock, addStock: '',
      price: p.price, discount: p.discount || 0,
      specs: specs.length ? specs : [specRow()],
      highlights: highlights.length ? highlights : [highlightRow()],
      warranty: p.warranty || '',
      image: p.image || '', featured: !!p.featured,
    });
    setEditingId(p.id);
    setError('');
    setNotice('');
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(createEmptyForm()); setError(''); setDragActive(false); };

  const updateSpec = (id, patch) => setForm(f => ({ ...f, specs: f.specs.map(s => (s.id === id ? { ...s, ...patch } : s)) }));
  const addSpec = (label = '') => setForm(f => ({ ...f, specs: [...f.specs, specRow(label)] }));
  const removeSpec = (id) => setForm(f => {
    const specs = f.specs.filter(s => s.id !== id);
    return { ...f, specs: specs.length ? specs : [specRow()] };
  });

  const updateHighlight = (id, value) => setForm(f => ({ ...f, highlights: f.highlights.map(h => (h.id === id ? { ...h, value } : h)) }));
  const addHighlight = () => setForm(f => ({ ...f, highlights: [...f.highlights, highlightRow()] }));
  const removeHighlight = (id) => setForm(f => {
    const highlights = f.highlights.filter(h => h.id !== id);
    return { ...f, highlights: highlights.length ? highlights : [highlightRow()] };
  });

  const activeMainCategory = mainCategories.find(c => c.id === form.mainCategoryId);
  const usedSpecLabels = new Set(form.specs.map(s => s.label.trim().toLowerCase()).filter(Boolean));
  const specSuggestions = presetsForCategory(activeMainCategory?.name).filter(label => !usedSpecLabels.has(label.toLowerCase()));

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
    const existing = subcategoriesOf(form.mainCategoryId)
      .find(c => c.name.trim().toLowerCase() === label.trim().toLowerCase());
    if (existing) {
      // Same name already exists under this category — reuse it instead of creating a duplicate.
      setForm(f => ({ ...f, subcategoryId: existing.id }));
      setSubcategoryPromptOpen(false);
      return;
    }
    const slug = `${slugify(label)}-${Date.now().toString(36)}`;
    try {
      const { id } = await api.post('/admin/categories', { name: label, slug, parentId: form.mainCategoryId });
      await api.get('/admin/categories').then(setCategories);
      setForm(f => ({ ...f, subcategoryId: id }));
    } catch (err) { setError(err.message); }
    setSubcategoryPromptOpen(false);
  };

  // Admin and inventory clerk writes take effect immediately, so the form submit gates on
  // an explicit confirmation first. General staff's submit already only ever queues a
  // change request — nothing goes live until a clerk reviews it — so it skips the extra step.
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.mainCategoryId) { setError('Select a main category.'); return; }

    // A value typed without a label would silently vanish on save, and two rows sharing a
    // label would collapse into one — catch both here rather than letting the object build
    // quietly drop them.
    const seen = new Set();
    for (const row of form.specs) {
      const label = row.label.trim();
      const value = row.value.trim();
      if (!label && value) { setError('Every specification needs a label — one row has a value but no label.'); return; }
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) { setError(`"${label}" is listed twice in the specifications. Use a different label for each row.`); return; }
      seen.add(key);
    }

    if (isGeneralStaff) { doSubmit(); return; }
    setConfirmSaveOpen(true);
  };

  const doSubmit = async () => {
    setConfirmSaveOpen(false);
    const categoryId = form.subcategoryId || form.mainCategoryId;
    const addQty = Number(form.addStock) || 0;
    const specifications = {};
    for (const row of form.specs) {
      const label = row.label.trim();
      const value = row.value.trim();
      if (label && value) specifications[label] = value;
    }
    const payload = {
      name: form.name, categoryId, description: form.description,
      price: Number(form.price), image: form.image,
      brand: form.brand, model: form.model, warranty: form.warranty,
      discount: Number(form.discount) || 0, status: form.status,
      featured: form.featured,
      specifications,
      highlights: form.highlights.map(h => h.value.trim()).filter(Boolean),
    };
    if (editingId) {
      payload.addStock = addQty;
    } else {
      payload.stock = Number(form.stock);
    }
    try {
      const result = editingId
        ? await api.put(`/admin/products/${editingId}`, payload)
        : await api.post('/admin/products', { ...payload, slug: slugify(form.name) });
      cancelForm();
      if (result?.pending) setNotice(result.message || 'Submitted for clerk approval.');
      load();
      loadMyRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  const archive = async (id) => { await api.put(`/admin/products/${id}/archive`); load(); };
  const restore = async (id) => { await api.put(`/admin/products/${id}/restore`); load(); };
  const remove = async (id) => {
    try {
      const result = await api.delete(`/admin/products/${id}`);
      if (result?.pending) setNotice(result.message || 'Deletion request submitted for clerk approval.');
      else setNotice('');
      load();
      loadMyRequests();
    } catch (err) {
      setPageError(err.message);
    }
  };

  const confirmArchive = () => { archive(confirmArchiveId); setConfirmArchiveId(null); };
  const confirmDelete = () => { setNotice(''); setPageError(''); remove(confirmDeleteId); setConfirmDeleteId(null); };

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
        title={isAdmin ? 'Permanently delete this product?' : 'Request deletion of this product?'}
        message={isAdmin ? 'This cannot be undone.' : 'An inventory clerk will need to approve this before the product is removed.'}
        confirmLabel={isAdmin ? 'Delete' : 'Request Deletion'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmDialog
        open={confirmSaveOpen}
        icon={editingId ? Pencil : Plus}
        tone={editingId ? 'update' : 'create'}
        title={editingId ? 'Save changes to this product?' : 'Add this new product?'}
        message={editingId ? 'This product will be updated immediately and shown to customers right away.' : 'This product will be added to the catalog and shown to customers immediately.'}
        confirmLabel={editingId ? 'Save Changes' : 'Add Product'}
        onConfirm={doSubmit}
        onCancel={() => setConfirmSaveOpen(false)}
        zIndexClass="z-[110]"
      />

      {notice && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
      {pageError && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pageError}</p>}

      {isGeneralStaff && myRequests.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Pending Requests</h3>
          <div className="space-y-1.5">
            {myRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600"><span className="capitalize font-medium">{r.action}</span> — {requestLabel(r, products)}</span>
                <span className="badge bg-amber-100 text-amber-800">Pending clerk review</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TabButton active={tab === 'active'} onClick={() => setTab('active')}>All Active ({activeCount})</TabButton>
          {canManageArchive && (
            <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>Archived ({archivedCount})</TabButton>
          )}
        </div>
        {!showForm && tab !== 'archived' && (
          <button onClick={startAdd} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Product</button>
        )}
      </div>


      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={cancelForm} />
          <form onSubmit={handleFormSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col fade-up">
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Everything filled in here shows on the customer product page. Fields marked <span className="text-red-500">*</span> are required.</p>
              </div>
              <button type="button" onClick={cancelForm} aria-label="Close" className="text-gray-400 hover:text-gray-600 shrink-0"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

              <Section icon={Info} title="Basic Information" description="The name, maker and summary shown at the top of the product page.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Product Name" required>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
                  </Field>
                  <Field label="Material / Maker" hint="Brand or material, shown under the product name.">
                    <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className="input-field" placeholder="e.g. Daikin" />
                  </Field>
                  <Field label="Model / SKU" className="md:col-span-2" hint="Optional manufacturer model number customers can search for.">
                    <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className="input-field" placeholder="e.g. FTKC35TVM" />
                  </Field>
                  <Field label="Description" required className="md:col-span-2" hint="Two or three sentences on what it is and who it suits.">
                    <textarea required rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
                  </Field>
                </div>
              </Section>

              <Section icon={FolderTree} title="Category & Visibility" description="Where the product is filed, and whether customers can see it.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Field label="Status" required hint="Inactive products stay in the catalog but are hidden from customers.">
                    <Select
                      value={form.status}
                      onChange={v => setForm(f => ({ ...f, status: v }))}
                      options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                    />
                  </Field>
                  <label className="flex items-start gap-2 text-sm text-gray-600 md:pt-6">
                    <input type="checkbox" className="mt-0.5" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} />
                    <span>
                      Featured product
                      <span className="block text-xs text-gray-400">Pinned to the homepage and badged in listings.</span>
                    </span>
                  </label>
                </div>
              </Section>

              <Section icon={Tag} title="Pricing & Inventory" description="What it sells for and how many are on hand.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Selling Price (₱)" required>
                    <input type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="input-field" />
                  </Field>
                  <Field label="Discount (%)">
                    <input type="number" min="0" max="100" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="input-field" />
                  </Field>
                  {!editingId ? (
                    <Field label="Current Stock" required>
                      <input type="number" min="0" required value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="input-field" />
                    </Field>
                  ) : (
                    <>
                      <Field label="Current Stock" hint="Stock only moves through the field beside it, so every change is traceable.">
                        <input type="number" value={form.stock} disabled className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
                      </Field>
                      <Field label="Add Stock">
                        <input type="number" min="0" placeholder="Additional" value={form.addStock} onChange={e => setForm(f => ({ ...f, addStock: e.target.value }))} className="input-field" />
                      </Field>
                    </>
                  )}
                </div>
              </Section>

              <Section icon={ListChecks} title="Specifications" description="Label and value pairs listed in the Specifications tab, in the order you arrange them.">
                <div className="space-y-2">
                  <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2 px-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Label</span>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Value</span>
                    <span className="w-9" />
                  </div>
                  {form.specs.map((row, i) => (
                    <div key={row.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2">
                      <input
                        value={row.label}
                        onChange={e => updateSpec(row.id, { label: e.target.value })}
                        placeholder="e.g. Cooling Capacity"
                        aria-label={`Specification ${i + 1} label`}
                        className="input-field py-2 text-sm"
                      />
                      <input
                        value={row.value}
                        onChange={e => updateSpec(row.id, { value: e.target.value })}
                        placeholder="e.g. 1.5 HP (12,000 BTU/hr)"
                        aria-label={`Specification ${i + 1} value`}
                        className="input-field py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSpec(row.id)}
                        aria-label={`Remove specification ${i + 1}`}
                        className="w-9 h-[42px] shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button type="button" onClick={() => addSpec()} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange transition">
                    <Plus className="w-4 h-4" /> Add specification
                  </button>
                </div>
                {specSuggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">
                      Common for {activeMainCategory ? activeMainCategory.name.toLowerCase() : 'most products'} — tap to add a row:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {specSuggestions.map(label => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => addSpec(label)}
                          className="px-2.5 py-1 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:border-brand-orange hover:text-brand-orange transition"
                        >
                          + {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section icon={Sparkles} title="Key Highlights" description="Short selling points shown as a bulleted list beside the price.">
                <div className="space-y-2">
                  {form.highlights.map((row, i) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0" />
                      <input
                        value={row.value}
                        onChange={e => updateHighlight(row.id, e.target.value)}
                        placeholder="e.g. Inverter compressor cuts power draw up to 40%"
                        aria-label={`Highlight ${i + 1}`}
                        className="input-field py-2 text-sm flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeHighlight(row.id)}
                        aria-label={`Remove highlight ${i + 1}`}
                        className="w-9 h-[42px] shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addHighlight} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange transition mt-3">
                  <Plus className="w-4 h-4" /> Add highlight
                </button>
              </Section>

              <Section icon={ShieldCheck} title="Warranty" description="Shown in the product page's Delivery & Warranty tab.">
                <Field label="Warranty Coverage">
                  <input
                    value={form.warranty}
                    onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))}
                    placeholder="e.g. 5 years on compressor, 1 year on parts and labor"
                    className="input-field"
                  />
                </Field>
              </Section>

              <Section icon={ImageIcon} title="Product Cover Image" description="The main photo used in listings, the cart and the product page.">
                {form.image ? (
                  <div className="relative w-full h-44 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={form.image} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, image: '' }))} aria-label="Remove image" className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-gray-600 hover:bg-white shadow"><X className="w-3.5 h-3.5" /></button>
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
              </Section>

              {isGeneralStaff && (
                <p className="text-xs text-gray-400">
                  {editingId ? 'This edit' : 'This product'} won't go live until an inventory clerk reviews and approves it.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button type="button" onClick={cancelForm} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition">Cancel</button>
              <button type="submit" className="btn-primary text-sm">
                {isGeneralStaff ? 'Submit for Approval' : editingId ? 'Save Changes' : 'Save Product'}
              </button>
            </div>
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

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
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
            ) : paginated.map(p => {
              const specCount = specEntries(p.specifications).length;
              return (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-gray-100" onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><ImageOff className="w-4 h-4 text-gray-300" /></div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                        {p.model && <span>{p.model}</span>}
                        {/* A product with no specs still sells, but its page looks bare —
                            flag it here so it's obvious which entries need filling in. */}
                        {specCount === 0
                          ? <span className="text-amber-600">No specs yet</span>
                          : <span>{specCount} spec{specCount === 1 ? '' : 's'}</span>}
                      </p>
                    </div>
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
                      canManageArchive && <button onClick={() => restore(p.id)} title="Unarchive" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <>
                        <button onClick={() => startEdit(p)} title="Edit" className="p-1.5 rounded-lg bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20 transition"><Pencil className="w-3.5 h-3.5" /></button>
                        {canManageArchive && <button onClick={() => setConfirmArchiveId(p.id)} title="Archive" className="p-1.5 rounded-lg bg-orange-50 text-brand-orange hover:bg-orange-100 transition"><Archive className="w-3.5 h-3.5" /></button>}
                        {(isAdmin || isGeneralStaff) && <button onClick={() => setConfirmDeleteId(p.id)} title={isAdmin ? 'Delete permanently' : 'Request deletion'} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <Pagination page={currentPage} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
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
