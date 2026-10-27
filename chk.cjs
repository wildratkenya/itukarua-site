const fs = require('fs');
const d = fs.readFileSync('src/components/itukarua/DashboardPage.tsx','utf8');
console.log(d.includes('Manual M-Pesa'));
console.log(d.split('\n').length);
