const fs = require('fs');
const p = 'src/components/itukarua/AdminPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(!s.includes('Verify & Approve')){
  const marker = "{payment.mpesa_ref || 'N/A'}</TableCell>";
  if(s.includes(marker)){
    const repl = "{payment.mpesa_ref || 'N/A'}</TableCell>\n                        <TableCell>\n                          {(payment.status === 'pending_verification' || payment.payment_type === 'manual_submission') && payment.status !== 'completed' ? (\n                            <Button size=\"sm\" onClick={() => verifyManualPayment(payment)} disabled={verifyingPaymentId === payment.id} className=\"bg-emerald-600 hover:bg-emerald-700\">\n                              {verifyingPaymentId === payment.id ? 'Verifying...' : 'Verify & Approve'}\n                            </Button>\n                          ) : (\n                            <span className=\"text-xs text-gray-400\">-</span>\n                          )}\n                        </TableCell>";
    s = s.replace(marker, repl);
    fs.writeFileSync(p,s);
    console.log('ok');
  }else console.log('no');
}else console.log('has');
