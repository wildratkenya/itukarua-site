const fs = require('fs');
const d = fs.readFileSync('src/components/itukarua/DashboardPage.tsx','utf8');
let o=0,c=0;
for(let i=0;i<d.length;i++){if(d[i]==='{')o++; if(d[i]==='}')c++;}
console.log(o,c);
