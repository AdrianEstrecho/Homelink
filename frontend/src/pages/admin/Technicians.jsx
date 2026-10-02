import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, MessageSquare, Mail, Phone, Plus, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import Modal, { ModalBody, ModalFooter, ModalHeader, modalButton } from '../../components/Modal';
import FormField from '../../components/FormField';
import { useAuth } from '../../context/AuthContext';

const EMPTY_FORM = { email: '', password: '', firstName: '', lastName: '', phone: '' };

export default function Technicians() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [technicians, setTechnicians] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTechnicians = () => api.get('/admin/users?role=employee&position=installer').then(rows => setTechnicians(rows.filter(t => !t.archived))).catch(() => {});

  useEffect(() => {
    loadTechnicians();
    api.get('/admin/bookings').then(setBookings).catch(() => {});
  }, []);

  const activeJobCount = (technicianId) =>
    bookings.filter(b => b.employee_id === technicianId && !['completed', 'cancelled'].includes(b.status)).length;

  const closeForm = () => { setShowForm(false); setForm(EMPTY_FORM); setFormError(''); };

  // Admin's add is immediate; a booking coordinator's is queued for admin approval, the same
  // way HR's onboarding is (the backend forces the position to installer either way).
  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const result = await api.post('/admin/users', { ...form, role: 'employee', position: 'installer' });
      closeForm();
      setNotice(result?.pending ? (result.message || 'Submitted for admin approval.') : 'Technician added.');
      loadTechnicians();
    } catch (err) {
      setFormError(err.message || 'Could not add technician.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Technicians" subtitle="Installer and technician contact info — message them directly about a job.">
      <Modal open={showForm} onClose={closeForm} dismissible={!saving} as="form" onSubmit={handleAdd}>
        <ModalHeader
          icon={HardHat}
          title="New technician"
          subtitle={isAdmin
            ? 'The account is created in the Installation department and can sign in right away.'
            : "This account won't be created until an admin reviews and approves it."}
        />
        <ModalBody className="grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
          <FormField label="First name" required>
            <input required autoFocus value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="input-field" />
          </FormField>
          <FormField label="Last name" required>
            <input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="input-field" />
          </FormField>
          <FormField label="Email" required>
            <input type="email" required autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
          </FormField>
          <FormField label="Temporary password" required hint="They can change it after signing in.">
            <input type="password" required autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" />
          </FormField>
          <FormField label="Phone" className="md:col-span-2">
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </FormField>
          {formError && <p role="alert" className="md:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={closeForm} disabled={saving} className={`${modalButton.base} ${modalButton.secondary}`}>Cancel</button>
          <button type="submit" disabled={saving} className={`${modalButton.base} ${modalButton.primary}`}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : isAdmin ? 'Add technician' : 'Submit for approval'}
          </button>
        </ModalFooter>
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {notice
          ? <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>
          : <span />}
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2">
          <Plus className="w-4 h-4" /> Add Technician
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Phone</th>
              <th className="p-3 font-medium">Active Jobs</th>
              <th className="p-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {technicians === null ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading...</td></tr>
            ) : technicians.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No installers or technicians on staff yet.</td></tr>
            ) : technicians.map(t => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="p-3 font-mono text-xs text-gray-500">{t.staff_code || '—'}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2 font-medium text-gray-800">
                    <HardHat className="w-3.5 h-3.5 text-brand-orange shrink-0" /> {t.first_name} {t.last_name}
                  </div>
                </td>
                <td className="p-3 text-gray-600">
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {t.email}</span>
                </td>
                <td className="p-3 text-gray-600">
                  {t.phone ? <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {t.phone}</span> : '—'}
                </td>
                <td className="p-3">
                  <span className={`badge ${activeJobCount(t.id) > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                    {activeJobCount(t.id)} active
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => navigate(`/admin/messages?with=${t.id}`)}
                      title="Message"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-[#00806f] hover:bg-teal-100 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Message
                    </button>
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
