import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, ShoppingCart, Calendar, Wallet, ArrowRight, Check, Plus, Pencil, Trash2, LogIn, Archive,
  Clock, PackageOpen, Truck, PackageCheck, CalendarCheck, Wrench, CircleCheckBig, AlertTriangle,
} from 'lucide-react';
import { api, formatPrice, statusColor } from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import RevenueColumns, { SERIES } from '../../components/admin/RevenueColumns';
import Pipeline from '../../components/admin/Pipeline';
import { useAuth } from '../../context/AuthContext';
import { ACTION_META, timeAgo } from '../../data/auditActions';

const CATEGORY_ICON = {
  create: { Icon: Plus, className: 'bg-green-100 text-green-600' },
  update: { Icon: Pencil, className: 'bg-amber-100 text-amber-600' },
  delete: { Icon: Trash2, className: 'bg-red-100 text-red-600' },
  login: { Icon: LogIn, className: 'bg-blue-100 text-blue-600' },
  archive: { Icon: Archive, className: 'bg-purple-100 text-purple-600' },
};

const [PRODUCTS, SERVICES] = SERIES;

// Each business line's stages, in the order work moves through them; the last is "done".
// A stage's tile opens its list page filtered to that status (both read ?tab=).
const ORDER_STAGES = [['pending', 'Pending', Clock], ['processing', 'Processing', PackageOpen], ['shipped', 'Shipped', Truck], ['delivered', 'Delivered', PackageCheck]];
const BOOKING_STAGES = [['pending', 'Pending', Clock], ['confirmed', 'Confirmed', CalendarCheck], ['in_progress', 'In progress', Wrench], ['completed', 'Completed', CircleCheckBig]];

const countIn = (breakdown, status) => breakdown?.find(r => r.status === status)?.count || 0;
const toStages = (stages, breakdown, page) => stages.map(([key, label, icon]) => ({ key, label, icon, count: countIn(breakdown, key), to: `${page}?tab=${key}` }));

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState(null);
  const [staff, setStaff] = useState([]);
  const [recentTab, setRecentTab] = useState('products');

  useEffect(() => {
    api.get('/admin/dashboard').then(setData).catch(() => {});
    api.get('/admin/audit-logs?limit=6').then(setActivity).catch(() => {});
    api.get('/admin/users').then(users => setStaff(users.filter(u => u.role !== 'customer'))).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminLayout title="Dashboard" subtitle={`Welcome back, ${user?.firstName || 'Admin'}.`}>
        <DashboardSkeleton />
      </AdminLayout>
    );
  }

  const { stats, orderStatusBreakdown, bookingStatusBreakdown, salesByMonth, recentOrders, recentBookings, lowStockProducts } = data;
  const nameOf = (id) => {
    const match = staff.find(u => u.id === id);
    return match && `${match.first_name} ${match.last_name}`;
  };

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const yearToDate = salesByMonth.filter(m => m.month <= currentMonth);
  const productsThisYear = yearToDate.reduce((sum, m) => sum + m.revenue, 0);
  const servicesThisYear = yearToDate.reduce((sum, m) => sum + (m.services || 0), 0);

  const orderStages = toStages(ORDER_STAGES, orderStatusBreakdown, '/admin/orders');
  const bookingStages = bookingStatusBreakdown && toStages(BOOKING_STAGES, bookingStatusBreakdown, '/admin/bookings');
  const ordersInProgress = orderStages.slice(0, -1).reduce((sum, s) => sum + s.count, 0);

  // Counts the backend doesn't send (an older deploy) simply drop off the list.
  const punchList = [
    { key: 'orders', label: 'Orders waiting to be processed', count: stats.pendingOrders, to: '/admin/orders?tab=pending' },
    { key: 'unassigned', label: 'Bookings without a technician', count: stats.unassignedBookings, to: '/admin/bookings' },
    { key: 'approvals', label: 'Approvals waiting on you', count: stats.pendingApprovals, to: '/admin/approvals' },
    { key: 'returns', label: 'Return requests to review', count: stats.pendingReturns, to: '/admin/returns' },
    { key: 'support', label: 'Open support messages', count: stats.openSupport, to: '/admin/support' },
    { key: 'stock', label: 'Products low or out of stock', count: (stats.lowStockCount ?? 0) + (stats.outOfStockCount ?? 0), to: '/admin/products' },
  ].filter(item => typeof item.count === 'number' && !Number.isNaN(item.count));
  const openItems = punchList.filter(item => item.count > 0).length;

  const firstName = user?.firstName || 'Admin';
  const subtitle = openItems > 0
    ? `Welcome back, ${firstName}. ${openItems} ${openItems === 1 ? 'item on the punch list needs' : 'items on the punch list need'} attention.`
    : `Welcome back, ${firstName}. The punch list is clear — nothing is waiting on you.`;

  return (
    <AdminLayout title="Dashboard" subtitle={subtitle}>
      <StockAlert lowCount={stats.lowStockCount ?? 0} outCount={stats.outOfStockCount ?? 0} products={lowStockProducts || []} />

      <Ledger
        cells={[
          { label: 'Total revenue', icon: Wallet, value: formatPrice(stats.revenue), note: 'Paid products and services, all time', className: 'col-span-6 lg:col-span-1' },
          { label: 'Customers', icon: Users, value: stats.totalCustomers.toLocaleString(), note: 'Registered accounts' },
          { label: 'Orders', icon: ShoppingCart, value: stats.totalOrders.toLocaleString(), note: `${ordersInProgress.toLocaleString()} in progress` },
          {
            label: 'Bookings', icon: Calendar, value: stats.totalBookings.toLocaleString(),
            note: bookingStages ? `${bookingStages.slice(0, -1).reduce((s, b) => s + b.count, 0).toLocaleString()} upcoming or underway` : `${stats.pendingBookings ?? 0} pending`,
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 mb-5">
            <div>
              <h3 className="font-semibold text-gray-900">Revenue</h3>
              <p className="text-xs text-gray-400">Paid orders and bookings by month, {now.getFullYear()}</p>
            </div>
            <dl className="flex items-start gap-5 text-xs">
              {[[PRODUCTS, productsThisYear], [SERVICES, servicesThisYear]].map(([s, total]) => (
                <div key={s.key}>
                  <dt className="flex items-center gap-1.5 text-gray-500"><span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />{s.label}</dt>
                  <dd className="mt-0.5 font-semibold text-gray-900">{formatPrice(total)}</dd>
                </div>
              ))}
              <div className="pl-5 border-l border-gray-200">
                <dt className="text-gray-500">This year</dt>
                <dd className="mt-0.5 text-base leading-tight font-semibold text-brand-ink">{formatPrice(productsThisYear + servicesThisYear)}</dd>
              </div>
            </dl>
          </div>
          <RevenueColumns data={salesByMonth} currentMonth={currentMonth} />
        </div>

        <PunchList items={punchList} />
      </div>

      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-gray-900">Fulfillment</h3>
        <p className="text-xs text-gray-400 mb-6">Where orders and bookings stand right now — open a stage to see what's in it</p>
        {/* Stacked, each at full width: four stage tiles need the room to stay readable. */}
        <div className="space-y-7">
          <Pipeline
            title="Product orders"
            color={PRODUCTS.color}
            stages={orderStages}
            offTrack={{ label: 'cancelled', count: countIn(orderStatusBreakdown, 'cancelled') }}
            to="/admin/orders"
            linkLabel="Manage orders"
          />
          {bookingStages && (
            <div className="pt-7 border-t border-gray-100">
              <Pipeline
                title="Service bookings"
                color={SERVICES.color}
                stages={bookingStages}
                offTrack={{ label: 'cancelled', count: countIn(bookingStatusBreakdown, 'cancelled') }}
                to="/admin/bookings"
                linkLabel="Manage bookings"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 lg:items-start gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent {recentTab === 'products' ? 'orders' : 'bookings'}</h3>
              <p className="text-xs text-gray-400">The latest five, newest first</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" role="group" aria-label="Show recent">
                {[['products', 'Products'], ['services', 'Services']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRecentTab(key)}
                    aria-pressed={recentTab === key}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${recentTab === key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Link
                to={recentTab === 'products' ? '/admin/orders' : '/admin/bookings'}
                className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {recentTab === 'products' ? (
            recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Order ID</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map(o => (
                      <tr key={o.id} className="border-t border-gray-100">
                        <td className="py-2.5">{o.first_name} {o.last_name}</td>
                        <td className="py-2.5 text-gray-500 font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</td>
                        <td className="py-2.5"><span className={`badge capitalize ${statusColor(o.status)}`}>{o.status}</span></td>
                        <td className="py-2.5 text-right font-medium tabular-nums">{formatPrice(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            recentBookings.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No bookings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Service</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map(b => (
                      <tr key={b.id} className="border-t border-gray-100">
                        <td className="py-2.5">{b.first_name} {b.last_name}</td>
                        <td className="py-2.5 text-gray-600">{b.service_name}</td>
                        <td className="py-2.5"><span className={`badge capitalize ${statusColor(b.status)}`}>{b.status.replace('_', ' ')}</span></td>
                        <td className="py-2.5 text-right font-medium tabular-nums">{formatPrice(b.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recent activity</h3>
              <p className="text-xs text-gray-400">Latest staff actions in your system</p>
            </div>
            <Link to="/admin/audit-log" className="text-xs font-semibold text-brand-navy hover:text-brand-orange transition flex items-center gap-1 whitespace-nowrap">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!activity ? (
            <div className="space-y-4" aria-hidden="true">
              {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-9" />)}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No activity recorded yet.</p>
          ) : (
            <ol className="relative">
              {activity.map((log, i) => {
                const meta = ACTION_META[log.action];
                const { Icon, className } = CATEGORY_ICON[meta?.category] || { Icon: Pencil, className: 'bg-gray-100 text-gray-600' };
                return (
                  <li key={log.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                    {/* The thread between events, stopping at the last one. */}
                    {i < activity.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" aria-hidden="true" />}
                    <div className={`relative w-8 h-8 rounded-full ring-4 ring-white flex items-center justify-center shrink-0 ${className}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm text-gray-800 leading-snug line-clamp-2">{meta && log.details ? meta.describe(log.details, nameOf) : log.action}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{log.first_name ? `${log.first_name} ${log.last_name}` : 'Deleted user'} · {timeAgo(log.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// The headline totals as one ruled strip — cells share hairlines rather than floating as
// separate boxes. On phones revenue takes the first row and the three counts share the next.
function Ledger({ cells }) {
  return (
    <div className="grid grid-cols-6 lg:grid-cols-4 gap-px mb-6 rounded-2xl overflow-hidden border border-[#e4e8f0] bg-[#e4e8f0] shadow-[0_1px_2px_rgba(15,43,91,0.04)]">
      {cells.map(c => (
        <div key={c.label} className={`bg-white p-4 sm:p-5 min-w-0 ${c.className || 'col-span-2 lg:col-span-1'}`}>
          <p className="flex items-center gap-1.5 text-sm text-gray-500 truncate"><c.icon className="hidden sm:block w-4 h-4 text-gray-400 shrink-0" /> {c.label}</p>
          <p className="mt-2 text-2xl sm:text-[1.75rem] leading-tight font-semibold tracking-tight text-brand-ink">{c.value}</p>
          {c.note && <p className="mt-1 text-xs text-gray-400">{c.note}</p>}
        </div>
      ))}
    </div>
  );
}

// Products that have run out or are about to (5 or fewer left), emptiest first; each name opens
// Products filtered to it so it can be restocked. While every product is stocked it stays as a
// quiet one-line all-clear, so the admin can tell "nothing is low" from "the check is missing".
function StockAlert({ lowCount, outCount, products }) {
  const total = lowCount + outCount;
  if (total === 0) {
    return (
      <section aria-label="Stock levels" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#e4e8f0] bg-white px-4 py-3 sm:px-5 shadow-[0_1px_2px_rgba(15,43,91,0.04)]">
        <span className="w-9 h-9 rounded-lg bg-brand-navy/[0.06] text-brand-navy flex items-center justify-center shrink-0" aria-hidden="true">
          <PackageCheck className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-[12rem]">
          <h3 className="font-semibold text-gray-900">All products are well stocked</h3>
          <p className="text-xs text-gray-400">No product is at 5 units or fewer — low stock will show here</p>
        </div>
        <Link to="/admin/products" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:text-brand-orange transition whitespace-nowrap">
          View products <ArrowRight className="w-3 h-3" />
        </Link>
      </section>
    );
  }
  const summary = [
    outCount > 0 && `${outCount.toLocaleString()} out of stock`,
    lowCount > 0 && `${lowCount.toLocaleString()} running low`,
  ].filter(Boolean).join(' · ');
  const more = total - products.length;
  return (
    <section aria-label="Low stock alert" className="mb-6 rounded-2xl border border-[#ffd8c6] bg-[#fff6f1] p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="w-9 h-9 rounded-lg bg-brand-orange/15 text-[#c8461a] flex items-center justify-center shrink-0" aria-hidden="true">
          <AlertTriangle className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-[12rem]">
          <h3 className="font-semibold text-[#a2401a]">Low stock alert</h3>
          <p className="text-xs text-[#a2401a]/80">{summary} — 5 or fewer units counts as low</p>
        </div>
        <Link to="/admin/products" className="inline-flex items-center gap-1 text-xs font-semibold text-[#c8461a] hover:text-[#a2401a] transition whitespace-nowrap pt-1">
          Review stock <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {products.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 sm:pl-[3.25rem]">
          {products.map(p => (
            <li key={p.id} className="min-w-0 max-w-full">
              <Link
                to={`/admin/products?search=${encodeURIComponent(p.name)}`}
                className="flex items-center gap-2 max-w-full rounded-lg border border-[#ffd8c6] bg-white pl-3 pr-1.5 py-1 text-sm text-gray-800 hover:border-[#ffb796] transition"
              >
                <span className="truncate">{p.name}</span>
                <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums ${p.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.stock <= 0 ? 'Out' : `${p.stock} left`}
                </span>
              </Link>
            </li>
          ))}
          {more > 0 && (
            <li>
              <Link to="/admin/products" className="flex items-center rounded-lg px-2 py-1 text-sm font-medium text-[#c8461a] hover:text-[#a2401a] transition">
                +{more.toLocaleString()} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

// Work waiting on someone, in the builder's sense: every open item is a box to tick, and it
// ticks itself once its count reaches zero. Open items come first and link to where the work
// gets done; cleared ones sink to the bottom.
function PunchList({ items }) {
  const cleared = items.filter(i => i.count === 0);
  const open = items.filter(i => i.count > 0);
  return (
    <div className="card p-6 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Punch list</h3>
          <p className="text-xs text-gray-400">Work waiting on someone right now</p>
        </div>
        <p className="text-xs text-gray-500 whitespace-nowrap pt-0.5">
          <span className="font-semibold text-gray-900">{cleared.length}</span> of {items.length} clear
        </p>
      </div>
      <div className="flex gap-1 mt-3 mb-3" aria-hidden="true">
        {items.map((item, i) => <span key={item.key} className={`h-1 flex-1 rounded-full ${i < cleared.length ? 'bg-brand-navy' : 'bg-gray-200'}`} />)}
      </div>
      <ul className="-mx-2">
        {open.map(item => (
          <li key={item.key}>
            <Link to={item.to} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50 transition">
              <span className="w-[18px] h-[18px] rounded-[5px] border-2 border-gray-300 group-hover:border-brand-orange transition shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-0 text-sm text-gray-800">{item.label}</span>
              <span className="min-w-[1.75rem] px-1.5 py-0.5 rounded-md bg-[#fff1ea] text-[#b9461b] text-xs font-semibold text-center tabular-nums">{item.count.toLocaleString()}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-orange transition shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
        {cleared.map(item => (
          <li key={item.key} className="flex items-center gap-3 px-2 py-2.5">
            <span className="w-[18px] h-[18px] rounded-[5px] bg-brand-navy flex items-center justify-center shrink-0" aria-hidden="true">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </span>
            <span className="flex-1 text-sm text-gray-400 line-through decoration-gray-300">{item.label}</span>
            <span className="sr-only">— clear</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton h-[7.5rem] rounded-2xl mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="skeleton h-80 rounded-2xl lg:col-span-2" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
      <div className="skeleton h-44 rounded-2xl" />
    </div>
  );
}
