import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Wallet, TrendingUp, Users, ArrowRight } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import RevenueChart from '../../components/admin/RevenueChart';
import { useAuth } from '../../context/AuthContext';

export default function PayrollDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/payroll/stats').then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminLayout title="Dashboard">
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
      </AdminLayout>
    );
  }

  const { revenue, salesByMonth, totalPayroll, employeeCount, netRevenue } = data;
  const cards = [
    { label: 'Total Revenue', value: formatPrice(revenue), icon: DollarSign },
    { label: 'Total Payroll', value: formatPrice(totalPayroll), icon: Wallet },
    { label: 'Net (Revenue − Payroll)', value: formatPrice(netRevenue), icon: TrendingUp },
    { label: 'Employees Paid', value: employeeCount, icon: Users },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'there'}. Here's the company's financial overview.`}>
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
            <h3 className="font-semibold text-gray-900">Revenue Overview</h3>
            <p className="text-xs text-gray-400">Monthly performance for the current year</p>
          </div>
          <Link to="/admin/payroll" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap">
            Manage salaries <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <RevenueChart data={salesByMonth} />
      </div>
    </AdminLayout>
  );
}
