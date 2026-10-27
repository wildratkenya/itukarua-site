const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p, 'utf8');

// Remove everything from the broken manual payment section onwards
const markers = ['Manual M-Pesa Payment Submission', 'Submit M-Pesa Transaction ID', 'showManualPayment'];
for (const m of markers) {
  const idx = s.indexOf(m);
  if (idx >= 0) {
    // Find start of this section (go back to find a logical break)
    // Look for comment or opening of modal
    const commentIdx = s.lastIndexOf('{/*', idx);
    if (commentIdx >= 0 && idx - commentIdx < 200) {
      s = s.slice(0, commentIdx);
    } else {
      // Go back to find start of button/section
      const btnIdx = s.lastIndexOf('<button', idx);
      if (btnIdx >= 0 && idx - btnIdx < 500) {
        // Find start of that button's container
        s = s.slice(0, btnIdx);
      } else {
        s = s.slice(0, idx);
      }
    }
    break;
  }
}

// Also remove the advert payments section's manual submit button if it got cut weird
s = s.trim();
// Make sure we end properly before adding modal
// Remove trailing chars until we get to a clean state
if (s.endsWith('});')) s = s.slice(0, -3).trim();
if (s.endsWith('}')) {
  // Check if it's the component end
  // Count braces
  let o=0,c=0;
  for(let i=0;i<s.length;i++){if(s[i]==='{')o++; if(s[i]==='}')c++;}
  if (o > c) {
    // Need more closes
  }
}

const modal = `\n\n      {/* Manual M-Pesa Payment Submission Modal */}\n      {showManualPayment && (\n        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">\n          <div className="bg-white rounded-xl max-w-md w-full p-6">\n            <div className="flex items-center justify-between mb-4">\n              <h3 className="text-lg font-semibold text-gray-900">Submit M-Pesa Transaction</h3>\n              <button onClick={() => setShowManualPayment(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>\n            </div>\n            <p className="text-sm text-gray-600 mb-4">If you paid directly to M-Pesa, enter your transaction details below. Our team will verify and apply the payment.</p>\n            {manualMsg && (\n              <div className={"text-sm p-2 rounded mb-3 " + (manualMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>\n                {manualMsg.text}\n              </div>\n            )}\n            <div className="space-y-3">\n              <div>\n                <label className="text-sm text-gray-700">M-Pesa Transaction ID *</label>\n                <input value={manualMpesaRef} onChange={(e) => setManualMpesaRef(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="e.g. QAB1234567" />\n              </div>\n              <div>\n                <label className="text-sm text-gray-700">Amount (KES)</label>\n                <input value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="e.g. 1000" />\n              </div>\n              <div>\n                <label className="text-sm text-gray-700">Phone Number (optional)</label>\n                <input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="07XXXXXXXX" />\n              </div>\n              <div>\n                <label className="text-sm text-gray-700">Notes (optional)</label>\n                <input value={manualNote} onChange={(e) => setManualNote(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="What are you paying for?" />\n              </div>\n            </div>\n            <div className="flex gap-2 mt-6">\n              <button onClick={() => setShowManualPayment(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg">Cancel</button>\n              <button\n                onClick={async () => {\n                  if (!manualMpesaRef.trim()) { setManualMsg({ type: 'err', text: 'Please enter M-Pesa transaction ID' }); return; }\n                  setManualSubmitting(true); setManualMsg(null);\n                  try {\n                    const { error } = await supabase.from('payments').insert({\n                      user_id: user.id,\n                      payment_type: 'manual_submission',\n                      amount: manualAmount ? Number(manualAmount) : 0,\n                      mpesa_ref: manualMpesaRef.trim(),\n                      mpesa_phone: manualPhone.trim() || null,\n                      status: 'pending_verification',\n                      description: manualNote.trim() || 'Manual M-Pesa payment submission'\n                    });\n                    if (error) { setManualMsg({ type: 'err', text: error.message }); }\n                    else {\n                      setManualMsg({ type: 'ok', text: 'Transaction submitted. Our team will verify and activate your account shortly.' });\n                      setTimeout(() => {\n                        setShowManualPayment(false);\n                        setManualMpesaRef('');\n                        setManualAmount('');\n                        setManualPhone('');\n                        setManualNote('');\n                        setManualMsg(null);\n                      }, 2000);\n                    }\n                  } catch (e) {\n                    setManualMsg({ type: 'err', text: e.message || 'Failed to submit' });\n                  }\n                  setManualSubmitting(false);\n                }}\n                disabled={manualSubmitting}\n                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"\n              >\n                {manualSubmitting ? 'Submitting...' : 'Submit'}\n              </button>\n            </div>\n          </div>\n        </div>\n      )}\n    </div>\n  );\n};\n\nexport default DashboardPage;\n`;

fs.writeFileSync(p, s + modal);
console.log('done');
