const fs = require('fs');
const d = fs.readFileSync('src/components/itukarua/DashboardPage.tsx','utf8');
const idx = d.indexOf('activeTab');
if(idx>=0){
  const s = d.slice(idx, idx+900);
  fs.writeFileSync('dump.txt', s, 'utf8');
  console.log('ok');
} else {
  console.log('no');
}
