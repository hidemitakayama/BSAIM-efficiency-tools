'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowDownToLine, BarChart3, Bot, Calculator, Calendar,
  CheckCircle2, ChevronDown, ChevronLeft, Clock, Coins, FileText, Globe,
  Hourglass, Instagram, Layers, LineChart as LineIcon, MapPin, MessageSquare,
  PiggyBank, Plus, Receipt, Save, Send, Settings, Sparkles, Target,
  TrendingUp, Trash2, Users, Wallet, Wrench, X,
} from 'lucide-react';

// ============================================================
// 型定義
// ============================================================

type ServiceDef = {
  id: string; name: string; icon: React.ComponentType<{ className?: string }>;
  initialFee: number; monthlyFee: number;
  defaultInitialHours: number; defaultMonthlyHours: number;
  basePages?: number; baseRevisions?: number; badge?: string; description?: string;
};

type HpPlanId = 'minimal' | 'premium' | 'pro' | 'max';

type CustomOption = { id: number; name: string; initial: number; monthly: number; hpPlanId?: HpPlanId };
type PerUseOption  = { id: number; name: string; unitPrice: number; monthlyCount: number; hpPlanId?: HpPlanId };

type ServiceState = {
  enabled: boolean; initialHours: number; monthlyHours: number; hpPlan: HpPlanId;
  customOptions: CustomOption[]; nextCustomId: number;
  perUseOptions: PerUseOption[];  nextPerUseId: number;
  extraPages: number; extraPagePrice: number;
  extraRevisions: number; extraRevisionPrice: number;
};

type ConsultingItem = { id: number; name: string; price: number };
type ChatMessage   = { role: 'user' | 'assistant'; content: string };

type Client = {
  id: string; name: string; contractMonths: number;
  serviceState: Record<string, ServiceState>;
  consultingEnabled: boolean; consultingItems: ConsultingItem[]; nextConsultingId: number;
  memo: string;
};

type Member = {
  id: string; name: string; hourlyRate: number; toolCost: number;
  clients: Client[];
};

type AppView =
  | { type: 'dashboard' }
  | { type: 'member'; memberId: string }
  | { type: 'client'; memberId: string; clientId: string };

type AppData = { members: Member[]; nextMemberId: number };
type Snapshot = { id: string; name: string; savedAt: string; data: AppData };

// ============================================================
// 定数
// ============================================================

const HP_PLANS: { id: HpPlanId; name: string; initialFee: number; monthlyFee: number; badge?: string }[] = [
  { id: 'minimal', name: 'ミニマム',   initialFee: 0,       monthlyFee: 2_000  },
  { id: 'premium', name: 'プレミアム', initialFee: 0,       monthlyFee: 6_800  },
  { id: 'pro',     name: 'プロ',       initialFee: 100_000, monthlyFee: 6_800  },
  { id: 'max',     name: 'MAX',        initialFee: 200_000, monthlyFee: 12_800 },
];

const SERVICES: ServiceDef[] = [
  { id: 'hp',      name: 'HP制作',                icon: Globe,     initialFee: 0,      monthlyFee: 6_800,  defaultInitialHours: 40, defaultMonthlyHours: 3,  basePages: 15, baseRevisions: 10, description: '5〜15P・月10回まで修正対応' },
  { id: 'sns',     name: 'Instagram運用代行',      icon: Instagram, initialFee: 60_000, monthlyFee: 5_500,  defaultInitialHours: 10, defaultMonthlyHours: 8,  description: 'AI投稿自動生成・インサイト分析' },
  { id: 'meo',     name: 'MEO対策',               icon: MapPin,    initialFee: 60_000, monthlyFee: 5_500,  defaultInitialHours: 8,  defaultMonthlyHours: 4,  description: 'AI口コミ返信・投稿自動生成' },
  { id: 'full',    name: 'フルセット (HP+IG+MEO)', icon: Layers,    initialFee: 60_000, monthlyFee: 14_800, defaultInitialHours: 50, defaultMonthlyHours: 15, basePages: 15, baseRevisions: 10, description: 'HP Premium + Instagram + MEO すべてセット' },
  { id: 'hp_sns',  name: 'HP + Instagram セット',  icon: Globe,     initialFee: 60_000, monthlyFee: 11_000, defaultInitialHours: 50, defaultMonthlyHours: 11, description: 'HP制作(プレミアム) + Instagram運用代行' },
  { id: 'hp_meo',  name: 'HP + MEO セット',        icon: Globe,     initialFee: 60_000, monthlyFee: 11_000, defaultInitialHours: 48, defaultMonthlyHours: 7,  description: 'HP制作(プレミアム) + MEO対策' },
  { id: 'sns_meo', name: 'Instagram + MEO セット', icon: Instagram, initialFee: 60_000, monthlyFee: 11_000, defaultInitialHours: 18, defaultMonthlyHours: 12, description: 'Instagram運用代行 + MEO対策' },
];

const HP_SERVICE_IDS  = ['hp', 'full', 'hp_sns', 'hp_meo'] as const;
const HP_BUNDLE_IDS   = ['full', 'hp_sns', 'hp_meo'] as const;
const isHpService     = (id: string) => HP_SERVICE_IDS.includes(id as (typeof HP_SERVICE_IDS)[number]);
const getAvailableHpPlans = (id: string) =>
  HP_BUNDLE_IDS.includes(id as (typeof HP_BUNDLE_IDS)[number]) ? HP_PLANS.filter(p => p.id !== 'minimal') : HP_PLANS;

const PREMIUM_PLAN = HP_PLANS.find(p => p.id === 'premium')!;
const resolveHpFees = (service: ServiceDef, planId: HpPlanId) => {
  const plan = HP_PLANS.find(p => p.id === planId)!;
  if (service.id === 'hp') return { initialFee: plan.initialFee, monthlyFee: plan.monthlyFee };
  return {
    initialFee: service.initialFee + (plan.initialFee - PREMIUM_PLAN.initialFee),
    monthlyFee: service.monthlyFee + (plan.monthlyFee - PREMIUM_PLAN.monthlyFee),
  };
};

const STORAGE_KEY   = 'price-simulator-v2';
const SNAPSHOTS_KEY = 'price-simulator-snapshots-v2';
const MAX_SNAPSHOTS = 10;

// ============================================================
// ヘルパー関数
// ============================================================

const fmt    = (n: number) => Math.round(n).toLocaleString('ja-JP');
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtNow = () => new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const toHalfWidth = (s: string) => s.replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

const mkServiceState = (s: ServiceDef): ServiceState => ({
  enabled: s.id === 'hp', initialHours: s.defaultInitialHours, monthlyHours: s.defaultMonthlyHours,
  hpPlan: 'premium', customOptions: [], nextCustomId: 1, perUseOptions: [], nextPerUseId: 1,
  extraPages: 0, extraPagePrice: 8_000, extraRevisions: 0, extraRevisionPrice: 3_000,
});

const mkClient = (id: string, name: string): Client => ({
  id, name, contractMonths: 24,
  serviceState: SERVICES.reduce<Record<string, ServiceState>>((acc, s) => { acc[s.id] = mkServiceState(s); return acc; }, {}),
  consultingEnabled: false, consultingItems: [], nextConsultingId: 1, memo: '',
});

const mkMember = (id: string, name: string): Member => ({
  id, name, hourlyRate: 1_500, toolCost: 17_500, clients: [],
});

// ============================================================
// 計算ロジック（純関数）
// ============================================================

function calcClientMetrics(client: Client, hourlyRate: number, allocatedToolCost: number) {
  const { serviceState, contractMonths, consultingEnabled, consultingItems } = client;
  const enabledServices = SERVICES.filter(s => serviceState[s.id]?.enabled);

  const getServiceFees = (s: ServiceDef) => {
    const st = serviceState[s.id];
    if (isHpService(s.id)) return resolveHpFees(s, st.hpPlan);
    return { initialFee: s.initialFee, monthlyFee: s.monthlyFee };
  };

  const serviceInitialRevenue = enabledServices.reduce((sum, s) => sum + getServiceFees(s).initialFee, 0);
  const serviceMonthlyRevenue = enabledServices.reduce((sum, s) => sum + getServiceFees(s).monthlyFee, 0);
  const totalInitialHours     = enabledServices.reduce((sum, s) => sum + (serviceState[s.id]?.initialHours ?? 0), 0);
  const totalMonthlyHours     = enabledServices.reduce((sum, s) => sum + (serviceState[s.id]?.monthlyHours ?? 0), 0);

  const hpEnabled = enabledServices.filter(s => isHpService(s.id));
  const extraPagesRevenue     = hpEnabled.reduce((sum, s) => sum + serviceState[s.id].extraPages * serviceState[s.id].extraPagePrice, 0);
  const extraRevisionsRevenue = hpEnabled.reduce((sum, s) => sum + serviceState[s.id].extraRevisions * serviceState[s.id].extraRevisionPrice, 0);

  const customInitialRevenue = enabledServices.reduce((sum, s) => {
    const st = serviceState[s.id];
    const opts = isHpService(s.id) ? st.customOptions.filter(o => o.hpPlanId === st.hpPlan) : st.customOptions;
    return sum + opts.reduce((s2, o) => s2 + (o.initial || 0), 0);
  }, 0);
  const customMonthlyRevenue = enabledServices.reduce((sum, s) => {
    const st = serviceState[s.id];
    const opts = isHpService(s.id) ? st.customOptions.filter(o => o.hpPlanId === st.hpPlan) : st.customOptions;
    return sum + opts.reduce((s2, o) => s2 + (o.monthly || 0), 0);
  }, 0);
  const perUseMonthlyRevenue = enabledServices.reduce((sum, s) => {
    const st = serviceState[s.id];
    const opts = isHpService(s.id) ? st.perUseOptions.filter(o => o.hpPlanId === st.hpPlan) : st.perUseOptions;
    return sum + opts.reduce((s2, o) => s2 + o.unitPrice * (o.monthlyCount || 0), 0);
  }, 0);

  const consultingMonthly = consultingItems.reduce((s, o) => s + (o.price || 0), 0);
  const consultingRevenue = consultingEnabled ? consultingMonthly : 0;

  const initialRevenue = serviceInitialRevenue + extraPagesRevenue + customInitialRevenue;
  const monthlyRevenue = serviceMonthlyRevenue + extraRevisionsRevenue + customMonthlyRevenue + perUseMonthlyRevenue + consultingRevenue;

  const initialLaborCost = totalInitialHours * hourlyRate;
  const monthlyLaborCost = totalMonthlyHours * hourlyRate;
  const monthlyCost      = monthlyLaborCost + allocatedToolCost;

  const initialProfit = initialRevenue - initialLaborCost;
  const monthlyProfit = monthlyRevenue - monthlyCost;
  const initialMargin = initialRevenue > 0 ? (initialProfit / initialRevenue) * 100 : 0;
  const monthlyMargin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;
  const ltv           = initialProfit + monthlyProfit * contractMonths;

  let paybackMonths: number | null = null;
  if (initialProfit >= 0) paybackMonths = 0;
  else if (monthlyProfit > 0) paybackMonths = Math.ceil(-initialProfit / monthlyProfit);

  const cumulativeData = Array.from({ length: contractMonths + 1 }, (_, m) => ({
    month: m,
    cumulative: Math.round(initialProfit + monthlyProfit * m),
    revenue:    Math.round(initialRevenue + monthlyRevenue * m),
    cost:       Math.round(initialLaborCost + monthlyCost * m),
  }));

  const breakdownData = [
    { name: '初期', 売上: Math.round(initialRevenue), 原価: Math.round(initialLaborCost), 粗利: Math.round(initialProfit) },
    { name: '月額', 売上: Math.round(monthlyRevenue), 原価: Math.round(monthlyCost),       粗利: Math.round(monthlyProfit) },
  ];

  return {
    enabledServices, getServiceFees,
    serviceInitialRevenue, serviceMonthlyRevenue, consultingRevenue, consultingMonthly,
    initialRevenue, monthlyRevenue,
    initialLaborCost, monthlyLaborCost, allocatedToolCost, monthlyCost,
    initialProfit, monthlyProfit, initialMargin, monthlyMargin,
    ltv, paybackMonths,
    totalInitialHours, totalMonthlyHours,
    extraPagesRevenue, extraRevisionsRevenue,
    customInitialRevenue, customMonthlyRevenue, perUseMonthlyRevenue,
    cumulativeData, breakdownData,
  };
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function PriceSimulatorPage() {
  const [members, setMembers] = useState<Member[]>(() => {
    const m = mkMember('1', 'メンバー 1');
    m.clients = [mkClient('c1', 'クライアント 1')];
    return [m];
  });
  const [nextMemberId, setNextMemberId] = useState(2);
  const [view, setView]   = useState<AppView>({ type: 'dashboard' });

  // 保存・読み込み
  const [saveModalOpen,     setSaveModalOpen]     = useState(false);
  const [saveName,          setSaveName]          = useState('');
  const [saveNameComposing, setSaveNameComposing] = useState(false);
  const [overwriteId,       setOverwriteId]       = useState('');
  const [snapshots,         setSnapshots]         = useState<Snapshot[]>([]);
  const [loadModalOpen,     setLoadModalOpen]     = useState(false);

  // localStorage 復元
  useEffect(() => {
    try {
      const snapsRaw = localStorage.getItem(SNAPSHOTS_KEY);
      if (snapsRaw) setSnapshots(JSON.parse(snapsRaw));
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved: AppData = JSON.parse(raw);
      if (Array.isArray(saved.members)) {
        setMembers(saved.members.map(m => ({
          ...mkMember(m.id, m.name),
          ...m,
          clients: (m.clients || []).map(c => ({
            ...mkClient(c.id, c.name),
            ...c,
            serviceState: Object.fromEntries(
              SERVICES.map(s => [s.id, { ...mkServiceState(s), ...(c.serviceState?.[s.id] || {}) }])
            ),
          })),
        })));
      }
      if (saved.nextMemberId) setNextMemberId(saved.nextMemberId);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Member CRUD
  const addMember = () => {
    const id = String(nextMemberId);
    setMembers(prev => [...prev, mkMember(id, `メンバー ${nextMemberId}`)]);
    setNextMemberId(n => n + 1);
  };
  const updateMember = (memberId: string, patch: Partial<Member>) =>
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...patch } : m));
  const deleteMember = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
    if (view.type !== 'dashboard' && (view as { memberId: string }).memberId === memberId)
      setView({ type: 'dashboard' });
  };

  // Client CRUD
  const addClient = (memberId: string) => {
    setMembers(prev => prev.map(m => {
      if (m.id !== memberId) return m;
      const id   = `c${Date.now()}`;
      const name = `クライアント ${m.clients.length + 1}`;
      return { ...m, clients: [...m.clients, mkClient(id, name)] };
    }));
  };
  const updateClient = (memberId: string, clientId: string, patch: Partial<Client>) =>
    setMembers(prev => prev.map(m => m.id !== memberId ? m : {
      ...m, clients: m.clients.map(c => c.id !== clientId ? c : { ...c, ...patch }),
    }));
  const deleteClient = (memberId: string, clientId: string) => {
    setMembers(prev => prev.map(m => m.id !== memberId ? m : {
      ...m, clients: m.clients.filter(c => c.id !== clientId),
    }));
    if (view.type === 'client' && view.memberId === memberId && view.clientId === clientId)
      setView({ type: 'member', memberId });
  };

  // Save / Load
  const currentData = (): AppData => ({ members, nextMemberId });

  const applyData = (d: AppData) => {
    if (Array.isArray(d.members)) setMembers(d.members);
    if (d.nextMemberId) setNextMemberId(d.nextMemberId);
    setView({ type: 'dashboard' });
  };

  const confirmSave = () => {
    const now  = fmtNow();
    const data = currentData();
    let next: Snapshot[];
    if (overwriteId) {
      next = snapshots.map(s => s.id === overwriteId ? { ...s, name: saveName.trim() || s.name, savedAt: now, data } : s);
    } else {
      const name = saveName.trim() || `スナップショット ${snapshots.length + 1}`;
      next = [{ id: Date.now().toString(), name, savedAt: now, data }, ...snapshots].slice(0, MAX_SNAPSHOTS);
    }
    setSnapshots(next);
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
      localStorage.setItem(STORAGE_KEY,   JSON.stringify(data));
    } catch { /* ignore */ }
    setSaveModalOpen(false);
    setSaveName('');
    setOverwriteId('');
  };

  const loadSnapshot = (snap: Snapshot) => {
    applyData(snap.data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snap.data)); } catch { /* ignore */ }
    setLoadModalOpen(false);
  };

  const deleteSnapshot = (id: string) => {
    const next = snapshots.filter(s => s.id !== id);
    setSnapshots(next);
    try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const currentMember = view.type !== 'dashboard'
    ? members.find(m => m.id === (view as { memberId: string }).memberId) ?? null
    : null;
  const currentClient = view.type === 'client' && currentMember
    ? currentMember.clients.find(c => c.id === (view as { clientId: string }).clientId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ===== Fixed: 保存・読み込みボタン ===== */}
      <div className="fixed top-3 right-3 z-40 flex items-center gap-2 sm:top-4 sm:right-4">
        {snapshots.length > 0 && (
          <button type="button" onClick={() => setLoadModalOpen(true)}
            className="flex items-center gap-2 rounded-full border border-indigo-200 bg-white/90 px-3 py-2 text-sm font-semibold text-indigo-600 shadow-md backdrop-blur-sm transition hover:bg-indigo-50 active:scale-95 sm:px-4">
            <ArrowDownToLine className="h-4 w-4" />
            <span className="hidden sm:inline">読み込み</span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 sm:ml-0.5">{snapshots.length}</span>
          </button>
        )}
        <button type="button" onClick={() => { setSaveName(''); setOverwriteId(''); setSaveModalOpen(true); }}
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 active:scale-95 sm:px-4">
          <Save className="h-4 w-4" />
          <span>保存</span>
        </button>
      </div>

      {/* ===== Views ===== */}
      {view.type === 'dashboard' && (
        <DashboardView
          members={members}
          onSelectMember={id => setView({ type: 'member', memberId: id })}
          onAddMember={addMember}
          onDeleteMember={deleteMember}
          onUpdateMember={updateMember}
        />
      )}
      {view.type === 'member' && currentMember && (
        <MemberView
          member={currentMember}
          onBack={() => setView({ type: 'dashboard' })}
          onSelectClient={clientId => setView({ type: 'client', memberId: currentMember.id, clientId })}
          onAddClient={() => addClient(currentMember.id)}
          onDeleteClient={clientId => deleteClient(currentMember.id, clientId)}
          onUpdateMember={patch => updateMember(currentMember.id, patch)}
          onUpdateClient={(clientId, patch) => updateClient(currentMember.id, clientId, patch)}
        />
      )}
      {view.type === 'client' && currentMember && currentClient && (
        <ClientDetailView
          client={currentClient}
          member={currentMember}
          onBack={() => setView({ type: 'member', memberId: currentMember.id })}
          onUpdateClient={patch => updateClient(currentMember.id, currentClient.id, patch)}
        />
      )}

      {/* ===== 保存モーダル ===== */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-2 text-base font-bold text-slate-900">
              <Save className="h-5 w-5 text-indigo-500" />スナップショット保存
            </div>
            <p className="mb-4 text-xs text-slate-500">現在の全データに名前をつけて保存します（最大{MAX_SNAPSHOTS}件）。</p>
            {snapshots.length > 0 && (
              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-500">既存データを上書き（任意）</label>
                <select value={overwriteId} onChange={e => { const id = e.target.value; setOverwriteId(id); if (id) setSaveName(snapshots.find(s => s.id === id)?.name ?? ''); else setSaveName(''); }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">── 新規保存 ──</option>
                  {snapshots.map(s => <option key={s.id} value={s.id}>{s.name}（{s.savedAt}）</option>)}
                </select>
              </div>
            )}
            <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
              onCompositionStart={() => setSaveNameComposing(true)} onCompositionEnd={() => setSaveNameComposing(false)}
              onKeyDown={e => e.key === 'Enter' && !saveNameComposing && confirmSave()}
              placeholder={overwriteId ? '名前を変更（空欄で現在の名前のまま）' : `スナップショット ${snapshots.length + 1}`}
              className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" autoFocus />
            {!overwriteId && snapshots.length >= MAX_SNAPSHOTS && (
              <p className="mb-3 text-xs text-amber-600">上限({MAX_SNAPSHOTS}件)に達しています。古いデータが削除されます。</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setSaveModalOpen(false); setOverwriteId(''); setSaveName(''); }}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">キャンセル</button>
              <button type="button" onClick={confirmSave}
                className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">{overwriteId ? '上書き保存' : '保存する'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 読み込みモーダル ===== */}
      {loadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ArrowDownToLine className="h-5 w-5 text-indigo-500" />保存データ読み込み
              </div>
              <button type="button" onClick={() => setLoadModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {snapshots.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">保存されたデータがありません</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {snapshots.map(snap => (
                  <li key={snap.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{snap.name}</p>
                      <p className="text-xs text-slate-400">{snap.savedAt}</p>
                    </div>
                    <button type="button" onClick={() => loadSnapshot(snap)}
                      className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">読み込む</button>
                    <button type="button" onClick={() => deleteSnapshot(snap.id)}
                      className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500" aria-label="削除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ダッシュボード
// ============================================================

function DashboardView({ members, onSelectMember, onAddMember, onDeleteMember, onUpdateMember }: {
  members: Member[];
  onSelectMember: (id: string) => void;
  onAddMember: () => void;
  onDeleteMember: (id: string) => void;
  onUpdateMember: (id: string, patch: Partial<Member>) => void;
}) {
  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1440px]">
        {/* ヘッダー */}
        <header className="mb-6 pr-36 sm:pr-48">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 text-white shadow-lg shadow-indigo-200 sm:p-2.5">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 sm:text-2xl md:text-3xl">料金・利益シミュレーター</h1>
              <p className="hidden text-sm text-slate-500 sm:block">AI Marketingメンバー1人1人の時間と付加価値を守るためのツール</p>
            </div>
          </div>
        </header>

        {/* メンバー一覧 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Users className="h-4 w-4 text-indigo-500" />担当メンバー
          </h2>
          <button type="button" onClick={onAddMember}
            className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95">
            <Plus className="h-4 w-4" />メンバーを追加
          </button>
        </div>

        {members.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">メンバーを追加してください</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map(member => (
              <MemberCard key={member.id} member={member}
                onSelect={() => onSelectMember(member.id)}
                onDelete={() => onDeleteMember(member.id)}
                onUpdateName={name => onUpdateMember(member.id, { name })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberCard({ member, onSelect, onDelete, onUpdateName }: {
  member: Member; onSelect: () => void; onDelete: () => void; onUpdateName: (n: string) => void;
}) {
  const clientCount   = member.clients.length;
  const allocated     = member.toolCost / Math.max(1, clientCount);
  const totalInitial  = member.clients.reduce((s, c) => s + calcClientMetrics(c, member.hourlyRate, allocated).initialProfit,  0);
  const totalMonthly  = member.clients.reduce((s, c) => s + calcClientMetrics(c, member.hourlyRate, allocated).monthlyProfit,  0);
  const totalLtv      = member.clients.reduce((s, c) => s + calcClientMetrics(c, member.hourlyRate, allocated).ltv,            0);
  const initial       = member.name.charAt(0).toUpperCase();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-base font-bold text-white shadow">
            {initial}
          </div>
          <input
            type="text" value={member.name}
            onChange={e => onUpdateName(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="text-base font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none w-full"
          />
        </div>
        <button type="button" onClick={onDelete}
          className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500" aria-label="削除">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex gap-3 text-xs text-slate-500">
        <span>時給 ¥{fmt(member.hourlyRate)}</span>
        <span>ツール ¥{fmt(member.toolCost)}/月</span>
        <span className="ml-auto font-semibold text-indigo-600">{clientCount}社担当</span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <div className="text-[10px] text-slate-400">初期粗利</div>
          <div className={`text-sm font-bold tabular-nums ${totalInitial >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>¥{fmt(totalInitial)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-center">
          <div className="text-[10px] text-slate-400">月額粗利</div>
          <div className={`text-sm font-bold tabular-nums ${totalMonthly >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>¥{fmt(totalMonthly)}</div>
        </div>
        <div className="rounded-lg bg-indigo-50 p-2 text-center">
          <div className="text-[10px] text-indigo-400">LTV合計</div>
          <div className={`text-sm font-bold tabular-nums ${totalLtv >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>¥{fmt(totalLtv)}</div>
        </div>
      </div>

      <button type="button" onClick={onSelect}
        className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95">
        詳細を見る →
      </button>
    </div>
  );
}

// ============================================================
// メンバービュー
// ============================================================

function MemberView({ member, onBack, onSelectClient, onAddClient, onDeleteClient, onUpdateMember, onUpdateClient }: {
  member: Member;
  onBack: () => void;
  onSelectClient: (id: string) => void;
  onAddClient: () => void;
  onDeleteClient: (id: string) => void;
  onUpdateMember: (patch: Partial<Member>) => void;
  onUpdateClient: (clientId: string, patch: Partial<Client>) => void;
}) {
  const clientCount = member.clients.length;
  const allocated   = member.toolCost / Math.max(1, clientCount);
  const allMetrics  = member.clients.map(c => calcClientMetrics(c, member.hourlyRate, allocated));

  const totalInitial = allMetrics.reduce((s, m) => s + m.initialProfit,  0);
  const totalMonthly = allMetrics.reduce((s, m) => s + m.monthlyProfit,  0);
  const totalLtv     = allMetrics.reduce((s, m) => s + m.ltv,            0);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1440px]">
        {/* ヘッダー */}
        <header className="mb-6 pr-36 sm:pr-48">
          <button type="button" onClick={onBack}
            className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-600">
            <ChevronLeft className="h-4 w-4" />ダッシュボード
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-base font-bold text-white shadow">
              {member.name.charAt(0)}
            </div>
            <input type="text" value={member.name} onChange={e => onUpdateMember({ name: e.target.value })}
              className="text-xl font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none" />
          </div>
          {/* メンバー設定 */}
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Coins className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500">担当者時給</span>
              <NumberField compact label="" suffix="円" value={member.hourlyRate} onChange={v => onUpdateMember({ hourlyRate: v })} step={100} min={0} containerClassName="border-0 bg-transparent p-0" inputClassName="w-20 text-sm" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500">AIツール月額</span>
              <NumberField compact label="" suffix="円" value={member.toolCost} onChange={v => onUpdateMember({ toolCost: v })} step={500} min={0} containerClassName="border-0 bg-transparent p-0" inputClassName="w-24 text-sm" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              按分: ¥{fmt(allocated)}/社
            </div>
          </div>
        </header>

        {/* 集計KPI */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard icon={<Receipt className="h-4 w-4" />}   label="初期粗利合計" value={`¥${fmt(totalInitial)}`} tone={totalInitial >= 0 ? 'positive' : 'negative'} />
          <KpiCard icon={<PiggyBank className="h-4 w-4" />} label="月額粗利合計" value={`¥${fmt(totalMonthly)}`} tone={totalMonthly >= 0 ? 'positive' : 'negative'} />
          <KpiCard icon={<Target className="h-4 w-4" />}    label="LTV合計"      value={`¥${fmt(totalLtv)}`}     tone={totalLtv >= 0 ? 'positive' : 'negative'} highlight />
          <KpiCard icon={<Users className="h-4 w-4" />}     label="担当クライアント" value={`${clientCount}社`}  tone="neutral" />
        </div>

        {/* クライアント一覧 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Wallet className="h-4 w-4 text-indigo-500" />担当クライアント
          </h2>
          <button type="button" onClick={onAddClient}
            className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95">
            <Plus className="h-4 w-4" />クライアントを追加
          </button>
        </div>

        {clientCount === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">クライアントを追加してください</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {member.clients.map((client, i) => {
              const m = allMetrics[i];
              const enabledNames = m.enabledServices.map(s => s.name);
              return (
                <div key={client.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <input type="text" value={client.name} onChange={e => onUpdateClient(client.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      className="text-base font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none w-full" />
                    <button type="button" onClick={() => onDeleteClient(client.id)}
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500" aria-label="削除">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {enabledNames.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {enabledNames.map(n => (
                        <span key={n} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">{n}</span>
                      ))}
                    </div>
                  )}

                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                      <div className="text-[10px] text-slate-400">初期粗利</div>
                      <div className={`text-sm font-bold tabular-nums ${m.initialProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>¥{fmt(m.initialProfit)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 text-center">
                      <div className="text-[10px] text-slate-400">月額粗利</div>
                      <div className={`text-sm font-bold tabular-nums ${m.monthlyProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>¥{fmt(m.monthlyProfit)}</div>
                    </div>
                    <div className="rounded-lg bg-indigo-50 p-2 text-center">
                      <div className="text-[10px] text-indigo-400">LTV</div>
                      <div className={`text-sm font-bold tabular-nums ${m.ltv >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>¥{fmt(m.ltv)}</div>
                    </div>
                  </div>

                  <button type="button" onClick={() => onSelectClient(client.id)}
                    className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-95">
                    詳細設定 →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// クライアント詳細ビュー（シミュレーター本体）
// ============================================================

function ClientDetailView({ client, member, onBack, onUpdateClient }: {
  client: Client; member: Member;
  onBack: () => void;
  onUpdateClient: (patch: Partial<Client>) => void;
}) {
  const { serviceState, consultingEnabled, consultingItems, contractMonths, memo } = client;

  // ローカル UI ステート
  const [hpAddonOpen, setHpAddonOpen] = useState<Record<string, { pages: boolean; revisions: boolean }>>({});
  const toggleHpAddon = (serviceId: string, key: 'pages' | 'revisions') =>
    setHpAddonOpen(prev => {
      const cur = prev[serviceId] ?? { pages: false, revisions: false };
      return { ...prev, [serviceId]: { ...cur, [key]: !cur[key] } };
    });

  // チャット
  const [chatOpen,      setChatOpen]      = useState(false);
  const [chatMessages,  setChatMessages]  = useState<ChatMessage[]>([]);
  const [chatInput,     setChatInput]     = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // 計算
  const allocatedToolCost = member.toolCost / Math.max(1, member.clients.length);
  const calc = useMemo(
    () => calcClientMetrics(client, member.hourlyRate, allocatedToolCost),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, member.hourlyRate, allocatedToolCost],
  );
  const consultingMonthly = calc.consultingMonthly;

  // サービス更新ヘルパー
  const updateService = (id: string, patch: Partial<ServiceState>) =>
    onUpdateClient({ serviceState: { ...serviceState, [id]: { ...serviceState[id], ...patch } } });

  const addCustomOption = (serviceId: string) => {
    const st = serviceState[serviceId];
    onUpdateClient({ serviceState: { ...serviceState, [serviceId]: {
      ...st,
      customOptions: [...st.customOptions, { id: st.nextCustomId, name: '', initial: 0, monthly: 0, ...(isHpService(serviceId) ? { hpPlanId: st.hpPlan } : {}) }],
      nextCustomId: st.nextCustomId + 1,
    }}});
  };
  const updateCustomOption = (serviceId: string, id: number, patch: Partial<CustomOption>) =>
    onUpdateClient({ serviceState: { ...serviceState, [serviceId]: {
      ...serviceState[serviceId],
      customOptions: serviceState[serviceId].customOptions.map(o => o.id === id ? { ...o, ...patch } : o),
    }}});
  const removeCustomOption = (serviceId: string, id: number) =>
    onUpdateClient({ serviceState: { ...serviceState, [serviceId]: {
      ...serviceState[serviceId],
      customOptions: serviceState[serviceId].customOptions.filter(o => o.id !== id),
    }}});

  const addPerUseOption = (serviceId: string) => {
    const st = serviceState[serviceId];
    onUpdateClient({ serviceState: { ...serviceState, [serviceId]: {
      ...st,
      perUseOptions: [...st.perUseOptions, { id: st.nextPerUseId, name: '', unitPrice: 0, monthlyCount: 0, ...(isHpService(serviceId) ? { hpPlanId: st.hpPlan } : {}) }],
      nextPerUseId: st.nextPerUseId + 1,
    }}});
  };
  const updatePerUseOption = (serviceId: string, id: number, patch: Partial<PerUseOption>) =>
    onUpdateClient({ serviceState: { ...serviceState, [serviceId]: {
      ...serviceState[serviceId],
      perUseOptions: serviceState[serviceId].perUseOptions.map(o => o.id === id ? { ...o, ...patch } : o),
    }}});
  const removePerUseOption = (serviceId: string, id: number) =>
    onUpdateClient({ serviceState: { ...serviceState, [serviceId]: {
      ...serviceState[serviceId],
      perUseOptions: serviceState[serviceId].perUseOptions.filter(o => o.id !== id),
    }}});

  // コンサルティング
  const addConsultingItem = () =>
    onUpdateClient({ consultingItems: [...consultingItems, { id: client.nextConsultingId, name: '', price: 0 }], nextConsultingId: client.nextConsultingId + 1 });
  const updateConsultingItem = (id: number, patch: Partial<ConsultingItem>) =>
    onUpdateClient({ consultingItems: consultingItems.map(o => o.id === id ? { ...o, ...patch } : o) });
  const removeConsultingItem = (id: number) =>
    onUpdateClient({ consultingItems: consultingItems.filter(o => o.id !== id) });

  // チャット
  const buildSimContext = () => [
    `■ 担当者設定`,
    `担当者時給: ¥${fmt(member.hourlyRate)} / AIツール月額: ¥${fmt(member.toolCost)} / 担当${member.clients.length}社（按分¥${fmt(allocatedToolCost)}）/ 契約縛り: ${contractMonths}ヶ月`,
    ``,
    `■ 選択中サービス`,
    calc.enabledServices.length > 0
      ? calc.enabledServices.map(s => {
          const fees = calc.getServiceFees(s);
          const plan = isHpService(s.id) ? HP_PLANS.find(p => p.id === serviceState[s.id].hpPlan)!.name : null;
          return `${s.name}${plan ? `(${plan})` : ''}（初期¥${fmt(fees.initialFee)} / 月額¥${fmt(fees.monthlyFee)}）`;
        }).join(', ')
      : 'なし',
    ``,
    `■ 追加オプション`,
    `コンサルティング: ${consultingEnabled ? `ON（¥${fmt(consultingMonthly)}/月）` : 'OFF'} / 追加ページ: ¥${fmt(calc.extraPagesRevenue)} / 超過修正: ¥${fmt(calc.extraRevisionsRevenue)} / 従量課金: ${calc.perUseMonthlyRevenue > 0 ? `¥${fmt(calc.perUseMonthlyRevenue)}/月` : 'なし'}`,
    ``,
    `■ シミュレーション結果`,
    `初期: 売上¥${fmt(calc.initialRevenue)} / 原価¥${fmt(calc.initialLaborCost)} / 粗利¥${fmt(calc.initialProfit)} / 利益率${fmtPct(calc.initialMargin)}`,
    `月額: 売上¥${fmt(calc.monthlyRevenue)} / 原価¥${fmt(calc.monthlyCost)} / 粗利¥${fmt(calc.monthlyProfit)} / 利益率${fmtPct(calc.monthlyMargin)}`,
    `LTV（${contractMonths}ヶ月）: ¥${fmt(calc.ltv)}`,
    calc.paybackMonths === 0 ? '初期コスト回収: 即回収（初期粗利プラス）'
      : calc.paybackMonths === null ? '初期コスト回収: 回収不可（月額粗利マイナス）'
      : `初期コスト回収: ${calc.paybackMonths}ヶ月`,
  ].join('\n');

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatStreaming) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatStreaming(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, simContext: buildSimContext() }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setChatMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: text }; return u; });
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }]);
    } finally {
      setChatStreaming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1440px]">
        {/* ヘッダー */}
        <header className="mb-4 pr-36 sm:mb-6 sm:pr-48">
          <button type="button" onClick={onBack}
            className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-indigo-600">
            <ChevronLeft className="h-4 w-4" />{member.name}
          </button>
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2 text-white shadow-lg shadow-indigo-200 sm:p-2.5">
              <Calculator className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <input type="text" value={client.name} onChange={e => onUpdateClient({ name: e.target.value })}
              className="text-lg font-bold text-slate-900 sm:text-2xl bg-transparent border-b border-transparent focus:border-indigo-400 focus:outline-none flex-1" />
          </div>
          <div className="mt-2 flex flex-wrap gap-3 pl-0 text-xs text-slate-400">
            <span>時給: ¥{fmt(member.hourlyRate)}</span>
            <span>ツール: ¥{fmt(member.toolCost)}/月</span>
            <span>按分: ¥{fmt(allocatedToolCost)}/社（{member.clients.length}社担当）</span>
          </div>
        </header>

        {/* 前提条件（契約期間のみ） */}
        <Section icon={<Settings className="h-4 w-4" />} title="① 前提条件" subtitle="契約期間は LTV・コスト回収計算に使用">
          <NumberField icon={<Calendar className="h-4 w-4" />} label="契約期間縛り" suffix="ヶ月" value={contractMonths}
            onChange={v => onUpdateClient({ contractMonths: v })} step={1} min={1} max={120} hint="LTV計算の対象期間" />
        </Section>

        {/* メインコンテンツ */}
        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12">
          {/* 左ペイン */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-7">

            {/* サービスメニュー */}
            <Section icon={<Wallet className="h-4 w-4" />} title="② サービスメニュー" subtitle="提供するプランを選択し、想定作業時間を入力">
              <div className="space-y-3">
                {SERVICES.map(s => {
                  const st = serviceState[s.id];
                  const Icon = s.icon;
                  const isHp = isHpService(s.id);
                  const currentPlan  = isHp ? HP_PLANS.find(p => p.id === st.hpPlan)! : null;
                  const planCustomOpts = isHp ? st.customOptions.filter(o => o.hpPlanId === st.hpPlan) : st.customOptions;
                  const planPerUseOpts = isHp ? st.perUseOptions.filter(o => o.hpPlanId === st.hpPlan) : st.perUseOptions;

                  return (
                    <div key={s.id} className={`rounded-xl border-2 p-4 transition-all ${st.enabled ? 'border-indigo-300 bg-indigo-50/40 shadow-sm shadow-indigo-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" checked={st.enabled} onChange={e => updateService(s.id, { enabled: e.target.checked })}
                          className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <div className={`rounded-lg p-2 ${st.enabled ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{s.name}</span>
                            {isHp && st.enabled && currentPlan && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{currentPlan.name}</span>
                            )}
                            {s.badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{s.badge}</span>}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            初期 ¥{fmt(calc.getServiceFees(s).initialFee)} / 月額 ¥{fmt(calc.getServiceFees(s).monthlyFee)}
                            {s.description && ` ・ ${s.description}`}
                          </div>
                        </div>
                      </label>

                      {st.enabled && isHp && (
                        <div className={`mt-3 grid gap-1.5 border-t border-indigo-100 pt-3 ${getAvailableHpPlans(s.id).length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                          {getAvailableHpPlans(s.id).map(plan => (
                            <button key={plan.id} type="button" onClick={() => updateService(s.id, { hpPlan: plan.id })}
                              className={`rounded-lg px-1.5 py-2 text-center transition ${st.hpPlan === plan.id ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
                              <div className="text-[11px] font-semibold leading-tight">
                                {plan.name}
                                {plan.badge && <span className={`ml-1 rounded-full px-1 py-0.5 text-[8px] font-bold ${st.hpPlan === plan.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{plan.badge}</span>}
                              </div>
                              <div className={`mt-0.5 text-[9px] ${st.hpPlan === plan.id ? 'text-indigo-100' : 'text-slate-400'}`}>{plan.initialFee > 0 ? `初期¥${(plan.initialFee / 10000).toFixed(0)}万` : '初期¥0'}</div>
                              <div className={`text-[10px] font-bold ${st.hpPlan === plan.id ? 'text-white' : 'text-slate-700'}`}>¥{plan.monthlyFee.toLocaleString()}/月</div>
                            </button>
                          ))}
                        </div>
                      )}

                      {st.enabled && (
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-indigo-100 pt-3">
                          <NumberField compact icon={<Clock className="h-3.5 w-3.5" />} label="初期作業時間(納品までにかかった時間)" suffix="h"
                            value={st.initialHours} onChange={v => updateService(s.id, { initialHours: v })} step={0.5} min={0} />
                          <NumberField compact icon={<Clock className="h-3.5 w-3.5" />} label="月次作業時間" suffix="h/月"
                            value={st.monthlyHours} onChange={v => updateService(s.id, { monthlyHours: v })} step={0.5} min={0} />
                        </div>
                      )}

                      {st.enabled && isHp && (
                        <div className="mt-4 space-y-1.5 border-t border-indigo-100 pt-3">
                          <div className="mb-1 text-[11px] font-semibold text-indigo-700">HP オプション</div>
                          {/* 追加ページ数 アコーディオン */}
                          {(() => {
                            const open  = hpAddonOpen[s.id]?.pages ?? false;
                            const total = st.extraPages * st.extraPagePrice;
                            return (
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <button type="button" onClick={() => toggleHpAddon(s.id, 'pages')}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50">
                                  <span className="rounded-md bg-indigo-100 p-1 text-indigo-600"><FileText className="h-3.5 w-3.5" /></span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-semibold text-slate-800">追加ページ数</div>
                                    <div className="text-[10px] text-slate-400">16ページ目以降</div>
                                  </div>
                                  {total > 0 && <span className="text-xs font-bold text-indigo-600">+¥{fmt(total)}</span>}
                                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && (
                                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-3">
                                    <NumberField compact label="ページ数" suffix="P" value={st.extraPages} onChange={v => updateService(s.id, { extraPages: v })} step={1} min={0} />
                                    <NumberField compact label="単価" suffix="円/P" value={st.extraPagePrice} onChange={v => updateService(s.id, { extraPagePrice: v })} step={500} min={0} />
                                    <ReadonlyField label="売上加算" value={`¥${fmt(total)}`} />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {/* 月間超過修正 アコーディオン */}
                          {(() => {
                            const open  = hpAddonOpen[s.id]?.revisions ?? false;
                            const total = st.extraRevisions * st.extraRevisionPrice;
                            return (
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <button type="button" onClick={() => toggleHpAddon(s.id, 'revisions')}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50">
                                  <span className="rounded-md bg-purple-100 p-1 text-purple-600"><Wrench className="h-3.5 w-3.5" /></span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-semibold text-slate-800">月間超過修正</div>
                                    <div className="text-[10px] text-slate-400">11回目以降</div>
                                  </div>
                                  {total > 0 && <span className="text-xs font-bold text-purple-600">+¥{fmt(total)}/月</span>}
                                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                                </button>
                                {open && (
                                  <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-3">
                                    <NumberField compact label="超過回数" suffix="回/月" value={st.extraRevisions} onChange={v => updateService(s.id, { extraRevisions: v })} step={1} min={0} />
                                    <NumberField compact label="単価" suffix="円/回" value={st.extraRevisionPrice} onChange={v => updateService(s.id, { extraRevisionPrice: v })} step={500} min={0} />
                                    <ReadonlyField label="月額加算" value={`¥${fmt(total)}`} />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* 独自オプション */}
                      {st.enabled && (
                        <div className="mt-3 border-t border-indigo-100 pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-purple-100 p-1 text-purple-600"><Sparkles className="h-3.5 w-3.5" /></span>
                              <div>
                                <div className="text-[12px] font-semibold text-slate-900">
                                  独自オプション
                                  {isHp && currentPlan && <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">{currentPlan.name}</span>}
                                </div>
                                <div className="text-[10px] text-slate-400">カスタムの初期/月額アップセルを追加</div>
                              </div>
                            </div>
                            <button type="button" onClick={() => addCustomOption(s.id)}
                              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-indigo-50">
                              <Plus className="h-3 w-3" /> 追加
                            </button>
                          </div>
                          {planCustomOpts.length === 0 ? (
                            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 py-3 text-center text-[11px] text-slate-400">
                              {isHp && currentPlan ? `${currentPlan.name}プランの独自オプションを追加` : 'このサービスの独自オプションを追加'}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {planCustomOpts.map(o => (
                                <div key={o.id} className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                                  <div className="mb-1.5">
                                    <label className="mb-0.5 block text-[10px] font-medium text-slate-500">名称</label>
                                    <input value={o.name} onChange={e => updateCustomOption(s.id, o.id, { name: e.target.value })}
                                      placeholder="例: SEO記事制作"
                                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                      <label className="mb-0.5 block text-[10px] font-medium text-slate-500">初期 (円)</label>
                                      <InlineNumInput value={o.initial} onChange={v => updateCustomOption(s.id, o.id, { initial: v })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div className="flex-1">
                                      <label className="mb-0.5 block text-[10px] font-medium text-slate-500">月額 (円)</label>
                                      <InlineNumInput value={o.monthly} onChange={v => updateCustomOption(s.id, o.id, { monthly: v })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <button type="button" onClick={() => removeCustomOption(s.id, o.id)}
                                      className="shrink-0 rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label="削除">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 従量課金 */}
                      {st.enabled && (
                        <div className="mt-3 border-t border-indigo-100 pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-purple-100 p-1 text-purple-600"><BarChart3 className="h-3.5 w-3.5" /></span>
                              <div>
                                <div className="text-[12px] font-semibold text-slate-900">
                                  従量課金メニュー
                                  {isHp && currentPlan && <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">{currentPlan.name}</span>}
                                </div>
                                <div className="text-[10px] text-slate-400">単価 × 月間回数で月額売上に加算</div>
                              </div>
                            </div>
                            <button type="button" onClick={() => addPerUseOption(s.id)}
                              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-indigo-50">
                              <Plus className="h-3 w-3" /> 追加
                            </button>
                          </div>
                          {planPerUseOpts.length === 0 ? (
                            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 py-3 text-center text-[11px] text-slate-400">
                              {isHp && currentPlan ? `${currentPlan.name}プランの従量課金を追加` : 'このサービスの従量課金を追加'}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {planPerUseOpts.map(opt => {
                                const monthly = opt.unitPrice * (opt.monthlyCount || 0);
                                return (
                                  <div key={opt.id} className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                                    <div className="mb-1.5">
                                      <label className="mb-0.5 block text-[10px] font-medium text-slate-500">名称</label>
                                      <input value={opt.name} onChange={e => updatePerUseOption(s.id, opt.id, { name: e.target.value })}
                                        placeholder="例: AI記事作成"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div className="flex items-end gap-2">
                                      <div className="flex-1">
                                        <label className="mb-0.5 block text-[10px] font-medium text-slate-500">単価 (円)</label>
                                        <InlineNumInput value={opt.unitPrice} onChange={v => updatePerUseOption(s.id, opt.id, { unitPrice: v })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                      </div>
                                      <div className="flex-1">
                                        <label className="mb-0.5 block text-[10px] font-medium text-slate-500">月間回数</label>
                                        <InlineNumInput value={opt.monthlyCount} onChange={v => updatePerUseOption(s.id, opt.id, { monthlyCount: v })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                      </div>
                                      <div className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-emerald-700">¥{fmt(monthly)}</div>
                                      <button type="button" onClick={() => removePerUseOption(s.id, opt.id)}
                                        className="shrink-0 rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label="削除">
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* アドオン */}
            <Section icon={<Plus className="h-4 w-4" />} title="③ 追加オプション (アドオン)" subtitle="基本プランに追加するアップセル要素">
              <div className="space-y-3">
                <div className={`rounded-lg border-2 transition-all ${consultingEnabled ? 'border-purple-300 bg-purple-50/40' : 'border-slate-200 bg-white'}`}>
                  <label className="flex cursor-pointer items-center gap-3 p-3">
                    <input type="checkbox" checked={consultingEnabled} onChange={e => onUpdateClient({ consultingEnabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                    <div className={`rounded-md p-1.5 ${consultingEnabled ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'}`}><Target className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">コンサルティング</span>
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">月額売上</span>
                      </div>
                    </div>
                    {consultingEnabled && <div className="text-sm font-bold text-purple-600">合計 ¥{fmt(consultingMonthly)}/月</div>}
                  </label>
                  {consultingEnabled && (
                    <div className="border-t border-purple-200 px-3 pb-3 pt-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">何をやるか・いくらでやるか</span>
                        <button type="button" onClick={addConsultingItem}
                          className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-purple-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-purple-50">
                          <Plus className="h-3 w-3" /> 追加
                        </button>
                      </div>
                      {consultingItems.length === 0 ? (
                        <div className="rounded-md border border-dashed border-purple-300 bg-white py-3 text-center text-[11px] text-slate-400">項目を追加してください</div>
                      ) : (
                        <div className="space-y-1.5">
                          {consultingItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                              <input value={item.name} onChange={e => updateConsultingItem(item.id, { name: e.target.value })}
                                placeholder="例: 戦略提案・月次レポート"
                                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                              <input type="number" value={item.price} onChange={e => updateConsultingItem(item.id, { price: Number(e.target.value) || 0 })}
                                className="w-28 flex-none rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                              <span className="flex-none text-[11px] text-slate-500">円/月</span>
                              <button type="button" onClick={() => removeConsultingItem(item.id)}
                                className="flex-none rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label="削除">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <div className="mt-2 flex justify-end border-t border-purple-200 pt-2">
                            <span className="text-sm font-bold text-purple-600">合計 ¥{fmt(consultingMonthly)}/月</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </div>

          {/* 右ペイン */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-5">
            {/* KPI */}
            <Section icon={<TrendingUp className="h-4 w-4" />} title="④ シミュレーション結果" subtitle="入力値から自動計算">
              <div className="grid grid-cols-2 gap-3">
                <KpiCard icon={<Receipt className="h-4 w-4" />}   label="初期粗利" value={`¥${fmt(calc.initialProfit)}`} sub={`売上 ¥${fmt(calc.initialRevenue)} - 原価 ¥${fmt(calc.initialLaborCost)}`} margin={calc.initialMargin} tone={calc.initialProfit >= 0 ? 'positive' : 'negative'} />
                <KpiCard icon={<PiggyBank className="h-4 w-4" />} label="月額粗利" value={`¥${fmt(calc.monthlyProfit)}`} sub={`売上 ¥${fmt(calc.monthlyRevenue)} - 原価 ¥${fmt(calc.monthlyCost)}`} margin={calc.monthlyMargin} tone={calc.monthlyProfit >= 0 ? 'positive' : 'negative'} />
                <KpiCard icon={<Target className="h-4 w-4" />}    label={`LTV (${contractMonths}ヶ月)`} value={`¥${fmt(calc.ltv)}`} sub={`初期粗利 + 月額粗利 × ${contractMonths}`} tone={calc.ltv >= 0 ? 'positive' : 'negative'} highlight />
                <KpiCard icon={<Hourglass className="h-4 w-4" />} label="初期コスト回収"
                  value={calc.paybackMonths === 0 ? '即回収' : calc.paybackMonths === null ? '回収不可' : `${calc.paybackMonths}ヶ月`}
                  sub={calc.paybackMonths === 0 ? '初期粗利がプラス' : calc.paybackMonths === null ? '月額粗利がマイナス' : calc.paybackMonths <= contractMonths ? '契約期間内に回収可能 ✓' : '契約期間を超過 ✕'}
                  tone={calc.paybackMonths === 0 ? 'positive' : calc.paybackMonths === null || calc.paybackMonths > contractMonths ? 'negative' : 'neutral'} />
              </div>
              {calc.enabledServices.length === 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-none" /><div>サービスが選択されていません。少なくとも1つ選択してください。</div>
                </div>
              )}
              {calc.enabledServices.length > 0 && calc.monthlyProfit > 0 && calc.initialProfit >= 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 flex-none" /><div>初期から黒字、月額も継続的に利益が出る健全なモデルです。</div>
                </div>
              )}
            </Section>

            {/* チャート */}
            <Section icon={<LineIcon className="h-4 w-4" />} title="⑤ グラフ" subtitle="契約期間中の収益推移">
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">売上・原価・粗利の内訳</p>
                  <p className="mb-2 text-[10px] text-slate-400">初期 vs 月額</p>
                  <div className="h-48 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={calc.breakdownData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="売上" fill="#6366f1" radius={[3,3,0,0]} />
                        <Bar dataKey="原価" fill="#f43f5e" radius={[3,3,0,0]} />
                        <Bar dataKey="粗利" fill="#10b981" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">累積粗利の推移</p>
                  <p className="mb-2 text-[10px] text-slate-400">契約期間 {contractMonths}ヶ月における累積額</p>
                  <div className="h-48 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={calc.cumulativeData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => `${v}ヶ月`} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 10000).toFixed(0)}万`} />
                        <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} labelFormatter={l => `${l}ヶ月目`} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="cumulative" name="累積粗利" stroke="#6366f1" strokeWidth={2} fill="url(#gradProfit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Section>

            {/* 詳細内訳 */}
            <Section icon={<FileText className="h-4 w-4" />} title="⑥ 詳細内訳" subtitle="計算根拠の透明化">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailBlock title="初期フェーズ" tone="indigo">
                  <DetailRow label="サービス売上" value={`¥${fmt(calc.serviceInitialRevenue)}`} />
                  <DetailRow label="追加ページ"   value={`¥${fmt(calc.extraPagesRevenue)}`} />
                  <DetailRow label="独自オプション" value={`¥${fmt(calc.customInitialRevenue)}`} />
                  <DetailRow label="売上合計" value={`¥${fmt(calc.initialRevenue)}`} bold />
                  <DetailRow label={`原価 (${calc.totalInitialHours}h × ¥${fmt(member.hourlyRate)})`} value={`▲ ¥${fmt(calc.initialLaborCost)}`} negative />
                  <DetailRow label="粗利"  value={`¥${fmt(calc.initialProfit)}`} bold tone={calc.initialProfit >= 0 ? 'green' : 'red'} />
                  <DetailRow label="利益率" value={fmtPct(calc.initialMargin)} tone={calc.initialProfit >= 0 ? 'green' : 'red'} />
                </DetailBlock>
                <DetailBlock title="月額フェーズ" tone="purple">
                  <DetailRow label="サービス売上" value={`¥${fmt(calc.serviceMonthlyRevenue)}`} />
                  <DetailRow label="超過修正"     value={`¥${fmt(calc.extraRevisionsRevenue)}`} />
                  <DetailRow label="独自オプション" value={`¥${fmt(calc.customMonthlyRevenue)}`} />
                  <DetailRow label="従量課金"     value={`¥${fmt(calc.perUseMonthlyRevenue)}`} />
                  <DetailRow label="コンサルティング" value={`¥${fmt(calc.consultingRevenue)}`} />
                  <DetailRow label="売上合計" value={`¥${fmt(calc.monthlyRevenue)}`} bold />
                  <DetailRow label={`労務費 (${calc.totalMonthlyHours}h × ¥${fmt(member.hourlyRate)})`} value={`▲ ¥${fmt(calc.monthlyLaborCost)}`} negative />
                  <DetailRow label={`ツール代按分`} value={`▲ ¥${fmt(calc.allocatedToolCost)}`} negative />
                  <DetailRow label="原価合計" value={`▲ ¥${fmt(calc.monthlyCost)}`} negative />
                  <DetailRow label="粗利"  value={`¥${fmt(calc.monthlyProfit)}`} bold tone={calc.monthlyProfit >= 0 ? 'green' : 'red'} />
                  <DetailRow label="利益率" value={fmtPct(calc.monthlyMargin)} tone={calc.monthlyProfit >= 0 ? 'green' : 'red'} />
                </DetailBlock>
              </div>
            </Section>

            {/* メモ */}
            <Section icon={<MessageSquare className="h-4 w-4" />} title="メモ" subtitle="このクライアントに関するメモを自由に記入">
              <textarea value={memo} onChange={e => onUpdateClient({ memo: e.target.value })}
                placeholder="提案時の補足・交渉余地・課題感など自由に記入..."
                rows={4}
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </Section>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-400">
          Price &amp; Profit Simulator ・ 入力値はリアルタイムに反映されます
        </footer>
      </div>

      {/* チャットボタン */}
      <button type="button" onClick={() => setChatOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-300/50 transition hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
        aria-label={chatOpen ? 'チャットを閉じる' : 'AIに相談する'}>
        {chatOpen ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />}
      </button>

      {/* チャットパネル */}
      {chatOpen && (
        <div className="fixed bottom-20 right-3 z-50 flex h-[75dvh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 sm:bottom-24 sm:right-6 sm:h-[520px] sm:w-[380px]">
          <div className="flex flex-none items-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
            <div className="rounded-full bg-white/25 p-1.5"><Bot className="h-4 w-4 text-white" /></div>
            <div>
              <div className="text-sm font-bold text-white">料金コンサルタントAI</div>
              <div className="text-[10px] text-white/75">現在のシミュレーション値をもとにアドバイス</div>
            </div>
            <button type="button" onClick={() => setChatOpen(false)} className="ml-auto rounded-lg p-1.5 text-white/70 transition hover:bg-white/20" aria-label="チャットを閉じる">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="rounded-2xl bg-indigo-50 p-4 mb-3"><Bot className="h-10 w-10 text-indigo-400 mx-auto" /></div>
                <p className="text-sm font-semibold text-slate-700">料金コンサルタントAI</p>
                <p className="mt-1 text-xs text-slate-400 max-w-[260px]">現在の設定に基づいて収益改善・料金戦略をアドバイスします。</p>
                <div className="mt-4 flex flex-col gap-1.5 w-full">
                  {['利益率を上げるには？', 'このモデルの問題点は？', 'LTVを最大化する方法は？'].map(q => (
                    <button key={q} type="button" onClick={() => setChatInput(q)}
                      className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-left text-xs text-indigo-700 transition hover:bg-indigo-100">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <div className="mt-0.5 flex-none rounded-full bg-indigo-100 p-1"><Bot className="h-3.5 w-3.5 text-indigo-600" /></div>}
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}>
                  {msg.content || (chatStreaming && i === chatMessages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : '')}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="flex flex-none items-end gap-2 border-t border-slate-100 p-3">
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder="質問を入力… (Shift+Enter で送信)" rows={3} disabled={chatStreaming}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60" />
            <button type="button" onClick={sendChatMessage} disabled={chatStreaming || !chatInput.trim()}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="送信">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 再利用コンポーネント
// ============================================================

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="rounded-md bg-indigo-100 p-1.5 text-indigo-600">{icon}</span>{title}
          </div>
          {subtitle && <p className="mt-1 pl-7 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  icon, label, suffix, value, onChange, step = 1, min, max, hint, compact = false, inputClassName, containerClassName,
}: {
  icon?: React.ReactNode; label: string; suffix?: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; hint?: string; compact?: boolean; inputClassName?: string; containerClassName?: string;
}) {
  const [display, setDisplay] = useState(String(value));
  const prevValueRef = React.useRef(value);
  if (prevValueRef.current !== value && parseFloat(display) !== value) {
    prevValueRef.current = value;
    setDisplay(String(value));
  } else {
    prevValueRef.current = value;
  }
  const inputId = React.useId();
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/40 ${compact ? 'p-2' : 'p-2.5'} ${containerClassName ?? ''}`}>
      {label && <label htmlFor={inputId} className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-default">{icon}{label}</label>}
      <div className="flex items-center gap-1.5">
        <input id={inputId} type="text" inputMode="decimal" value={display} step={step}
          onFocus={e => { if (display === '0') { setDisplay(''); } e.target.select(); }}
          onChange={e => {
            const raw = toHalfWidth(e.target.value);
            setDisplay(raw);
            const n = parseFloat(raw);
            if (!Number.isNaN(n)) {
              const clamped = min !== undefined && n < min ? min : max !== undefined && n > max ? max : n;
              onChange(clamped);
            }
          }}
          onBlur={() => {
            const n = parseFloat(toHalfWidth(display));
            if (Number.isNaN(n) || display.trim() === '') {
              setDisplay('0'); onChange(min !== undefined && 0 < min ? min : 0);
            } else {
              const clamped = min !== undefined && n < min ? min : max !== undefined && n > max ? max : n;
              setDisplay(String(clamped)); onChange(clamped);
            }
          }}
          className={`w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-semibold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${inputClassName ?? ''}`}
        />
        {suffix && <span className="flex-none whitespace-nowrap text-[11px] text-slate-500">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}

function InlineNumInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  const [display, setDisplay] = useState(String(value));
  const prevRef = React.useRef(value);
  if (prevRef.current !== value && parseFloat(display) !== value) { prevRef.current = value; setDisplay(String(value)); }
  else { prevRef.current = value; }
  return (
    <input type="text" inputMode="decimal" value={display}
      onFocus={e => { if (display === '0') { setDisplay(''); } e.target.select(); }}
      onChange={e => { const raw = toHalfWidth(e.target.value); setDisplay(raw); const n = parseFloat(raw); if (!Number.isNaN(n)) onChange(n); }}
      onBlur={() => {
        const n = parseFloat(toHalfWidth(display));
        if (Number.isNaN(n) || display.trim() === '') { setDisplay('0'); onChange(0); }
        else { setDisplay(String(n)); onChange(n); }
      }}
      className={className}
    />
  );
}

function ReadonlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
      <label className="mb-1 block text-[11px] font-medium text-emerald-700">{label}</label>
      <div className="text-right text-sm font-bold tabular-nums text-emerald-700">{value}</div>
      {hint && <div className="mt-0.5 text-right text-[10px] text-emerald-600/70">{hint}</div>}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, margin, tone, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; margin?: number; tone: 'positive' | 'negative' | 'neutral'; highlight?: boolean;
}) {
  const gradients: Record<typeof tone, string> = { positive: 'from-emerald-500 to-teal-600', negative: 'from-rose-500 to-red-600', neutral: 'from-slate-500 to-slate-700' };
  const bg         = highlight ? `bg-gradient-to-br ${gradients[tone]} text-white` : 'bg-white';
  const labelClass = highlight ? 'text-white/80' : 'text-slate-500';
  const valueClass = highlight ? 'text-white' : tone === 'negative' ? 'text-rose-600' : 'text-slate-900';
  const subClass   = highlight ? 'text-white/70' : 'text-slate-400';
  return (
    <div className={`rounded-xl border ${highlight ? 'border-transparent shadow-lg shadow-indigo-200/50' : 'border-slate-200'} ${bg} p-3.5`}>
      <div className="flex items-center justify-between gap-1">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${labelClass}`}>
          <span className={`rounded-md p-1 ${highlight ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>{icon}</span>{label}
        </div>
        {margin !== undefined && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${highlight ? 'bg-white/20 text-white' : margin >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {margin.toFixed(1)}%
          </span>
        )}
      </div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className={`mt-1 text-[10px] tabular-nums ${subClass}`}>{sub}</div>}
    </div>
  );
}

function DetailBlock({ title, tone, children }: { title: string; tone: 'indigo' | 'purple'; children: React.ReactNode }) {
  const styles = { indigo: 'border-indigo-200 bg-indigo-50/30', purple: 'border-purple-200 bg-purple-50/30' };
  return (
    <div className={`rounded-lg border ${styles[tone]} p-3`}>
      <div className="mb-2 text-xs font-bold text-slate-700">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, bold, negative, tone }: { label: string; value: string; bold?: boolean; negative?: boolean; tone?: 'green' | 'red' }) {
  const valueClass = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-rose-600' : negative ? 'text-rose-600' : 'text-slate-700';
  return (
    <div className={`flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0 ${bold ? 'font-bold text-slate-900' : ''}`}>
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] tabular-nums ${valueClass} ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}
