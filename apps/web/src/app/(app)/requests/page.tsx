'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { EmployeeRequest } from '@/types';
import {
  Send, DollarSign, Calendar, FileText, Briefcase, Clock,
  CheckCircle, XCircle, History,
} from 'lucide-react';

const REQUEST_ICONS: Record<string, React.ElementType> = {
  EXPENSE:   DollarSign,
  LEAVE:     Calendar,
  DOCUMENT:  FileText,
  EQUIPMENT: Briefcase,
  DEFAULT:   Send,
};

const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-brutal-yellow text-brutal-ink',
  APPROVED: 'bg-brutal-blue text-white',
  REJECTED: 'bg-brutal-red text-white',
};

const ACCENT_BG: Record<string, string> = {
  EXPENSE:   'bg-brutal-blue',
  LEAVE:     'bg-brutal-yellow',
  DOCUMENT:  'bg-brutal-ink',
  EQUIPMENT: 'bg-brutal-red',
  DEFAULT:   'bg-brutal-surface',
};

const FILTERS = ['All', 'PENDING', 'APPROVED', 'REJECTED'] as const;
type Filter = typeof FILTERS[number];

export default function RequestsPage() {
  const [filter, setFilter] = React.useState<Filter>('All');
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<EmployeeRequest[]>({
    queryKey: ['requests'],
    queryFn: () => apiClient.get('/requests').then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/requests/${id}/status`, { status: 'APPROVED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/requests/${id}/status`, { status: 'REJECTED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });

  const filtered = filter === 'All' ? requests : requests.filter((r) => r.status === filter);
  const pending  = requests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            Requests &amp;<br />
            <span className="text-brutal-red" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Expenses</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Manage approvals and submissions
          </p>
        </div>
        <button className="brutal-btn-primary px-6 py-4 text-sm flex items-center gap-2 group">
          New Request
          <Send size={16} className="group-hover:rotate-45 transition-transform" />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`brutal-pill ${filter === f ? 'active' : ''}`}
            data-active={filter === f}
          >
            {f === 'All' ? 'All Requests' :
             f === 'PENDING' ? `Pending Review${pending > 0 ? ` (${pending})` : ''}` :
             f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main list */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-brutal-surface animate-pulse brutal-border" />
            ))
          ) : filtered.length === 0 ? (
            <div className="bg-brutal-white brutal-border brutal-shadow p-10 text-center">
              <p className="font-display font-bold uppercase text-[#4a4a4a]">No requests found.</p>
            </div>
          ) : (
            filtered.map((req) => {
              const Icon = (REQUEST_ICONS[req.requestType] ?? REQUEST_ICONS.DEFAULT) as React.ElementType;
              const accentBg = ACCENT_BG[req.requestType] ?? ACCENT_BG.DEFAULT;
              return (
                <div key={req.id} className="bg-brutal-white brutal-border brutal-shadow p-6 relative overflow-hidden group">
                  {/* Type badge corner */}
                  <div className={`absolute top-0 right-0 w-16 h-16 ${accentBg} flex items-center justify-center border-b-[3px] border-l-[3px] border-brutal-ink`}>
                    <Icon size={24} className="text-white" />
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 text-xs font-display font-bold uppercase border-2 border-brutal-ink ${
                      STATUS_STYLE[req.status] ?? 'bg-brutal-surface'
                    }`}>
                      {req.status}
                    </span>
                    <span className="font-body text-sm font-bold text-[#4a4a4a]">
                      #{req.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-xl font-display font-bold uppercase tracking-tight mb-1 pr-16 group-hover:text-brutal-blue transition-colors">
                    {req.requestType.replace('_', ' ')} Request
                  </h3>

                  {req.details?.notes != null && (
                    <p className="font-body text-sm text-[#4a4a4a] mb-4">{String(req.details.notes)}</p>
                  )}

                  <div className="flex items-center justify-between brutal-border-t pt-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-[#4a4a4a]" />
                      <span className="font-body text-xs text-[#4a4a4a] font-bold">
                        {formatDate(req.createdAt)}
                      </span>
                      {req.comment && (
                        <span className="font-body text-xs text-[#4a4a4a] italic ml-2">{req.comment}</span>
                      )}
                    </div>
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => rejectMutation.mutate(req.id)}
                          disabled={rejectMutation.isPending}
                          className="brutal-border p-2 hover:bg-brutal-red hover:text-white transition-colors"
                          title="Reject"
                        >
                          <XCircle size={16} />
                        </button>
                        <button
                          onClick={() => approveMutation.mutate(req.id)}
                          disabled={approveMutation.isPending}
                          className="brutal-border p-2 hover:bg-brutal-yellow transition-colors"
                          title="Approve"
                        >
                          <CheckCircle size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Budget utilization */}
          <div className="bg-brutal-ink text-white p-8 brutal-shadow relative">
            <div className="absolute top-4 right-4 text-brutal-yellow">
              <DollarSign size={36} />
            </div>
            <h3 className="font-display font-bold text-xs uppercase tracking-widest text-brutal-surface-dim mb-4">
              Budget Utilization
            </h3>
            <div className="font-display font-bold text-5xl mb-2">74%</div>
            <div className="w-full h-4 bg-brutal-surface-dim border-2 border-brutal-surface mt-4">
              <div className="h-full bg-brutal-yellow w-3/4 border-r-2 border-brutal-surface" />
            </div>
            <p className="font-body text-sm mt-4 font-bold text-white/70">₹12L Remaining Q3</p>
          </div>

          {/* Activity Log */}
          <div className="bg-brutal-white brutal-border brutal-shadow p-6">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-3 mb-4 flex items-center justify-between">
              Activity Log <History size={16} />
            </h3>
            <ul className="flex flex-col gap-4">
              {requests.slice(0, 4).map((r) => (
                <li key={r.id} className="flex gap-4 items-start">
                  <div className={`w-2 h-2 mt-1.5 flex-shrink-0 border border-brutal-ink ${
                    r.status === 'REJECTED' ? 'bg-brutal-red' :
                    r.status === 'APPROVED' ? 'bg-brutal-blue' :
                    'bg-brutal-yellow'
                  }`} />
                  <div>
                    <div className="font-display font-bold text-xs uppercase">
                      {r.requestType} — {r.status}
                    </div>
                    <div className="font-body text-xs text-[#4a4a4a] mt-0.5">{formatDate(r.createdAt)}</div>
                  </div>
                </li>
              ))}
              {requests.length === 0 && (
                <li className="text-xs text-[#4a4a4a] font-bold uppercase">No activity yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
