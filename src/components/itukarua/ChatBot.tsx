import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { createMessage } from '@/lib/database';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  role: 'bot' | 'user';
  text: string;
}

const FAQS: { q: string; a: string }[] = [
  { q: 'how to post a job', a: 'Click "Post a Job" in the menu. Fill in the job details, set your budget, and submit. Employers can post jobs for free.' },
  { q: 'how to register', a: 'Click "Register" and choose your role (Jobseeker or Employer). Jobseekers pay KES 100/mo for a subscription.' },
  { q: 'how to pay', a: 'We use M-Pesa. Go to the Pricing page, click Pay, and follow the instructions. You can use STK Push or manual PayBill.' },
  { q: 'how to bid', a: 'Browse jobs and click "Bid on This Job". Enter your price and proposal. The employer will review your bid.' },
  { q: 'subscription', a: 'Jobseeker membership is KES 100/mo — a 30-day subscription. You can renew from your Dashboard.' },
  { q: 'contact', a: 'You can reach us at info@itukarua.co.ke or call +254 721 219 359. You can also use the Contact page.' },
  { q: 'messaging', a: 'Once your bid is accepted, you can message the employer directly through the Inbox page.' },
  { q: 'refund', a: 'For payment issues, please contact our support team via the Contact page or email info@itukarua.co.ke.' },
];

function findAnswer(input: string): string | null {
  const lower = input.toLowerCase();
  for (const faq of FAQS) {
    const keywords = faq.q.split(' ');
    if (keywords.some(k => lower.includes(k))) return faq.a;
  }
  return null;
}

const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'Hello! How can I help you today? Ask me about posting jobs, bidding, payments, or anything else.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setUserName(data.user.email?.split('@')[0] || 'User');
        setUserEmail(data.user.email || '');
      }
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);

    const answer = findAnswer(text);
    if (answer) {
      setTimeout(() => setMessages(prev => [...prev, { role: 'bot', text: answer }]), 500);
      return;
    }

    setSending(true);
    try {
      await createMessage({
        sender_name: userName || 'Chat User',
        sender_email: userEmail || 'chat@itukarua.co.ke',
        subject: 'Chat Support',
        message: text,
        type: 'support',
      });
      setMessages(prev => [...prev, { role: 'bot', text: 'Thank you for reaching out. Our support team will get back to you via email. You can also call us at +254 721 219 359 for urgent issues.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, something went wrong. Please try again or use the Contact page.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-all hover:scale-105">
          <MessageCircle className="w-7 h-7" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Itukarua Chat</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5 text-white" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'bot' ? 'bg-white text-gray-800 border border-gray-100' : 'bg-green-600 text-white'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-400 border border-gray-100 px-3 py-2 rounded-xl text-sm"><Loader2 className="w-4 h-4 animate-spin" /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type your question..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              <button onClick={handleSend} disabled={sending || !input.trim()} className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
