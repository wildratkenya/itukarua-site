const fs = require('fs');
const p = 'src/components/AppLayout.tsx';
let s = fs.readFileSync(p, 'utf8');
if(s.includes('URLSearchParams')){ console.log('has'); process.exit(0); }
const old = "  const [currentPage, setCurrentPage] = useState<Page>(initialPage || 'home');";
const neu = "  const [currentPage, setCurrentPage] = useState<Page>(() => { if (initialPage) return initialPage; if (typeof window !== 'undefined') { try { const params = new URLSearchParams(window.location.search); const pay = params.get('pay') || params.get('payment') || params.get('type'); const role = params.get('role'); const intent = params.get('intent'); if (pay === 'corporate' || role === 'corporate' || intent === 'corporate') return 'corporate'; if (pay || intent || params.get('ad_id') || params.get('job_id') || params.get('invoice_id')) return 'dashboard'; } catch(e) {} } return 'home'; });";
if(s.includes(old)){
  s = s.replace(old, neu);
  fs.writeFileSync(p, s);
  console.log('ok');
} else {
  console.log('no');
}
