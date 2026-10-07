import { downloadCsv } from './csv';

// The report periods offered on Reports → Supplier Reports. Ranges are browser-local calendar
// days, sent as YYYY-MM-DD; the backend reads them as Manila days. "To date" presets end today.
export const PERIOD_PRESETS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'this_year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function periodRange(preset, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = ymd(now);
  switch (preset) {
    case 'this_month': return { from: ymd(new Date(y, m, 1)), to: today };
    case 'last_month': return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'this_quarter': return { from: ymd(new Date(y, m - (m % 3), 1)), to: today };
    case 'this_year': return { from: ymd(new Date(y, 0, 1)), to: today };
    default: return { from: null, to: null };
  }
}

// 'YYYY-MM-DD' parsed as a local date — new Date('2026-10-01') would be UTC midnight and can
// land on the previous day once formatted.
function parseYmd(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const formatDay = (value) => (value ? parseYmd(value).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function periodLabel({ from, to } = {}) {
  if (!from && !to) return 'All time';
  if (from && to) return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
  return from ? `From ${formatDay(from)}` : `Up to ${formatDay(to)}`;
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

export const orderRef = (id) => `#${String(id).slice(0, 8).toUpperCase()}`;
export const returnRef = (id) => `RET-${String(id).slice(0, 8).toUpperCase()}`;

export function reportFileBase(report) {
  const slug = report.supplier.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'supplier';
  const { from, to } = report.period;
  return `homelink-${slug}-report-${from || to ? `${from || 'start'}-to-${to || 'today'}` : 'all-time'}`;
}

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

// One file, several blocks separated by blank rows — the same sections as the PDF, but with plain
// numbers so the supplier can total and filter them in a spreadsheet.
export function downloadSupplierReportCsv(report) {
  const { supplier, period, totals, products, months, sales, returns } = report;
  const rows = [
    ['HomeLink Supplier Sales Report'],
    ['Supplier', supplier.name],
    ['Contact', supplier.contact_name || ''],
    ['Email', supplier.email || ''],
    ['Phone', supplier.phone || ''],
    ['Partner since', supplier.partner_since ? formatDay(supplier.partner_since) : ''],
    ['Period', periodLabel(period)],
    ['Generated', new Date(report.generatedAt).toLocaleString('en-PH')],
    [],
    ['Summary'],
    ['Orders', totals.orders],
    ['Units sold', totals.units_sold],
    ['Gross sales (PHP)', money(totals.gross_sales)],
    ['Returned units', totals.returned_units],
    ['Returns value (PHP)', money(totals.returned_value)],
    ['Net units', totals.net_units],
    ['Net sales (PHP)', money(totals.net_sales)],
    [],
    ['Product performance'],
    ['Product', 'Model / SKU', 'Category', 'Selling price (PHP)', 'Units sold', 'Gross sales (PHP)', 'Returned units', 'Returns value (PHP)', 'Net units', 'Net sales (PHP)', 'Stock on hand', 'Rating', 'Reviews', 'Listing'],
    ...products.map(p => [
      p.name, p.model || '', p.category || '', money(p.price), p.units_sold, money(p.gross_sales), p.returned_units,
      money(p.returned_value), p.net_units, money(p.net_sales), p.stock, p.avg_rating ?? '', p.review_count,
      p.archived ? 'Archived' : p.status === 'inactive' ? 'Hidden' : 'Listed',
    ]),
    [],
    ['Monthly summary'],
    ['Month', 'Orders', 'Units sold', 'Gross sales (PHP)', 'Returned units', 'Returns value (PHP)', 'Net units', 'Net sales (PHP)'],
    ...months.map(m => [monthLabel(m.month), m.orders, m.units_sold, money(m.gross_sales), m.returned_units, money(m.returned_value), m.net_units, money(m.net_sales)]),
    [],
    ['Sales ledger'],
    ['Date', 'Order', 'Product', 'Model / SKU', 'Qty', 'Unit price (PHP)', 'Line total (PHP)'],
    ...sales.map(s => [new Date(s.created_at).toLocaleDateString('en-PH'), orderRef(s.order_id), s.product_name, s.model || '', s.quantity, money(s.price), money(s.quantity * s.price)]),
    [],
    ['Returns received'],
    ['Date received', 'Return', 'Order', 'Product', 'Model / SKU', 'Qty', 'Unit price (PHP)', 'Value (PHP)'],
    ...returns.map(r => [new Date(r.received_at).toLocaleDateString('en-PH'), returnRef(r.return_id), orderRef(r.order_id), r.product_name, r.model || '', r.quantity, money(r.unit_price), money(r.quantity * r.unit_price)]),
  ];
  downloadCsv(`${reportFileBase(report)}.csv`, null, rows);
}
