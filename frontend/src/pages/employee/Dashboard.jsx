import { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Clock, MapPin, PlayCircle } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

// The pending-verification badge sits ahead of "Installed Completed" in the stepper: the
// installer has submitted, but the booking coordinator hasn't verified it yet, so the
// underlying booking.status is still 'in_progress' until they do.
const PENDING_LABEL = 'Pending Verification';

// The 3 stages an installer confirms a job through — labels only, the
// underlying booking.status values are unchanged so admin/coordinator views
// that already read confirmed/in_progress/completed keep working as-is.
const INSTALLER_STAGES = [
  { status: 'confirmed', label: 'Under Review' },
  { status: 'in_progress', label: 'Ongoing' },
  { status: 'completed', label: 'Installed Completed' },
];

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [pendingIds, setPendingIds] = useState(new Set());
  const [completingId, setCompletingId] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get('/employee/dashboard').then(setData).catch(() => {});
  const loadPending = () => api.get('/admin/approvals/mine')
    .then(rows => setPendingIds(new Set(rows.filter(r => r.entity_type === 'booking' && r.status === 'pending').map(r => r.entity_id))))
    .catch(() => {});
  useEffect(() => { load(); loadPending(); }, []);

  const startInstallation = async (id) => {
    await api.put(`/employee/bookings/${id}/status`, { status: 'in_progress' });
    load();
  };

  const confirmCompleted = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await api.put(`/employee/bookings/${completingId}/status`, { status: 'completed', completionNotes: notes });
      setCompletingId(null);
      setNotes('');
      if (result?.pending) setNotice(result.message || 'Submitted for booking coordinator verification.');
      load();
      loadPending();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Installer Dashboard" subtitle="Review, confirm, and update the status of your assigned installations.">
      {notice && <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>}

      {!data ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card p-4 text-center"><p className="text-2xl font-bold">{data.stats.total}</p><p className="text-sm text-gray-500">Total Jobs</p></div>
            <div className="card p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{data.stats.pending}</p><p className="text-sm text-gray-500">Active</p></div>
            <div className="card p-4 text-center"><p className="text-2xl font-bold text-green-600">{data.stats.completed}</p><p className="text-sm text-gray-500">Completed</p></div>
          </div>

          {data.todayJobs.length > 0 && (
            <div className="mb-8">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-brand-orange" /> Today's Jobs</h2>
              <div className="space-y-3">
                {data.todayJobs.map(b => (
                  <JobCard key={b.id} booking={b} pending={pendingIds.has(b.id)} onStart={startInstallation} onRequestComplete={() => { setCompletingId(b.id); setNotes(''); setError(''); }} />
                ))}
              </div>
            </div>
          )}

          <h2 className="font-semibold text-lg mb-4">All Assigned Jobs</h2>
          {data.assigned.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No jobs assigned yet. Check back after admin assigns bookings.</p>
          ) : (
            <div className="space-y-3">
              {data.assigned.map(b => (
                <JobCard key={b.id} booking={b} pending={pendingIds.has(b.id)} onStart={startInstallation} onRequestComplete={() => { setCompletingId(b.id); setNotes(''); setError(''); }} />
              ))}
            </div>
          )}
        </>
      )}

      {completingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={() => !saving && setCompletingId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 fade-up">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-green-100 text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-brand-navy">Confirm Installed Completed</h2>
            <p className="text-sm text-gray-600 mt-1.5">This submits the job for booking coordinator verification — it won't be marked Installed Completed until they confirm.</p>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">{error}</p>}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Completion notes (optional)"
              rows={3}
              className="w-full mt-4 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                disabled={saving}
                onClick={() => setCompletingId(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 font-medium text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmCompleted}
                className="flex-1 rounded-lg py-2.5 font-semibold text-sm text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatusStepper({ status, pending }) {
  const currentIndex = INSTALLER_STAGES.findIndex(s => s.status === status);
  if (currentIndex === -1) return null;
  const isDone = status === 'completed';
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {INSTALLER_STAGES.map((stage, i) => {
        const isPendingStage = pending && stage.status === 'completed';
        return (
          <div key={stage.status} className="flex items-center gap-1.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isPendingStage ? 'bg-amber-100 text-amber-700'
                : i < currentIndex || (i === currentIndex && isDone) ? 'bg-green-100 text-green-700'
                : i === currentIndex ? 'bg-brand-orange/15 text-brand-orange'
                : 'bg-gray-100 text-gray-400'
            }`}>
              {isPendingStage ? PENDING_LABEL : stage.label}
            </span>
            {i < INSTALLER_STAGES.length - 1 && (
              <span className={`w-3 h-px ${i < currentIndex ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function JobCard({ booking: b, pending, onStart, onRequestComplete }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
        <div>
          <h3 className="font-semibold">{b.service_name}</h3>
          <p className="text-sm text-gray-500">{b.category}</p>
        </div>
        <span className={`badge ${pending ? 'bg-amber-100 text-amber-700' : statusColor(b.status)}`}>{pending ? PENDING_LABEL : b.status.replace('_', ' ')}</span>
      </div>
      <div className="text-sm text-gray-600 space-y-1 mb-4">
        <p className="flex items-center gap-1"><Clock className="w-4 h-4" /> {b.scheduled_date} at {b.scheduled_time}</p>
        <p className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {b.address}</p>
        <p>Customer: {b.first_name} {b.last_name} · {b.phone}</p>
      </div>
      <div className="mb-3"><StatusStepper status={b.status} pending={pending} /></div>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-bold text-brand-orange">{formatPrice(b.price)}</span>
        {b.status === 'confirmed' && (
          <button onClick={() => onStart(b.id)} className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-lg flex items-center gap-1">
            <PlayCircle className="w-3.5 h-3.5" /> Confirm & Start Installation
          </button>
        )}
        {b.status === 'in_progress' && (
          pending ? (
            <span className="text-sm bg-amber-100 text-amber-800 px-3 py-1 rounded-lg flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Awaiting Coordinator Verification
            </span>
          ) : (
            <button onClick={onRequestComplete} className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Confirm Installed Completed
            </button>
          )
        )}
      </div>
    </div>
  );
}
