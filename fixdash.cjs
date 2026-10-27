const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('export default DashboardPage')){console.log('has');process.exit(0);}
if(s.includes('Manual M-Pesa Payment Submission')){
  if(!s.trim().endsWith('};')){
    s = s.trim() + '\n\nexport default DashboardPage;\n';
    fs.writeFileSync(p,s);
    console.log('ok');
  }else{
    s = s.replace(/\n?\};\s*$/, '\n};\n\nexport default DashboardPage;\n');
    fs.writeFileSync(p,s);
    console.log('ok2');
  }
}else console.log('no');
