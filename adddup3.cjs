const fs = require('fs');
const p = 'src/components/itukarua/AdminPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('verifyManualPayment')){console.log('has');process.exit(0);}
const idx = s.indexOf('paymentStatusFilter');
if(idx==-1){console.log('no');process.exit(0);}
const end = s.indexOf(';', idx);
if(end==-1){console.log('x');process.exit(0);}
const line = s.slice(idx, end+1);
const neu = line + "\n  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);\n  const [paymentVerifyMsg, setPaymentVerifyMsg] = useState<{type:'ok'|'err', text:string}|null>(null);";
s = s.slice(0,idx) + neu + s.slice(end+1);
fs.writeFileSync(p,s);
console.log('ok');
