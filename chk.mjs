import fs from 'fs';
const d = fs.readFileSync('src/components/itukarua/AdminPage.tsx','utf8');
const idx = d.indexOf('getPayments');
console.log(idx);
if(idx>=0){ console.log(d.slice(idx-80, idx+120)); }
