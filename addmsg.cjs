const fs = require('fs');
const p = 'src/components/itukarua/AdminPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('paymentVerifyMsg')){console.log('has');process.exit(0);}
const marker = "<CardHeader className=\"pb-3\">";
if(!s.includes(marker)){console.log('no');process.exit(0);}
const msg = "                {paymentVerifyMsg && (<div className={\`text-sm p-2 rounded mb-2 \${paymentVerifyMsg.type==='ok'?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}\`}>{paymentVerifyMsg.text}</div>)}\n";
s = s.replace(marker, marker + "\n" + msg);
fs.writeFileSync(p,s);
console.log('ok');
