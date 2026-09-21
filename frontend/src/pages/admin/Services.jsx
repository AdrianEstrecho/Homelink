import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Search, X, ImageOff, UploadCloud, Info, FolderTree, Tag, ListChecks, Sparkles, ClipboardList, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Select from '../../components/Select';
import PromptDialog from '../../components/PromptDialog';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';
import { specEntries, toHighlights, presetsForServiceCategory } from '../../utils/catalogSpecs';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_MB = 5;
const PAGE_SIZE = 10;

// Service details are edited as ordered rows but stored as a label -> value object and two
// string arrays. Rows carry a client-only id so React keeps inputs focused while rows above
// them are added or removed (an index key would not).
let rowSeq = 0;
const specRow = (label = '', value = '') => ({ id: `s${++rowSeq}`, label, value });
const lineRow = (value = '') => ({ id: `l${++rowSeq}`, value });

// A factory rather than a shared constant — the form holds arrays, and reusing one object
// across resets would let two edits mutate the same rows.
const createEmptyForm = () => ({
  name: '', category: '', description: '',
  status: 'active',
  basePrice: '', discount: '', durationHours: '2',
  specs: [specRow()], highlights: [lineRow()], requirements: [lineRow()], warranty: '',
  image: '',
});

function requestLabel(r, services) {
  if (r.payload?.name) return r.payload.name;
  return services.find(s => s.id === r.entity_id)?.name || 'this service';
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

// Groups the form into labelled blocks so a long service record reads as a few short
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

// Highlights and requirements are both plain lists of short lines, so they share one editor.
function LineListEditor({ rows, onChange, onAdd, onRemove, placeholder, addLabel, bulletClass }) {
  return (
    <>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.id} className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${bulletClass}`} />
            <input
              value={row.value}
              onChange={e => onChange(row.id, e.target.value)}
              placeholder={placeholder}
              aria-label={`${addLabel} ${i + 1}`}
              className="input-field py-2 text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              aria-label={`Remove ${addLabel.toLowerCase()} ${i + 1}`}
              className="w-9 h-[42px] shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange transition mt-3">
        <Plus className="w-4 h-4" /> Add {addLabel.toLowerCase()}
      </button>
    </>
  );
}

export default function AdminServices() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isClerk = user?.position === 'inventory_clerk';
  const isGeneralStaff = user?.position === 'general_staff';
  const canManageArchive = isAdmin || isClerk || isGeneralStaff;
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState(searchParams.get('tab') === 'archived' ? 'archived' : 'active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pageError, setPageError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [categoryPromptOpen, setCategoryPromptOpen] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const fileInputRef = useRef(null);

  const load = () => {
    api.get('/admin/services').then(setServices).catch(() => {});
    api.get('/services/categories').then(setCategories).catch(() => {});
  };
  const loadMyRequests = () => {
    if (!isGeneralStaff) return;
    api.get('/admin/approvals/mine').then(rows => setMyRequests(rows.filter(r => r.entity_type === 'service' && r.status === 'pending'))).catch(() => {});
  };
  useEffect(load, []);
  useEffect(loadMyRequests, [isGeneralStaff]);

  const byTabAndSearch = useMemo(() => {
    return services
      .filter(s => (tab === 'archived' ? s.archived : !s.archived))
      .filter(s => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [services, tab, search]);

  const categoryCounts = useMemo(() => {
    const c = { '': byTabAndSearch.length };
    categories.forEach(cat => { c[cat] = byTabAndSearch.filter(s => s.category === cat).length; });
    return c;
  }, [byTabAndSearch, categories]);

  const filtered = categoryFilter ? byTabAndSearch.filter(s => s.category === categoryFilter) : byTabAndSearch;

  useEffect(() => { setPage(1); }, [tab, search, categoryFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeCount = services.filter(s => !s.archived).length;
  const archivedCount = services.filter(s => s.archived).length;

  const startAdd = () => { setForm(createEmptyForm()); setEditingId(null); setError(''); setNotice(''); setShowForm(true); };
  const startEdit = (s) => {
    const specs = specEntries(s.specifications).map(row => specRow(row.label, row.value));
    const highlights = toHighlights(s.highlights).map(v => lineRow(v));
    const requirements = toHighlights(s.requirements).map(v => lineRow(v));
    setForm({
      name: s.name, category: s.category, description: s.description || '',
      status: s.status === 'inactive' ? 'inactive' : 'active',
      basePrice: s.base_price, discount: s.discount || 0, durationHours: s.duration_hours,
      specs: specs.length ? specs : [specRow()],
      highlights: highlights.length ? highlights : [lineRow()],
      requirements: requirements.length ? requirements : [lineRow()],
      warranty: s.warranty || '',
      image: s.image || '',
    });
    setEditingId(s.id);
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

  // One set of handlers for both line lists, keyed by which form field they edit.
  const updateLine = (key) => (id, value) => setForm(f => ({ ...f, [key]: f[key].map(r => (r.id === id ? { ...r, value } : r)) }));
  const addLine = (key) => () => setForm(f => ({ ...f, [key]: [...f[key], lineRow()] }));
  const removeLine = (key) => (id) => setForm(f => {
    const rows = f[key].filter(r => r.id !== id);
    return { ...f, [key]: rows.length ? rows : [lineRow()] };
  });

  const usedSpecLabels = new Set(form.specs.map(s => s.label.trim().toLowerCase()).filter(Boolean));
  const specSuggestions = presetsForServiceCategory(form.category).filter(label => !usedSpecLabels.has(label.toLowerCase()));

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

  const handleCategoryChange = (value) => {
    if (value !== '__new__') { setForm(f => ({ ...f, category: value })); return; }
    setCategoryPromptOpen(true);
  };

  const confirmNewCategory = (label) => {
    setCategories(prev => prev.includes(label) ? prev : [...prev, label].sort());
    setForm(f => ({ ...f, category: label }));
    setCategoryPromptOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // A value typed without a label would silently vanish on save, and two rows sharing a
    // label would collapse into one — catch both here rather than letting the object build
    // quietly drop them.
    const seen = new Set();
    for (const row of form.specs) {
      const label = row.label.trim();
      const value = row.value.trim();
      if (!label && value) { setError('Every service detail needs a label — one row has a value but no label.'); return; }
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) { setError(`"${label}" is listed twice in the service details. Use a different label for each row.`); return; }
      seen.add(key);
    }

    const specifications = {};
    for (const row of form.specs) {
      const label = row.label.trim();
      const value = row.value.trim();
      if (label && value) specifications[label] = value;
    }

    const payload = {
      name: form.name, category: form.category, description: form.description,
      basePrice: Number(form.basePrice), discount: Number(form.discount) || 0,
      durationHours: Number(form.durationHours), image: form.image, status: form.status,
      warranty: form.warranty,
      specifications,
      highlights: form.highlights.map(r => r.value.trim()).filter(Boolean),
      requirements: form.requirements.map(r => r.value.trim()).filter(Boolean),
    };
    try {
      const result = editingId
        ? await api.put(`/admin/services/${editingId}`, payload)
        : await api.post('/admin/services', { ...payload, slug: slugify(form.name) });
      cancelForm();
      if (result?.pending) setNotice(result.message || 'Submitted for clerk approval.');
      load();
      loadMyRequests();
    } catch (err) {
      setError(err.message);
    }
  };

  const archive = async (id) => { await api.put(`/admin/services/${id}/archive`); load(); };
  const restore = async (id) => { await api.put(`/admin/services/${id}/restore`); load(); };
  const remove = async (id) => {
    try {
      const result = await api.delete(`/admin/services/${id}`);
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
    <AdminLayout title="Services" subtitle="View and manage your service offerings.">
      <PromptDialog
        open={categoryPromptOpen}
        title="New Category"
        message="Enter a name for the new service category."
        placeholder="e.g. Deep Cleaning"
        onConfirm={confirmNewCategory}
        onCancel={() => setCategoryPromptOpen(false)}
      />

      <ConfirmDialog
        open={!!confirmArchiveId}
        icon={Archive}
        tone="archive"
        title="Archive this service?"
        message="It will be hidden from customers but can be restored later from the Archived tab."
        confirmLabel="Archive"
        onConfirm={confirmArchive}
        onCancel={() => setConfirmArchiveId(null)}
      />
      <ConfirmDialog
        open={!!confirmDeleteId}
        icon={Trash2}
        tone="delete"
        title={isAdmin ? 'Permanently delete this service?' : 'Request deletion of this service?'}
        message={isAdmin ? 'This cannot be undone.' : 'An inventory clerk will need to approve this before the service is removed.'}
        confirmLabel={isAdmin ? 'Delete' : 'Request Deletion'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {notice && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}
      {pageError && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pageError}</p>}

      {isGeneralStaff && myRequests.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Pending Requests</h3>
          <div className="space-y-1.5">
            {myRequests.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600"><span className="capitalize font-medium">{r.action}</span> — {requestLabel(r, services)}</span>
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
          <button onClick={startAdd} className="btn-primary flex items-center gap-2 text-sm py-2"><Plus className="w-4 h-4" /> Add Service</button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={cancelForm} />
          <form onSubmit={handleSubmit} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col fade-up">
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">{editingId ? 'Edit Service' : 'Add New Service'}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Everything filled in here shows on the customer service page. Fields marked <span className="text-red-500">*</span> are required.</p>
              </div>
              <button type="button" onClick={cancelForm} aria-label="Close" className="text-gray-400 hover:text-gray-600 shrink-0"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

              <Section icon={Info} title="Basic Information" description="The name and summary shown at the top of the service page.">
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Service Name" required>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
                  </Field>
                  <Field label="Description" required hint="Two or three sentences on what the visit covers and who it suits.">
                    <textarea required rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
                  </Field>
                </div>
              </Section>

              <Section icon={FolderTree} title="Category & Visibility" description="Where the service is filed, and whether customers can book it.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Category" required>
                    <Select
                      value={form.category}
                      onChange={handleCategoryChange}
                      placeholder="Select Category"
                      options={[
                        ...categories.map(cat => ({ value: cat, label: cat })),
                        { value: '__new__', label: '+ Add new category...' },
                      ]}
                    />
                  </Field>
                  <Field label="Status" required hint="Inactive services stay listed here but are hidden from customers.">
                    <Select
                      value={form.status}
                      onChange={v => setForm(f => ({ ...f, status: v }))}
                      options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                    />
                  </Field>
                </div>
              </Section>

              <Section icon={Tag} title="Pricing & Duration" description="The starting price quoted to customers, and how long a visit usually takes.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Base Price (₱)" required>
                    <input type="number" min="0" step="0.01" required value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))} className="input-field" />
                  </Field>
                  <Field label="Discount (%)">
                    <input type="number" min="0" max="100" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="input-field" />
                  </Field>
                  <Field label="Duration (hours)" required className="md:col-span-2" hint="Shown as the typical time on site, and used to plan the technician's day.">
                    <input type="number" min="0" step="0.5" required value={form.durationHours} onChange={e => setForm(f => ({ ...f, durationHours: e.target.value }))} className="input-field" />
                  </Field>
                </div>
              </Section>

              <Section icon={ListChecks} title="Service Details" description="Label and value pairs listed in the Service Details tab, in the order you arrange them.">
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
                        placeholder="e.g. Team Size"
                        aria-label={`Service detail ${i + 1} label`}
                        className="input-field py-2 text-sm"
                      />
                      <input
                        value={row.value}
                        onChange={e => updateSpec(row.id, { value: e.target.value })}
                        placeholder="e.g. 2 technicians"
                        aria-label={`Service detail ${i + 1} value`}
                        className="input-field py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSpec(row.id)}
                        aria-label={`Remove service detail ${i + 1}`}
                        className="w-9 h-[42px] shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addSpec()} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange transition mt-3">
                  <Plus className="w-4 h-4" /> Add detail
                </button>
                {specSuggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-2">
                      Common for {form.category ? form.category.toLowerCase() : 'most services'} — tap to add a row:
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

              <Section icon={Sparkles} title="What's Included" description="Short lines on what the visit covers, shown beside the booking button.">
                <LineListEditor
                  rows={form.highlights}
                  onChange={updateLine('highlights')}
                  onAdd={addLine('highlights')}
                  onRemove={removeLine('highlights')}
                  placeholder="e.g. Vacuum and nitrogen leak test before charging"
                  addLabel="Inclusion"
                  bulletClass="bg-brand-orange"
                />
              </Section>

              <Section icon={ClipboardList} title="Before the Visit" description="What the customer should have ready so the technician isn't turned away.">
                <LineListEditor
                  rows={form.requirements}
                  onChange={updateLine('requirements')}
                  onAdd={addLine('requirements')}
                  onRemove={removeLine('requirements')}
                  placeholder="e.g. Clear access to the mounting wall"
                  addLabel="Requirement"
                  bulletClass="bg-brand-teal"
                />
              </Section>

              <Section icon={ShieldCheck} title="Service Guarantee" description="Shown in the How It Works tab on the service page.">
                <Field label="Guarantee / Warranty">
                  <input
                    value={form.warranty}
                    onChange={e => setForm(f => ({ ...f, warranty: e.target.value }))}
                    placeholder="e.g. 1 year workmanship guarantee"
                    className="input-field"
                  />
                </Field>
              </Section>

              <Section icon={ImageIcon} title="Service Cover Image" description="The main photo used in listings and on the service page.">
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
                  {editingId ? 'This edit' : 'This service'} won't go live until an inventory clerk reviews and approves it.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button type="button" onClick={cancelForm} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 transition">Cancel</button>
              <button type="submit" className="btn-primary text-sm">
                {isGeneralStaff ? 'Submit for Approval' : editingId ? 'Save Changes' : 'Save Service'}
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
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-transparent outline-none transition"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          className="w-56"
          options={[
            { value: '', label: `All Categories (${categoryCounts[''] || 0})` },
            ...categories.map(cat => ({ value: cat, label: `${cat} (${categoryCounts[cat] || 0})` })),
          ]}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Service</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Price</th>
              <th className="p-3 font-medium">Duration</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No services {tab === 'archived' ? 'archived' : 'found'}.</td></tr>
            ) : paginated.map(s => {
              const detailCount = specEntries(s.specifications).length;
              return (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {s.image ? (
                      <img src={s.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 bg-gray-100" onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><ImageOff className="w-4 h-4 text-gray-300" /></div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">{s.name}</p>
                      {/* A service with no details still books, but its page looks bare —
                          flag it here so it's obvious which entries need filling in. */}
                      <p className="text-xs text-gray-400">
                        {detailCount === 0
                          ? <span className="text-amber-600">No details yet</span>
                          : `${detailCount} detail${detailCount === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-gray-600">{s.category}</td>
                <td className="p-3 text-gray-600">
                  {formatPrice(s.base_price)}
                  {s.discount > 0 && <span className="ml-1.5 badge bg-orange-100 text-brand-orange">-{s.discount}%</span>}
                </td>
                <td className="p-3 text-gray-600">~{Number(s.duration_hours).toFixed(1)}h</td>
                <td className="p-3">
                  <span className={`badge ${s.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                    {s.status === 'inactive' ? 'Inactive' : 'Active'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {s.archived ? (
                      canManageArchive && <button onClick={() => restore(s.id)} title="Unarchive" className="p-1.5 rounded-lg bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"><ArchiveRestore className="w-3.5 h-3.5" /></button>
                    ) : (
                      <>
                        <button onClick={() => startEdit(s)} title="Edit" className="p-1.5 rounded-lg bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20 transition"><Pencil className="w-3.5 h-3.5" /></button>
                        {canManageArchive && <button onClick={() => setConfirmArchiveId(s.id)} title="Archive" className="p-1.5 rounded-lg bg-orange-50 text-brand-orange hover:bg-orange-100 transition"><Archive className="w-3.5 h-3.5" /></button>}
                        {(isAdmin || isGeneralStaff) && <button onClick={() => setConfirmDeleteId(s.id)} title={isAdmin ? 'Delete permanently' : 'Request deletion'} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>}
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
        <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
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
