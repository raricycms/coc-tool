'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldErrors, pathToCharacterKey } from '@/lib/useFieldErrors';
import { FieldError } from './FieldError';

type Step = 'SAN_RECOVERY' | 'KNOWLEDGE_GAIN' | 'RETIREMENT' | 'SKILL_GROWTH' | 'DONE';

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

interface Props {
  sessionId: string;
  pcs: PC[];
  initialStep: Step | string;
}

export function SettlementWizard({ sessionId, pcs, initialStep }: Props) {
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
  const [step, setStep] = useState<Step>((initialStep as Step) ?? 'SAN_RECOVERY');
  const [sanRecoveries, setSanRecoveries] = useState<Record<string, number>>({});
  const [knowledgeGains, setKnowledgeGains] = useState<Record<string, number>>({});
  const [retirements, setRetirements] = useState<Record<string, 'dead' | 'asylum' | 'user_request' | ''>>({});
  const [skillSelections, setSkillSelections] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(j?.error?.message || 'Mythos 增长失败');
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
        setError(j?.error?.message || '撕卡失败');
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
    if (growths.length === 0) {
      setStep('DONE');
      submitComplete();
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
    setLoading(true);
    await fetch(`/api/sessions/${sessionId}/settlement/complete`, { method: 'POST' });
    setLoading(false);
    router.push('/dashboard');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {(['SAN_RECOVERY', 'KNOWLEDGE_GAIN', 'RETIREMENT', 'SKILL_GROWTH', 'DONE'] as Step[]).map((s) => (
          <div key={s} className={`px-3 py-1 rounded text-xs ${
            step === s ? 'bg-brand-600' : 'bg-ink-800 text-ink-100/40'
          }`}>{s}</div>
        ))}
      </div>

      {step === 'SAN_RECOVERY' && (
        <div className="card space-y-3">
          <h2 className="font-bold">Step 1: SAN 恢复</h2>
          {pcs.map((pc) => (
            <div key={pc.characterId} className="flex items-center gap-3 border-b border-ink-800 pb-2">
              <div className="flex-1">
                <div className="font-medium">{pc.characterName}</div>
                <div className="text-xs text-ink-100/40">SAN {pc.sanCurrent}/{pc.sanMax}</div>
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
          <button className="btn-primary w-full" onClick={submitSan} disabled={loading}>下一步：神话知识</button>
        </div>
      )}

      {step === 'KNOWLEDGE_GAIN' && (
        <div className="card space-y-3">
          <h2 className="font-bold">Step 2: 克苏鲁知识增长</h2>
          <p className="text-xs text-ink-100/40">每 +1 Mythos 自动 -1 SAN</p>
          {pcs.map((pc) => (
            <div key={pc.characterId} className="flex items-center gap-3 border-b border-ink-800 pb-2">
              <div className="flex-1">
                <div className="font-medium">{pc.characterName}</div>
                <div className="text-xs text-ink-100/40">当前 Mythos: {pc.mythos}</div>
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
          <button className="btn-primary w-full" onClick={submitKnowledge} disabled={loading}>下一步：撕卡</button>
        </div>
      )}

      {step === 'RETIREMENT' && (
        <div className="card space-y-3">
          <h2 className="font-bold">Step 3: 撕卡 / 送疯人院</h2>
          {pcs.map((pc) => (
            <div key={pc.characterId} className="flex items-center gap-3 border-b border-ink-800 pb-2">
              <div className="flex-1">
                <div className="font-medium">{pc.characterName}</div>
                {pc.retired && <div className="text-xs text-red-400">⚰ 已撕卡</div>}
              </div>
              <FieldError error={get(`reason:${pc.characterId}`)}>
                <select
                  className="input w-40"
                  value={retirements[pc.characterId] ?? ''}
                  onChange={(e) => { setRetirements({ ...retirements, [pc.characterId]: e.target.value as any }); clear(`reason:${pc.characterId}`); }}
                >
                  <option value="">-</option>
                  <option value="dead">死亡</option>
                  <option value="asylum">永久疯狂</option>
                  <option value="user_request">主动退出</option>
                </select>
              </FieldError>
            </div>
          ))}
          <button className="btn-primary w-full" onClick={submitRetirements} disabled={loading}>下一步：技能成长</button>
        </div>
      )}

      {step === 'SKILL_GROWTH' && (
        <div className="card space-y-3">
          <h2 className="font-bold">Step 4: 技能成长投骰</h2>
          <p className="text-xs text-ink-100/40">为每个角色选择要尝试成长的技能</p>
          {pcs.filter((pc) => !pc.retired).map((pc) => (
            <div key={pc.characterId} className="border-b border-ink-800 pb-2">
              <div className="font-medium mb-2">{pc.characterName}</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {pc.skills.map((sk) => {
                  const sel = skillSelections[pc.characterId] ?? new Set();
                  const checked = sel.has(sk.name);
                  return (
                    <label key={sk.id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const newSel = new Set(skillSelections[pc.characterId] ?? new Set());
                          if (e.target.checked) newSel.add(sk.name);
                          else newSel.delete(sk.name);
                          setSkillSelections({ ...skillSelections, [pc.characterId]: newSel });
                        }}
                      />
                      <span className={sk.isMythos ? 'text-red-400' : ''}>{sk.name} ({sk.value})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="btn-primary w-full" onClick={submitSkillGrowth} disabled={loading}>投骰 + 完成</button>
        </div>
      )}

      {step === 'DONE' && (
        <div className="card text-center space-y-3">
          <h2 className="font-bold text-xl">🎉 结算完成</h2>
          <p className="text-ink-100/60">所有数值已更新。点击下方按钮完结本场。</p>
          <button className="btn-primary w-full" onClick={submitComplete} disabled={loading}>完结本场</button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}