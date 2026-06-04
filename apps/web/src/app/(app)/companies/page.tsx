'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Building2, AlertTriangle, Clock, Calendar, User, Plus, Search, Filter, RefreshCw, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { differenceInDays, format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:   { label: 'Active',   color: 'text-green-800',  bg: 'bg-green-100 border-green-300' },
  DELAYED:  { label: 'Delayed',  color: 'text-orange-800', bg: 'bg-orange-100 border-orange-300' },
  AT_RISK:  { label: 'At Risk',  color: 'text-red-800',    bg: 'bg-red-100 border-red-300' },
  LOST:     { label: 'Lost',     color: 'text-gray-600',   bg: 'bg-gray-100 border-gray-300' },
  DORMANT:  { label: 'Dormant',  color: 'text-purple-800', bg: 'bg-purple-100 border-purple-300' },
};

const CRIT_CONFIG: Record<string, { label: string; dot: string }> = {
  HIGH:   { label: 'HIGH',   dot: 'bg-brutal-red' },
  MEDIUM: { label: 'MED',    dot: 'bg-brutal-yellow' },
  LOW:    { label: 'LOW',    dot: 'bg-green-400' },
};

function DaysBadge({ date, label }: { date: string | null; label: string }) {
  if (!date) return <span className="text-brutal-ink/40 text-[11px]">{label}: —</span>;
  const days = differenceInDays(new Date(), new Date(date));
  const color = days >= 30 ? 'text-brutal-red' : days >= 15 ? 'text-orange-500' : 'text-brutal-ink/60';
  return <span className={`text-[11px] font-bold ${color}`}>{label}: {days}d ago</span>;
}

function CompanyCard({ company }: { company: any }) {
  const status = STATUS_CONFIG[company.businessStatus] ?? STATUS_CONFIG['ACTIVE']!;
  const crit = CRIT_CONFIG[company.criticality] ?? CRIT_CONFIG['MEDIUM']!;
  const daysToAudit = company.nextAuditDate
    ? differenceInDays(new Date(company.nextAuditDate), new Date())
    : null;

  const cardBorder =
    company.businessStatus === 'AT_RISK' ? 'border-brutal-red' :
    company.businessStatus === 'LOST' ? 'border-gray-300' :
    company.criticality === 'HIGH' ? 'border-brutal-yellow' : 'border-brutal-ink';

  return (
    <Link href={`/companies/${company.id}`}>
      <div className={`bg-white border-2 ${cardBorder} p-4 hover:shadow-[4px_4px_0_0] hover:shadow-brutal-ink hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer`}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${crit.dot}`} />
              <h3 className="font-display font-bold text-[14px] truncate">{company.name}</h3>
            </div>
            <div className="text-[11px] text-brutal-ink/60 truncate">{company.currentStage ?? 'No stage set'}</div>
          </div>
          <div className="flex flex-col gap-1 items-end flex-shrink-0">
            <span className={`px-2 py-0.5 text-[10px] font-display font-bold border ${status.bg} ${status.color}`}>
              {status.label}
            </span>
            <span className="text-[10px] font-display font-bold text-brutal-ink/50">{crit.label}</span>
          </div>
        </div>

        {/* Responsible */}
        {company.responsibleEmployee && (
          <div className="flex items-center gap-1 mb-2 text-[11px]">
            <User size={10} className="text-brutal-ink/50" />
            <span className="text-brutal-ink/70">{company.responsibleEmployee.firstName} {company.responsibleEmployee.lastName}</span>
          </div>
        )}

        {/* Dates */}
        <div className="flex flex-col gap-1 mb-3">
          <DaysBadge date={company.lastVisitDate} label="Visit" />
          <DaysBadge date={company.lastCommunicationDate} label="Comm" />
        </div>

        {/* Audit countdown */}
        {daysToAudit !== null && daysToAudit >= 0 && (
          <div className={`flex items-center gap-1 text-[11px] font-bold mb-2 ${daysToAudit <= 7 ? 'text-brutal-red' : daysToAudit <= 30 ? 'text-orange-600' : 'text-brutal-ink/70'}`}>
            <Calendar size={10} />
            Audit: {daysToAudit === 0 ? 'TODAY' : `${daysToAudit}d`} ({format(new Date(company.nextAuditDate), 'dd MMM')})
          </div>
        )}

        {/* Alerts & counts */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-brutal-ink/10">
          <div className="flex gap-2 text-[10px] text-brutal-ink/50">
            <span>{company._count?.meetingNotes ?? 0} notes</span>
            <span>·</span>
            <span>{company._count?.visits ?? 0} visits</span>
          </div>
          {company.alerts?.length > 0 && (
            <div className="flex items-center gap-1 text-brutal-red">
              <AlertTriangle size={10} />
              <span className="text-[10px] font-bold">{company.alerts.length}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] font-bold text-brutal-ink/50">
            Risk <span className={`${company.riskScore >= 60 ? 'text-brutal-red' : company.riskScore >= 30 ? 'text-orange-500' : 'text-green-600'}`}>{company.riskScore}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-2 text-[10px] text-brutal-blue font-bold">
          View details <ArrowRight size={9} />
        </div>
      </div>
    </Link>
  );
}

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [criticality, setCriticality] = useState('');
  const [archived, setArchived] = useState(false);

  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ['client-companies', search, status, criticality, archived],
    queryFn: () => apiClient.get('/client-companies', {
      params: { search: search || undefined, status: status || undefined, criticality: criticality || undefined, archived },
    }).then(r => r.data),
  });

  const stats = {
    total: companies.length,
    active: companies.filter((c: any) => c.businessStatus === 'ACTIVE').length,
    atRisk: companies.filter((c: any) => c.businessStatus === 'AT_RISK').length,
    high: companies.filter((c: any) => c.criticality === 'HIGH').length,
    dormant: companies.filter((c: any) => c.businessStatus === 'DORMANT').length,
    lost: companies.filter((c: any) => c.businessStatus === 'LOST').length,
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Company Intelligence"
        subtitle="Nexgen client portfolio — real-time status and risk tracking"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              <RefreshCw size={14} />
            </Button>
            <Link href="/companies/new">
              <Button size="sm"><Plus size={14} /> Add Company</Button>
            </Link>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'bg-brutal-surface' },
          { label: 'Active', value: stats.active, color: 'bg-green-50' },
          { label: 'At Risk', value: stats.atRisk, color: 'bg-red-50' },
          { label: 'High Priority', value: stats.high, color: 'bg-yellow-50' },
          { label: 'Dormant', value: stats.dormant, color: 'bg-purple-50' },
          { label: 'Lost', value: stats.lost, color: 'bg-gray-100' },
        ].map(s => (
          <div key={s.label} className={`brutal-border p-3 ${s.color}`}>
            <div className="font-display font-bold text-2xl">{s.value}</div>
            <div className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-2 brutal-border px-3 py-2 bg-white min-w-[200px] flex-1">
          <Search size={14} className="text-brutal-ink/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="flex-1 outline-none text-sm font-display bg-transparent"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="brutal-border px-3 py-2 text-sm font-display bg-white outline-none cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="AT_RISK">At Risk</option>
          <option value="DELAYED">Delayed</option>
          <option value="DORMANT">Dormant</option>
          <option value="LOST">Lost</option>
        </select>
        <select
          value={criticality}
          onChange={e => setCriticality(e.target.value)}
          className="brutal-border px-3 py-2 text-sm font-display bg-white outline-none cursor-pointer"
        >
          <option value="">All Priority</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <button
          onClick={() => setArchived(!archived)}
          className={`brutal-border px-3 py-2 text-sm font-display font-bold transition-colors ${archived ? 'bg-brutal-ink text-white' : 'bg-white'}`}
        >
          {archived ? '📁 Archived' : 'Archive'}
        </button>
      </div>

      {/* Company grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="brutal-border h-48 bg-brutal-surface animate-pulse" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="brutal-border p-12 text-center bg-white">
          <Building2 size={40} className="mx-auto mb-3 text-brutal-ink/30" />
          <p className="font-display font-bold text-brutal-ink/50">No companies found</p>
          <Link href="/companies/new">
            <Button size="sm" className="mt-4"><Plus size={14} /> Add First Company</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {companies.map((c: any) => <CompanyCard key={c.id} company={c} />)}
        </div>
      )}
    </div>
  );
}
