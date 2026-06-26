'use client';

import { useState, useEffect } from 'react';
import { managementService } from '@/lib/api/management';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';

export default function ManagementReviewHubPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [weekly, recs, perf] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ['management-weekly'], queryFn: () => managementService.weeklyReview() }).catch(() => null),
        queryClient.fetchQuery({ queryKey: ['management-ai-recs'], queryFn: () => managementService.aiRecommendations() }).catch(() => []),
        queryClient.fetchQuery({ queryKey: ['management-perf', 30], queryFn: () => managementService.employeePerformance(30) }).catch(() => []),
      ]);
      setWeeklyData(weekly);
      setRecommendations(Array.isArray(recs) ? recs : recs?.recommendations ?? []);
      setPerformance(Array.isArray(perf) ? perf : perf?.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-md text-center">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">lock</span>
        <p className="text-on-surface-variant">Management Review is only available to Managers and Admins.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">rate_review</span>
          MANAGEMENT
        </div>
        <div className="flex items-end justify-between gap-md flex-wrap">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Management Review Hub</h2>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Review Hub</h2>
            <p className="text-on-surface-variant mt-xs">Weekly review, AI recommendations, and team performance.</p>
          </div>
          <div className="flex gap-sm shrink-0">
            <a href={managementService.exportPdf()} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-xs text-label-caps font-label-caps text-primary border border-outline-variant px-3 py-2 rounded-full hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-[16px]">download</span>Export PDF
            </a>
          </div>
        </div>
      </div>

      {/* Weekly summary stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-surface-container-high animate-pulse" />)}
        </div>
      ) : weeklyData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {[
            { label: 'Present Today', value: weeklyData.presentToday ?? weeklyData.attendance?.presentToday ?? '—', color: 'text-tertiary', icon: 'how_to_reg' },
            { label: 'Pending Leaves', value: weeklyData.pendingLeaves ?? weeklyData.leaves?.pending ?? '—', color: 'text-primary', icon: 'event_available' },
            { label: 'Pending Expenses', value: weeklyData.pendingExpenses ?? weeklyData.expenses?.pending ?? '—', color: 'text-error', icon: 'receipt_long' },
            { label: 'Active Clients', value: weeklyData.activeClients ?? weeklyData.clients?.active ?? '—', color: 'text-on-surface', icon: 'domain' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-md border border-outline-variant/30 flex flex-col gap-sm">
              <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
              <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
              <p className="text-body-sm text-on-surface-variant">{s.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
          Weekly review data not available. Make sure the backend is running.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-lg">
        {/* Employee performance table */}
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mb-sm">EMPLOYEE PERFORMANCE — LAST 30 DAYS</p>
          {loading ? (
            <div className="flex flex-col gap-xs">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-surface-container-high animate-pulse" />)}
            </div>
          ) : performance.length === 0 ? (
            <div className="glass-card rounded-xl p-lg text-center text-on-surface-variant border border-outline-variant/30">
              Performance data not available.
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
              <div className="divide-y divide-outline-variant/20">
                {performance.map((emp: any) => {
                  const score = emp.score ?? emp.productivityScore ?? 0;
                  return (
                    <div key={emp.id ?? emp.employeeId} className="flex items-center gap-md p-sm hover:bg-surface-container-low transition-colors">
                      <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0">
                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface text-sm">{emp.firstName} {emp.lastName}</p>
                        <p className="text-body-sm text-on-surface-variant">{emp.designation ?? emp.department?.name}</p>
                      </div>
                      <div className="flex items-center gap-sm hidden md:flex">
                        <div className="w-24 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                          <div className={`h-full rounded-full ${score >= 80 ? 'bg-tertiary' : score >= 60 ? 'bg-primary' : 'bg-error'}`}
                            style={{ width: `${score}%` }} />
                        </div>
                        <span className={`font-bold text-sm w-8 text-right ${score >= 80 ? 'text-tertiary' : score >= 60 ? 'text-primary' : 'text-error'}`}>{score}</span>
                      </div>
                      {emp.updates !== undefined && (
                        <span className="text-[10px] text-on-surface-variant hidden lg:block">{emp.updates} updates</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* AI recommendations */}
        <div className="flex flex-col gap-sm">
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">AI RECOMMENDATIONS</p>
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-container-high animate-pulse" />)
          ) : recommendations.length === 0 ? (
            <div className="glass-card rounded-xl p-md text-center text-on-surface-variant border border-outline-variant/30 text-body-sm">
              AI recommendations will appear once there is enough data.
            </div>
          ) : (
            recommendations.slice(0, 6).map((rec: any, i) => (
              <div key={i} className={`glass-card rounded-xl p-sm border flex items-start gap-sm ${rec.priority === 'HIGH' ? 'border-error/20 bg-error/3' : rec.priority === 'MEDIUM' ? 'border-primary/20 bg-primary/3' : 'border-outline-variant/30'}`}>
                <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${rec.priority === 'HIGH' ? 'text-error' : rec.priority === 'MEDIUM' ? 'text-primary' : 'text-tertiary'}`}>
                  {rec.priority === 'HIGH' ? 'warning' : rec.priority === 'MEDIUM' ? 'info' : 'lightbulb'}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface text-sm">{rec.title ?? rec.type ?? 'Recommendation'}</p>
                  <p className="text-body-sm text-on-surface-variant mt-0.5 leading-snug">{rec.description ?? rec.message ?? String(rec)}</p>
                </div>
              </div>
            ))
          )}

          <button onClick={load} className="mt-sm border border-outline-variant/50 text-on-surface-variant font-label-caps text-label-caps py-2 rounded-full hover:bg-surface-container-low hover:text-primary transition-colors">
            Refresh AI Insights
          </button>
        </div>
      </div>
    </div>
  );
}
