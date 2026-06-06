'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BrainCircuit, Send, Trash2, Plus, User, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';

const EXAMPLE_QUESTIONS = [
  'Which companies haven\'t been visited in 2 weeks?',
  'Summarize Vemed\'s current status',
  'What\'s pending for West Coast audit?',
  'Which companies are at risk right now?',
  'Who is working on what this week?',
  'Which companies have no recent communication?',
  'Record: Vemed dossier review is pending; follow up tomorrow',
];

type Message = { role: 'user' | 'assistant'; content: string; time: string };

function genSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ChatAIPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [sessionId, setSessionId] = useState(genSessionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Guard: only SUPER_ADMIN
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: (question: string) =>
      apiClient.post('/ai-chat/message', { sessionId, question }).then(r => r.data),
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, time: new Date().toISOString() }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Failed to get a response. Check that Gemini API key is configured.', time: new Date().toISOString() }]);
    },
  });

  const { mutate: clearHistory } = useMutation({
    mutationFn: () => apiClient.delete(`/ai-chat/history/${sessionId}`),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const send = (question: string) => {
    if (!question.trim() || isPending) return;
    setMessages(prev => [...prev, { role: 'user', content: question, time: new Date().toISOString() }]);
    setInput('');
    sendMessage(question);
  };

  const newConversation = () => {
    clearHistory();
    setMessages([]);
    setSessionId(genSessionId());
  };

  if (user?.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brutal-ink grid place-items-center">
            <BrainCircuit size={18} className="text-brutal-yellow" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl">AI Assistant</h1>
            <p className="text-sm text-brutal-ink/50">Ask anything about your client portfolio</p>
          </div>
        </div>
        <button
          onClick={newConversation}
          className="flex items-center gap-2 brutal-border px-3 py-2 font-display font-bold text-[11px] uppercase hover:bg-brutal-yellow transition-colors"
        >
          <Plus size={12} /> New Chat
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 brutal-border bg-white overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 py-8">
            <BrainCircuit size={48} className="text-brutal-ink/20" />
            <p className="font-display font-bold text-brutal-ink/40 text-center">
              Ask me anything about your pharma clients
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="brutal-border p-2.5 text-left text-[12px] font-display hover:bg-brutal-yellow hover:border-brutal-ink transition-colors text-brutal-ink/70 hover:text-brutal-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 flex-shrink-0 grid place-items-center ${msg.role === 'user' ? 'bg-brutal-blue' : 'bg-brutal-ink'}`}>
              {msg.role === 'user'
                ? <User size={13} className="text-white" />
                : <BrainCircuit size={13} className="text-brutal-yellow" />
              }
            </div>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`brutal-border p-3 ${msg.role === 'user' ? 'bg-brutal-blue text-white' : 'bg-brutal-surface'}`}>
                {msg.role === 'assistant'
                  ? <pre className="font-mono text-[12px] whitespace-pre-wrap leading-relaxed">{msg.content}</pre>
                  : <p className="text-[13px] font-display">{msg.content}</p>
                }
              </div>
              <span className="text-[10px] text-brutal-ink/30 mt-0.5 font-display">
                {format(new Date(msg.time), 'HH:mm')}
              </span>
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-brutal-ink grid place-items-center">
              <BrainCircuit size={13} className="text-brutal-yellow" />
            </div>
            <div className="brutal-border bg-brutal-surface p-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-brutal-ink/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
                <span className="font-display text-[11px] text-brutal-ink/50 ml-2">Analyzing live data…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 mt-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="Ask about companies, audits, employees, risks…"
            disabled={isPending}
            className="flex-1 brutal-border px-4 py-3 font-display text-sm outline-none bg-white disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isPending}
            className="brutal-border w-12 h-12 grid place-items-center bg-brutal-ink text-brutal-yellow hover:bg-brutal-blue transition-colors disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-brutal-ink/40 mt-1 font-display">
          Answers are based on live EMS data · Session: {sessionId.slice(-8)}
        </p>
      </div>
    </div>
  );
}
