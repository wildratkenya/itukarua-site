const fs = require('fs');
const d = fs.readFileSync('src/components/itukarua/DashboardPage.tsx','utf8');
const i = d.indexOf('const [activeTab');
if(i>=0){
  fs.writeFileSync('active.txt', d.slice(i, i+1000));
  console.log('ok');
} else {
  console.log('no');
}
