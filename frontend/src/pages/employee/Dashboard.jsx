import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, Clock, MapPin, UserCircle } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);

  const load = () => api.get('/employee/dashboard').then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    const notes = status === 'completed' ? prompt('Completion notes (optional):') || '' : '';
    await api.put(`/employee/bookings/${id}/status`, { status, completionNotes: notes });
    load();
  };

  if (!data) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-navy mb-2">Employee Dashboard</h1>
          <p className="text-gray-600">Manage your assigned service jobs</p>
        </div>
        <Link to="/employee/profile" className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange transition">
          <UserCircle className="w-5 h-5" /> My Profile
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-4 text-center"><p className="text-2xl font-bold">{data.stats.total}</p><p className="text-sm text-gray-500">Total Jobs</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{data.stats.pending}</p><p className="text-sm text-gray-500">Active</p></div>
        <div className="card p-4 text-center"><p className="text-2xl font-bold text-green-600">{data.stats.completed}</p><p className="text-sm text-gray-500">Completed</p></div>
      </div>

      {data.todayJobs.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-brand-orange" /> Today's Jobs</h2>
          <div className="space-y-3">
            {data.todayJobs.map(b => <JobCard key={b.id} booking={b} onUpdate={updateStatus} />)}
          </div>
        </div>
      )}

      <h2 className="font-semibold text-lg mb-4">All Assigned Jobs</h2>
      {data.assigned.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No jobs assigned yet. Check back after admin assigns bookings.</p>
      ) : (
        <div className="space-y-3">
          {data.assigned.map(b => <JobCard key={b.id} booking={b} onUpdate={updateStatus} />)}
        </div>
      )}
    </div>
  );
}

function JobCard({ booking: b, onUpdate }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
        <div>
          <h3 className="font-semibold">{b.service_name}</h3>
          <p className="text-sm text-gray-500">{b.category}</p>
        </div>
        <span className={`badge ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span>
      </div>
      <div className="text-sm text-gray-600 space-y-1 mb-4">
        <p className="flex items-center gap-1"><Clock className="w-4 h-4" /> {b.scheduled_date} at {b.scheduled_time}</p>
        <p className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {b.address}</p>
        <p>Customer: {b.first_name} {b.last_name} · {b.phone}</p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-bold text-brand-orange">{formatPrice(b.price)}</span>
        {b.status === 'confirmed' && (
          <button onClick={() => onUpdate(b.id, 'in_progress')} className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-lg">Start Job</button>
        )}
        {b.status === 'in_progress' && (
          <button onClick={() => onUpdate(b.id, 'completed')} className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-lg flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Complete</button>
        )}
      </div>
    </div>
  );
}
