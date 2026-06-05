'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { Employee } from '@/types';
import {
  Building2,
  Calendar,
  Camera,
  CheckCircle,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useAvatarUrl } from '@/hooks/useAvatarUrl';

type Requirement = { key: string; label: string; complete: boolean };
type Onboarding = {
  completionPercent: number;
  requirements: Requirement[];
  bankDetailsSubmitted: boolean;
  panSubmitted: boolean;
  aadhaarSubmitted: boolean;
  profilePhotoSubmitted: boolean;
};

const HIDDEN_KEYS = new Set(['BANK', 'AADHAAR', 'PAN']);

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', label: 'IN' },
  { code: '+1',  flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'GB' },
  { code: '+971',flag: '🇦🇪', label: 'AE' },
  { code: '+65', flag: '🇸🇬', label: 'SG' },
  { code: '+61', flag: '🇦🇺', label: 'AU' },
  { code: '+49', flag: '🇩🇪', label: 'DE' },
  { code: '+33', flag: '🇫🇷', label: 'FR' },
];

function splitPhone(raw: string | null | undefined): { cc: string; num: string } {
  if (!raw) return { cc: '+91', num: '' };
  const match = COUNTRY_CODES.find(c => raw.startsWith(c.code));
  if (match) return { cc: match.code, num: raw.slice(match.code.length).trim() };
  return { cc: '+91', num: raw };
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Phone edit state
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneCC, setPhoneCC] = useState('+91');
  const [phoneNum, setPhoneNum] = useState('');
  const [phoneSaved, setPhoneSaved] = useState('');



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
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const changePw = useMutation({
    mutationFn: () => apiClient.patch('/auth/change-password', {
      currentPassword: currentPw,
      newPassword: newPw,
    }),
    onSuccess: () => {
      setPwSuccess('Password changed successfully.');
      setPwError('');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPwError(msg ?? 'Failed to change password.');
      setPwSuccess('');
    },
  });

  const handleChangePw = () => {
    setPwError(''); setPwSuccess('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    changePw.mutate();
  };



  const uploadPhoto = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('docType', 'PHOTO');
      form.append('file', file);
      return apiClient.post('/employees/me/documents/upload', form);
    },
    onSuccess: refresh,
  });

  const removePhoto = useMutation({
    mutationFn: () => apiClient.delete('/employees/me/photo'),
    onSuccess: refresh,
  });

  const savePhone = useMutation({
    mutationFn: () => apiClient.patch('/employees/me', { phone: phoneCC + phoneNum }),
    onSuccess: () => {
      refresh();
      setEditingPhone(false);
      setPhoneSaved('Phone updated.');
      setTimeout(() => setPhoneSaved(''), 3000);
    },
  });

  const photoUrl = useAvatarUrl(profile?.profilePhotoUrl);

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

  const allRequirements = onboarding?.requirements ?? [
    { key: 'PHOTO', label: 'Photograph', complete: false },
  ];
  const requirements = allRequirements.filter((r) => !HIDDEN_KEYS.has(r.key));
  const completed = requirements.filter((item) => item.complete).length;
  const completionPercent = Math.round((completed / Math.max(requirements.length, 1)) * 100);

  const infoFields = [
    { icon: Mail, label: 'Email', value: profile.email },
    { icon: Building2, label: 'Department', value: profile.department?.name ?? '-' },
    { icon: User, label: 'Designation', value: profile.designation ?? '-' },
    { icon: Shield, label: 'Role', value: profile.role.replace('_', ' ') },
    { icon: Calendar, label: 'Joined', value: formatDate(profile.joiningDate) },
    { icon: User, label: 'Manager', value: profile.manager ? `${profile.manager.firstName} ${profile.manager.lastName}` : '-' },
  ];


  return (
    <div className="space-y-8 w-full">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <h1 className="font-display font-bold text-5xl uppercase tracking-tighter text-brutal-ink leading-none">
            My<br />
            <span className="text-brutal-yellow" style={{ WebkitTextStroke: '2px #1a1a1a' }}>Profile</span>
          </h1>
          <p className="font-display font-bold text-sm uppercase tracking-widest text-[#4a4a4a] mt-3">
            Account settings, documents and face enrollment
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
          {/* Profile photo + identity card */}
          <div className="bg-brutal-ink brutal-border brutal-shadow-lg p-8 flex items-center gap-6">
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 bg-brutal-yellow brutal-border flex items-center justify-center text-brutal-ink font-display font-bold text-2xl overflow-hidden">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  `${profile.firstName[0]}${profile.lastName[0]}`
                )}
              </div>
              {/* Photo overlay controls */}
              <div className="absolute inset-0 bg-brutal-ink/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="w-7 h-7 bg-brutal-yellow text-brutal-ink flex items-center justify-center hover:bg-white transition-colors"
                  title="Upload photo"
                >
                  <Pencil size={12} />
                </button>
                {photoUrl && (
                  <button
                    onClick={() => removePhoto.mutate()}
                    disabled={removePhoto.isPending}
                    className="w-7 h-7 bg-brutal-red text-white flex items-center justify-center hover:bg-white hover:text-brutal-red transition-colors"
                    title="Remove photo"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto.mutate(file);
                e.target.value = '';
              }}
            />
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
              <p className="font-display font-bold text-[10px] uppercase tracking-widest text-white/40 mt-3">
                Hover avatar to change photo
              </p>
            </div>
          </div>

          {/* Photo upload quick action */}
          <div className="brutal-border brutal-shadow p-5 bg-brutal-white">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-3 mb-4 flex items-center gap-2">
              <Camera size={18} /> Profile Photo
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 brutal-border overflow-hidden flex items-center justify-center bg-brutal-surface font-display font-bold text-xl text-brutal-ink flex-shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  `${profile.firstName[0]}${profile.lastName[0]}`
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadPhoto.isPending}
                  className="brutal-btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-40"
                >
                  <Upload size={13} />
                  {uploadPhoto.isPending ? 'Uploading…' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
                {photoUrl && (
                  <button
                    onClick={() => removePhoto.mutate()}
                    disabled={removePhoto.isPending}
                    className="brutal-border px-4 py-2 text-xs font-display font-bold uppercase tracking-wide bg-brutal-red text-white flex items-center gap-2 disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                    {removePhoto.isPending ? 'Removing…' : 'Remove Photo'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-brutal-white brutal-border brutal-shadow p-6">
            <h3 className="font-display font-bold text-xl uppercase brutal-border-b pb-3 mb-5">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Phone — editable inline */}
              <div className="flex items-start gap-4 md:col-span-2">
                <div className="w-9 h-9 bg-brutal-ink text-brutal-yellow flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Phone size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-xs uppercase tracking-widest text-[#4a4a4a] mb-0.5">Phone</p>
                  {editingPhone ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex gap-0">
                        <select
                          value={phoneCC}
                          onChange={(e) => setPhoneCC(e.target.value)}
                          className="brutal-border bg-brutal-surface px-2 py-1.5 font-display font-bold text-xs uppercase focus:outline-none border-r-0"
                        >
                          {COUNTRY_CODES.map(c => (
                            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={phoneNum}
                          onChange={(e) => setPhoneNum(e.target.value)}
                          placeholder="9876543210"
                          className="flex-1 brutal-border bg-brutal-surface px-3 py-1.5 font-display font-bold text-sm focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => savePhone.mutate()}
                          disabled={savePhone.isPending || !phoneNum}
                          className="brutal-btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
                        >
                          {savePhone.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingPhone(false)}
                          className="brutal-btn-secondary px-3 py-1.5 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-body text-sm font-bold text-brutal-ink">
                        {profile.phone ?? '-'}
                      </p>
                      <button
                        onClick={() => {
                          const { cc, num } = splitPhone(profile.phone);
                          setPhoneCC(cc);
                          setPhoneNum(num);
                          setEditingPhone(true);
                        }}
                        className="w-6 h-6 bg-brutal-surface brutal-border flex items-center justify-center hover:bg-brutal-yellow transition-colors"
                        title="Edit phone"
                      >
                        <Pencil size={11} />
                      </button>
                      {phoneSaved && <span className="font-display font-bold text-[10px] text-[#0F8F3A] uppercase">{phoneSaved}</span>}
                    </div>
                  )}
                </div>
              </div>

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

          {!!profile.approvalAuthority?.length && (
            <div className="bg-brutal-white brutal-border brutal-shadow p-6">
              <h3 className="font-display font-bold text-xl uppercase brutal-border-b pb-3 mb-5 flex items-center gap-2">
                <ShieldCheck size={20} /> Approval Authority
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {profile.approvalAuthority.map((authority) => (
                  <div key={authority} className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-brutal-yellow brutal-border flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={14} />
                    </div>
                    <p className="font-display font-bold text-xs uppercase tracking-wide text-brutal-ink leading-relaxed">
                      {authority}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
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



          {/* Change Password */}
          <div className="bg-brutal-white brutal-border brutal-shadow p-5">
            <h3 className="font-display font-bold text-lg uppercase brutal-border-b pb-3 mb-4 flex items-center gap-2">
              <KeyRound size={18} /> Change Password
            </h3>
            <div className="space-y-3">
              {[
                ['Current Password', currentPw, setCurrentPw],
                ['New Password', newPw, setNewPw],
                ['Confirm New Password', confirmPw, setConfirmPw],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="block">
                  <span className="font-display font-bold text-[10px] uppercase tracking-widest text-[#4a4a4a]">{label as string}</span>
                  <input
                    type="password"
                    value={value as string}
                    onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full brutal-border bg-brutal-surface px-3 py-2 font-body text-sm focus:outline-none focus:border-brutal-blue"
                  />
                </label>
              ))}
            </div>
            {pwError && (
              <p className="mt-2 font-display font-bold text-xs uppercase text-brutal-red">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="mt-2 font-display font-bold text-xs uppercase text-[#0F8F3A]">{pwSuccess}</p>
            )}
            <button
              disabled={changePw.isPending || !currentPw || !newPw || !confirmPw}
              onClick={handleChangePw}
              className="mt-4 brutal-btn-primary px-4 py-3 text-xs disabled:opacity-40 flex items-center gap-2"
            >
              <KeyRound size={14} />
              {changePw.isPending ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </section>
      </div>


    </div>
  );
}
