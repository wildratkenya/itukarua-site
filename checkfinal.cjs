const fs = require('fs');
const d = fs.readFileSync('src/components/itukarua/AdminPage.tsx','utf8');
console.log('v:'+d.includes('verifyManualPayment'));
console.log('a:'+d.includes('Verify & Approve'));
console.log('m:'+d.includes('manual_submission'));
console.log('p:'+d.includes('pending_verification'));
