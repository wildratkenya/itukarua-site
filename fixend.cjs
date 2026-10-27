const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p, 'utf8');
const expIdx = s.lastIndexOf('export default DashboardPage');
if (expIdx >= 0) {
  const end = s.indexOf(';', expIdx);
  if (end >= 0) {
    s = s.slice(0, end + 1);
  } else {
    s = s.slice(0, expIdx + 'export default DashboardPage'.length) + ';\n';
  }
} else {
  s = s.trim();
  s += '\n\nexport default DashboardPage;\n';
}
fs.writeFileSync(p, s);
console.log('done');
