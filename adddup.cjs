const fs = require('fs');
const p = 'src/components/itukarua/AdminPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('verifyManualPayment')){console.log('has');process.exit(0);}
const old = "  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');";
if(!s.includes(old)){console.log('no');process.exit(0);}
const neu = old + "\n  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);\n  const [paymentVerifyMsg, setPaymentVerifyMsg] = useState<{type:'ok'|'err', text:string}|null>(null);";
s = s.replace(old, neu);
fs.writeFileSync(p,s);
console.log('ok');
