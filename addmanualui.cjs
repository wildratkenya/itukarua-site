const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('Submit M-Pesa Transaction')){console.log('has');process.exit(0);}
const marker = "Payment history for banner advert subscriptions and homepage boosts.";
if(!s.includes(marker)){console.log('no');process.exit(0);}
const block = `Payment history for banner advert subscriptions and homepage boosts.
              </p>
              <button onClick={() => { setShowManualPayment(true); setManualMsg(null); }} className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg flex items-center gap-2">
                <Send className="w-4 h-4" /> Submit M-Pesa Transaction ID
              </button>`;
s = s.replace(marker + "</p>", block);
fs.writeFileSync(p,s);
console.log('ok');
