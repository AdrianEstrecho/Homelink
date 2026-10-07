import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, Handshake, ShoppingCart, Undo2, Wallet, Package, Star } from 'lucide-react';
import { api, formatPrice } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getStaffRole } from '../../constants/staffRoles';
import FilterTab from './FilterTab';
import StatTile from './StatTile';
import Pagination from '../Pagination';
import {
  PERIOD_PRESETS, periodRange, periodLabel, formatDay, monthLabel, orderRef, returnRef, downloadSupplierReportCsv,
} from '../../utils/supplierReport';

const LEDGER_PAGE_SIZE = 10;

const Spinner = () => (
  <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full" /></div>
);

function TableCard({ title, subtitle, children, footer }) {
  return (
    <div className="card overflow-x-auto">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
      {footer}
    </div>
  );
}

const th = 'p-3 font-medium';
const thRight = `${th} text-right`;

// Reports → Supplier Reports. Each partner supplier gets a report covering only the products
// linked to them; admin and HR download it (PDF to send, CSV for spreadsheets) and pass it on.
// `supplierId` lives in the page URL so a report can be linked to straight from Suppliers.
export default function SupplierReports({ supplierId, onSelectSupplier }) {
  const { user } = useAuth();
  const [preset, setPreset] = useState('this_year');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [list, setList] = useState(null);
  const [listError, setListError] = useState('');
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const period = useMemo(
    () => (preset === 'custom' ? { from: custom.from || null, to: custom.to || null } : periodRange(preset)),
    [preset, custom.from, custom.to],
  );
  const invalidRange = !!(period.from && period.to && period.from > period.to);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period.from) params.set('from', period.from);
    if (period.to) params.set('to', period.to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [period.from, period.to]);

  useEffect(() => {
    if (invalidRange) return undefined;
    let cancelled = false;
    setListError('');
    api.get(`/admin/reports/suppliers${query}`)
      .then(d => { if (!cancelled) setList(d); })
      .catch(err => { if (!cancelled) setListError(err.message); });
    return () => { cancelled = true; };
  }, [query, invalidRange]);

  // The last report stays on screen (dimmed) while a new period loads, so switching periods
  // doesn't blank the page — `key` says which request the data on screen belongs to.
  const reportKey = `${supplierId}${query}`;
  useEffect(() => {
    if (!supplierId || invalidRange) return undefined;
    let cancelled = false;
    setReportError('');
    setLedgerPage(1);
    api.get(`/admin/reports/suppliers/${supplierId}${query}`)
      .then(data => { if (!cancelled) setReport({ key: reportKey, data }); })
      .catch(err => { if (!cancelled) { setReport(null); setReportError(err.message); } });
    return () => { cancelled = true; };
  }, [supplierId, query, invalidRange, reportKey]);

  const shown = report && report.data.supplier.id === supplierId ? report.data : null;
  const loadingReport = !!supplierId && report?.key !== reportKey && !reportError;

  const roleTitle = getStaffRole(user?.role === 'admin' ? 'admin' : user?.position)?.title;
  const preparedBy = user ? [`${user.firstName} ${user.lastName}`, roleTitle].filter(Boolean).join(', ') : '';

  const exportPdf = async () => {
    if (!shown) return;
    setExporting(true);
    try {
      // jsPDF only loads when someone actually downloads, not with the Reports page.
      const { downloadSupplierReportPdf } = await import('../../utils/supplierReportPdf');
      downloadSupplierReportPdf(shown, preparedBy);
    } finally {
      setExporting(false);
    }
  };

  const periodBar = (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_PRESETS.map(p => (
          <FilterTab key={p.key} active={preset === p.key} onClick={() => setPreset(p.key)}>{p.label}</FilterTab>
        ))}
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label="From" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} className="input-field py-1.5 w-auto text-sm" />
            <span className="text-sm text-gray-400">to</span>
            <input type="date" aria-label="To" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} className="input-field py-1.5 w-auto text-sm" />
          </div>
        )}
      </div>
      {invalidRange
        ? <p role="alert" className="mt-2 text-sm text-red-600">The start date must be on or before the end date.</p>
        : <p className="mt-2 text-xs text-gray-400">Showing {periodLabel(period)}</p>}
    </div>
  );

  if (!supplierId) {
    return (
      <>
        {periodBar}
        {listError ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{listError}</p>
        ) : !list ? <Spinner /> : list.partners.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center"><Handshake className="w-6 h-6" /></div>
            <h3 className="font-semibold text-gray-900">No partner suppliers yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Mark a supplier as a partner on the Suppliers page, then pick that supplier on each of their products. Their sales report shows up here.
            </p>
            <Link to="/admin/suppliers" className="btn-primary inline-flex items-center gap-2 text-sm py-2 mt-4">Go to Suppliers <ArrowRight className="w-4 h-4" /></Link>
          </div>
        ) : (
          <TableCard
            title="Partner suppliers"
            subtitle={`Sales of each partner's products · ${periodLabel(period)}`}
            footer={list.otherSuppliers > 0 && (
              <p className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                {list.otherSuppliers} other supplier{list.otherSuppliers === 1 ? ' isn\'t a partner' : 's aren\'t partners'}, so {list.otherSuppliers === 1 ? 'it has' : 'they have'} no report.{' '}
                <Link to="/admin/suppliers" className="font-semibold text-brand-navy hover:text-brand-orange">Manage suppliers</Link>
              </p>
            )}
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className={th}>Supplier</th>
                  <th className={thRight}>Products</th>
                  <th className={thRight}>Orders</th>
                  <th className={thRight}>Net units</th>
                  <th className={thRight}>Net sales</th>
                  <th className={th}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {list.partners.map(p => (
                  <tr key={p.id} onClick={() => onSelectSupplier(p.id)} className="border-t border-gray-100 cursor-pointer hover:bg-gray-50/70 transition">
                    <td className="p-3">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{[p.category, p.contact_name].filter(Boolean).join(' · ') || (p.partner_since ? `Partner since ${formatDay(p.partner_since)}` : '—')}</p>
                    </td>
                    <td className="p-3 text-right text-gray-600">{p.product_count}</td>
                    <td className="p-3 text-right text-gray-600">{p.orders}</td>
                    <td className="p-3 text-right text-gray-600">{p.net_units}</td>
                    <td className="p-3 text-right font-medium">{formatPrice(p.net_sales)}</td>
                    <td className="p-3 text-right">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onSelectSupplier(p.id); }} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:text-brand-orange transition whitespace-nowrap">
                        Open report <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </>
    );
  }

  const backLink = (
    <button type="button" onClick={() => onSelectSupplier(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-brand-navy transition mb-3">
      <ArrowLeft className="w-3.5 h-3.5" /> All partners
    </button>
  );

  if (reportError) {
    return (
      <>
        {backLink}
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{reportError}</p>
      </>
    );
  }
  if (!shown) return <>{backLink}{periodBar}<Spinner /></>;

  const { supplier, totals, inventory, products, months, sales, returns } = shown;
  const ledgerPages = Math.max(1, Math.ceil(sales.length / LEDGER_PAGE_SIZE));
  const ledgerPageSafe = Math.min(ledgerPage, ledgerPages);
  const ledger = sales.slice((ledgerPageSafe - 1) * LEDGER_PAGE_SIZE, ledgerPageSafe * LEDGER_PAGE_SIZE);
  const contact = [supplier.contact_name, supplier.email, supplier.phone].filter(Boolean).join(' · ');

  return (
    <>
      {backLink}
      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-gray-900">{supplier.name}</h2>
              <span className="badge bg-orange-100 text-[#c8461a] gap-1">
                <Handshake className="w-3 h-3" /> Partner{supplier.partner_since ? ` since ${formatDay(supplier.partner_since)}` : ''}
              </span>
              {supplier.status === 'inactive' && <span className="badge bg-gray-100 text-gray-600">Inactive</span>}
            </div>
            <p className="text-sm text-gray-500 mt-1">{contact || 'No contact details on file'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => downloadSupplierReportCsv(shown)} disabled={loadingReport} className="btn-outline flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50">
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
            <button type="button" onClick={exportPdf} disabled={loadingReport || exporting} className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50">
              <Download className="w-4 h-4" /> {exporting ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>

      {periodBar}

      <div className={`transition-opacity ${loadingReport ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loadingReport}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatTile label="Net sales" value={formatPrice(totals.net_sales)} icon={Wallet} />
          <StatTile label="Net units sold" value={totals.net_units} icon={Package} />
          <StatTile label="Orders" value={totals.orders} icon={ShoppingCart} />
          <StatTile label="Units returned" value={totals.returned_units} icon={Undo2} />
        </div>
        <p className="text-xs text-gray-500 mb-6">
          {formatPrice(totals.gross_sales)} gross from {totals.units_sold} unit{totals.units_sold === 1 ? '' : 's'}, less {formatPrice(totals.returned_value)} in returns
          {' · '}{inventory.stockOnHand} in stock across {inventory.listed} listed product{inventory.listed === 1 ? '' : 's'}
          {inventory.lowStock + inventory.outOfStock > 0 && <span className="text-[#c8461a]"> · {inventory.lowStock} low, {inventory.outOfStock} out of stock</span>}
        </p>

        <div className="mb-6">
          <TableCard title="Product performance" subtitle={`${products.length} product${products.length === 1 ? '' : 's'} from ${supplier.name}`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className={th}>Product</th>
                  <th className={thRight}>Price</th>
                  <th className={thRight}>Sold</th>
                  <th className={thRight}>Gross</th>
                  <th className={thRight}>Returned</th>
                  <th className={thRight}>Net sales</th>
                  <th className={thRight}>Stock</th>
                  <th className={thRight}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      No products are linked to {supplier.name} yet. Pick them as the supplier when adding or editing a product.
                    </td>
                  </tr>
                ) : products.map(p => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="p-3">
                      <p className="text-gray-800 font-medium">
                        {p.name}
                        {p.archived && <span className="ml-1.5 badge bg-gray-100 text-gray-500">Archived</span>}
                        {!p.archived && p.status === 'inactive' && <span className="ml-1.5 badge bg-gray-100 text-gray-500">Hidden</span>}
                      </p>
                      <p className="text-xs text-gray-400">{[p.model, p.category].filter(Boolean).join(' · ') || '—'}</p>
                    </td>
                    <td className="p-3 text-right text-gray-600 whitespace-nowrap">{formatPrice(p.price)}</td>
                    <td className="p-3 text-right text-gray-600">{p.units_sold}</td>
                    <td className="p-3 text-right text-gray-600 whitespace-nowrap">{formatPrice(p.gross_sales)}</td>
                    <td className="p-3 text-right text-gray-600">{p.returned_units}</td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">{formatPrice(p.net_sales)}</td>
                    <td className={`p-3 text-right ${!p.archived && p.stock <= 0 ? 'text-red-600 font-medium' : !p.archived && p.stock <= 5 ? 'text-[#c8461a] font-medium' : 'text-gray-600'}`}>{p.stock}</td>
                    <td className="p-3 text-right text-gray-600 whitespace-nowrap">
                      {p.avg_rating != null
                        ? <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{p.avg_rating} <span className="text-xs text-gray-400">({p.review_count})</span></span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {products.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-800">
                    <td className="p-3">Total</td>
                    <td className="p-3" />
                    <td className="p-3 text-right">{totals.units_sold}</td>
                    <td className="p-3 text-right whitespace-nowrap">{formatPrice(totals.gross_sales)}</td>
                    <td className="p-3 text-right">{totals.returned_units}</td>
                    <td className="p-3 text-right whitespace-nowrap">{formatPrice(totals.net_sales)}</td>
                    <td className="p-3 text-right">{inventory.stockOnHand}</td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </TableCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TableCard title="Monthly summary" subtitle="Sales by month ordered, returns by month received">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className={th}>Month</th>
                  <th className={thRight}>Orders</th>
                  <th className={thRight}>Units</th>
                  <th className={thRight}>Returned</th>
                  <th className={thRight}>Net sales</th>
                </tr>
              </thead>
              <tbody>
                {months.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">No sales or returns in this period.</td></tr>
                ) : months.map(m => (
                  <tr key={m.month} className="border-t border-gray-100">
                    <td className="p-3 text-gray-800">{monthLabel(m.month)}</td>
                    <td className="p-3 text-right text-gray-600">{m.orders}</td>
                    <td className="p-3 text-right text-gray-600">{m.units_sold}</td>
                    <td className="p-3 text-right text-gray-600">{m.returned_units}</td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">{formatPrice(m.net_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>

          <TableCard title="Returns received" subtitle="Items customers sent back in this period">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className={th}>Received</th>
                  <th className={th}>Product</th>
                  <th className={thRight}>Qty</th>
                  <th className={thRight}>Value</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-400">No returns in this period.</td></tr>
                ) : returns.map(r => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-3 text-gray-600 whitespace-nowrap">
                      {new Date(r.received_at).toLocaleDateString('en-PH')}
                      <p className="text-xs text-gray-400">{returnRef(r.return_id)}</p>
                    </td>
                    <td className="p-3 text-gray-800">{r.product_name}</td>
                    <td className="p-3 text-right text-gray-600">{r.quantity}</td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">{formatPrice(r.quantity * r.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        </div>

        <TableCard
          title="Sales ledger"
          subtitle="Every sale of this supplier's products in the period — order numbers only, no customer details"
          footer={<Pagination page={ledgerPageSafe} totalPages={ledgerPages} total={sales.length} pageSize={LEDGER_PAGE_SIZE} onChange={setLedgerPage} />}
        >
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className={th}>Date</th>
                <th className={th}>Order</th>
                <th className={th}>Product</th>
                <th className={thRight}>Qty</th>
                <th className={thRight}>Unit price</th>
                <th className={thRight}>Line total</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No sales in this period.</td></tr>
              ) : ledger.map(s => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="p-3 text-gray-600 whitespace-nowrap">{new Date(s.created_at).toLocaleDateString('en-PH')}</td>
                  <td className="p-3 text-gray-600 font-mono text-xs">{orderRef(s.order_id)}</td>
                  <td className="p-3 text-gray-800">{s.product_name}</td>
                  <td className="p-3 text-right text-gray-600">{s.quantity}</td>
                  <td className="p-3 text-right text-gray-600 whitespace-nowrap">{formatPrice(s.price)}</td>
                  <td className="p-3 text-right font-medium whitespace-nowrap">{formatPrice(s.quantity * s.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <p className="mt-4 text-xs text-gray-400 leading-relaxed">
          Sales are paid, non-cancelled orders placed in the period, at each product's selling price before order-level vouchers or promos.
          Returns count in the period they were received back. Stock and ratings are as of today.
        </p>
      </div>
    </>
  );
}
