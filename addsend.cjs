const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('Send')){console.log('has');process.exit(0);}
const idx = s.indexOf("from 'lucide-react'");
if(idx==-1){console.log('no');process.exit(0);}
const start = s.lastIndexOf('import', idx);
const line = s.slice(start, s.indexOf('\n', idx));
if(line.includes('{')){
  const neu = line.replace('}', ', Send }');
  s = s.slice(0,start) + neu + s.slice(s.indexOf('\n',idx));
  fs.writeFileSync(p,s);
  console.log('ok');
}else console.log('x');
