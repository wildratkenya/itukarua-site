import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Loader2, User } from 'lucide-react';
import { getConversations, getConversationMessages, sendMessage, markConversationRead, type DbConversationWithParticipant, type DbDirectMessage } from '@/lib/database';
import { supabase } from '@/lib/supabase';

interface InboxPageProps {
  userId: string;
  onBack: () => void;
  onNavigate?: (page: any) => void;
}

const InboxPage: React.FC<InboxPageProps> = ({ userId, onBack }) => {
  const [conversations, setConversations] = useState<DbConversationWithParticipant[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<DbDirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const convs = await getConversations(userId);
      setConversations(convs);
      setLoading(false);
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (!activeConv) return;
    const load = async () => {
      const msgs = await getConversationMessages(activeConv);
      setMessages(msgs);
      await markConversationRead(activeConv, userId);
      setConversations(prev => prev.map(c => c.id === activeConv ? { ...c, unread_count: 0 } : c));
    };
    load();
  }, [activeConv, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!activeConv) return;
    const channel = supabase.channel(`messages:${activeConv}`);
    channel.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${activeConv}` },
      async (payload: any) => {
        const newMsg = payload.new;
        const { data: sender } = await supabase.from('profiles').select('full_name, profile_image').eq('id', newMsg.sender_id).maybeSingle();
        setMessages(prev => [...prev, {
          ...newMsg,
          sender_name: sender?.full_name || 'Unknown',
          sender_image: sender?.profile_image || '',
        }]);
        // Update conversation list
        setConversations(prev => prev.map(c =>
          c.id === activeConv ? { ...c, last_message: newMsg.content, last_message_at: newMsg.created_at, last_sender_id: newMsg.sender_id } : c
        ));
      }
    );
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      await sendMessage(activeConv, userId, input.trim());
      setInput('');
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  }, [input, activeConv, userId, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeConvData = conversations.find(c => c.id === activeConv);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-green-700 to-green-800 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={onBack} className="text-green-200 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white">Messages</h1>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex h-[calc(100vh-220px)] min-h-[400px]">
          {/* Conversation List */}
          <div className={`${activeConv ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-gray-100 flex-shrink-0`}>
            <div className="p-3 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No conversations yet</p>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv.id)}
                    className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${activeConv === conv.id ? 'bg-green-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        {conv.other_user_image ? (
                          <img src={conv.other_user_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-green-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 truncate">{conv.other_user_name}</span>
                          <span className="text-[10px] text-gray-400">{new Date(conv.last_message_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{conv.last_message || 'No messages yet'}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${!activeConv ? 'hidden md:flex' : 'flex'} flex-1 flex-col`}>
            {activeConv && activeConvData ? (
              <>
                {/* Chat Header (mobile back button) */}
                <div className="flex items-center gap-3 p-3 border-b border-gray-100 md:hidden">
                  <button onClick={() => setActiveConv(null)} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    {activeConvData.other_user_image ? (
                      <img src={activeConvData.other_user_image} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-green-700" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{activeConvData.other_user_name}</span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Start a conversation</p>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.sender_id === userId ? 'bg-green-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender_id === userId ? 'text-green-200' : 'text-gray-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-gray-100 p-3">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-gray-500 font-medium">Select a conversation</p>
                  <p className="text-sm text-gray-400 mt-1">Choose a conversation from the left to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InboxPage;
