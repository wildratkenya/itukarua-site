const fs = require('fs');
const d = fs.readFileSync('src/components/itukarua/DashboardPage.tsx','utf8');
const i = d.indexOf('getPayments');
if(i>=0){
  fs.writeFileSync('p.txt', d.slice(Math.max(0,i-200), i+300));
  console.log('ok');
} else console.log('no');
