'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_SKILLS, rollDie } from '@coc-tools/coc-rules';
import { useFieldErrors } from '@/lib/useFieldErrors';
import { FieldError } from './FieldError';

type PrimaryStats = {
  str: number; con: number; siz: number; dex: number;
  app: number; int: number; pow: number; edu: number; luck: number;
};

const DEFAULT_PRIMARY: PrimaryStats = {
  str: 50, con: 50, siz: 50, dex: 50,
  app: 50, int: 50, pow: 50, edu: 50, luck: 50,
};

function rollPrimary(): PrimaryStats {
  const roll3D6x5 = () => rollDie(6) + rollDie(6) + rollDie(6);
  const roll2D6plus6x5 = () => rollDie(6) + rollDie(6) + 6;
  return {
    str: roll3D6x5() * 5,
    con: roll3D6x5() * 5,
    siz: roll2D6plus6x5() * 5,
    dex: roll3D6x5() * 5,
    app: roll3D6x5() * 5,
    int: roll2D6plus6x5() * 5,
    pow: roll3D6x5() * 5,
    edu: roll2D6plus6x5() * 5,
    luck: roll3D6x5() * 5,
  };
}

export function CharacterForm() {
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [age, setAge] = useState(30);
  const [birthplace, setBirthplace] = useState('');
  const [residence, setResidence] = useState('');
  const [nationality, setNationality] = useState('中国');
  const [occupation, setOccupation] = useState('');
  const [era, setEra] = useState<'modern' | '1920s' | 'victorian' | 'ancient' | 'future'>('modern');
  const [primary, setPrimary] = useState<PrimaryStats>(DEFAULT_PRIMARY);
  const [skills, setSkills] = useState<Array<{ name: string; value: number; isMythos?: boolean }>>(
    Object.entries(DEFAULT_SKILLS).map(([name, value]) => ({ name, value })),
  );
  const [newSkill, setNewSkill] = useState({ name: '', value: 50 });
  const [weapons, setWeapons] = useState<Array<{ name: string; skill: string; damage: string; range?: string }>>([]);
  const [newWeapon, setNewWeapon] = useState({ name: '', skill: '', damage: '', range: '' });
  const [equipment, setEquipment] = useState<Array<{ name: string; quantity: number }>>([]);
  const [newEquip, setNewEquip] = useState({ name: '', quantity: 1 });
  const [background, setBackground] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const randomPrimary = () => {
    setPrimary(rollPrimary());
    // 随机生成后旧属性错误已无关，清掉
    for (const k of ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu', 'luck'] as const) {
      clear(`primary.${k}`);
    }
  };

  // 母语 = EDU（CoC 7e 规则）。当 EDU 变化时同步更新母语技能值。
  useEffect(() => {
    setSkills((prev) =>
      prev.map((s) => (s.name === '母语' ? { ...s, value: primary.edu } : s)),
    );
  }, [primary.edu]);

  // 闪避 = DEX / 2（向上取整）。当 DEX 变化时同步更新闪避技能值。
  useEffect(() => {
    setSkills((prev) =>
      prev.map((s) => (s.name === '闪避' ? { ...s, value: Math.ceil(primary.dex / 2) } : s)),
    );
  }, [primary.dex]);

  const submit = async () => {
    setError(null);
    clearAll();
    setLoading(true);
    const body = {
      name, gender: gender || undefined, age, birthplace, residence,
      nationality, occupation, era, primary, skills, weapons, equipment,
      background, notes,
    };
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      // 字段级错误 → 标红；非字段错误（captcha、429 等）→ 顶部错误条
      if (Array.isArray(j.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields);
        // 跳到第一个出错的 step
        const firstStep = stepForPath(j.error.fields[0].path);
        if (firstStep) setStep(firstStep);
      } else {
        setError(j.error?.message || '创建失败');
      }
      return;
    }
    router.push(`/characters/${j.data.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {[
          { n: 1, label: '基础' },
          { n: 2, label: '属性' },
          { n: 3, label: '技能' },
          { n: 4, label: '装备' },
          { n: 5, label: '背景' },
        ].map(({ n, label }) => (
          <div
            key={n}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm transition ${
              step === n
                ? 'border-brand-500/50 bg-brand-600/90 text-white shadow-[0_8px_24px_-12px_rgba(124,58,237,0.8)]'
                : step > n
                  ? 'border-white/10 bg-white/[0.06] text-ink-100/70'
                  : 'border-white/10 bg-white/[0.02] text-ink-100/40'
            }`}
          >
            <span className="font-semibold">{n}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-bold">基础信息</h2>
          <FieldError error={get('name')}>
            <label className="label">姓名 *</label>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); clear('name'); }} required />
          </FieldError>
          <div className="grid grid-cols-2 gap-3">
            <FieldError error={get('gender')}>
              <label className="label">性别</label>
              <select className="input" value={gender} onChange={(e) => { setGender(e.target.value as any); clear('gender'); }}>
                <option value="">未指定</option>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            </FieldError>
            <FieldError error={get('age')}>
              <label className="label">年龄</label>
              <input type="number" className="input" value={age} min={15} max={90} onChange={(e) => { setAge(parseInt(e.target.value)); clear('age'); }} />
            </FieldError>
          </div>
          <FieldError error={get('era')}>
            <label className="label">时代 *</label>
            <select className="input" value={era} onChange={(e) => { setEra(e.target.value as any); clear('era'); }}>
              <option value="modern">现代</option>
              <option value="1920s">1920s</option>
              <option value="victorian">维多利亚</option>
              <option value="ancient">古代</option>
              <option value="future">未来</option>
            </select>
          </FieldError>
          <div className="grid grid-cols-2 gap-3">
            <FieldError error={get('occupation')}>
              <label className="label">职业</label>
              <input className="input" value={occupation} onChange={(e) => { setOccupation(e.target.value); clear('occupation'); }} placeholder="私家侦探 / 记者 / ..." />
            </FieldError>
            <FieldError error={get('nationality')}>
              <label className="label">国籍</label>
              <input className="input" value={nationality} onChange={(e) => { setNationality(e.target.value); clear('nationality'); }} />
            </FieldError>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldError error={get('birthplace')}>
              <label className="label">出生地</label>
              <input className="input" value={birthplace} onChange={(e) => { setBirthplace(e.target.value); clear('birthplace'); }} />
            </FieldError>
            <FieldError error={get('residence')}>
              <label className="label">住址</label>
              <input className="input" value={residence} onChange={(e) => { setResidence(e.target.value); clear('residence'); }} />
            </FieldError>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="font-bold">属性</h2>
            <button type="button" onClick={randomPrimary} className="btn-ghost text-sm">🎲 随机生成</button>
          </header>
          <div className="grid grid-cols-3 gap-3">
            {(['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu', 'luck'] as const).map((k) => (
              <FieldError key={k} error={get(`primary.${k}`)}>
                <label className="label uppercase">{k}</label>
                <input type="number" className="input" value={primary[k]} min={1} max={100}
                  onChange={(e) => { setPrimary({ ...primary, [k]: parseInt(e.target.value) || 0 }); clear(`primary.${k}`); }} />
              </FieldError>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="font-bold">技能</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {skills.map((s, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="flex-1 pt-2">{s.name}</span>
                <div className="w-28">
                  <FieldError error={get(`skills.${i}.value`)}>
                    <input type="number" className="input" value={s.value} min={0} max={100}
                      onChange={(e) => {
                        const c = [...skills]; c[i] = { ...c[i], value: parseInt(e.target.value) || 0 }; setSkills(c);
                        clear(`skills.${i}.value`);
                      }} />
                  </FieldError>
                </div>
                <button type="button" className="btn-ghost text-xs px-2 py-1 mt-1" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>删除</button>
              </div>
            ))}
          </div>
          <div className="subpanel">
            <p className="label mb-2">添加技能</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="input sm:flex-1" placeholder="技能名称" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} />
              <div className="flex gap-2">
                <input type="number" className="input w-24 sm:w-28" placeholder="初始值" value={newSkill.value} min={0} max={100}
                  onChange={(e) => setNewSkill({ ...newSkill, value: parseInt(e.target.value) || 0 })} />
                <button type="button" className="btn-primary flex-1 whitespace-nowrap sm:flex-none" onClick={() => {
                  if (newSkill.name) {
                    setSkills([...skills, newSkill]);
                    setNewSkill({ name: '', value: 50 });
                  }
                }}>+ 添加</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-bold">武器</h2>
            {weapons.map((w, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="flex-1">{w.name} ({w.skill}, {w.damage})</span>
                <button type="button" className="btn-ghost text-xs px-2 py-1" onClick={() => setWeapons(weapons.filter((_, j) => j !== i))}>删除</button>
              </div>
            ))}
            <div className="subpanel space-y-2">
              <p className="label mb-0">添加武器</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input className="input" placeholder="武器名称" value={newWeapon.name} onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })} />
                <input className="input" placeholder="使用技能" value={newWeapon.skill} onChange={(e) => setNewWeapon({ ...newWeapon, skill: e.target.value })} />
                <input className="input" placeholder="伤害" value={newWeapon.damage} onChange={(e) => setNewWeapon({ ...newWeapon, damage: e.target.value })} />
                <input className="input" placeholder="射程（可选）" value={newWeapon.range} onChange={(e) => setNewWeapon({ ...newWeapon, range: e.target.value })} />
              </div>
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => {
                if (newWeapon.name) {
                  setWeapons([...weapons, newWeapon]);
                  setNewWeapon({ name: '', skill: '', damage: '', range: '' });
                }
              }}>+ 添加武器</button>
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="font-bold">装备</h2>
            {equipment.map((e, i) => (
              <div key={i} className="flex gap-2 text-sm items-start">
                <span className="flex-1 pt-2">{e.name} × {e.quantity}</span>
                <button type="button" className="btn-ghost text-xs px-2 py-1 mt-1" onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}>删除</button>
              </div>
            ))}
            <div className="subpanel">
              <p className="label mb-2">添加装备</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className="input sm:flex-1" placeholder="装备名称" value={newEquip.name} onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })} />
                <div className="flex gap-2">
                  <input type="number" className="input w-24 sm:w-28" placeholder="数量" value={newEquip.quantity} min={1}
                    onChange={(e) => setNewEquip({ ...newEquip, quantity: parseInt(e.target.value) || 1 })} />
                  <button type="button" className="btn-primary flex-1 whitespace-nowrap sm:flex-none" onClick={() => {
                    if (newEquip.name) {
                      setEquipment([...equipment, newEquip]);
                      setNewEquip({ name: '', quantity: 1 });
                    }
                  }}>+ 添加</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card space-y-4">
          <h2 className="font-bold">背景 & 备注</h2>
          <FieldError error={get('background')}>
            <label className="label">调查员背景</label>
            <textarea className="input min-h-[200px]" value={background} onChange={(e) => { setBackground(e.target.value); clear('background'); }} />
          </FieldError>
          <FieldError error={get('notes')}>
            <label className="label">玩家私有备注</label>
            <textarea className="input min-h-[100px]" value={notes} onChange={(e) => { setNotes(e.target.value); clear('notes'); }} />
          </FieldError>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>← 上一步</button>
        {step < 5 ? (
          <button type="button" className="btn-primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !name}>下一步 →</button>
        ) : (
          <button type="button" className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? '创建中...' : '✓ 创建车卡'}
          </button>
        )}
      </div>
    </div>
  );
}

/** 根据 issue.path 推断应该跳到哪个 step。 */
function stepForPath(path: (string | number)[]): number | null {
  const head = path[0];
  if (head === 'skills') return 3;
  if (head === 'weapons' || head === 'equipment') return 4;
  if (head === 'background' || head === 'notes') return 5;
  if (head === 'primary') return 2;
  // name/gender/age/era/occupation/nationality/birthplace/residence → step 1
  return 1;
}