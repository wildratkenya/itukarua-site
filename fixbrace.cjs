const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p, 'utf8');
let o=0,c=0;
for(let i=0;i<s.length;i++){if(s[i]==='{')o++; if(s[i]==='}')c++;}
console.log(o,c);
if (o > c) {
  s = s + '\n' + '}'.repeat(o-c) + '\n\nexport default DashboardPage;\n';
} else if (c > o) {
  // try to trim
  let diff = c-o;
  while(diff>0 && s.endsWith('}')) { s = s.slice(0, -1); diff--; }
  s = s.trim() + '\n\nexport default DashboardPage;\n';
}
fs.writeFileSync(p, s);
console.log('fixed');
