'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { Employee } from '@/types';
import {
  Mail, Phone, Building2, User, Calendar, Shield,
  CheckCircle, XCircle, Camera, Fingerprint,
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { data: profile, isLoading } = useQuery<Employee & { manager?: Employee }>({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/employees/me').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl animate-pulse">
        <div className="h-8 w-48 bg-brutal-surface" />
        <div className="h-48 bg-brutal-surface brutal-border" />
        <div className="h-64 bg-brutal-surface brutal-border" />
      </div>
    );
  }
  if (!profile) return null;

  const infoFields = [
    { icon: Mail,      label: 'Email',       value: profile.email },
    { icon: Phone,     label: 'Phone',       value: profile.phone ?? '—' },
    { icon: Building2, label: 'Department',  value: profile.department?.name ?? '—' },
    { icon: User,      label: 'Designation', value: profile.designation ?? '—' },
    { icon: Shield,    label: 'Role',        value: profile.role.replace('_', ' ') },
    { icon: Calendar,  label: 'Joined',      value: formatDate(profile.joiningDate) },
    { icon: User,      label: 'Manager',     value: profile.manager ? `${profile.manager.firstName} ${profile.manager.lastName}` : '—' },
  ];

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
          My<br />
          <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Profile</span>
        </h1>
        <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
          Your account and biometric information
        </p>
      </div>

      {/* Hero Card */}
      <div className="bg-brutal-ink brutal-border brutal-shadow-lg p-8 flex items-center gap-8">
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
          <div className="flex items-center gap-3 mt-3">
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

      {/* Personal Info Grid */}
      <div className="bg-brutal-white brutal-border brutal-shadow p-6">
        <h3 className="font-display font-bold text-xl uppercase brutal-border-b pb-3 mb-5">
          Personal Information
        </h3>
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

      {/* Biometric Enrollment */}
      <div className="bg-brutal-white brutal-border brutal-shadow p-6">
        <h3 className="font-display font-bold text-xl uppercase brutal-border-b pb-3 mb-5">
          Biometric Enrollment
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Face Recognition */}
          <div className={`brutal-border brutal-shadow p-5 flex items-center gap-4 ${
            profile.faceEnrolled ? 'bg-brutal-yellow' : 'bg-brutal-surface'
          }`}>
            <div className={`w-12 h-12 flex items-center justify-center ${
              profile.faceEnrolled ? 'bg-brutal-ink text-brutal-yellow' : 'bg-brutal-surface-dim text-[#4a4a4a]'
            }`}>
              <Camera size={20} />
            </div>
            <div>
              <p className="font-display font-bold text-sm uppercase">Face Recognition</p>
              <div className="flex items-center gap-1.5 mt-1">
                {profile.faceEnrolled
                  ? <><CheckCircle size={12} className="text-brutal-ink" /><span className="text-xs font-display font-bold uppercase text-brutal-ink">Enrolled</span></>
                  : <><XCircle size={12} className="text-[#4a4a4a]" /><span className="text-xs font-display font-bold uppercase text-[#4a4a4a]">Not Enrolled</span></>
                }
              </div>
            </div>
          </div>

          {/* Fingerprint */}
          <div className="brutal-border brutal-shadow p-5 flex items-center gap-4 bg-brutal-surface">
            <div className="w-12 h-12 bg-brutal-surface-dim text-[#4a4a4a] flex items-center justify-center">
              <Fingerprint size={20} />
            </div>
            <div>
              <p className="font-display font-bold text-sm uppercase">Fingerprint</p>
              <div className="flex items-center gap-1.5 mt-1">
                <XCircle size={12} className="text-[#4a4a4a]" />
                <span className="text-xs font-display font-bold uppercase text-[#4a4a4a]">Not Enrolled</span>
              </div>
            </div>
          </div>
        </div>

        {!profile.faceEnrolled && (
          <div className="mt-5 brutal-border bg-brutal-yellow p-4 flex items-center justify-between brutal-shadow-sm">
            <p className="font-body text-sm font-bold text-brutal-ink">Enroll your biometrics for contactless attendance.</p>
            <Link
              href="/attendance/biometric"
              className="ml-4 brutal-btn-secondary px-4 py-2 text-xs whitespace-nowrap"
            >
              Enroll Now →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
