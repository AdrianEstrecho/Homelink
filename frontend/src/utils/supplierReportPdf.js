import { jsPDF } from 'jspdf';
import { formatDay, monthLabel, orderRef, periodLabel, reportFileBase, returnRef } from './supplierReport';

const NAVY = '#0f2b5b';
const ORANGE = '#ff6b35';
const GRAY = '#6b7280';
const INK = '#1f2937';
const LINE = '#e5e7eb';
const TINT = '#f3f5f9';

// A4 portrait — this one goes out to a supplier, so it reads as a business document rather
// than the receipt strip in receiptPdf.js.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const RIGHT = PAGE_W - MARGIN;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_SPACE = 48;
const BOTTOM = PAGE_H - FOOTER_SPACE;

// jsPDF's standard fonts can't render the ₱ glyph, so PDFs spell out "PHP" instead.
const num = (n, digits = 0) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const amount = (n) => num(n, 2);
const pdfMoney = (n) => `PHP ${amount(n)}`;

function font(doc, style, size, color = INK) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color);
}

// Wraps text to at most `max` lines, ending the last kept line with an ellipsis when some was
// cut — so a long product name visibly continues instead of silently stopping mid-phrase.
// Measures with whatever font is currently set.
function clampLines(doc, text, width, max) {
  const lines = doc.splitTextToSize(String(text ?? ''), width);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = kept[max - 1];
  while (last && doc.getTextWidth(`${last}…`) > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

function ensureSpace(doc, y, needed) {
  if (y + needed <= BOTTOM) return y;
  doc.addPage();
  return MARGIN;
}

function drawHeader(doc, report) {
  let y = MARGIN + 16;
  font(doc, 'bold', 22, NAVY);
  doc.text('Home', MARGIN, y);
  doc.setTextColor(ORANGE);
  doc.text('Link', MARGIN + doc.getTextWidth('Home'), y);
  font(doc, 'normal', 7.5, GRAY);
  doc.text('HOME IMPROVEMENT & SERVICES', MARGIN, y + 13);

  font(doc, 'bold', 13, NAVY);
  doc.text('SUPPLIER SALES REPORT', RIGHT, y - 4, { align: 'right' });
  font(doc, 'normal', 9, INK);
  doc.text(periodLabel(report.period), RIGHT, y + 10, { align: 'right' });
  font(doc, 'normal', 8, GRAY);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString('en-PH')}`, RIGHT, y + 22, { align: 'right' });

  y += 36;
  doc.setDrawColor(ORANGE);
  doc.setLineWidth(2);
  doc.line(MARGIN, y, RIGHT, y);
  doc.setLineWidth(0.5);
  return y + 24;
}

function drawParties(doc, report, preparedBy, y) {
  const { supplier } = report;
  const colW = CONTENT_W / 2;

  const block = (x, label, title, lines) => {
    let by = y;
    font(doc, 'bold', 7.5, GRAY);
    doc.text(label, x, by);
    by += 15;
    font(doc, 'bold', 13, NAVY);
    clampLines(doc, title, colW - 16, 2).forEach(line => { doc.text(line, x, by); by += 15; });
    font(doc, 'normal', 9, INK);
    lines.filter(Boolean).forEach(text => {
      clampLines(doc, text, colW - 16, 2).forEach(line => { doc.text(line, x, by); by += 12; });
    });
    return by;
  };

  const left = block(MARGIN, 'PREPARED FOR', supplier.name, [
    supplier.contact_name && `Attn: ${supplier.contact_name}`,
    supplier.email,
    supplier.phone,
    supplier.address,
    supplier.partner_since && `Partner since ${formatDay(supplier.partner_since)}`,
  ]);
  const right = block(MARGIN + colW, 'PREPARED BY', 'HomeLink', [
    preparedBy,
    'Sales of the products HomeLink sources from you.',
  ]);
  return Math.max(left, right) + 14;
}

function drawTiles(doc, tiles, y) {
  const gap = 10;
  const w = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
  const h = 54;
  tiles.forEach((t, i) => {
    const x = MARGIN + i * (w + gap);
    doc.setFillColor(t.accent ? '#fff4ee' : TINT);
    doc.roundedRect(x, y, w, h, 6, 6, 'F');
    font(doc, 'bold', 7, GRAY);
    doc.text(t.label.toUpperCase(), x + 10, y + 16);
    font(doc, 'bold', t.value.length > 16 ? 11 : 13, t.accent ? '#c8461a' : NAVY);
    doc.text(t.value, x + 10, y + 34);
    if (t.sub) {
      font(doc, 'normal', 7.5, GRAY);
      doc.text(t.sub, x + 10, y + 46);
    }
  });
  return y + h + 22;
}

function sectionTitle(doc, title, note, y) {
  y = ensureSpace(doc, y, 70);
  font(doc, 'bold', 11, NAVY);
  doc.text(title, MARGIN, y);
  if (note) {
    font(doc, 'normal', 8, GRAY);
    doc.text(note, RIGHT, y, { align: 'right' });
  }
  return y + 10;
}

// Draws a table, breaking onto new pages as needed and repeating the header row on each. Each
// column is { header, width, align?, value(row) -> string, sub?(row) -> string } — `sub` adds a
// smaller gray second line (a model number under a product name).
function drawTable(doc, columns, rows, y, { totalRow, empty } = {}) {
  const pad = 5;
  const headerH = 20;

  const drawHeaderRow = (top) => {
    doc.setFillColor(NAVY);
    doc.rect(MARGIN, top, CONTENT_W, headerH, 'F');
    font(doc, 'bold', 7.5, '#ffffff');
    let x = MARGIN;
    columns.forEach(c => {
      const tx = c.align === 'right' ? x + c.width - pad : x + pad;
      doc.text(c.header, tx, top + 13, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.width;
    });
    return top + headerH;
  };

  const layoutRow = (row) => columns.map(c => {
    font(doc, 'normal', 8.5);
    const main = clampLines(doc, c.value(row), c.width - pad * 2, 2);
    const sub = c.sub?.(row);
    return { main, sub: sub ? clampLines(doc, sub, c.width - pad * 2, 1) : [] };
  });

  const drawRow = (cells, top, h, { bold, fill } = {}) => {
    if (fill) {
      doc.setFillColor(fill);
      doc.rect(MARGIN, top, CONTENT_W, h, 'F');
    }
    let x = MARGIN;
    cells.forEach((cell, i) => {
      const c = columns[i];
      const align = c.align === 'right' ? 'right' : 'left';
      const tx = align === 'right' ? x + c.width - pad : x + pad;
      let ty = top + 13;
      font(doc, bold ? 'bold' : 'normal', 8.5, INK);
      cell.main.forEach(line => { doc.text(line, tx, ty, { align }); ty += 10; });
      font(doc, 'normal', 7, GRAY);
      cell.sub.forEach(line => { doc.text(line, tx, ty, { align }); ty += 9; });
      x += c.width;
    });
    doc.setDrawColor(LINE);
    doc.line(MARGIN, top + h, RIGHT, top + h);
  };

  y = ensureSpace(doc, y, headerH + 24);
  y = drawHeaderRow(y);

  if (rows.length === 0) {
    font(doc, 'normal', 8.5, GRAY);
    doc.text(empty || 'Nothing in this period.', MARGIN + pad, y + 15);
    return y + 44;
  }

  rows.forEach((row, idx) => {
    const cells = layoutRow(row);
    const lines = Math.max(...cells.map(cell => cell.main.length + cell.sub.length * 0.9));
    const h = Math.max(20, 8 + lines * 10);
    if (y + h > BOTTOM) {
      doc.addPage();
      y = drawHeaderRow(MARGIN);
    }
    drawRow(cells, y, h, { fill: idx % 2 ? '#fafbfc' : null });
    y += h;
  });

  if (totalRow) {
    const cells = columns.map(c => ({ main: [String(totalRow[c.key] ?? '')], sub: [] }));
    if (y + 20 > BOTTOM) {
      doc.addPage();
      y = drawHeaderRow(MARGIN);
    }
    drawRow(cells, y, 20, { bold: true, fill: TINT });
    y += 20;
  }
  return y + 22;
}

function drawNotes(doc, y) {
  y = ensureSpace(doc, y, 60);
  font(doc, 'bold', 8, GRAY);
  doc.text('HOW THESE FIGURES ARE COUNTED', MARGIN, y);
  y += 12;
  font(doc, 'normal', 8, GRAY);
  const notes = [
    'Sales are paid, non-cancelled HomeLink orders placed during the period, valued at each product\'s selling price before order-level vouchers or holiday promos.',
    'Returns are counted in the period the item was received back by HomeLink, so a return can relate to a sale from an earlier period.',
    'Stock on hand and ratings are as of the date this report was generated.',
  ];
  notes.forEach(n => {
    doc.splitTextToSize(`•  ${n}`, CONTENT_W).forEach(line => { doc.text(line, MARGIN, y); y += 11; });
  });
  return y;
}

function drawFooters(doc, report) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE);
    doc.line(MARGIN, PAGE_H - 34, RIGHT, PAGE_H - 34);
    font(doc, 'normal', 7.5, GRAY);
    const label = `HomeLink · Supplier sales report for ${report.supplier.name} · ${periodLabel(report.period)} · Confidential`;
    doc.text(doc.splitTextToSize(label, CONTENT_W - 70)[0], MARGIN, PAGE_H - 22);
    doc.text(`Page ${i} of ${pages}`, RIGHT, PAGE_H - 22, { align: 'right' });
  }
}

export function downloadSupplierReportPdf(report, preparedBy) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { totals, inventory, products, months, sales, returns } = report;

  let y = drawHeader(doc, report);
  y = drawParties(doc, report, preparedBy, y);

  y = drawTiles(doc, [
    { label: 'Net sales', value: pdfMoney(totals.net_sales), sub: `${pdfMoney(totals.gross_sales)} gross`, accent: true },
    { label: 'Units sold', value: num(totals.net_units), sub: `${num(totals.units_sold)} sold, ${num(totals.returned_units)} returned` },
    { label: 'Orders', value: num(totals.orders), sub: 'with your products' },
    { label: 'Stock on hand', value: num(inventory.stockOnHand), sub: `${inventory.listed} listed · ${inventory.outOfStock} out of stock` },
  ], y);

  y = sectionTitle(doc, 'Product performance', `${products.length} product${products.length === 1 ? '' : 's'} · amounts in PHP`, y);
  y = drawTable(doc, [
    { key: 'name', header: 'PRODUCT', width: 157, value: p => p.name, sub: p => [p.model, p.archived ? 'Archived' : p.status === 'inactive' ? 'Hidden' : null].filter(Boolean).join(' · ') },
    { key: 'price', header: 'PRICE', width: 60, align: 'right', value: p => amount(p.price) },
    { key: 'units_sold', header: 'SOLD', width: 38, align: 'right', value: p => num(p.units_sold) },
    { key: 'gross_sales', header: 'GROSS', width: 66, align: 'right', value: p => amount(p.gross_sales) },
    { key: 'returned_units', header: 'RET.', width: 34, align: 'right', value: p => num(p.returned_units) },
    { key: 'net_units', header: 'NET QTY', width: 44, align: 'right', value: p => num(p.net_units) },
    { key: 'net_sales', header: 'NET SALES', width: 70, align: 'right', value: p => amount(p.net_sales) },
    { key: 'stock', header: 'STOCK', width: 46, align: 'right', value: p => num(p.stock) },
  ], products, y, {
    empty: 'No products are linked to this supplier yet.',
    totalRow: {
      name: 'Total', price: '', units_sold: num(totals.units_sold), gross_sales: amount(totals.gross_sales),
      returned_units: num(totals.returned_units), net_units: num(totals.net_units), net_sales: amount(totals.net_sales), stock: num(inventory.stockOnHand),
    },
  });

  y = sectionTitle(doc, 'Monthly summary', 'amounts in PHP', y);
  y = drawTable(doc, [
    { key: 'month', header: 'MONTH', width: 95, value: m => monthLabel(m.month) },
    { key: 'orders', header: 'ORDERS', width: 55, align: 'right', value: m => num(m.orders) },
    { key: 'units_sold', header: 'UNITS SOLD', width: 65, align: 'right', value: m => num(m.units_sold) },
    { key: 'gross_sales', header: 'GROSS', width: 80, align: 'right', value: m => amount(m.gross_sales) },
    { key: 'returned_units', header: 'RETURNED', width: 60, align: 'right', value: m => num(m.returned_units) },
    { key: 'returned_value', header: 'RETURNS VALUE', width: 75, align: 'right', value: m => amount(m.returned_value) },
    { key: 'net_sales', header: 'NET SALES', width: 85, align: 'right', value: m => amount(m.net_sales) },
  ], months, y, { empty: 'No sales or returns in this period.' });

  y = sectionTitle(doc, 'Sales ledger', `${sales.length} line${sales.length === 1 ? '' : 's'} · amounts in PHP`, y);
  y = drawTable(doc, [
    { header: 'DATE', width: 72, value: s => new Date(s.created_at).toLocaleDateString('en-PH') },
    { header: 'ORDER', width: 72, value: s => orderRef(s.order_id) },
    { header: 'PRODUCT', width: 177, value: s => s.product_name, sub: s => s.model },
    { header: 'QTY', width: 40, align: 'right', value: s => num(s.quantity) },
    { header: 'UNIT PRICE', width: 72, align: 'right', value: s => amount(s.price) },
    { header: 'LINE TOTAL', width: 82, align: 'right', value: s => amount(s.quantity * s.price) },
  ], sales, y, { empty: 'No sales in this period.' });

  if (returns.length) {
    y = sectionTitle(doc, 'Returns received', `${returns.length} line${returns.length === 1 ? '' : 's'} · amounts in PHP`, y);
    y = drawTable(doc, [
      { header: 'RECEIVED', width: 72, value: r => new Date(r.received_at).toLocaleDateString('en-PH') },
      { header: 'RETURN', width: 82, value: r => returnRef(r.return_id), sub: r => `Order ${orderRef(r.order_id)}` },
      { header: 'PRODUCT', width: 167, value: r => r.product_name, sub: r => r.model },
      { header: 'QTY', width: 40, align: 'right', value: r => num(r.quantity) },
      { header: 'UNIT PRICE', width: 72, align: 'right', value: r => amount(r.unit_price) },
      { header: 'VALUE', width: 82, align: 'right', value: r => amount(r.quantity * r.unit_price) },
    ], returns, y);
  }

  drawNotes(doc, y);
  drawFooters(doc, report);
  doc.save(`${reportFileBase(report)}.pdf`);
}
