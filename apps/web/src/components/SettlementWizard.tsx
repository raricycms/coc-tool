'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldErrors, pathToCharacterKey } from '@/lib/useFieldErrors';
import { FieldError } from './FieldError';

type Step = 'SAN_RECOVERY' | 'KNOWLEDGE_GAIN' | 'RETIREMENT' | 'SKILL_GROWTH' | 'DONE';

const STEP_LABEL: Record<Step, string> = {
  SAN_RECOVERY: 'SAN 恢复',
  KNOWLEDGE_GAIN: '神话知识',
  RETIREMENT: '角色结局',
  SKILL_GROWTH: '技能成长',
  DONE: '完成',
};

const STEP_ORDER: Step[] = ['SAN_RECOVERY', 'KNOWLEDGE_GAIN', 'RETIREMENT', 'SKILL_GROWTH', 'DONE'];

interface PC {
  characterId: string;
  characterName: string;
  ownerUsername: string;
  sanCurrent: number;
  sanMax: number;
  hpCurrent: number;
  hpMax: number;
  mythos: number;
  skills: Array<{ id: string; name: string; value: number; isMythos: boolean }>;
  retired: boolean;
}

interface SanRecovery { characterId: string; amount: number }
interface KnowledgeGain { characterId: string; amount: number }
interface Retirement { characterId: string; reason: 'dead' | 'asylum' | 'user_request'; note?: string }

interface Props {
  sessionId: string;
  pcs: PC[];
  initialStep: Step | string;
  initialDrafts?: {
    sanRecoveries?: SanRecovery[];
    knowledgeGains?: KnowledgeGain[];
    retirements?: Retirement[];
  };
}

export function SettlementWizard({ sessionId, pcs, initialStep, initialDrafts }: Props) {
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
  const [step, setStep] = useState<Step>((initialStep as Step) ?? 'SAN_RECOVERY');
  // 从服务端 JSON 草稿回填，刷新页面不会丢
  const [sanRecoveries, setSanRecoveries] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of initialDrafts?.sanRecoveries ?? []) m[r.characterId] = r.amount;
    return m;
  });
  const [knowledgeGains, setKnowledgeGains] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const k of initialDrafts?.knowledgeGains ?? []) m[k.characterId] = k.amount;
    return m;
  });
  const [retirements, setRetirements] = useState<Record<string, 'dead' | 'asylum' | 'user_request' | ''>>(() => {
    const m: Record<string, 'dead' | 'asylum' | 'user_request' | ''> = {};
    for (const r of initialDrafts?.retirements ?? []) m[r.characterId] = r.reason;
    return m;
  });
  const [skillSelections, setSkillSelections] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goPrev = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };
  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };
  const stepIdx = STEP_ORDER.indexOf(step);

  const submitSan = async () => {
    setLoading(true); setError(null); clearAll();
    const sanBody = {
      sanRecoveries: Object.entries(sanRecoveries).map(([characterId, amount]) => ({ characterId, amount })),
    };
    const res = await fetch(`/api/sessions/${sessionId}/settlement/san-recovery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanBody),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      if (Array.isArray(j?.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields, pathToCharacterKey(sanBody));
      } else {
        setError(j?.error?.message || 'SAN 恢复失败');
      }
      return;
    }
    setStep('KNOWLEDGE_GAIN');
  };

  const submitKnowledge = async () => {
    setLoading(true); setError(null); clearAll();
    const knowledgeBody = {
      knowledgeGains: Object.entries(knowledgeGains).map(([characterId, amount]) => ({ characterId, amount })),
    };
    const res = await fetch(`/api/sessions/${sessionId}/settlement/knowledge`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(knowledgeBody),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      if (Array.isArray(j?.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields, pathToCharacterKey(knowledgeBody));
      } else {
        setError(j?.error?.message || '神话知识更新失败');
      }
      return;
    }
    setStep('RETIREMENT');
  };

  const submitRetirements = async () => {
    setLoading(true); setError(null); clearAll();
    const retirementBody = {
      retirements: Object.entries(retirements)
        .filter(([, reason]) => reason)
        .map(([characterId, reason]) => ({ characterId, reason: reason as any })),
    };
    const res = await fetch(`/api/sessions/${sessionId}/settlement/retirements`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(retirementBody),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      if (Array.isArray(j?.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields, pathToCharacterKey(retirementBody));
      } else {
        setError(j?.error?.message || '角色结局保存失败');
      }
      return;
    }
    setStep('SKILL_GROWTH');
  };

  const submitSkillGrowth = async () => {
    setLoading(true); setError(null); clearAll();
    const growths: Array<{ characterId: string; skillName: string }> = [];
    for (const [characterId, skills] of Object.entries(skillSelections)) {
      for (const s of skills) growths.push({ characterId, skillName: s });
    }
    // 没勾选也允许进入 DONE 步；但不再自动 complete，由用户点「完结」按钮确认。
    if (growths.length === 0) {
      setLoading(false);
      setStep('DONE');
      return;
    }
    const growthBody = { growths };
    const res = await fetch(`/api/sessions/${sessionId}/settlement/skill-growth`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(growthBody),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      if (Array.isArray(j?.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields, pathToCharacterKey(growthBody));
      } else {
        setError(j?.error?.message || '技能成长投骰失败');
      }
      return;
    }
    setStep('DONE');
  };

  const submitComplete = async () => {
    setLoading(true); setError(null);
    const res = await fetch(`/api/sessions/${sessionId}/settlement/complete`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error?.message || '完结失败，请重试');
      return;
    }
    router.push('/dashboard');
  };

  const STEPS = STEP_ORDER;

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s) => {
          const state = step === s ? 'current' : STEPS.indexOf(step) > STEPS.indexOf(s) ? 'done' : 'todo';
          const cls =
            state === 'current'
              ? 'border-macaron-300 bg-macaron-300 text-white shadow-lift'
              : state === 'done'
                ? 'border-macaron-200 bg-macaron-100 text-macaron-600'
                : 'border-sky-200 bg-white text-ink-muted';
          return (
            <li
              key={s}
              className={`flex flex-1 min-w-[6rem] items-center justify-center rounded-2xl border px-3 py-2 text-sm font-semibold transition ${cls}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {STEP_LABEL[s]}
            </li>
          );
        })}
      </ol>

      {step === 'SAN_RECOVERY' && (
        <section className="card space-y-3">
          <header>
            <h2 className="text-lg font-bold text-ink">SAN 恢复</h2>
            <p className="mt-1 text-sm text-ink-soft">每位调查员本次能恢复的 SAN 值。</p>
          </header>
          {pcs.map((pc) => (
            <div key={pc.characterId} className="flex items-center gap-3 border-b border-sky-100 pb-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{pc.characterName}</div>
                <div className="text-xs text-ink-muted">SAN {pc.sanCurrent}/{pc.sanMax}</div>
              </div>
              <FieldError error={get(`amount:${pc.characterId}`)}>
                <input
                  type="number" className="input w-24"
                  value={sanRecoveries[pc.characterId] ?? 0}
                  onChange={(e) => { setSanRecoveries({ ...sanRecoveries, [pc.characterId]: parseInt(e.target.value) || 0 }); clear(`amount:${pc.characterId}`); }}
                />
              </FieldError>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" disabled={loading} onClick={goPrev}>← 上一步</button>
            <button className="btn-primary flex-1" onClick={submitSan} disabled={loading}>下一步：神话知识</button>
          </div>
        </section>
      )}

      {step === 'KNOWLEDGE_GAIN' && (
        <section className="card space-y-3">
          <header>
            <h2 className="text-lg font-bold text-ink">神话知识</h2>
            <p className="mt-1 text-sm text-ink-soft">每获得 1 点神话知识，会自动扣除 1 点 SAN。</p>
          </header>
          {pcs.map((pc) => (
            <div key={pc.characterId} className="flex items-center gap-3 border-b border-sky-100 pb-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{pc.characterName}</div>
                <div className="text-xs text-ink-muted">当前神话知识 {pc.mythos}</div>
              </div>
              <FieldError error={get(`amount:${pc.characterId}`)}>
                <input
                  type="number" className="input w-24" min={0} max={20}
                  value={knowledgeGains[pc.characterId] ?? 0}
                  onChange={(e) => { setKnowledgeGains({ ...knowledgeGains, [pc.characterId]: parseInt(e.target.value) || 0 }); clear(`amount:${pc.characterId}`); }}
                />
              </FieldError>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" disabled={loading} onClick={goPrev}>← 上一步</button>
            <button className="btn-primary flex-1" onClick={submitKnowledge} disabled={loading}>下一步：角色结局</button>
          </div>
        </section>
      )}

      {step === 'RETIREMENT' && (
        <section className="card space-y-3">
          <header>
            <h2 className="text-lg font-bold text-ink">角色结局</h2>
            <p className="mt-1 text-sm text-ink-soft">如果谁要离开这个故事，从下拉里选一个结局；没选就是继续跑。</p>
          </header>
          {pcs.map((pc) => (
            <div key={pc.characterId} className="flex items-center gap-3 border-b border-sky-100 pb-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{pc.characterName}</div>
                {pc.retired && <div className="text-xs text-bad">已退役</div>}
              </div>
              <FieldError error={get(`reason:${pc.characterId}`)}>
                <select
                  className="input w-44"
                  value={retirements[pc.characterId] ?? ''}
                  onChange={(e) => { setRetirements({ ...retirements, [pc.characterId]: e.target.value as any }); clear(`reason:${pc.characterId}`); }}
                >
                  <option value="">继续调查</option>
                  <option value="dead">死亡</option>
                  <option value="asylum">永久疯狂</option>
                  <option value="user_request">主动离开</option>
                </select>
              </FieldError>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" disabled={loading} onClick={goPrev}>← 上一步</button>
            <button className="btn-primary flex-1" onClick={submitRetirements} disabled={loading}>下一步：技能成长</button>
          </div>
        </section>
      )}

      {step === 'SKILL_GROWTH' && (
        <section className="card space-y-3">
          <header>
            <h2 className="text-lg font-bold text-ink">技能成长</h2>
            <p className="mt-1 text-sm text-ink-soft">勾选想要尝试成长的技能，没选就跳过。</p>
          </header>
          {pcs.filter((pc) => !pc.retired).map((pc) => (
            <div key={pc.characterId} className="border-b border-sky-100 pb-3 last:border-b-0">
              <div className="mb-2 font-semibold text-ink">{pc.characterName}</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {pc.skills.map((sk) => {
                  const sel = skillSelections[pc.characterId] ?? new Set();
                  const checked = sel.has(sk.name);
                  return (
                    <label key={sk.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-sky-300 text-macaron-300 focus:ring-macaron-300"
                        checked={checked}
                        onChange={(e) => {
                          const newSel = new Set(skillSelections[pc.characterId] ?? new Set());
                          if (e.target.checked) newSel.add(sk.name);
                          else newSel.delete(sk.name);
                          setSkillSelections({ ...skillSelections, [pc.characterId]: newSel });
                        }}
                      />
                      <span className={sk.isMythos ? 'text-mythos font-semibold' : 'text-ink'}>
                        {sk.name}（{sk.value}）
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost flex-1" disabled={loading} onClick={goPrev}>← 上一步</button>
            <button className="btn-primary flex-1" onClick={submitSkillGrowth} disabled={loading}>投骰并完成</button>
          </div>
        </section>
      )}

      {step === 'DONE' && (
        <section className="card space-y-4 text-center">
          <h2 className="text-xl font-bold text-ink">🎉 结算完成</h2>
          <p className="text-ink-soft">所有数值已更新。完结后将不可再进入结算流程。</p>
          <button className="btn-primary w-full" onClick={submitComplete} disabled={loading}>完结这场跑团</button>
        </section>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}