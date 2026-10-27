const fs = require('fs');
const s = fs.readFileSync('src/components/AppLayout.tsx','utf8');
const i = s.indexOf('const [currentPage');
if(i>=0){
  const j = s.indexOf('useState', i);
  const k = s.indexOf(';', i);
  fs.writeFileSync('checkapp.txt', s.slice(i, Math.min(k+1, i+400)));
  console.log('ok');
} else console.log('no');
