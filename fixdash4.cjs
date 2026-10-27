const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p,'utf8');
// Fix template literal in className
s = s.replace(/className=\`\$\{manualMsg\.type === 'ok' \? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'\}\`\}/g, 
  "className={`text-sm p-2 rounded mb-3 ${manualMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}");
fs.writeFileSync(p,s);
console.log('ok');
