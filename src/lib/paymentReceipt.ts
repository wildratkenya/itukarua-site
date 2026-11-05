type ReceiptPayment = {
  id: string;
  amount: number;
  description?: string | null;
  mpesa_ref?: string | null;
  mpesa_phone?: string | null;
  created_at: string;
  payment_type: string;
  status: string;
};

const escapePdfText = (text: string): string => text
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const wrap = (text: string, width = 90): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach(word => {
    if (!word) return;
    if (!current) current = word;
    else if (current.length + word.length + 1 <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const createPdf = (content: string[]): Blob => {
  const lines = content.flatMap(line => line ? wrap(line) : ['']);
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48));
  if (!pages.length) pages.push(['No receipt details available.']);

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((page, pageIndex) => {
    const stream = ['BT', '/F1 10 Tf', '50 760 Td', ...page.flatMap((line, index) => [
      `(${escapePdfText(line)}) Tj`,
      ...(index < page.length - 1 ? ['0 -15 Td'] : []),
    ]), 'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + pageIndex * 2} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
  });

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(body).length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(body).length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([body], { type: 'application/pdf' });
};

export function downloadPaymentReceipt(payment: ReceiptPayment): void {
  if (payment.status !== 'completed') return;
  const date = new Date(payment.created_at);
  const lines = [
    'ITUKARUA PAYMENT RECEIPT',
    '=====================================',
    '',
    `Receipt number: ${payment.id}`,
    `Date: ${date.toLocaleString('en-KE')}`,
    `Payment type: ${payment.payment_type.replace(/_/g, ' ')}`,
    `Description: ${payment.description || '-'}`,
    `Amount: KES ${Number(payment.amount || 0).toLocaleString('en-KE')}`,
    `M-Pesa reference: ${payment.mpesa_ref || '-'}`,
    `M-Pesa phone: ${payment.mpesa_phone || '-'}`,
    'Status: PAID',
    '',
    'Thank you for your payment.',
  ];
  const url = URL.createObjectURL(createPdf(lines));
  const link = document.createElement('a');
  link.href = url;
  link.download = `itukarua-receipt-${payment.mpesa_ref || payment.id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
