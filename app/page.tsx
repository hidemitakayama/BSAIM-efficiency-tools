'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  Bot,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileText,
  Globe,
  Hourglass,
  Instagram,
  Layers,
  LineChart as LineIcon,
  MapPin,
  MessageSquare,
  PiggyBank,
  Plus,
  Receipt,
  Send,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';

// =====================================================
// 型定義 / Service Definitions
// =====================================================

type ServiceDef = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  initialFee: number;
  monthlyFee: number;
  defaultInitialHours: number;
  defaultMonthlyHours: number;
  basePages?: number;
  baseRevisions?: number;
  badge?: string;
  description?: string;
};

type HpPlanId = 'minimal' | 'premium' | 'pro' | 'max';

const HP_PLANS: { id: HpPlanId; name: string; initialFee: number; monthlyFee: number; badge?: string }[] = [
  { id: 'minimal', name: 'ミニマム', initialFee: 0, monthlyFee: 2_000 },
  { id: 'premium', name: 'プレミアム', initialFee: 0, monthlyFee: 6_800, badge: '人気' },
  { id: 'pro', name: 'プロ', initialFee: 100_000, monthlyFee: 6_800 },
  { id: 'max', name: 'MAX', initialFee: 200_000, monthlyFee: 12_800 },
];

const SERVICES: ServiceDef[] = [
  {
    id: 'hp',
    name: 'HP制作',
    icon: Globe,
    initialFee: 0,
    monthlyFee: 6_800,
    defaultInitialHours: 40,
    defaultMonthlyHours: 3,
    basePages: 15,
    baseRevisions: 10,
    description: '5〜15P・月10回まで修正対応',
  },
  {
    id: 'sns',
    name: 'Instagram運用代行',
    icon: Instagram,
    initialFee: 60_000,
    monthlyFee: 5_500,
    defaultInitialHours: 10,
    defaultMonthlyHours: 8,
    description: 'AI投稿自動生成・インサイト分析',
  },
  {
    id: 'meo',
    name: 'MEO対策',
    icon: MapPin,
    initialFee: 60_000,
    monthlyFee: 5_500,
    defaultInitialHours: 8,
    defaultMonthlyHours: 4,
    description: 'AI口コミ返信・投稿自動生成',
  },
  {
    id: 'full',
    name: 'フルセット (HP+IG+MEO)',
    icon: Layers,
    initialFee: 60_000,
    monthlyFee: 14_800,
    defaultInitialHours: 50,
    defaultMonthlyHours: 15,
    basePages: 15,
    baseRevisions: 10,
    badge: 'お得',
    description: 'HP Premium + Instagram + MEO すべてセット',
  },
  {
    id: 'hp_sns',
    name: 'HP + Instagram セット',
    icon: Globe,
    initialFee: 60_000,
    monthlyFee: 11_000,
    defaultInitialHours: 50,
    defaultMonthlyHours: 11,
    description: 'HP制作(プレミアム) + Instagram運用代行',
  },
  {
    id: 'hp_meo',
    name: 'HP + MEO セット',
    icon: Globe,
    initialFee: 60_000,
    monthlyFee: 11_000,
    defaultInitialHours: 48,
    defaultMonthlyHours: 7,
    description: 'HP制作(プレミアム) + MEO対策',
  },
  {
    id: 'sns_meo',
    name: 'Instagram + MEO セット',
    icon: Instagram,
    initialFee: 60_000,
    monthlyFee: 11_000,
    defaultInitialHours: 18,
    defaultMonthlyHours: 12,
    description: 'Instagram運用代行 + MEO対策',
  },
];

type ServiceState = {
  enabled: boolean;
  initialHours: number;
  monthlyHours: number;
};

type CustomOption = {
  id: number;
  name: string;
  initial: number;
  monthly: number;
};

type PerUseOption = {
  id: number;
  name: string;
  unitPrice: number;
  monthlyCount: number;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// =====================================================
// メインコンポーネント
// =====================================================

export default function PriceSimulatorPage() {
  // ----- 前提条件 -----
  const [hourlyRate, setHourlyRate] = useState(1_500);
  const [toolCost, setToolCost] = useState(17_500);
  const [clientCount, setClientCount] = useState(10);
  const [contractMonths, setContractMonths] = useState(24);

  // ----- サービス選択ステート -----
  const [serviceState, setServiceState] = useState<Record<string, ServiceState>>(() =>
    SERVICES.reduce<Record<string, ServiceState>>((acc, s) => {
      acc[s.id] = {
        enabled: s.id === 'hp',
        initialHours: s.defaultInitialHours,
        monthlyHours: s.defaultMonthlyHours,
      };
      return acc;
    }, {}),
  );

  const updateService = (id: string, patch: Partial<ServiceState>) => {
    setServiceState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  // ----- アドオン -----
  const [extraPages, setExtraPages] = useState(0);
  const [extraPagePrice, setExtraPagePrice] = useState(8_000);
  const [extraRevisions, setExtraRevisions] = useState(0);
  const [extraRevisionPrice, setExtraRevisionPrice] = useState(3_000);
  const [blogUnits, setBlogUnits] = useState(1); // 20記事 = 1単位 (初回0円)
  const [blogUnitPrice, setBlogUnitPrice] = useState(3_500);
  const [customOptions, setCustomOptions] = useState<CustomOption[]>([]);
  const [nextCustomId, setNextCustomId] = useState(1);

  // ----- 従量課金オプション -----
  const [perUseOptions, setPerUseOptions] = useState<PerUseOption[]>([]);
  const [nextPerUseId, setNextPerUseId] = useState(1);

  // ----- HP プラン -----
  const [hpPlan, setHpPlan] = useState<HpPlanId>('premium');

  // ----- コンサルティング -----
  const [consultingEnabled, setConsultingEnabled] = useState(false);
  const consultingMonthly = 5_000;

  // ----- チャット -----
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const addCustomOption = () => {
    setCustomOptions((prev) => [
      ...prev,
      { id: nextCustomId, name: '', initial: 0, monthly: 0 },
    ]);
    setNextCustomId((n) => n + 1);
  };
  const updateCustomOption = (id: number, patch: Partial<CustomOption>) => {
    setCustomOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };
  const removeCustomOption = (id: number) => {
    setCustomOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const addPerUseOption = () => {
    setPerUseOptions((prev) => [
      ...prev,
      { id: nextPerUseId, name: '', unitPrice: 0, monthlyCount: 0 },
    ]);
    setNextPerUseId((n) => n + 1);
  };
  const updatePerUseOption = (id: number, patch: Partial<PerUseOption>) => {
    setPerUseOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };
  const removePerUseOption = (id: number) => {
    setPerUseOptions((prev) => prev.filter((o) => o.id !== id));
  };

  // =====================================================
  // 計算ロジック
  // =====================================================
  const calc = useMemo(() => {
    const enabledServices = SERVICES.filter((s) => serviceState[s.id]?.enabled);

    // HP プランの料金を動的に取得
    const getServiceFees = (s: ServiceDef) => {
      if (s.id === 'hp') {
        const plan = HP_PLANS.find((p) => p.id === hpPlan)!;
        return { initialFee: plan.initialFee, monthlyFee: plan.monthlyFee };
      }
      return { initialFee: s.initialFee, monthlyFee: s.monthlyFee };
    };

    // サービス売上
    const serviceInitialRevenue = enabledServices.reduce((sum, s) => sum + getServiceFees(s).initialFee, 0);
    const serviceMonthlyRevenue = enabledServices.reduce((sum, s) => sum + getServiceFees(s).monthlyFee, 0);

    // 工数合計
    const totalInitialHours = enabledServices.reduce(
      (sum, s) => sum + (serviceState[s.id]?.initialHours ?? 0),
      0,
    );
    const totalMonthlyHours = enabledServices.reduce(
      (sum, s) => sum + (serviceState[s.id]?.monthlyHours ?? 0),
      0,
    );

    // アドオン売上
    const extraPagesRevenue = extraPages * extraPagePrice;
    const extraRevisionsRevenue = extraRevisions * extraRevisionPrice;
    const blogChargeableUnits = Math.max(0, blogUnits - 1); // 初回1単位は無料
    const blogRevenue = blogChargeableUnits * blogUnitPrice;
    const customInitialRevenue = customOptions.reduce((s, o) => s + (o.initial || 0), 0);
    const customMonthlyRevenue = customOptions.reduce((s, o) => s + (o.monthly || 0), 0);
    const perUseMonthlyRevenue = perUseOptions.reduce(
      (sum, option) => sum + (option.unitPrice || 0) * (option.monthlyCount || 0),
      0,
    );

    // 売上合計
    const initialRevenue =
      serviceInitialRevenue + extraPagesRevenue + blogRevenue + customInitialRevenue;
    const consultingRevenue = consultingEnabled ? consultingMonthly : 0;
    const monthlyRevenue =
      serviceMonthlyRevenue +
      extraRevisionsRevenue +
      customMonthlyRevenue +
      perUseMonthlyRevenue +
      consultingRevenue;

    // 原価
    const initialLaborCost = totalInitialHours * hourlyRate;
    const monthlyLaborCost = totalMonthlyHours * hourlyRate;
    const allocatedToolCost = clientCount > 0 ? toolCost / clientCount : toolCost;
    const monthlyCost = monthlyLaborCost + allocatedToolCost;

    // 粗利・利益率
    const initialProfit = initialRevenue - initialLaborCost;
    const monthlyProfit = monthlyRevenue - monthlyCost;
    const initialMargin = initialRevenue > 0 ? (initialProfit / initialRevenue) * 100 : 0;
    const monthlyMargin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;

    // LTV
    const ltv = initialProfit + monthlyProfit * contractMonths;

    // 回収月数
    let paybackMonths: number | null = null;
    if (initialProfit >= 0) {
      paybackMonths = 0;
    } else if (monthlyProfit > 0) {
      paybackMonths = Math.ceil(-initialProfit / monthlyProfit);
    }

    // チャート用データ: 累積粗利推移
    const cumulativeData: {
      month: number;
      cumulative: number;
      revenue: number;
      cost: number;
    }[] = [];
    for (let m = 0; m <= contractMonths; m++) {
      cumulativeData.push({
        month: m,
        cumulative: Math.round(initialProfit + monthlyProfit * m),
        revenue: Math.round(initialRevenue + monthlyRevenue * m),
        cost: Math.round(initialLaborCost + monthlyCost * m),
      });
    }

    // チャート用データ: 内訳比較
    const breakdownData = [
      {
        name: '初期',
        売上: Math.round(initialRevenue),
        原価: Math.round(initialLaborCost),
        粗利: Math.round(initialProfit),
      },
      {
        name: '月額',
        売上: Math.round(monthlyRevenue),
        原価: Math.round(monthlyCost),
        粗利: Math.round(monthlyProfit),
      },
    ];

    return {
      enabledServices,
      serviceInitialRevenue,
      serviceMonthlyRevenue,
      consultingRevenue,
      initialRevenue,
      monthlyRevenue,
      initialLaborCost,
      monthlyLaborCost,
      allocatedToolCost,
      monthlyCost,
      initialProfit,
      monthlyProfit,
      initialMargin,
      monthlyMargin,
      ltv,
      paybackMonths,
      totalInitialHours,
      totalMonthlyHours,
      extraPagesRevenue,
      extraRevisionsRevenue,
      blogRevenue,
      blogChargeableUnits,
      customInitialRevenue,
      customMonthlyRevenue,
      perUseMonthlyRevenue,
      cumulativeData,
      breakdownData,
    };
  }, [
    hourlyRate,
    toolCost,
    clientCount,
    contractMonths,
    serviceState,
    extraPages,
    extraPagePrice,
    extraRevisions,
    extraRevisionPrice,
    blogUnits,
    blogUnitPrice,
    customOptions,
    perUseOptions,
    hpPlan,
    consultingEnabled,
  ]);

  // =====================================================
  // ヘルパー
  // =====================================================
  const fmt = (n: number) => Math.round(n).toLocaleString('ja-JP');
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  // =====================================================
  // チャット ロジック
  // =====================================================

  const buildSimContext = () =>
    [
      `■ 前提条件`,
      `担当者時給: ¥${fmt(hourlyRate)} / AIツール月額: ¥${fmt(toolCost)} / 担当クライアント数: ${clientCount}社 / 契約縛り: ${contractMonths}ヶ月`,
      ``,
      `■ 選択中サービス`,
      calc.enabledServices.length > 0
        ? calc.enabledServices
            .map((s) => {
              const fees = s.id === 'hp' ? HP_PLANS.find(p => p.id === hpPlan)! : s;
              return `${s.name}${s.id === 'hp' ? `(${HP_PLANS.find(p => p.id === hpPlan)!.name})` : ''}（初期¥${fmt(fees.initialFee)} / 月額¥${fmt(fees.monthlyFee)}）`;
            })
            .join(', ')
        : 'なし',
      ``,
      `■ 追加オプション`,
      `コンサルティング: ${consultingEnabled ? `ON（¥${fmt(consultingMonthly)}/月）` : 'OFF'} / 追加ページ: ${extraPages}P（¥${fmt(calc.extraPagesRevenue)}） / 超過修正: ${extraRevisions}回（¥${fmt(calc.extraRevisionsRevenue)}） / ブログ移管: ${blogUnits}単位（¥${fmt(calc.blogRevenue)}） / 従量課金: ${perUseOptions.length > 0 ? `¥${fmt(calc.perUseMonthlyRevenue)}/月` : 'なし'}`,
      ``,
      `■ シミュレーション結果`,
      `初期: 売上¥${fmt(calc.initialRevenue)} / 原価¥${fmt(calc.initialLaborCost)} / 粗利¥${fmt(calc.initialProfit)} / 利益率${fmtPct(calc.initialMargin)}`,
      `月額: 売上¥${fmt(calc.monthlyRevenue)} / 原価¥${fmt(calc.monthlyCost)} / 粗利¥${fmt(calc.monthlyProfit)} / 利益率${fmtPct(calc.monthlyMargin)}`,
      `LTV（${contractMonths}ヶ月）: ¥${fmt(calc.ltv)}`,
      calc.paybackMonths === 0
        ? '初期コスト回収: 即回収（初期粗利プラス）'
        : calc.paybackMonths === null
          ? '初期コスト回収: 回収不可（月額粗利マイナス）'
          : `初期コスト回収: ${calc.paybackMonths}ヶ月`,
    ].join('\n');

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const nextMessages: ChatMessage[] = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          simContext: buildSimContext(),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Chat API error:', res.status, errText);
        throw new Error(`status ${res.status}: ${errText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';

      setChatMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: text };
          return updated;
        });
      }
    } catch (err) {
      console.error('sendChatMessage error:', err);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' },
      ]);
    } finally {
      setChatStreaming(false);
    }
  };

  // =====================================================
  // レンダリング
  // =====================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-[1440px]">
        {/* ===== ヘッダー ===== */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 text-white shadow-lg shadow-indigo-200">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                料金・利益シミュレーター
              </h1>
              <p className="text-sm text-slate-500">
                サブスク型Web制作サービスの収益性をリアルタイムに可視化
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="indigo">
              {calc.enabledServices.length} プラン選択中
            </Badge>
            <Badge color="green">縛り {contractMonths}ヶ月</Badge>
            <Badge color="amber">時給 ¥{fmt(hourlyRate)}</Badge>
          </div>
        </header>

        {/* ===== 前提条件 ===== */}
        <Section
          icon={<Settings className="h-4 w-4" />}
          title="① 前提条件・原価入力"
          subtitle="シミュレーション全体に適用される共通パラメータ"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <NumberField
              icon={<Coins className="h-4 w-4" />}
              label="担当者時給"
              suffix="円"
              value={hourlyRate}
              onChange={setHourlyRate}
              step={100}
              min={0}
            />
            <NumberField
              icon={<Sparkles className="h-4 w-4" />}
              label="AIツール月額費用"
              suffix="円"
              value={toolCost}
              onChange={setToolCost}
              step={500}
              min={0}
              hint="Cursor / Claude等"
            />
            <NumberField
              icon={<Users className="h-4 w-4" />}
              label="同時担当クライアント数"
              suffix="社"
              value={clientCount}
              onChange={setClientCount}
              step={1}
              min={1}
              hint="ツール代を按分するための分母"
            />
            <NumberField
              icon={<Calendar className="h-4 w-4" />}
              label="契約期間縛り"
              suffix="ヶ月"
              value={contractMonths}
              onChange={setContractMonths}
              step={1}
              min={1}
              max={120}
              hint="LTV計算の対象期間"
            />
          </div>
        </Section>

        {/* ===== メインコンテンツ ===== */}
        <div className="mt-6 grid gap-6 xl:grid-cols-12">
          {/* ----- 左ペイン: サービス + アドオン ----- */}
          <div className="space-y-6 xl:col-span-7">
            {/* サービス選択 */}
            <Section
              icon={<Wallet className="h-4 w-4" />}
              title="② サービスメニュー"
              subtitle="提供するプランを選択し、想定作業時間を入力"
            >
              <div className="space-y-3">
                {SERVICES.map((s) => {
                  const st = serviceState[s.id];
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border-2 p-4 transition-all ${
                        st.enabled
                          ? 'border-indigo-300 bg-indigo-50/40 shadow-sm shadow-indigo-100'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={st.enabled}
                          onChange={(e) =>
                            updateService(s.id, { enabled: e.target.checked })
                          }
                          className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div
                          className={`rounded-lg p-2 ${
                            st.enabled
                              ? 'bg-indigo-500 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {s.name}
                            </span>
                            {s.badge && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                {s.badge}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {s.id === 'hp' ? (
                              <>
                                初期 ¥{fmt(HP_PLANS.find(p => p.id === hpPlan)!.initialFee)} / 月額 ¥{fmt(HP_PLANS.find(p => p.id === hpPlan)!.monthlyFee)}
                                {s.description && ` ・ ${s.description}`}
                              </>
                            ) : (
                              <>
                                初期 ¥{fmt(s.initialFee)} / 月額 ¥{fmt(s.monthlyFee)}
                                {s.description && ` ・ ${s.description}`}
                              </>
                            )}
                          </div>
                        </div>
                      </label>

                      {st.enabled && s.id === 'hp' && (
                        <div className="mt-3 grid grid-cols-4 gap-1.5 border-t border-indigo-100 pt-3">
                          {HP_PLANS.map((plan) => (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => setHpPlan(plan.id)}
                              className={`rounded-lg px-1.5 py-2 text-center transition ${
                                hpPlan === plan.id
                                  ? 'bg-indigo-600 text-white shadow'
                                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="text-[11px] font-semibold leading-tight">
                                {plan.name}
                                {plan.badge && (
                                  <span className={`ml-1 rounded-full px-1 py-0.5 text-[8px] font-bold ${hpPlan === plan.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                    {plan.badge}
                                  </span>
                                )}
                              </div>
                              <div className={`mt-0.5 text-[9px] ${hpPlan === plan.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {plan.initialFee > 0 ? `初期¥${(plan.initialFee/10000).toFixed(0)}万` : '初期¥0'}
                              </div>
                              <div className={`text-[10px] font-bold ${hpPlan === plan.id ? 'text-white' : 'text-slate-700'}`}>
                                ¥{plan.monthlyFee.toLocaleString()}/月
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {st.enabled && (
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-indigo-100 pt-3">
                          <NumberField
                            compact
                            icon={<Clock className="h-3.5 w-3.5" />}
                            label="初期作業時間"
                            suffix="h"
                            value={st.initialHours}
                            onChange={(v) =>
                              updateService(s.id, { initialHours: v })
                            }
                            step={0.5}
                            min={0}
                          />
                          <NumberField
                            compact
                            icon={<Clock className="h-3.5 w-3.5" />}
                            label="月次作業時間"
                            suffix="h/月"
                            value={st.monthlyHours}
                            onChange={(v) =>
                              updateService(s.id, { monthlyHours: v })
                            }
                            step={0.5}
                            min={0}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* アドオン */}
            <Section
              icon={<Plus className="h-4 w-4" />}
              title="③ 追加オプション (アドオン)"
              subtitle="基本プランに追加するアップセル要素"
            >
              <div className="space-y-3">
                {/* コンサルティング */}
                <div className={`rounded-lg border-2 p-3 transition-all ${consultingEnabled ? 'border-purple-300 bg-purple-50/40' : 'border-slate-200 bg-white'}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={consultingEnabled}
                      onChange={(e) => setConsultingEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className={`rounded-md p-1.5 ${consultingEnabled ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Target className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">コンサルティング</span>
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">月額売上</span>
                      </div>
                      <div className="text-xs text-slate-500">月額 ¥5,000 ・ 戦略提案・分析レポート・改善施策</div>
                    </div>
                    <div className="text-sm font-bold text-purple-600">+¥{fmt(consultingMonthly)}/月</div>
                  </label>
                </div>

                {/* 追加ページ */}
                <AddonRow
                  icon={<FileText className="h-4 w-4" />}
                  title="追加ページ数"
                  caption="HP制作 16ページ目以降"
                  effect="初期売上"
                  effectColor="indigo"
                >
                  <NumberField
                    compact
                    label="ページ数"
                    suffix="P"
                    value={extraPages}
                    onChange={setExtraPages}
                    step={1}
                    min={0}
                  />
                  <NumberField
                    compact
                    label="単価"
                    suffix="円/P"
                    value={extraPagePrice}
                    onChange={setExtraPagePrice}
                    step={500}
                    min={0}
                  />
                  <ReadonlyField
                    label="売上加算"
                    value={`¥${fmt(calc.extraPagesRevenue)}`}
                  />
                </AddonRow>

                {/* 月間超過修正 */}
                <AddonRow
                  icon={<Wrench className="h-4 w-4" />}
                  title="月間超過修正"
                  caption="11回目以降"
                  effect="月額売上"
                  effectColor="purple"
                >
                  <NumberField
                    compact
                    label="超過回数"
                    suffix="回/月"
                    value={extraRevisions}
                    onChange={setExtraRevisions}
                    step={1}
                    min={0}
                  />
                  <NumberField
                    compact
                    label="単価"
                    suffix="円/回"
                    value={extraRevisionPrice}
                    onChange={setExtraRevisionPrice}
                    step={500}
                    min={0}
                  />
                  <ReadonlyField
                    label="月額加算"
                    value={`¥${fmt(calc.extraRevisionsRevenue)}`}
                  />
                </AddonRow>

                {/* ブログ移管 */}
                <AddonRow
                  icon={<ArrowDownToLine className="h-4 w-4" />}
                  title="ブログ移管"
                  caption="20記事=1単位 / 初回1単位は0円"
                  effect="初期売上"
                  effectColor="indigo"
                >
                  <NumberField
                    compact
                    label="単位数"
                    suffix={`単位 (${blogUnits * 20}記事)`}
                    value={blogUnits}
                    onChange={setBlogUnits}
                    step={1}
                    min={0}
                  />
                  <NumberField
                    compact
                    label="単位単価"
                    suffix="円/単位"
                    value={blogUnitPrice}
                    onChange={setBlogUnitPrice}
                    step={500}
                    min={0}
                  />
                  <ReadonlyField
                    label="売上加算"
                    value={`¥${fmt(calc.blogRevenue)}`}
                    hint={`課金: ${calc.blogChargeableUnits}単位`}
                  />
                </AddonRow>

                {/* 独自オプション */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-purple-100 p-1.5 text-purple-600">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          独自オプション
                        </div>
                        <div className="text-[10px] text-slate-400">
                          カスタムの初期/月額アップセルを自由に追加
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addCustomOption}
                      className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-indigo-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> 追加
                    </button>
                  </div>

                  {customOptions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white py-4 text-center text-xs text-slate-400">
                      オプションを追加してください
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customOptions.map((o) => (
                        <div
                          key={o.id}
                          className="grid grid-cols-12 items-end gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200"
                        >
                          <div className="col-span-12 sm:col-span-4">
                            <div className="h-full rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                名称
                              </label>
                              <input
                                value={o.name}
                                onChange={(e) =>
                                  updateCustomOption(o.id, { name: e.target.value })
                                }
                                placeholder="例: SEO記事制作"
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="col-span-5 sm:col-span-3">
                            <NumberField
                              compact
                              label="初期"
                              suffix="円"
                              value={o.initial}
                              onChange={(v) =>
                                updateCustomOption(o.id, {
                                  initial: v,
                                })
                              }
                              min={0}
                            />
                          </div>
                          <div className="col-span-5 sm:col-span-3">
                            <NumberField
                              compact
                              label="月額"
                              suffix="円"
                              value={o.monthly}
                              onChange={(v) =>
                                updateCustomOption(o.id, {
                                  monthly: v,
                                })
                              }
                              min={0}
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeCustomOption(o.id)}
                              className="rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="削除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 従量課金オプション */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-purple-100 p-1.5 text-purple-600">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          従量課金メニュー
                        </div>
                        <div className="text-[10px] text-slate-400">
                          単価 × 月間回数で月額売上に加算
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={addPerUseOption}
                      className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-indigo-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> 追加
                    </button>
                  </div>

                  {perUseOptions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white py-4 text-center text-xs text-slate-400">
                      回数課金のメニューを追加してください
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {perUseOptions.map((option) => (
                        <div
                          key={option.id}
                          className="grid grid-cols-12 items-end gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200"
                        >
                          <div className="col-span-12 sm:col-span-4">
                            <div className="h-full rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                名称
                              </label>
                              <input
                                value={option.name}
                                onChange={(e) =>
                                  updatePerUseOption(option.id, { name: e.target.value })
                                }
                                placeholder="例: AI記事作成"
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <NumberField
                              compact
                              label="単価"
                              suffix="円"
                              value={option.unitPrice}
                              onChange={(v) =>
                                updatePerUseOption(option.id, {
                                  unitPrice: v,
                                })
                              }
                              min={0}
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <NumberField
                              compact
                              label="月間回数"
                              suffix="回"
                              value={option.monthlyCount}
                              onChange={(v) =>
                                updatePerUseOption(option.id, {
                                  monthlyCount: v,
                                })
                              }
                              min={0}
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <div className="h-full rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                                月額加算
                              </label>
                              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-right text-sm font-bold tabular-nums text-emerald-700">
                                ¥{fmt(option.unitPrice * option.monthlyCount)}
                              </div>
                            </div>
                          </div>
                          <div className="col-span-12 flex justify-between sm:col-span-2 sm:justify-end">
                            <div className="text-[10px] text-slate-400 sm:hidden">
                              月額売上に加算
                            </div>
                            <button
                              type="button"
                              onClick={() => removePerUseOption(option.id)}
                              className="rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              aria-label="削除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          </div>

          {/* ----- 右ペイン: 結果表示 ----- */}
          <div className="space-y-6 xl:col-span-5">
            {/* KPIカード */}
            <Section
              icon={<TrendingUp className="h-4 w-4" />}
              title="④ シミュレーション結果"
              subtitle="入力値から自動計算"
            >
              <div className="grid grid-cols-2 gap-3">
                <KpiCard
                  icon={<Receipt className="h-4 w-4" />}
                  label="初期粗利"
                  value={`¥${fmt(calc.initialProfit)}`}
                  sub={`売上 ¥${fmt(calc.initialRevenue)} - 原価 ¥${fmt(
                    calc.initialLaborCost,
                  )}`}
                  margin={calc.initialMargin}
                  tone={calc.initialProfit >= 0 ? 'positive' : 'negative'}
                />
                <KpiCard
                  icon={<PiggyBank className="h-4 w-4" />}
                  label="月額粗利"
                  value={`¥${fmt(calc.monthlyProfit)}`}
                  sub={`売上 ¥${fmt(calc.monthlyRevenue)} - 原価 ¥${fmt(
                    calc.monthlyCost,
                  )}`}
                  margin={calc.monthlyMargin}
                  tone={calc.monthlyProfit >= 0 ? 'positive' : 'negative'}
                />
                <KpiCard
                  icon={<Target className="h-4 w-4" />}
                  label={`LTV (${contractMonths}ヶ月)`}
                  value={`¥${fmt(calc.ltv)}`}
                  sub={`初期粗利 + 月額粗利 × ${contractMonths}`}
                  tone={calc.ltv >= 0 ? 'positive' : 'negative'}
                  highlight
                />
                <KpiCard
                  icon={<Hourglass className="h-4 w-4" />}
                  label="初期コスト回収"
                  value={
                    calc.paybackMonths === 0
                      ? '即回収'
                      : calc.paybackMonths === null
                        ? '回収不可'
                        : `${calc.paybackMonths}ヶ月`
                  }
                  sub={
                    calc.paybackMonths === 0
                      ? '初期粗利がプラス'
                      : calc.paybackMonths === null
                        ? '月額粗利がマイナス'
                        : calc.paybackMonths <= contractMonths
                          ? `契約期間内に回収可能 ✓`
                          : `契約期間を超過 ✕`
                  }
                  tone={
                    calc.paybackMonths === 0
                      ? 'positive'
                      : calc.paybackMonths === null ||
                          calc.paybackMonths > contractMonths
                        ? 'negative'
                        : 'neutral'
                  }
                />
              </div>

              {/* アラート */}
              {calc.enabledServices.length === 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 flex-none" />
                  <div>サービスが選択されていません。少なくとも1つ選択してください。</div>
                </div>
              )}
              {calc.enabledServices.length > 0 &&
                calc.monthlyProfit > 0 &&
                calc.initialProfit >= 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 flex-none" />
                    <div>初期から黒字、月額も継続的に利益が出る健全なモデルです。</div>
                  </div>
                )}
              {calc.enabledServices.length > 0 && calc.monthlyProfit <= 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertTriangle className="h-4 w-4 flex-none" />
                  <div>
                    月額粗利がマイナスです。月次工数か料金を見直してください。
                  </div>
                </div>
              )}
            </Section>

            {/* 売上・原価・粗利の比較 */}
            <Section
              icon={<BarChart3 className="h-4 w-4" />}
              title="売上・原価・粗利の内訳"
              subtitle="初期 vs 月額"
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={calc.breakdownData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v: number) =>
                        v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => `¥${fmt(value)}`}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="売上" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="原価" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="粗利" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* 累積利益チャート */}
            <Section
              icon={<LineIcon className="h-4 w-4" />}
              title="累積粗利の推移"
              subtitle={`契約期間 ${contractMonths}ヶ月における累積額`}
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={calc.cumulativeData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v: number) => `${v}M`}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v: number) =>
                        v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => `¥${fmt(value)}`}
                      labelFormatter={(label: number) => `${label}ヶ月後`}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    {calc.paybackMonths !== null &&
                      calc.paybackMonths > 0 &&
                      calc.paybackMonths <= contractMonths && (
                        <ReferenceLine
                          x={calc.paybackMonths}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          label={{
                            value: `回収 ${calc.paybackMonths}M`,
                            fill: '#10b981',
                            fontSize: 11,
                            position: 'top',
                          }}
                        />
                      )}
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#profitGrad)"
                      name="累積粗利"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>

            {/* 詳細内訳 */}
            <Section
              icon={<FileText className="h-4 w-4" />}
              title="詳細内訳"
              subtitle="計算根拠の透明化"
            >
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <DetailBlock title="初期フェーズ" tone="indigo">
                  <DetailRow
                    label="サービス売上"
                    value={`¥${fmt(calc.serviceInitialRevenue)}`}
                  />
                  <DetailRow
                    label="追加ページ"
                    value={`¥${fmt(calc.extraPagesRevenue)}`}
                  />
                  <DetailRow
                    label="ブログ移管"
                    value={`¥${fmt(calc.blogRevenue)}`}
                  />
                  <DetailRow
                    label="独自オプション"
                    value={`¥${fmt(calc.customInitialRevenue)}`}
                  />
                  <DetailRow
                    label="売上合計"
                    value={`¥${fmt(calc.initialRevenue)}`}
                    bold
                  />
                  <DetailRow
                    label={`原価 (${calc.totalInitialHours}h × ¥${fmt(hourlyRate)})`}
                    value={`▲ ¥${fmt(calc.initialLaborCost)}`}
                    negative
                  />
                  <DetailRow
                    label="粗利"
                    value={`¥${fmt(calc.initialProfit)}`}
                    bold
                    tone={calc.initialProfit >= 0 ? 'green' : 'red'}
                  />
                  <DetailRow
                    label="利益率"
                    value={fmtPct(calc.initialMargin)}
                    tone={calc.initialProfit >= 0 ? 'green' : 'red'}
                  />
                </DetailBlock>

                <DetailBlock title="月額フェーズ" tone="purple">
                  <DetailRow
                    label="サービス売上"
                    value={`¥${fmt(calc.serviceMonthlyRevenue)}`}
                  />
                  <DetailRow
                    label="超過修正"
                    value={`¥${fmt(calc.extraRevisionsRevenue)}`}
                  />
                  <DetailRow
                    label="独自オプション"
                    value={`¥${fmt(calc.customMonthlyRevenue)}`}
                  />
                  <DetailRow
                    label="従量課金メニュー"
                    value={`¥${fmt(calc.perUseMonthlyRevenue)}`}
                  />
                  <DetailRow
                    label="売上合計"
                    value={`¥${fmt(calc.monthlyRevenue)}`}
                    bold
                  />
                  <DetailRow
                    label={`労務費 (${calc.totalMonthlyHours}h × ¥${fmt(hourlyRate)})`}
                    value={`▲ ¥${fmt(calc.monthlyLaborCost)}`}
                    negative
                  />
                  <DetailRow
                    label={`ツール代按分 (${fmt(toolCost)} ÷ ${clientCount})`}
                    value={`▲ ¥${fmt(calc.allocatedToolCost)}`}
                    negative
                  />
                  <DetailRow
                    label="原価合計"
                    value={`▲ ¥${fmt(calc.monthlyCost)}`}
                    negative
                  />
                  <DetailRow
                    label="粗利"
                    value={`¥${fmt(calc.monthlyProfit)}`}
                    bold
                    tone={calc.monthlyProfit >= 0 ? 'green' : 'red'}
                  />
                  <DetailRow
                    label="利益率"
                    value={fmtPct(calc.monthlyMargin)}
                    tone={calc.monthlyProfit >= 0 ? 'green' : 'red'}
                  />
                </DetailBlock>
              </div>
            </Section>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-400">
          Price &amp; Profit Simulator Prototype ・ 入力値はリアルタイムに反映されます
        </footer>

        {/* ===== フローティングチャットボタン ===== */}
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-300/50 transition hover:scale-105 active:scale-95"
          aria-label={chatOpen ? 'チャットを閉じる' : 'AIに相談する'}
        >
          {chatOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </button>

        {/* ===== チャットパネル ===== */}
        {chatOpen && (
          <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15">
            {/* ヘッダー */}
            <div className="flex flex-none items-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
              <div className="rounded-full bg-white/25 p-1.5">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">料金コンサルタントAI</div>
                <div className="text-[10px] text-white/75">現在のシミュレーション値をもとにアドバイス</div>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="ml-auto rounded-lg p-1.5 text-white/70 transition hover:bg-white/20"
                aria-label="チャットを閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* メッセージ一覧 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="rounded-2xl bg-indigo-50 p-4 mb-3">
                    <Bot className="h-10 w-10 text-indigo-400 mx-auto" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">料金コンサルタントAI</p>
                  <p className="mt-1 text-xs text-slate-400 max-w-[260px]">
                    現在の設定に基づいて収益改善・料金戦略をアドバイスします。気軽に相談してください。
                  </p>
                  <div className="mt-4 flex flex-col gap-1.5 w-full">
                    {[
                      '利益率を上げるには？',
                      'このモデルの問題点は？',
                      'LTVを最大化する方法は？',
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setChatInput(q);
                        }}
                        className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-left text-xs text-indigo-700 transition hover:bg-indigo-100"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="mt-0.5 flex-none rounded-full bg-indigo-100 p-1">
                      <Bot className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'rounded-br-md bg-indigo-600 text-white'
                        : 'rounded-bl-md bg-slate-100 text-slate-800'
                    }`}
                  >
                    {msg.content ||
                      (chatStreaming && i === chatMessages.length - 1 ? (
                        <span className="inline-flex gap-1">
                          <span className="animate-bounce delay-0 h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                        </span>
                      ) : (
                        ''
                      ))}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* 入力エリア */}
            <div className="flex flex-none items-end gap-2 border-t border-slate-100 p-3">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="質問を入力… (Shift+Enter で送信)"
                rows={3}
                disabled={chatStreaming}
                className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={sendChatMessage}
                disabled={chatStreaming || !chatInput.trim()}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="送信"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// =====================================================
// 再利用コンポーネント
// =====================================================

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="rounded-md bg-indigo-100 p-1.5 text-indigo-600">
              {icon}
            </span>
            {title}
          </div>
          {subtitle && (
            <p className="mt-1 pl-7 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  icon,
  label,
  suffix,
  value,
  onChange,
  step = 1,
  min,
  max,
  hint,
  compact = false,
}: {
  icon?: React.ReactNode;
  label: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  compact?: boolean;
}) {
  const [display, setDisplay] = useState(String(value));

  // 外部から value が変わったとき（別のステートによるリセット等）だけ同期
  const prevValueRef = React.useRef(value);
  if (prevValueRef.current !== value && parseFloat(display) !== value) {
    prevValueRef.current = value;
    setDisplay(String(value));
  } else {
    prevValueRef.current = value;
  }

  const inputId = React.useId();

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50/40 ${
        compact ? 'p-2' : 'p-2.5'
      }`}
    >
      <label
        htmlFor={inputId}
        className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-default"
      >
        {icon}
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={display}
          step={step}
          onChange={(e) => {
            const raw = e.target.value;
            setDisplay(raw);
            const n = parseFloat(raw);
            if (!Number.isNaN(n)) {
              const clamped =
                min !== undefined && n < min
                  ? min
                  : max !== undefined && n > max
                    ? max
                    : n;
              onChange(clamped);
            }
          }}
          onBlur={() => {
            const n = parseFloat(display);
            if (Number.isNaN(n)) {
              // 不正な入力はリセット
              setDisplay(String(value));
            } else {
              const clamped =
                min !== undefined && n < min
                  ? min
                  : max !== undefined && n > max
                    ? max
                    : n;
              setDisplay(String(clamped));
              onChange(clamped);
            }
          }}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-semibold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {suffix && (
          <span className="flex-none whitespace-nowrap text-[11px] text-slate-500">
            {suffix}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2">
      <label className="mb-1 block text-[11px] font-medium text-emerald-700">
        {label}
      </label>
      <div className="text-right text-sm font-bold tabular-nums text-emerald-700">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-right text-[10px] text-emerald-600/70">
          {hint}
        </div>
      )}
    </div>
  );
}

function AddonRow({
  icon,
  title,
  caption,
  effect,
  effectColor,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  effect: string;
  effectColor: 'indigo' | 'purple';
  children: React.ReactNode;
}) {
  const effectStyles =
    effectColor === 'indigo'
      ? 'bg-indigo-100 text-indigo-700'
      : 'bg-purple-100 text-purple-700';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-purple-100 p-1.5 text-purple-600">
            {icon}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="text-[10px] text-slate-400">{caption}</div>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${effectStyles}`}
        >
          → {effect}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">{children}</div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  margin,
  tone,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  margin?: number;
  tone: 'positive' | 'negative' | 'neutral';
  highlight?: boolean;
}) {
  const gradients: Record<typeof tone, string> = {
    positive: 'from-emerald-500 to-teal-600',
    negative: 'from-rose-500 to-red-600',
    neutral: 'from-slate-500 to-slate-700',
  };
  const bg = highlight
    ? `bg-gradient-to-br ${gradients[tone]} text-white`
    : 'bg-white';
  const labelClass = highlight ? 'text-white/80' : 'text-slate-500';
  const valueClass = highlight
    ? 'text-white'
    : tone === 'negative'
      ? 'text-rose-600'
      : 'text-slate-900';
  const subClass = highlight ? 'text-white/70' : 'text-slate-400';

  return (
    <div
      className={`rounded-xl border ${
        highlight
          ? 'border-transparent shadow-lg shadow-indigo-200/50'
          : 'border-slate-200'
      } ${bg} p-3.5`}
    >
      <div className="flex items-center justify-between gap-1">
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium ${labelClass}`}
        >
          <span
            className={`rounded-md p-1 ${
              highlight ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'
            }`}
          >
            {icon}
          </span>
          {label}
        </div>
        {margin !== undefined && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
              highlight
                ? 'bg-white/20 text-white'
                : margin >= 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        )}
      </div>
      <div className={`mt-2 text-xl font-bold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {sub && (
        <div className={`mt-1 text-[10px] tabular-nums ${subClass}`}>{sub}</div>
      )}
    </div>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: 'indigo' | 'green' | 'amber';
}) {
  const styles = {
    indigo: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
    green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-100 text-amber-700 ring-amber-200',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles[color]}`}
    >
      {children}
    </span>
  );
}

function DetailBlock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'indigo' | 'purple';
  children: React.ReactNode;
}) {
  const styles = {
    indigo: 'border-indigo-200 bg-indigo-50/30',
    purple: 'border-purple-200 bg-purple-50/30',
  };
  return (
    <div className={`rounded-lg border ${styles[tone]} p-3`}>
      <div className="mb-2 text-xs font-bold text-slate-700">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  bold,
  negative,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  tone?: 'green' | 'red';
}) {
  const valueClass =
    tone === 'green'
      ? 'text-emerald-700'
      : tone === 'red'
        ? 'text-rose-600'
        : negative
          ? 'text-rose-600'
          : 'text-slate-700';
  return (
    <div
      className={`flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0 ${
        bold ? 'font-bold text-slate-900' : ''
      }`}
    >
      <span className="text-[11px] text-slate-500">{label}</span>
      <span
        className={`text-[11px] tabular-nums ${valueClass} ${
          bold ? 'font-bold' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}
