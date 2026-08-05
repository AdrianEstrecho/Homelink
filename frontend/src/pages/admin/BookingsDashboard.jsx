import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, UserX, CheckCircle, ArrowRight } from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../context/AuthContext';

export default function BookingsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/bookings/stats').then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { totalBookings, unassignedCount, todayCount, statusBreakdown, upcomingBookings } = data;
  const countOf = (status) => statusBreakdown.find(r => r.status === status)?.count || 0;
  const cards = [
    { label: 'Total Bookings', value: totalBookings, icon: Calendar },
    { label: "Today's Jobs", value: todayCount, icon: Clock },
    { label: 'Unassigned', value: unassignedCount, icon: UserX },
    { label: 'Completed', value: countOf('completed'), icon: CheckCircle },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'there'}. Here's your booking & scheduling overview.`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className="card p-4">
            <div className="w-10 h-10 bg-brand-navy/10 rounded-lg flex items-center justify-center mb-3">
              <c.icon className="w-5 h-5 text-brand-navy" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Upcoming Bookings</h3>
            <p className="text-xs text-gray-400">Pending and confirmed jobs, soonest first</p>
          </div>
          <Link to="/admin/bookings" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap">
            Manage bookings <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {upcomingBookings.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No upcoming bookings.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="font-medium pb-2">Customer</th>
                  <th className="font-medium pb-2">Service</th>
                  <th className="font-medium pb-2">Date</th>
                  <th className="font-medium pb-2">Status</th>
                  <th className="font-medium pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {upcomingBookings.map(b => (
                  <tr key={b.id} className="border-t border-gray-100">
                    <td className="py-2.5">{b.first_name} {b.last_name}</td>
                    <td className="py-2.5 text-gray-600">{b.service_name}</td>
                    <td className="py-2.5 text-gray-600">{b.scheduled_date} &middot; {b.scheduled_time}</td>
                    <td className="py-2.5"><span className={`badge ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span></td>
                    <td className="py-2.5 text-right font-medium">{formatPrice(b.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
