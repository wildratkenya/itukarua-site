const fs = require('fs');
const d = fs.readFileSync('tsc2.txt','utf8');
console.log(d.split('\n').filter(x=>x.includes('DashboardPage')).slice(0,10).join('\n'));
