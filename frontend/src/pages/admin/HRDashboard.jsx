import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Truck, Wrench, ArrowRight, UserCog } from 'lucide-react';
import { api } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { POSITION_LABELS } from '../../data/auditActions';

export default function HRDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/hr/stats').then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { totalEmployees, totalCustomers, positionBreakdown, supplierStats, recentHires } = data;
  const installerCount = positionBreakdown.find(p => p.position === 'installer')?.count || 0;
  const cards = [
    { label: 'Total Employees', value: totalEmployees, icon: Users },
    { label: 'Customers (Onboarding Pool)', value: totalCustomers, icon: UserPlus },
    { label: 'Active Suppliers', value: `${supplierStats.active} / ${supplierStats.total}`, icon: Truck },
    { label: 'Installers / Technicians', value: installerCount, icon: Wrench },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'there'}. Here's your workforce and vendor overview.`}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Link to="/admin/hr/employees" className="card p-5 flex items-center justify-between hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center"><UserCog className="w-5 h-5 text-[#00806f]" /></div>
            <div>
              <p className="font-semibold text-gray-900">Manage Employees</p>
              <p className="text-xs text-gray-400">Onboard, promote, and manage staff accounts</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>
        <Link to="/admin/suppliers" className="card p-5 flex items-center justify-between hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center"><Truck className="w-5 h-5 text-brand-orange" /></div>
            <div>
              <p className="font-semibold text-gray-900">Manage Suppliers</p>
              <p className="text-xs text-gray-400">Add, update, and review vendor accounts</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Recent Hires</h3>
            <p className="text-xs text-gray-400">Latest employees onboarded</p>
          </div>
          <Link to="/admin/hr/employees" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap">
            Manage employees <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recentHires.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No employees onboarded yet.</p>
        ) : (
          <div className="space-y-3">
            {recentHires.map(h => (
              <div key={h.id} className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 first:border-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{h.first_name} {h.last_name}</p>
                  <p className="text-xs text-gray-400 truncate">{h.email} · {h.staff_code || '—'}</p>
                </div>
                <span className="badge bg-gray-100 text-gray-700 shrink-0">{h.position ? POSITION_LABELS[h.position] || h.position : 'No position'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
