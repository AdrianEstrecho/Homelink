import { jsPDF } from 'jspdf';
import { paymentMethodLabel } from '../constants/paymentMethods';

const NAVY = '#0f2b5b';
const ORANGE = '#ff6b35';
const GRAY = '#6b7280';
const INK = '#1f2937';
const LINE = '#c7cad1';

// A narrow strip rather than a full A4 page — closer to what actually prints out of a
// receipt printer, and it reads as a receipt at a glance instead of a corporate invoice.
const WIDTH = 320;
const MARGIN = 24;
const CONTENT_WIDTH = WIDTH - MARGIN * 2;
const RIGHT = WIDTH - MARGIN;
const CENTER = WIDTH / 2;

// jsPDF's standard fonts can't render the ₱ glyph, so PDFs spell out "PHP" instead.
const pdfMoney = (n) => `PHP ${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function dashedRule(doc, y) {
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.75);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(MARGIN, y, RIGHT, y);
  doc.setLineDashPattern([], 0);
}

function totalRule(doc, y) {
  doc.setDrawColor(NAVY);
  doc.setLineWidth(1.3);
  doc.line(MARGIN, y, RIGHT, y);
  doc.line(MARGIN, y + 2.4, RIGHT, y + 2.4);
  doc.setLineWidth(1);
}

// Draws the full receipt starting at y and returns the y position it ended at. Called twice
// by downloadReceiptPdf — once on a throwaway tall page to measure how much height this
// particular order actually needs (item count and address length vary), then again on a
// page sized to exactly that, so the downloaded PDF is a snug strip, not a mostly-blank page.
function drawReceipt(doc, order, person, personLabel) {
  let y = 36;

  doc.setFont('courier', 'bold');
  doc.setFontSize(19);
  const homeWidth = doc.getTextWidth('Home');
  const linkWidth = doc.getTextWidth('Link');
  const logoStart = CENTER - (homeWidth + linkWidth) / 2;
  doc.setTextColor(NAVY);
  doc.text('Home', logoStart, y);
  doc.setTextColor(ORANGE);
  doc.text('Link', logoStart + homeWidth, y);

  y += 13;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY);
  doc.text('HOME IMPROVEMENT & SERVICES', CENTER, y, { align: 'center' });

  y += 14;
  dashedRule(doc, y);
  y += 16;

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(INK);
  doc.text('OFFICIAL RECEIPT', CENTER, y, { align: 'center' });
  y += 16;

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(NAVY);
  doc.text(`ORDER #${order.id.slice(0, 8).toUpperCase()}`, CENTER, y, { align: 'center' });
  y += 13;
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(GRAY);
  doc.text(new Date(order.created_at).toLocaleString('en-PH'), CENTER, y, { align: 'center' });
  y += 12;
  doc.text(`${capitalize(order.status)}  ·  ${capitalize(order.payment_status)}`, CENTER, y, { align: 'center' });
  y += 16;
  dashedRule(doc, y);
  y += 18;

  if (person) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY);
    doc.text(personLabel.toUpperCase(), MARGIN, y);
    y += 12;
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text(person.name, MARGIN, y);
    y += 12;
    if (person.email) {
      doc.text(person.email, MARGIN, y);
      y += 12;
    }
    y += 6;
    dashedRule(doc, y);
    y += 18;
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY);
  doc.text('ITEMS', MARGIN, y);
  y += 14;

  order.items?.forEach((i) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(INK);
    const nameLines = doc.splitTextToSize(i.name, CONTENT_WIDTH - 72);
    nameLines.forEach((line, idx) => {
      doc.text(line, MARGIN, y);
      if (idx === 0) doc.text(pdfMoney(i.price * i.quantity), RIGHT, y, { align: 'right' });
      y += 11;
    });
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GRAY);
    doc.text(`${i.quantity} x ${pdfMoney(i.price)}`, MARGIN, y);
    y += 16;
  });

  dashedRule(doc, y);
  y += 18;

  if (order.shipping_address) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY);
    doc.text('SHIPPING ADDRESS', MARGIN, y);
    y += 12;
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.splitTextToSize(order.shipping_address, CONTENT_WIDTH).forEach((line) => {
      doc.text(line, MARGIN, y);
      y += 12;
    });
    y += 6;
  }

  if (order.payment_method) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY);
    doc.text('PAYMENT METHOD', MARGIN, y);
    y += 12;
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.text(paymentMethodLabel(order.payment_method), MARGIN, y);
    y += 12;
  }

  y += 4;
  dashedRule(doc, y);
  y += 18;

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor('#374151');
  doc.text('Subtotal', MARGIN, y);
  doc.text(pdfMoney(order.subtotal), RIGHT, y, { align: 'right' });
  y += 14;

  if (order.discount > 0) {
    doc.setTextColor('#16a34a');
    doc.text(`Discount${order.promo_code ? ` (${order.promo_code})` : ''}`, MARGIN, y);
    doc.text(`-${pdfMoney(order.discount)}`, RIGHT, y, { align: 'right' });
    y += 14;
  }

  y += 4;
  totalRule(doc, y);
  y += 18;

  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  doc.text('TOTAL', MARGIN, y);
  doc.setTextColor(ORANGE);
  doc.text(pdfMoney(order.total), RIGHT, y, { align: 'right' });
  y += 24;

  dashedRule(doc, y);
  y += 20;

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(INK);
  doc.text('THANK YOU FOR SHOPPING', CENTER, y, { align: 'center' });
  y += 12;
  doc.text('WITH HOMELINK!', CENTER, y, { align: 'center' });
  y += 18;

  doc.setFontSize(9);
  doc.setTextColor(LINE);
  doc.text('* * * * * * * * * * * * * *', CENTER, y, { align: 'center' });
  y += 20;

  return y;
}

export function downloadReceiptPdf(order, person, personLabel = 'Customer') {
  const probe = new jsPDF({ unit: 'pt', format: [WIDTH, 4000] });
  const finalY = drawReceipt(probe, order, person, personLabel);

  const doc = new jsPDF({ unit: 'pt', format: [WIDTH, finalY] });
  drawReceipt(doc, order, person, personLabel);
  doc.save(`homelink-receipt-${order.id.slice(0, 8).toUpperCase()}.pdf`);
}
