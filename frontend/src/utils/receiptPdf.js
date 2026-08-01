import { jsPDF } from 'jspdf';

const NAVY = '#0f2b5b';
const ORANGE = '#ff6b35';
const GRAY = '#6b7280';
const INK = '#1f2937';
const LINE = '#e5e7eb';

const MARGIN = 48;
const RIGHT = 595.28 - MARGIN;

// jsPDF's standard fonts can't render the ₱ glyph, so PDFs spell out "PHP" instead.
const pdfMoney = (n) => `PHP ${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;

export function downloadReceiptPdf(order, person, personLabel = 'Customer') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(NAVY);
  doc.text('Home', MARGIN, y);
  doc.setTextColor(ORANGE);
  doc.text('Link', MARGIN + doc.getTextWidth('Home'), y);

  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(GRAY);
  doc.text('OFFICIAL RECEIPT', MARGIN, y);

  y += 20;
  doc.setDrawColor(LINE);
  doc.line(MARGIN, y, RIGHT, y);
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(NAVY);
  doc.text(`Order #${order.id.slice(0, 8).toUpperCase()}`, MARGIN, y);

  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(GRAY);
  doc.text(new Date(order.created_at).toLocaleString(), MARGIN, y);

  y += 16;
  doc.text(`Status: ${capitalize(order.status)}    Payment: ${capitalize(order.payment_status)}`, MARGIN, y);

  y += 30;
  if (person) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(NAVY);
    doc.text(personLabel.toUpperCase(), MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(person.name, MARGIN, y);
    y += 13;
    if (person.email) {
      doc.text(person.email, MARGIN, y);
      y += 13;
    }
    y += 12;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(NAVY);
  doc.text('ITEMS', MARGIN, y);
  y += 12;
  doc.setDrawColor(LINE);
  doc.line(MARGIN, y, RIGHT, y);
  y += 20;

  order.items?.forEach(i => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(i.name, MARGIN, y);
    doc.text(pdfMoney(i.price * i.quantity), RIGHT, y, { align: 'right' });
    y += 13;
    doc.setFontSize(9);
    doc.setTextColor(GRAY);
    doc.text(`Qty ${i.quantity} x ${pdfMoney(i.price)}`, MARGIN, y);
    y += 20;
  });

  doc.setDrawColor(LINE);
  doc.line(MARGIN, y, RIGHT, y);
  y += 24;

  if (order.shipping_address) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(NAVY);
    doc.text('SHIPPING ADDRESS', MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(order.shipping_address, MARGIN, y);
    y += 24;
  }

  if (order.payment_method) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(NAVY);
    doc.text('PAYMENT METHOD', MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(capitalize(order.payment_method), MARGIN, y);
    y += 24;
  }

  doc.setDrawColor(LINE);
  doc.line(MARGIN, y, RIGHT, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor('#374151');
  doc.text('Subtotal', MARGIN, y);
  doc.text(pdfMoney(order.subtotal), RIGHT, y, { align: 'right' });
  y += 18;

  if (order.discount > 0) {
    doc.setTextColor('#16a34a');
    doc.text(`Discount${order.promo_code ? ` (${order.promo_code})` : ''}`, MARGIN, y);
    doc.text(`-${pdfMoney(order.discount)}`, RIGHT, y, { align: 'right' });
    y += 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  doc.text('Total', MARGIN, y);
  doc.setTextColor(ORANGE);
  doc.text(pdfMoney(order.total), RIGHT, y, { align: 'right' });
  y += 40;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(GRAY);
  doc.text('Thank you for shopping with HomeLink!', MARGIN, y);

  doc.save(`homelink-receipt-${order.id.slice(0, 8).toUpperCase()}.pdf`);
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
