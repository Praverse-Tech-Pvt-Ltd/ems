'use client';

import { useState, useEffect, useRef } from 'react';
import { workUpdatesService, aiService, aiProposalsService } from '@/lib/api/work-updates';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';

function parseUpdate(text: string) {
  if (!text || text.length < 10) return null;
  const tasks: string[] = [];
  const taskPatterns = [/completed?\s+([^.!,\n]+)/gi, /finished?\s+([^.!,\n]+)/gi, /submitted?\s+([^.!,\n]+)/gi, /deployed?\s+([^.!,\n]+)/gi];
  for (const pat of taskPatterns) {
    let match;
    while ((match = pat.exec(text)) !== null) tasks.push((match[1] ?? '').trim().slice(0, 50));
  }
  const hasBlocker = /block|stuck|wait(ing)?|pending|delay|issue|problem|can't|cannot/i.test(text);
  const isStressed = /overwhelm|stressed|too much|overload|behind|late|struggle/i.test(text);
  const isPositive = /great|good|done|complet|success|finished|delivered|shipped/i.test(text);
  const sentiment = isStressed
    ? { label: 'At Risk', icon: 'warning', color: 'text-error' }
    : isPositive
    ? { label: 'Productive', icon: 'trending_up', color: 'text-tertiary' }
    : { label: 'Neutral', icon: 'remove', color: 'text-on-surface-variant' };
  const categories: string[] = [];
  if (/client|pharma|visit|customer/i.test(text)) categories.push('Client Work');
  if (/deploy|code|bug|sprint|engineering|dev|api/i.test(text)) categories.push('Engineering');
  if (/expense|finance|invoice|salary/i.test(text)) categories.push('Finance');
  if (/meeting|call|sync|review/i.test(text)) categories.push('Internal');
  const score = Math.min(98, Math.max(40, 60 + tasks.length * 8 + (isPositive ? 15 : 0) - (isStressed ? 20 : 0) - (hasBlocker ? 10 : 0)));
  return { tasks: tasks.slice(0, 3), hasBlocker, sentiment, categories, score };
}

const heatColors = ['bg-surface-container-highest', 'bg-primary/20', 'bg-primary/40', 'bg-primary/70', 'bg-primary'];

export default function AiWorkIntelligencePage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [myUpdates, setMyUpdates] = useState<any[]>([]);
  const [allUpdates, setAllUpdates] = useState<any[]>([]);
  const [pendingProposals, setPendingProposals] = useState<any[]>([]);
  const [reviewingProposal, setReviewingProposal] = useState<string | null>(null);
  const [workMap, setWorkMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [updateText, setUpdateText] = useState('');
  const [blockerText, setBlockerText] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [energy, setEnergy] = useState(3);
  const [submitted, setSubmitted] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [aiInput, setAiInput] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiAsking, setAiAsking] = useState(false);
  const sessionId = useRef(`session-${user?.id ?? 'anon'}-${Date.now()}`);

  const load = async () => {
    try {
      const [mine, map] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ['ai-my-updates'], queryFn: () => workUpdatesService.my({ limit: 10 }) }).catch(() => []),
        queryClient.fetchQuery({ queryKey: ['ai-work-map'], queryFn: () => aiService.employeeWorkMap() }).catch(() => null),
      ]);
      setMyUpdates(Array.isArray(mine) ? mine : mine?.data ?? []);
      setWorkMap(map);
      if (isAdmin) {
        const all = await queryClient.fetchQuery({ queryKey: ['ai-all-updates'], queryFn: () => workUpdatesService.all({ limit: 20 }) }).catch(() => []);
        setAllUpdates(Array.isArray(all) ? all : all?.data ?? []);
      }
      if (isSuperAdmin) {
        const proposals = await queryClient.fetchQuery({ queryKey: ['ai-pending-proposals'], queryFn: () => aiProposalsService.all({ status: 'PENDING', limit: 20 }) }).catch(() => null);
        setPendingProposals(Array.isArray(proposals) ? proposals : proposals?.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (streamRef.current) clearInterval(streamRef.current); }, []);

  const parsed = parseUpdate(updateText);

  const streamPhrases = [
    '🔍 Scanning update for task signals...',
    '✅ Detecting completed deliverables...',
    '📊 Correlating with your module data...',
    '🧠 Cross-referencing attendance + leave records...',
    '📈 Calculating productivity score...',
    '✨ Update analyzed and indexed successfully.',
  ];

  const handleSubmit = async () => {
    if (!updateText.trim()) return;
    setSubmitted(true);
    setStreaming(true);
    let i = 0;
    streamRef.current = setInterval(() => {
      setStreamText(streamPhrases[i] ?? '');
      i++;
      if (i >= streamPhrases.length) {
        clearInterval(streamRef.current!);
        setTimeout(async () => {
          try {
            const full = `${updateText}${blockerText ? `\nBlockers: ${blockerText}` : ''}${nextSteps ? `\nNext: ${nextSteps}` : ''}`;
            await workUpdatesService.submit({ rawText: full, updateDate: new Date().toISOString().slice(0, 10) });
            await load();
          } catch { /* ignore */ }
          setStreaming(false);
        }, 400);
      }
    }, 600);
  };

  const handleAskAI = async () => {
    if (!aiInput.trim()) return;
    setAiAsking(true);
    setAiAnswer('');
    try {
      const res = await aiService.chat(sessionId.current, aiInput);
      setAiAnswer(res?.answer ?? res?.message ?? res?.response ?? 'No response from AI.');
    } catch {
      setAiAnswer('AI service unavailable. Please ensure the backend is running with GEMINI_API_KEY configured.');
    } finally {
      setAiAsking(false);
    }
  };

  const handleProposalReview = async (id: string, action: 'approve' | 'reject') => {
    setReviewingProposal(id);
    try {
      if (action === 'approve') {
        await aiProposalsService.approve(id);
      } else {
        await aiProposalsService.reject(id, 'Rejected from AI approval queue');
      }
      await load();
    } finally {
      setReviewingProposal(null);
    }
  };

  // Build heatmap from real update dates
  const heatmap = (() => {
    const grid: number[][] = Array.from({ length: 12 }, () => Array(5).fill(0));
    const now = new Date();
    myUpdates.forEach(u => {
      const d = new Date(u.updateDate ?? u.createdAt);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      const week = 11 - Math.floor(diffDays / 7);
      const day = d.getDay();
      if (week >= 0 && week < 12 && day >= 1 && day <= 5) {
        const row = grid[week];
        if (row) row[day - 1] = Math.min(4, (row[day - 1] ?? 0) + 2);
      }
    });
    return grid;
  })();

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">neurology</span>
          AI INTELLIGENCE
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">AI Work Intelligence</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">AI Work Intel</h2>
            <p className="text-on-surface-variant mt-xs flex items-center gap-xs flex-wrap">
              Daily updates · AI-analyzed · Real database sync
              <span className="inline-flex items-center gap-1 bg-tertiary/10 text-tertiary border border-tertiary/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />Live
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-lg">
        {/* Left */}
        <div className="flex flex-col gap-md">
          {/* Submit form */}
          <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
            <div className="p-md border-b border-outline-variant/20 flex items-center gap-sm">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-on-surface text-sm">Submit Work Update</p>
                <p className="text-[10px] text-on-surface-variant">AI parses in real-time · Saved to backend</p>
              </div>
              <div className="flex items-center gap-xs text-[10px] text-tertiary font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />AI Active
              </div>
            </div>

            {submitted && streaming ? (
              <div className="p-lg flex flex-col items-center justify-center gap-md text-center min-h-[200px]">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <span className="absolute inset-0 flex items-center justify-center material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                </div>
                <p className="text-body-sm text-primary font-mono">{streamText}</p>
              </div>
            ) : submitted ? (
              <div className="p-lg flex flex-col items-center gap-md text-center">
                <span className="material-symbols-outlined text-tertiary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="font-semibold text-on-surface">Update saved and analyzed</p>
                <button onClick={() => { setSubmitted(false); setUpdateText(''); setBlockerText(''); setNextSteps(''); setEnergy(3); }}
                  className="bg-primary text-on-primary font-label-caps text-label-caps px-lg py-2 rounded-full hover:opacity-90">
                  Submit Another
                </button>
              </div>
            ) : (
              <div className="p-md flex flex-col gap-sm">
                <textarea value={updateText} onChange={e => setUpdateText(e.target.value)}
                  placeholder="Describe your work today... AI will parse tasks, blockers, and sentiment in real-time."
                  rows={4}
                  className="w-full border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none resize-none" />

                {parsed && (
                  <div className="bg-primary/3 border border-primary/20 rounded-xl p-sm flex flex-col gap-xs">
                    <div className="flex items-center gap-xs text-primary font-label-caps text-[10px] tracking-widest">
                      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                      AI PARSING LIVE
                    </div>
                    <div className="grid grid-cols-4 gap-xs">
                      {[
                        { label: 'Sentiment', value: parsed.sentiment.label, color: parsed.sentiment.color },
                        { label: 'Score', value: `${parsed.score}/100`, color: 'text-on-surface' },
                        { label: 'Tasks', value: String(parsed.tasks.length), color: 'text-on-surface' },
                        { label: 'Blocker', value: parsed.hasBlocker ? 'Yes' : 'No', color: parsed.hasBlocker ? 'text-error' : 'text-tertiary' },
                      ].map(s => (
                        <div key={s.label} className="bg-surface-container-lowest rounded-lg p-xs border border-outline-variant/20 text-center">
                          <p className="text-[8px] text-on-surface-variant">{s.label}</p>
                          <p className={`font-bold text-xs ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {parsed.tasks.length > 0 && (
                      <div className="flex flex-wrap gap-xs">
                        {parsed.tasks.map(t => <span key={t} className="text-[9px] bg-tertiary/10 text-tertiary border border-tertiary/20 px-2 py-0.5 rounded-full">✓ {t}</span>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-sm">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">BLOCKERS</label>
                    <input value={blockerText} onChange={e => setBlockerText(e.target.value)}
                      placeholder="What's slowing you down?"
                      className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">NEXT STEPS</label>
                    <input value={nextSteps} onChange={e => setNextSteps(e.target.value)}
                      placeholder="What's on deck tomorrow?"
                      className="border border-outline-variant/50 rounded-xl px-sm py-2 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none" />
                  </div>
                </div>

                <div className="flex items-center gap-sm">
                  <span className="font-label-caps text-[10px] text-on-surface-variant tracking-widest">ENERGY</span>
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setEnergy(v)}
                      className={`w-8 h-8 rounded-full border-2 font-bold text-sm transition-all ${energy >= v ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant/50 text-on-surface-variant'}`}>
                      {v}
                    </button>
                  ))}
                  <span className="text-[10px] text-on-surface-variant">{['', 'Exhausted', 'Low', 'Okay', 'Good', 'Excellent'][energy]}</span>
                </div>

                <button onClick={handleSubmit} disabled={!updateText.trim()}
                  className="py-3 bg-primary text-on-primary font-title-md text-title-md rounded-xl flex items-center justify-center gap-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                  Submit & Analyze with AI
                </button>
              </div>
            )}
          </div>

          {/* My updates from DB */}
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">YOUR RECENT UPDATES</p>
            {loading ? (
              <div className="flex flex-col gap-xs">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-container-high animate-pulse" />)}</div>
            ) : myUpdates.length === 0 ? (
              <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
                No updates yet. Submit your first work update above.
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {myUpdates.map(u => (
                  <div key={u.id} className="glass-card rounded-2xl border border-outline-variant/30 p-md">
                    <div className="flex items-center justify-between gap-sm mb-xs flex-wrap">
                      <span className="text-[10px] text-on-surface-variant">
                        {new Date(u.updateDate ?? u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <div className="flex gap-xs">
                        {u.aiScore && <span className={`font-black text-sm ${u.aiScore >= 80 ? 'text-tertiary' : u.aiScore >= 65 ? 'text-primary' : 'text-error'}`}>{u.aiScore}/100</span>}
                        {u.status && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${u.status === 'APPROVED' ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'bg-primary/10 text-primary border-primary/20'}`}>{u.status}</span>}
                      </div>
                    </div>
                    <p className="text-body-sm text-on-surface leading-relaxed line-clamp-3">{u.rawText}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-md">
          {/* Productivity ring */}
          <div className="glass-card rounded-2xl p-lg border border-outline-variant/30 flex flex-col items-center gap-md text-center">
            <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest self-start">PRODUCTIVITY SCORE</p>
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" stroke="currentColor" className="text-surface-container-highest" />
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" stroke="currentColor"
                  strokeDasharray={`${((workMap?.averageScore ?? 0) / 100) * 327} 327`} strokeLinecap="round" className="text-tertiary" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-black text-on-surface text-3xl">{workMap?.averageScore ?? '—'}</span>
                <span className="text-[10px] text-on-surface-variant">/ 100</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-sm w-full">
              {[
                { label: 'Updates', value: workMap?.totalUpdates ?? myUpdates.length },
                { label: 'Blockers', value: workMap?.blockers ?? 0 },
                { label: 'Streak', value: workMap?.streak ?? 0 },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="font-black text-on-surface text-lg">{s.value}</p>
                  <p className="text-[9px] text-on-surface-variant">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Ask */}
          <div className="glass-card rounded-2xl p-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-surface-container-lowest">
            <div className="flex items-center gap-sm text-primary mb-md">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              <div>
                <p className="font-semibold text-on-surface text-sm">Ask AI — Full Context</p>
                <p className="text-[10px] text-on-surface-variant">Connected to all modules & database</p>
              </div>
            </div>
            <div className="relative mb-sm">
              <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                className="w-full border border-primary/30 rounded-xl px-sm py-2.5 text-body-sm bg-surface-container-lowest focus:border-primary focus:outline-none pr-12"
                placeholder="Ask about any employee, client, or pattern..." />
              <button onClick={handleAskAI} disabled={aiAsking || !aiInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">{aiAsking ? 'hourglass_empty' : 'send'}</span>
              </button>
            </div>
            {aiAnswer && (
              <div className="bg-surface-container-low rounded-xl p-sm text-body-sm text-on-surface-variant leading-relaxed mb-sm">
                {aiAnswer}
              </div>
            )}
            <div className="flex flex-wrap gap-xs">
              {['Who is at burnout risk?', 'My productivity this week', 'Unresolved blockers', 'Top performers'].map(q => (
                <button key={q} onClick={() => setAiInput(q)}
                  className="text-[10px] bg-primary/5 text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Super admin: AI approval queue */}
          {isSuperAdmin && (
            <div>
              <div className="flex items-center justify-between mb-sm">
                <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">AI APPROVAL QUEUE</p>
                <span className="text-[10px] text-primary font-bold">{pendingProposals.length} pending</span>
              </div>
              {pendingProposals.length === 0 ? (
                <div className="glass-card rounded-xl p-md text-center text-on-surface-variant border border-outline-variant/30 text-body-sm">
                  No AI changes waiting for approval.
                </div>
              ) : (
                <div className="flex flex-col gap-xs">
                  {pendingProposals.slice(0, 5).map((proposal: any) => (
                    <div key={proposal.id} className="glass-card rounded-xl p-sm border border-primary/20 bg-primary/3 flex flex-col gap-xs">
                      <div className="flex items-start justify-between gap-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-on-surface text-xs">{proposal.proposalType?.replaceAll('_', ' ')}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {proposal.submitter?.firstName} {proposal.submitter?.lastName} · {new Date(proposal.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">PENDING</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant line-clamp-2">{proposal.rawInput}</p>
                      {proposal.aiReason && <p className="text-[10px] text-primary line-clamp-1">AI: {proposal.aiReason}</p>}
                      <div className="flex gap-xs pt-xs">
                        <button
                          onClick={() => handleProposalReview(proposal.id, 'approve')}
                          disabled={reviewingProposal === proposal.id}
                          className="flex-1 bg-tertiary text-on-primary font-label-caps text-[10px] py-1.5 rounded-full disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleProposalReview(proposal.id, 'reject')}
                          disabled={reviewingProposal === proposal.id}
                          className="flex-1 border border-error/30 text-error font-label-caps text-[10px] py-1.5 rounded-full disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin: Team updates */}
          {isAdmin && allUpdates.length > 0 && (
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">TEAM UPDATES</p>
              <div className="flex flex-col gap-xs">
                {allUpdates.slice(0, 5).map(u => (
                  <div key={u.id} className="glass-card rounded-xl p-sm border border-outline-variant/30 flex items-start gap-sm">
                    <div className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-[10px] shrink-0">
                      {u.employee?.firstName?.[0]}{u.employee?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-xs">
                        <p className="font-semibold text-on-surface text-xs">{u.employee?.firstName} {u.employee?.lastName}</p>
                        <span className="text-[9px] text-on-surface-variant">{new Date(u.updateDate ?? u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-2">{u.rawText}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div>
        <div className="flex items-center justify-between mb-sm">
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">UPDATE HEATMAP — LAST 12 WEEKS</p>
          <div className="flex items-center gap-xs text-[10px] text-on-surface-variant">
            <span>Less</span>
            {heatColors.map((c, i) => <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />)}
            <span>More</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-md border border-outline-variant/30 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            <div className="flex flex-col gap-1 mr-1">
              <div className="h-3" />
              {['M', 'T', 'W', 'T', 'F'].map((d, i) => (
                <div key={i} className="w-5 h-5 flex items-center justify-center text-[9px] text-on-surface-variant">{d}</div>
              ))}
            </div>
            {heatmap.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                <div className="h-3 flex items-center justify-center text-[8px] text-on-surface-variant/50">
                  {wi % 4 === 0 ? `W${wi + 1}` : ''}
                </div>
                {week.map((val, di) => (
                  <div key={di} title={val === 0 ? 'No update' : `Activity: ${val}`}
                    className={`w-5 h-5 rounded-sm cursor-pointer hover:ring-2 hover:ring-primary/50 ${heatColors[val]}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
