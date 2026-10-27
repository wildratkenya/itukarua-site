const fs = require('fs');
const d = fs.readFileSync('src/components/itukarua/DashboardPage.tsx','utf8');
try {
  new Function(d);
  console.log('ok');
} catch(e) {
  console.log(e.toString());
}
