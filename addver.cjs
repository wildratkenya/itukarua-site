const fs = require('fs');
const p = 'src/components/itukarua/AdminPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('verifyManualPayment')){console.log('has');process.exit(0);}
const marker = "const loadData = async () => {";
if(!s.includes(marker)){console.log('no');process.exit(0);}
const fn = `
  const verifyManualPayment = async (payment: any) => {
    if (!payment?.mpesa_ref) {
      setPaymentVerifyMsg({ type: 'err', text: 'No M-Pesa transaction ID on this payment.' });
      return;
    }
    const refNorm = payment.mpesa_ref.trim().toUpperCase();
    setVerifyingPaymentId(payment.id);
    setPaymentVerifyMsg(null);
    try {
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('status', 'completed')
        .neq('id', payment.id)
        .ilike('mpesa_ref', refNorm)
        .limit(1);
      if (existing && existing.length > 0) {
        setPaymentVerifyMsg({ type: 'err', text: 'This M-Pesa transaction ID has already been used and cannot be approved again.' });
        setVerifyingPaymentId(null);
        return;
      }
      const { error } = await supabase
        .from('payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment.id);
      if (error) {
        if (error.code === '23505') {
          setPaymentVerifyMsg({ type: 'err', text: 'This M-Pesa transaction ID has already been used and cannot be approved again.' });
        } else {
          setPaymentVerifyMsg({ type: 'err', text: error.message });
        }
        setVerifyingPaymentId(null);
        return;
      }
      setPaymentVerifyMsg({ type: 'ok', text: 'Payment verified and marked as completed.' });
      await loadData();
    } catch (e: any) {
      setPaymentVerifyMsg({ type: 'err', text: e?.message || 'Failed to verify payment' });
    }
    setVerifyingPaymentId(null);
  };
`;
s = s.replace(marker, fn + "\n  " + marker);
fs.writeFileSync(p,s);
console.log('ok');
