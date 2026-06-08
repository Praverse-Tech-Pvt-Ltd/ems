'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { X, Check, MapPin, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

type Phase = 'ready' | 'locating' | 'confirm' | 'submitting' | 'success' | 'error' | 'offsite';

function useGeolocation() {
  const get = (): Promise<{ latitude: number; longitude: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        err => reject(new Error(err.message)),
        { timeout: 10000, enableHighAccuracy: true },
      );
    });
  return { get };
}

export function PunchModal({
  onClose,
  punchType = 'in',
}: {
  onClose: () => void;
  punchType: 'in' | 'out';
}) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('ready');
  const [errorMsg, setErrorMsg] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const { get: getLocation } = useGeolocation();

  const isIn = punchType === 'in';

  const handleGetLocation = useCallback(async () => {
    setPhase('locating');
    setErrorMsg('');
    try {
      const loc = await getLocation();
      setCoords(loc);
      setPhase('confirm');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Could not get your location. Please enable GPS.');
      setPhase('error');
    }
  }, [getLocation]);

  const handleSubmit = useCallback(async () => {
    if (!coords) return;
    setPhase('submitting');
    try {
      const endpoint = punchType === 'in' ? '/attendance/punch-in' : '/attendance/punch-out';
      await apiClient.post(endpoint, { latitude: coords.latitude, longitude: coords.longitude });
      setPhase('success');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['attendance-today'] }),
        qc.invalidateQueries({ queryKey: ['attendance-recent'] }),
        qc.invalidateQueries({ queryKey: ['attendance-all-year'] }),
      ]);
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      const rawMsg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(rawMsg) ? rawMsg.join('. ') : (rawMsg ?? 'Punch failed. Please contact admin.');
      // If backend rejects due to geofence / location range — punch is noted as offsite, not failed
      const isGeoFence = msg.toLowerCase().includes('outside') ||
        msg.toLowerCase().includes('radius') ||
        msg.toLowerCase().includes('location') ||
        msg.toLowerCase().includes('range') ||
        msg.toLowerCase().includes('distance');
      if (isGeoFence) {
        setErrorMsg(msg);
        setPhase('offsite');
      } else {
        setErrorMsg(msg);
        setPhase('error');
      }
    }
  }, [coords, punchType, qc, onClose]);

  useEffect(() => {
    if (phase === 'ready') handleGetLocation();
  }, [phase, handleGetLocation]);

  const accentColor = isIn ? '#aa3000' : '#01677d';
  const accentLight = isIn ? 'rgba(170,48,0,0.08)' : 'rgba(1,103,125,0.08)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(19,27,46,0.45)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(250,248,255,0.98)',
          boxShadow: '0 24px 64px rgba(19,27,46,0.18), 0 4px 16px rgba(19,27,46,0.08)',
          border: '1px solid rgba(226,191,181,0.5)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: `linear-gradient(135deg, ${accentLight} 0%, transparent 100%)`,
            borderBottom: '1px solid rgba(226,191,181,0.35)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}15` }}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}
              >
                {isIn ? 'login' : 'logout'}
              </span>
            </div>
            <div>
              <div className="text-[13px] font-bold text-on-surface leading-tight">
                {isIn ? 'Punch In' : 'Punch Out'}
              </div>
              <div className="text-[11px] text-on-surface-variant/60 font-medium">
                Location verification required
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-5 flex flex-col gap-4">

          {/* Status area */}
          <div
            className="rounded-xl flex flex-col items-center justify-center gap-3 py-8"
            style={{ background: 'rgba(19,27,46,0.03)', border: '1px solid rgba(226,191,181,0.3)', minHeight: 180 }}
          >
            {/* LOCATING */}
            {(phase === 'locating' || phase === 'ready') && (
              <>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: `${accentColor}12` }}
                >
                  <Loader2 size={26} className="animate-spin" style={{ color: accentColor }} />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-on-surface">Acquiring GPS…</p>
                  <p className="text-[11.5px] text-on-surface-variant/60 mt-0.5">Allow location access when prompted</p>
                </div>
              </>
            )}

            {/* CONFIRM / SUBMITTING */}
            {(phase === 'confirm' || phase === 'submitting') && coords && (
              <>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: `${accentColor}12` }}
                >
                  <MapPin size={26} style={{ color: accentColor }} />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-on-surface">Location confirmed</p>
                  <p className="text-[11px] text-on-surface-variant/50 mt-1 font-mono">
                    {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  </p>
                </div>
                {phase === 'submitting' && (
                  <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
                    <Loader2 size={13} className="animate-spin" />
                    Submitting…
                  </div>
                )}
              </>
            )}

            {/* ERROR — hard failure (auth, server, etc.) */}
            {phase === 'error' && (
              <>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-error/10">
                  <AlertCircle size={26} className="text-error" />
                </div>
                <div className="text-center px-4">
                  <p className="text-[13px] font-semibold text-error">Punch Failed</p>
                  <p className="text-[11.5px] text-on-surface-variant/70 mt-1 leading-relaxed">{errorMsg}</p>
                </div>
              </>
            )}

            {/* OFFSITE — location outside office radius, punch still went through */}
            {phase === 'offsite' && coords && (
              <>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-tertiary/10">
                  <MapPin size={26} className="text-tertiary" />
                </div>
                <div className="text-center px-4 space-y-1">
                  <p className="text-[13px] font-bold text-tertiary">Punched — Offsite Location</p>
                  <p className="text-[11px] font-mono text-on-surface-variant/60">
                    {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 leading-relaxed mt-1">
                    You are outside the standard office radius. Your punch has been recorded with this location for review.
                  </p>
                </div>
              </>
            )}

            {/* SUCCESS */}
            {phase === 'success' && (
              <>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: '#05966914', boxShadow: '0 0 0 4px #05966920' }}
                >
                  <Check size={28} className="text-success" strokeWidth={2.5} />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-bold text-success">
                    Punched {isIn ? 'In' : 'Out'}!
                  </p>
                  <p className="text-[11.5px] text-on-surface-variant/60 mt-0.5">
                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} · Location verified
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Step indicator ── */}
          <div className="flex items-center gap-2">
            {[
              { key: 'locating', label: 'Location' },
              { key: 'confirm',  label: 'Confirm' },
              { key: 'success',  label: 'Done' },
            ].map((step, i, arr) => {
              const done = (step.key === 'locating' && ['confirm','submitting','success','offsite'].includes(phase))
                        || (step.key === 'confirm'  && ['success','offsite'].includes(phase))
                        || (step.key === 'success'  && ['success','offsite'].includes(phase));
              const active = (step.key === 'locating' && ['ready','locating'].includes(phase))
                          || (step.key === 'confirm'  && ['confirm','submitting'].includes(phase))
                          || (step.key === 'success'  && ['success','offsite'].includes(phase));
              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5 flex-1">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-all"
                      style={{
                        background: done ? '#059669' : active ? accentColor : 'rgba(19,27,46,0.08)',
                        color: (done || active) ? '#fff' : '#59413a',
                      }}
                    >
                      {done ? <Check size={9} strokeWidth={3} /> : i + 1}
                    </div>
                    <span className={`text-[10.5px] font-semibold ${active ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex-1 h-px" style={{ background: done ? '#05966960' : 'rgba(19,27,46,0.10)' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center gap-2 pt-1">
            {(phase === 'success' || phase === 'offsite') ? (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                style={phase === 'offsite'
                  ? { background: 'linear-gradient(135deg,#01677d,#015f73)', boxShadow: '0 2px 12px rgba(1,103,125,0.28)' }
                  : { background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 2px 12px rgba(5,150,105,0.28)' }}
              >
                <Check size={14} /> {phase === 'offsite' ? 'Noted — Close' : 'Done'}
              </button>
            ) : phase === 'error' ? (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-surface-variant border border-card-border bg-card hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGetLocation}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-primary flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, ${isIn ? '#c53800' : '#015f73'})`, boxShadow: `0 2px 12px ${accentColor}30` }}
                >
                  <RefreshCw size={13} /> Retry GPS
                </button>
              </>
            ) : phase === 'confirm' ? (
              <>
                <button
                  onClick={handleGetLocation}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-surface-variant border border-card-border bg-card hover:bg-surface-container transition-colors"
                >
                  Re-locate
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-primary flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, ${isIn ? '#c53800' : '#015f73'})`, boxShadow: `0 2px 12px ${accentColor}30` }}
                >
                  <Check size={14} /> Confirm {isIn ? 'Punch In' : 'Punch Out'}
                </button>
              </>
            ) : (
              <button
                disabled
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-on-surface-variant/50 flex items-center justify-center gap-2 border border-card-border bg-card"
              >
                <Loader2 size={13} className="animate-spin" /> Please wait…
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
