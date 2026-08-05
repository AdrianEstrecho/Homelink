import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, MessageSquare, Mail, Phone } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function Technicians() {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState(null);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api.get('/admin/users?role=employee&position=installer').then(setTechnicians).catch(() => {});
    api.get('/admin/bookings').then(setBookings).catch(() => {});
  }, []);

  const activeJobCount = (technicianId) =>
    bookings.filter(b => b.employee_id === technicianId && !['completed', 'cancelled'].includes(b.status)).length;

  return (
    <AdminLayout title="Technicians" subtitle="Installer and technician contact info — message them directly about a job.">
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
