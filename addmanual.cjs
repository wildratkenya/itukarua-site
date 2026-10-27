const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('showManualPayment')){console.log('has');process.exit(0);}
const target = "const [activeTab, setActiveTab] = useState('overview');";
const repl = "const [activeTab, setActiveTab] = useState('overview');\n  const [showManualPayment, setShowManualPayment] = useState(false);\n  const [manualMpesaRef, setManualMpesaRef] = useState('');\n  const [manualAmount, setManualAmount] = useState('');\n  const [manualPhone, setManualPhone] = useState('');\n  const [manualNote, setManualNote] = useState('');\n  const [manualSubmitting, setManualSubmitting] = useState(false);\n  const [manualMsg, setManualMsg] = useState<{type: 'ok'|'err', text: string}|null>(null);";
if(!s.includes(target)){console.log('no');process.exit(0);}
s = s.replace(target, repl);
fs.writeFileSync(p,s);
console.log('ok');
