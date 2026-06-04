'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';

const PRIORITY_PRESETS = {
  'West Coast': { criticality: 'HIGH', businessStatus: 'ACTIVE', currentStage: 'Audit Preparation', notes: 'Audit scheduled 17-20 June. High priority.' },
  'Vemed': { criticality: 'HIGH', businessStatus: 'ACTIVE', currentStage: 'WHO Audit Readiness', notes: 'WHO audit approval expected. Track documentation gaps and pending CAPA.' },
  'Peak Lifesciences': { criticality: 'LOW', businessStatus: 'LOST', currentStage: 'Project Closed', notes: 'Project discontinued. Moved to archive.' },
};

export default function NewCompanyPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', shortName: '', contactEmail: '', contactPhone: '',
    address: '', industry: 'Pharma',
    businessStatus: 'ACTIVE', criticality: 'MEDIUM',
    currentStage: '', responsibleEmployeeId: '',
    lastVisitDate: '', lastCommunicationDate: '', nextAuditDate: '',
    notes: '',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => apiClient.get('/employees').then(r => r.data?.employees ?? r.data ?? []),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => apiClient.post('/client-companies', {
      ...form,
      lastVisitDate: form.lastVisitDate || undefined,
      lastCommunicationDate: form.lastCommunicationDate || undefined,
      nextAuditDate: form.nextAuditDate || undefined,
      responsibleEmployeeId: form.responsibleEmployeeId || undefined,
      shortName: form.shortName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      address: form.address || undefined,
    }),
    onSuccess: (r) => router.push(`/companies/${r.data.id}`),
  });

  const applyPreset = (name: string) => {
    const preset = PRIORITY_PRESETS[name as keyof typeof PRIORITY_PRESETS];
    if (preset) setForm(f => ({ ...f, name, ...preset }));
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4">
        <Link href="/companies" className="flex items-center gap-1 text-sm font-display font-bold text-brutal-ink/60 hover:text-brutal-ink mb-3">
          <ArrowLeft size={14} /> Companies
        </Link>
        <PageHeader title="Add Company" subtitle="Register a new pharma client company" />
      </div>

      {/* Priority presets */}
      <div className="mb-5">
        <p className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-2">QUICK ADD PRIORITY CLIENTS</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(PRIORITY_PRESETS).map(name => (
            <button key={name} onClick={() => applyPreset(name)} className="brutal-border px-3 py-1.5 text-sm font-display font-bold hover:bg-brutal-yellow transition-colors">
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="brutal-border p-5 bg-white max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Company Name *">
            <input value={form.name} onChange={set('name')} className="w-full brutal-border p-2 text-sm font-display outline-none" placeholder="e.g. Vemed Pharma Ltd" />
          </FormField>
          <FormField label="Short Name">
            <input value={form.shortName} onChange={set('shortName')} className="w-full brutal-border p-2 text-sm font-display outline-none" placeholder="e.g. Vemed" />
          </FormField>
          <FormField label="Business Status">
            <select value={form.businessStatus} onChange={set('businessStatus')} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white">
              <option value="ACTIVE">Active</option>
              <option value="DELAYED">Delayed</option>
              <option value="AT_RISK">At Risk</option>
              <option value="DORMANT">Dormant</option>
              <option value="LOST">Lost / Closed</option>
            </select>
          </FormField>
          <FormField label="Priority Level">
            <select value={form.criticality} onChange={set('criticality')} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white">
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </FormField>
          <FormField label="Current Stage">
            <input value={form.currentStage} onChange={set('currentStage')} className="w-full brutal-border p-2 text-sm font-display outline-none" placeholder="e.g. WHO Audit Readiness" />
          </FormField>
          <FormField label="Responsible Employee">
            <select value={form.responsibleEmployeeId} onChange={set('responsibleEmployeeId')} className="w-full brutal-border p-2 text-sm font-display outline-none bg-white">
              <option value="">Select employee</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Contact Email">
            <input type="email" value={form.contactEmail} onChange={set('contactEmail')} className="w-full brutal-border p-2 text-sm font-display outline-none" />
          </FormField>
          <FormField label="Contact Phone">
            <input value={form.contactPhone} onChange={set('contactPhone')} className="w-full brutal-border p-2 text-sm font-display outline-none" />
          </FormField>
          <FormField label="Last Visit Date">
            <input type="date" value={form.lastVisitDate} onChange={set('lastVisitDate')} className="w-full brutal-border p-2 text-sm font-display outline-none" />
          </FormField>
          <FormField label="Last Communication Date">
            <input type="date" value={form.lastCommunicationDate} onChange={set('lastCommunicationDate')} className="w-full brutal-border p-2 text-sm font-display outline-none" />
          </FormField>
          <FormField label="Next Audit Date">
            <input type="date" value={form.nextAuditDate} onChange={set('nextAuditDate')} className="w-full brutal-border p-2 text-sm font-display outline-none" />
          </FormField>
          <FormField label="Industry">
            <input value={form.industry} onChange={set('industry')} className="w-full brutal-border p-2 text-sm font-display outline-none" />
          </FormField>
          <div className="col-span-full">
            <FormField label="Address">
              <input value={form.address} onChange={set('address')} className="w-full brutal-border p-2 text-sm font-display outline-none" />
            </FormField>
          </div>
          <div className="col-span-full">
            <FormField label="Notes">
              <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full brutal-border p-2 text-sm font-display outline-none resize-none" />
            </FormField>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button disabled={!form.name.trim() || isPending} onClick={() => mutate()}>
            <Save size={14} /> {isPending ? 'Saving…' : 'Save Company'}
          </Button>
          <Link href="/companies"><Button variant="secondary">Cancel</Button></Link>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-display font-bold text-[10px] tracking-widest uppercase text-brutal-ink/60 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
