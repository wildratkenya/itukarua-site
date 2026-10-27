try {
  const parser = require('@babel/parser');
  const fs = require('fs');
  const d = fs.readFileSync('src/components/itukarua/DashboardPage.tsx','utf8');
  parser.parse(d, {sourceType:'module', plugins:['jsx','typescript','classProperties']});
  console.log('ok');
} catch(e) {
  console.log(e.message);
}
