const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p,'utf8');
// Remove everything from last showManualPayment occurrence
const idx = s.lastIndexOf('{showManualPayment');
if(idx >= 0){
  // Find start of modal block - go back to find comment or div
  const cut = s.lastIndexOf('{/* Manual M-Pesa', idx);
  if(cut >= 0) {
    s = s.slice(0, cut).trim();
  } else {
    s = s.slice(0, s.lastIndexOf('\n', idx-200)).trim();
  }
}
// Ensure proper ending
if(!s.endsWith('export default DashboardPage;')){
  if(s.endsWith('};')) s += '\n\nexport default DashboardPage;\n';
  else if(s.endsWith('}')) s += '\n\nexport default DashboardPage;\n';
  else s += '\n\nexport default DashboardPage;\n';
}
fs.writeFileSync(p,s);
console.log('ok');
