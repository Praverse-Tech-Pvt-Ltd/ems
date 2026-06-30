'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { companyTrackerService } from '@/lib/api/company-tracker';

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Badge({ value }: { value: string }) {
  const red = value === 'Delayed' || value === 'Correction Required';
  const green = value === 'Completed' || value === 'Closed';
  return <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${red ? 'bg-error/10 text-error border-error/20' : green ? 'bg-success/10 text-success border-success/20' : 'bg-surface-container text-on-surface border-card-border'}`}>{value}</span>;
}

export default function TrackerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setProject(await companyTrackerService.project(id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  if (loading) return <div className="p-6 text-on-surface-variant">Loading project...</div>;
  if (!project) return <div className="p-6 text-on-surface-variant">Project not found.</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{project.trackingId}</p>
            <h1 className="text-[26px] font-black text-on-surface mt-1">{project.company?.name}</h1>
            <p className="text-sm text-on-surface-variant mt-1">{project.projectType} · {project.regulatoryGoal} · {project.clientType}</p>
          </div>
          <div className="flex gap-2"><Badge value={project.currentStage} /><Badge value={project.priority} /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            ['Completion', `${project.completionPercent}%`],
            ['Target', fmtDate(project.targetCompletionDate)],
            ['Next Follow-up', fmtDate(project.nextFollowUpDate)],
            ['Owner', project.owner ? `${project.owner.firstName} ${project.owner.lastName}` : '-'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">{label}</p>
              <p className="text-sm font-semibold text-on-surface mt-1">{value}</p>
            </div>
          ))}
        </div>
        {project.currentStatusSummary && <p className="text-sm text-on-surface-variant mt-4">{project.currentStatusSummary}</p>}
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-card-border"><h2 className="font-bold">Requirements</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-surface-container-low text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
              <tr>{['Category', 'Requirement', 'Assigned To', 'Reviewer', 'Due', 'Status', 'Completion', 'Remarks'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {(project.requirements ?? []).map((req: any) => (
                <tr key={req.id}>
                  <td className="px-3 py-3">{req.category}</td>
                  <td className="px-3 py-3 font-medium">{req.description}</td>
                  <td className="px-3 py-3">{req.assignee ? `${req.assignee.firstName} ${req.assignee.lastName}` : '-'}</td>
                  <td className="px-3 py-3">{req.reviewer ? `${req.reviewer.firstName} ${req.reviewer.lastName}` : '-'}</td>
                  <td className="px-3 py-3">{fmtDate(req.dueDate)}</td>
                  <td className="px-3 py-3"><Badge value={req.status} /></td>
                  <td className="px-3 py-3">{req.completionPercent}%</td>
                  <td className="px-3 py-3">{req.remarks ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-4">
          <h2 className="font-bold mb-3">Follow-ups</h2>
          <div className="space-y-2">
            {(project.followUps ?? []).map((item: any) => (
              <div key={item.id} className="rounded-lg border border-card-border p-3">
                <p className="font-semibold">{item.description}</p>
                <p className="text-xs text-on-surface-variant">Next: {fmtDate(item.nextFollowUpDate)} · {item.status}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-xl p-4">
          <h2 className="font-bold mb-3">Activity Log</h2>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {(project.activityLogs ?? []).map((item: any) => (
              <div key={item.id} className="rounded-lg border border-card-border p-3">
                <p className="font-semibold">{item.action}</p>
                <p className="text-xs text-on-surface-variant">{item.actor?.firstName} {item.actor?.lastName} · {new Date(item.createdAt).toLocaleString('en-IN')}</p>
                {item.remarks && <p className="text-xs text-on-surface-variant mt-1">{item.remarks}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
