import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, ExternalLink, ChevronRight } from 'lucide-react';
import { createChatMessage, getChatConversation, getConversationId } from '@/lib/database';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  role: 'bot' | 'user' | 'admin';
  text: string;
  id?: string;
}

const FAQS = [
  { id: 'post-job', label: 'How to Post a Job', answer: 'Click "Post a Job" in the menu. Fill in the job details, set your budget, and submit. Employers can post jobs for free.' },
  { id: 'register', label: 'How to Register', answer: 'Click "Register" and choose your role (Advertiser, Employer, or Jobseeker). Jobseekers pay KES 100/mo for a subscription.' },
  { id: 'payments', label: 'Payments & M-Pesa', answer: 'We use M-Pesa. Go to the Pricing page, click Pay, and follow the instructions. You can use STK Push or pay manually via Till Number 1600149.' },
  { id: 'bid', label: 'How to Bid', answer: 'Browse jobs and click "Bid on This Job". Enter your price and proposal. The employer will review your bid.' },
  { id: 'subscription', label: 'Subscription Plans', answer: 'Jobseeker membership is KES 100/mo — a 30-day subscription. You can renew from your Dashboard.' },
  { id: 'contact', label: 'Contact Support', answer: 'You can reach us at info@itukarua.co.ke or call +254 721 219 359.' },
];

const WHATSAPP_URL = 'https://wa.me/254721219359';

const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'Hi! I\'m Itukarua\'s assistant. How can I help you today?' },
  ]);
  const [mode, setMode] = useState<'faq' | 'agent'>('faq');
  const [input, setInput] = useState('');
  const [faqRounds, setFaqRounds] = useState(0);
  const [lastFaqId, setLastFaqId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId] = useState(() => getConversationId());
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [showFaqButtons, setShowFaqButtons] = useState(true);
  const [showHelpfulButtons, setShowHelpfulButtons] = useState(false);
  const [showAgentButton, setShowAgentButton] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

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
  }, [messages, showFaqButtons, showHelpfulButtons, showAgentButton]);

  useEffect(() => {
    if (mode === 'agent' && open) {
      pollRef.current = setInterval(async () => {
        try {
          const msgs = await getChatConversation(conversationId);
          const adminMsgs = msgs.filter(m => m.role === 'admin');
          setMessages(prev => {
            const existingIds = new Set(prev.filter(m => m.id).map(m => m.id));
            const newMsgs: ChatMessage[] = [];
            for (const m of adminMsgs) {
              if (!existingIds.has(m.id)) {
                newMsgs.push({ role: 'admin', text: m.message, id: m.id });
              }
            }
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
          });
        } catch {}
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mode, open, conversationId]);

  const saveTranscript = useCallback(async () => {
    if (transcriptSaved) return;
    setTranscriptSaved(true);
    const transcript = messages
      .filter(m => m.role !== 'bot' || m.text.startsWith('User asked'))
      .map(m => {
        const who = m.role === 'user' ? 'User' : m.role === 'admin' ? 'Admin' : 'Bot';
        return `${who}: ${m.text}`;
      })
      .join('\n');
    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_name: userName || 'Chat User',
        sender_email: userEmail || 'chat@itukarua.co.ke',
        subject: 'Chat Conversation',
        message: transcript || 'No messages',
        type: 'chat_transcript',
        status: 'unread',
      });
    } catch {}
  }, [transcriptSaved, messages, conversationId, userName, userEmail]);

  const handleFaqClick = async (faq: typeof FAQS[0]) => {
    setShowFaqButtons(false);
    setShowHelpfulButtons(false);
    setShowAgentButton(false);
    setLastFaqId(faq.id);

    const userMsg: ChatMessage = { role: 'user', text: faq.label };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: faq.answer }]);
      setShowHelpfulButtons(true);
    }, 400);
  };

  const handleHelpful = (yes: boolean) => {
    setShowHelpfulButtons(false);
    if (yes) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Great! Glad that helped. 😊' }]);
      setFaqRounds(prev => prev + 1);
      if (faqRounds + 1 >= 2) {
        setShowAgentButton(true);
      } else {
        setTimeout(() => setShowFaqButtons(true), 300);
      }
    } else {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry about that. Let me connect you with an agent who can help further.' }]);
      setTimeout(() => switchToAgent(), 600);
    }
  };

  const switchToAgent = async () => {
    setShowHelpfulButtons(false);
    setShowFaqButtons(false);
    setShowAgentButton(false);
    await saveTranscript();
    setMode('agent');
    setMessages(prev => [...prev, { role: 'bot', text: 'You\'re now chatting with our support team. You can also reach us on WhatsApp for faster replies.' }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    const tempId = crypto.randomUUID();
    setMessages(prev => [...prev, { role: 'user', text, id: tempId }]);
    try {
      await createChatMessage({
        conversation_id: conversationId,
        sender_name: userName || 'Chat User',
        sender_email: userEmail || 'chat@itukarua.co.ke',
        message: text,
        role: 'user',
      });
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (mode === 'agent') await saveTranscript();
    setOpen(false);
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-all hover:scale-105">
          <MessageCircle className="w-7 h-7" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 w-80 sm:w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Itukarua Support</div>
                <div className="text-[10px] text-green-100">{mode === 'agent' ? 'Online' : 'Typically replies instantly'}</div>
              </div>
            </div>
            <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-4 h-4 text-white" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#e5ddd5]" style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'bot' || msg.role === 'admin' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed shadow-sm ${
                  msg.role === 'bot'
                    ? 'bg-white text-gray-800 rounded-bl-sm'
                    : msg.role === 'admin'
                    ? 'bg-white text-gray-800 rounded-bl-sm'
                    : 'bg-[#dcf8c6] text-gray-800 rounded-br-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {showFaqButtons && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg rounded-bl-sm shadow-sm p-2.5 max-w-[85%]">
                  <div className="text-xs font-semibold text-gray-800 mb-2">Choose a topic:</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FAQS.map(faq => (
                      <button
                        key={faq.id}
                        onClick={() => handleFaqClick(faq)}
                        className="text-left text-xs px-2.5 py-2 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-lg transition-colors text-gray-700"
                      >
                        {faq.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showHelpfulButtons && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg rounded-bl-sm shadow-sm p-2">
                  <div className="text-xs text-gray-600 mb-1.5 text-center">Was this helpful?</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleHelpful(true)} className="px-4 py-1.5 text-xs font-semibold bg-green-100 hover:bg-green-200 text-green-700 rounded-full transition-colors">Yes</button>
                    <button onClick={() => handleHelpful(false)} className="px-4 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors">No</button>
                  </div>
                </div>
              </div>
            )}

            {showAgentButton && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg rounded-bl-sm shadow-sm p-3 max-w-[85%]">
                  <div className="text-xs text-gray-700 mb-2">Need more help?</div>
                  <button onClick={switchToAgent} className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    <span>Talk with an Agent</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium">
                      <ExternalLink className="w-3 h-3" />
                      Chat on WhatsApp instead
                    </a>
                  </div>
                </div>
              </div>
            )}

            {mode === 'agent' && (
              <div className="flex justify-start">
                <div className="bg-white rounded-lg rounded-bl-sm shadow-sm p-3 max-w-[85%]">
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            )}

            {sending && (
              <div className="flex justify-end">
                <div className="bg-[#dcf8c6] px-3.5 py-2.5 rounded-lg rounded-br-sm shadow-sm"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {mode === 'agent' && (
            <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
                <button onClick={handleSendMessage} disabled={sending || !input.trim()} className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors disabled:opacity-50 flex-shrink-0"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ChatBot;
