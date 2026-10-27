const fs = require('fs');
const s = fs.readFileSync('src/components/AppLayout.tsx','utf8');
const i = s.indexOf('initialPage');
if(i>=0){
  fs.writeFileSync('app.txt', s.slice(i, i+150));
  console.log('ok');
} else console.log('no');
