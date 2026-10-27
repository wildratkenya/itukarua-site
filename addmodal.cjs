const fs = require('fs');
const p = 'src/components/itukarua/DashboardPage.tsx';
let s = fs.readFileSync(p,'utf8');
if(s.includes('Manual M-Pesa Payment Submission')){console.log('has');process.exit(0);}
const marker = "{/* Edit Profile Modal */}";
if(!s.includes(marker)){console.log('no');process.exit(0);}
const modal = `      {/* Manual M-Pesa Payment Submission Modal */}
      {showManualPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Submit M-Pesa Transaction</h3>
              <button onClick={() => setShowManualPayment(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">If you paid directly to M-Pesa, enter your transaction details below. Our team will verify and apply the payment.</p>
            {manualMsg && (<div className={\`text-sm p-2 rounded mb-3 \${manualMsg.type==='ok'?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}\`}>{manualMsg.text}</div>)}
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-700">M-Pesa Transaction ID *</label>
                <input value={manualMpesaRef} onChange={(e)=>setManualMpesaRef(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="e.g. QAB1234567" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Amount (KES)</label>
                <input value={manualAmount} onChange={(e)=>setManualAmount(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="e.g. 1000" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Phone Number (optional)</label>
                <input value={manualPhone} onChange={(e)=>setManualPhone(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="07XXXXXXXX" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Notes (optional)</label>
                <input value={manualNote} onChange={(e)=>setManualNote(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg" placeholder="What are you paying for?" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowManualPayment(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg">Cancel</button>
              <button onClick={async ()=>{
                if(!manualMpesaRef.trim()){ setManualMsg({type:'err', text:'Please enter M-Pesa transaction ID'}); return; }
                setManualSubmitting(true); setManualMsg(null);
                try {
                  const { data, error } = await supabase.from('payments').insert({
                    user_id: user.id,
                    payment_type: 'manual_submission',
                    amount: manualAmount ? Number(manualAmount) : 0,
                    mpesa_ref: manualMpesaRef.trim(),
                    mpesa_phone: manualPhone.trim() || null,
                    status: 'pending_verification',
                    description: manualNote.trim() || 'Manual M-Pesa payment submission'
                  }).select().single();
                  if(error){ setManualMsg({type:'err', text:error.message}); }
                  else { setManualMsg({type:'ok', text:'Transaction submitted. Our team will verify and activate your account shortly.'}); setTimeout(()=>{ setShowManualPayment(false); setManualMpesaRef(''); setManualAmount(''); setManualPhone(''); setManualNote(''); setManualMsg(null); }, 2000); }
                } catch(e:any){ setManualMsg({type:'err', text:e.message || 'Failed to submit'}); }
                setManualSubmitting(false);
              }} disabled={manualSubmitting} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50">{manualSubmitting?'Submitting...':'Submit'}</button>
            </div>
          </div>
        </div>
      )}
`;
s = s.replace(marker, modal + "\n\n      " + marker);
fs.writeFileSync(p,s);
console.log('ok');
