'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { Employee } from '@/types';
import {
  BadgeIndianRupee,
  Banknote,
  Building2,
  Calendar,
  Camera,
  CheckCircle,
  FileCheck2,
  Fingerprint,
  IdCard,
  Mail,
  Phone,
  Shield,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

type Requirement = { key: string; label: string; complete: boolean };
type Onboarding = {
  completionPercent: number;
  requirements: Requirement[];
  bankDetailsSubmitted: boolean;
  panSubmitted: boolean;
  aadhaarSubmitted: boolean;
  profilePhotoSubmitted: boolean;
  faceEnrolled: boolean;
};

const docItems = [
  { key: 'AADHAAR', label: 'Aadhaar Card', icon: IdCard },
  { key: 'PAN', label: 'PAN Card', icon: BadgeIndianRupee },
  { key: 'PHOTO', label: 'Photograph', icon: Camera },
] as const;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarLast4, setAadhaarLast4] = useState('');

  const { data: profile, isLoading } = useQuery<Employee & { manager?: Employee }>({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/employees/me').then((r) => r.data),
  });

  const { data: onboarding } = useQuery<Onboarding>({
    queryKey: ['profile-onboarding'],
    queryFn: () => apiClient.get('/employees/me/onboarding').then((r) => r.data),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['profile-onboarding'] });
  };

  const saveBank = useMutation({
    mutationFn: () => apiClient.patch('/employees/me/bank-details', {
      bankName,
      accountNumber,
      ifsc,
      panNumber: panNumber || undefined,
      aadhaarLast4: aadhaarLast4 || undefined,
      accountHolderName: profile ? `${profile.firstName} ${profile.lastName}` : undefined,
    }),
    onSuccess: refresh,
  });

  const submitDoc = useMutation({
    mutationFn: ({ docType, file }: { docType: string; file: File }) => {
      const form = new FormData();
      form.append('docType', docType);
      form.append('file', file);
      return apiClient.post('/employees/me/documents/upload', form);
    },
    onSuccess: refresh,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl animate-pulse">
        <div className="h-8 w-48 bg-brutal-surface" />
        <div className="h-48 bg-brutal-surface brutal-border" />
        <div className="h-64 bg-brutal-surface brutal-border" />
      </div>
    );
  }
  if (!profile) return null;

  const requirements = onboarding?.requirements ?? [
    { key: 'BANK', label: 'Bank details', complete: false },
    { key: 'AADHAAR', label: 'Aadhaar card', complete: false },
    { key: 'PAN', label: 'PAN card', complete: false },
    { key: 'PHOTO', label: 'Photograph', complete: false },
    { key: 'FACE_CAPTURE', label: 'Face recognition capture', complete: profile.faceEnrolled },
  ];

  const infoFields = [
    { icon: Mail, label: 'Email', value: profile.email },
    { icon: Phone, label: 'Phone', value: profile.phone ?? '-' },
    { icon: Building2, label: 'Department', value: profile.department?.name ?? '-' },
    { icon: User, label: 'Designation', value: profile.designation ?? '-' },
    { icon: Shield, label: 'Role', value: profile.role.replace('_', ' ') },
    { icon: Calendar, label: 'Joined', value: formatDate(profile.joiningDate) },
    { icon: User, label: 'Manager', value: profile.manager ? `${profile.manager.firstName} ${profile.manager.lastName}` : '-' },
  ];

  const completed = requirements.filter((item) => item.complete).length;
  const completionPercent = onboarding?.completionPercent ?? Math.round((completed / requirements.length) * 100);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            My<br />
            <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Profile</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Account, KYC documents, bank details and face enrollment
          </p>
        </div>
        <div className="brutal-border brutal-shadow bg-brutal-ink text-white p-5 min-w-[260px]">
          <p className="font-display font-bold text-[10px] uppercase tracking-[0.25em] text-white/60">Employee File Readiness</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="font-display font-bold text-4xl text-brutal-yellow">{completionPercent}%</span>
            <span className="font-display font-bold text-[10px] uppercase tracking-widest text-white/60 mb-2">{completed}/{requirements.length} complete</span>
          </div>
          <div className="mt-3 h-4 brutal-border border-white bg-white/10">
            <div className="h-full bg-brutal-yellow" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <section className="space-y-6">
          <div className="bg-brutal-ink brutal-border brutal-shadow-lg p-8 flex items-center gap-6">
            <div className="w-20 h-20 bg-brutal-yellow brutal-border flex items-center justify-center text-brutal-ink font-display font-bold text-2xl flex-shrink-0">
              {profile.firstName[0]}{profile.lastName[0]}
            </div>
            <div className="flex-1">
              <h2 className="font-display font-bold text-3xl uppercase text-white leading-tight">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="font-body text-white/60 text-sm mt-1 uppercase tracking-wider">
                {profile.designation ?? profile.role.replace('_', ' ')}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="px-3 py-1 bg-brutal-yellow border-2 border-brutal-yellow text-brutal-ink font-mono font-bold text-xs">
                  {profile.employeeCode}
                </span>
                <span className={`flex items-center gap-1.5 px-3 py-1 border-2 text-xs font-display font-bold uppercase ${
                  profile.status === 'ACTIVE'
                    ? 'bg-brutal-yellow border-brutal-yellow text-brutal-ink'
                    : 'bg-brutal-red border-brutal-red text-white'
                }`}>
                  <span className={`w-1.5 h-1.5 ${profile.status === 'ACTIVE' ? 'bg-brutal-ink' : 'bg-white'}`} />
                  {profile.status}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-brutal-white brutal-border brutal-shadow p-6">
            <h3 className="font-display font-bold text-xl uppercase brutal-border-b pb-3 mb-5">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {infoFields.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-9 h-9 bg-brutal-ink text-brutal-yellow flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-xs uppercase tracking-widest text-[#4a4a4a] mb-0.5">{label}</p>
                    <p className="font-body text-sm font-bold text-brutal-ink">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="bg-brutal-white brutal-border brutal-shadow">
            <div className="px-5 py-3 brutal-border-b bg-brutal-ink text-white flex items-center justify-between">
              <h3 className="font-display font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-2">
                <FileCheck2 size={16} /> Joining Document Vault
              </h3>
              <span className="bg-brutal-yellow text-brutal-ink px-2 py-1 font-display font-bold text-[10px] uppercase tracking-widest">Required</span>
            </div>
            <div className="divide-y-[3px] divide-brutal-ink">
              {requirements.map((item) => (
                <div key={item.key} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 flex items-center justify-center brutal-border ${item.complete ? 'bg-brutal-yellow' : 'bg-brutal-surface'}`}>
                      {item.complete ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    </div>
                    <div>
                      <p className="font-display font-bold uppercase text-sm">{item.label}</p>
                      <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">
                        {item.complete ? 'On file' : 'Pending submission'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 border-2 border-brutal-ink font-display font-bold text-[10px] uppercase tracking-widest ${
                    item.complete ? 'bg-brutal-yellow' : 'bg-brutal-surface'
                  }`}>
                    {item.complete ? 'Done' : 'Open'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-brutal-white brutal-border brutal-shadow p-5">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-3 mb-4 flex items-center gap-2">
              <Banknote size={18} /> Bank + Statutory Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['Bank Name', bankName, setBankName],
                ['Account Number', accountNumber, setAccountNumber],
                ['IFSC', ifsc, setIfsc],
                ['PAN Number', panNumber, setPanNumber],
                ['Aadhaar Last 4', aadhaarLast4, setAadhaarLast4],
              ].map(([label, value, setter]) => (
                <label key={label as string} className={label === 'Aadhaar Last 4' ? '' : ''}>
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{label as string}</span>
                  <input
                    value={value as string}
                    onChange={(e) => (setter as (next: string) => void)(e.target.value)}
                    className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-display font-bold uppercase"
                  />
                </label>
              ))}
            </div>
            <button
              disabled={saveBank.isPending || !bankName || !accountNumber || !ifsc}
              onClick={() => saveBank.mutate()}
              className="mt-4 brutal-btn-primary px-4 py-3 text-xs disabled:opacity-40"
            >
              Save Bank Details
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {docItems.map(({ key, label, icon: Icon }) => (
              <label key={key} className="bg-brutal-white brutal-border brutal-shadow p-4 cursor-pointer hover:bg-brutal-surface transition-colors">
                <input
                  type="file"
                  className="hidden"
                  accept={key === 'PHOTO' ? 'image/*' : '.pdf,image/*'}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) submitDoc.mutate({ docType: key, file });
                  }}
                />
                <div className="w-10 h-10 bg-brutal-ink text-brutal-yellow flex items-center justify-center mb-4">
                  <Icon size={18} />
                </div>
                <p className="font-display font-bold uppercase text-sm">{label}</p>
                <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a] mt-1 flex items-center gap-1">
                  <Upload size={12} /> Upload file
                </p>
              </label>
            ))}
          </div>

          <div className={`brutal-border brutal-shadow p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            profile.faceEnrolled ? 'bg-brutal-yellow' : 'bg-brutal-surface'
          }`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brutal-ink text-brutal-yellow flex items-center justify-center">
                <Fingerprint size={20} />
              </div>
              <div>
                <p className="font-display font-bold uppercase">Face Recognition Capture</p>
                <p className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">
                  {profile.faceEnrolled ? 'Captured and enrolled' : 'Required on first login for attendance'}
                </p>
              </div>
            </div>
            <Link href="/attendance/biometric" className="brutal-btn-secondary px-4 py-2 text-xs text-center">
              {profile.faceEnrolled ? 'Recapture' : 'Capture Now'}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
