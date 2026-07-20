'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_SKILLS, rollDie } from '@coc-tools/coc-rules';
import { useFieldErrors } from '@/lib/useFieldErrors';
import { FieldError } from './FieldError';

type PrimaryStats = {
  str: number; con: number; siz: number; dex: number;
  app: number; int: number; pow: number; edu: number; luck: number;
};

type Weapon = { name: string; skill: string; damage: string; range?: string };
type Equipment = { name: string; quantity: number; note?: string };

export type CharacterFormInitial = {
  id?: string;
  name?: string;
  gender?: 'male' | 'female' | 'other' | '';
  age?: number;
  birthplace?: string;
  residence?: string;
  nationality?: string;
  occupation?: string;
  era?: 'modern' | '1920s' | 'victorian' | 'ancient' | 'future';
  primary?: PrimaryStats;
  skills?: Array<{ name: string; value: number; isMythos?: boolean }>;
  weapons?: Weapon[];
  equipment?: Equipment[];
  background?: string;
  notes?: string;
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

const STEPS = [
  { n: 1, label: '基础' },
  { n: 2, label: '属性' },
  { n: 3, label: '技能' },
  { n: 4, label: '装备' },
  { n: 5, label: '背景' },
] as const;

export function CharacterForm({ initial }: { initial?: CharacterFormInitial } = {}) {
  const editingId = initial?.id;
  const router = useRouter();
  const { get, apply, clear, clearAll } = useFieldErrors();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial?.name ?? '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>(initial?.gender ?? '');
  const [age, setAge] = useState(initial?.age ?? 30);
  const [birthplace, setBirthplace] = useState(initial?.birthplace ?? '');
  const [residence, setResidence] = useState(initial?.residence ?? '');
  const [nationality, setNationality] = useState(initial?.nationality ?? '中国');
  const [occupation, setOccupation] = useState(initial?.occupation ?? '');
  const [era, setEra] = useState<'modern' | '1920s' | 'victorian' | 'ancient' | 'future'>(initial?.era ?? 'modern');
  const [primary, setPrimary] = useState<PrimaryStats>(initial?.primary ?? DEFAULT_PRIMARY);
  const [skills, setSkills] = useState<Array<{ name: string; value: number; isMythos?: boolean }>>(
    initial?.skills ?? Object.entries(DEFAULT_SKILLS).map(([name, value]) => ({ name, value })),
  );
  const [newSkill, setNewSkill] = useState({ name: '', value: 50 });
  const [weapons, setWeapons] = useState<Weapon[]>(initial?.weapons ?? []);
  const [newWeapon, setNewWeapon] = useState({ name: '', skill: '', damage: '', range: '' });
  const [equipment, setEquipment] = useState<Equipment[]>(initial?.equipment ?? []);
  const [newEquip, setNewEquip] = useState({ name: '', quantity: 1 });
  const [background, setBackground] = useState(initial?.background ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 列表 ref：新增后自动滚到底部，让刚加的那条可见
  const skillsListRef = useRef<HTMLUListElement>(null);
  const weaponsListRef = useRef<HTMLUListElement>(null);
  const equipmentListRef = useRef<HTMLUListElement>(null);

  const scrollListToBottom = (ref: React.RefObject<HTMLElement | null>) => {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const randomPrimary = () => {
    setPrimary(rollPrimary());
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
    const url = editingId ? `/api/characters/${editingId}` : '/api/characters';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      if (Array.isArray(j.error?.fields) && j.error.fields.length > 0) {
        apply(j.error.fields);
        const firstStep = stepForPath(j.error.fields[0].path);
        if (firstStep) setStep(firstStep);
      } else {
        setError(j.error?.message || (editingId ? '保存失败' : '创建失败'));
      }
      return;
    }
    router.push(`/characters/${j.data.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 步骤条 */}
      <ol className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map(({ n, label }) => {
          const state = step === n ? 'current' : step > n ? 'done' : 'todo';
          const cls =
            state === 'current'
              ? 'border-macaron-300 bg-macaron-300 text-white shadow-lift'
              : state === 'done'
                ? 'border-macaron-200 bg-macaron-100 text-macaron-600'
                : 'border-sky-200 bg-white text-ink-muted';
          return (
            <li
              key={n}
              className={`flex flex-1 min-w-[5rem] items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${cls}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="font-bold">{n}</span>
              <span className="hidden sm:inline">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="card space-y-5">
          <header>
            <h2 className="text-lg font-bold text-ink">基础信息</h2>
            <p className="mt-1 text-sm text-ink-soft">从名字和身世开始。</p>
          </header>

          <FieldError error={get('name')}>
            <label className="label">姓名 <span className="text-bad">*</span></label>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); clear('name'); }} required />
          </FieldError>

          {/* 每一格是一个完整字段组（label + input），不再横排交叉 */}
          <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="label">时代 <span className="text-bad">*</span></label>
            <select className="input" value={era} onChange={(e) => { setEra(e.target.value as any); clear('era'); }}>
              <option value="modern">现代</option>
              <option value="1920s">1920s</option>
              <option value="victorian">维多利亚</option>
              <option value="ancient">古代</option>
              <option value="future">未来</option>
            </select>
          </FieldError>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldError error={get('occupation')}>
              <label className="label">职业</label>
              <input className="input" value={occupation} onChange={(e) => { setOccupation(e.target.value); clear('occupation'); }} placeholder="私家侦探 / 记者 / ..." />
            </FieldError>
            <FieldError error={get('nationality')}>
              <label className="label">国籍</label>
              <input className="input" value={nationality} onChange={(e) => { setNationality(e.target.value); clear('nationality'); }} />
            </FieldError>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="card space-y-5">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">基础属性</h2>
              <p className="mt-1 text-sm text-ink-soft">不会写？就交给骰子。</p>
            </div>
            <button type="button" onClick={randomPrimary} className="btn-soft text-sm">🎲 随机生成</button>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu', 'luck'] as const).map((k) => (
              <FieldError key={k} error={get(`primary.${k}`)}>
                <label className="label uppercase">{k}</label>
                <input
                  type="number"
                  className="input"
                  value={primary[k]}
                  min={1}
                  onChange={(e) => { setPrimary({ ...primary, [k]: parseInt(e.target.value) || 0 }); clear(`primary.${k}`); }}
                />
              </FieldError>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-5">
          <header>
            <h2 className="text-lg font-bold text-ink">技能</h2>
            <p className="mt-1 text-sm text-ink-soft">勾选「克苏鲁神话」会让该技能以紫色显示。</p>
          </header>

          <ul ref={skillsListRef} className="max-h-96 divide-y divide-sky-100 overflow-y-auto rounded-2xl border border-sky-200">
            {skills.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <FieldError error={get(`skills.${i}.name`)}>
                  <input
                    className="input flex-1 min-w-[8rem]"
                    placeholder="技能名称"
                    value={s.name}
                    onChange={(e) => {
                      const c = [...skills]; c[i] = { ...c[i], name: e.target.value }; setSkills(c);
                      clear(`skills.${i}.name`);
                    }}
                  />
                </FieldError>
                <FieldError error={get(`skills.${i}.value`)}>
                  <input
                    type="number"
                    className="input w-24"
                    value={s.value}
                    min={0}
                    onChange={(e) => {
                      const c = [...skills]; c[i] = { ...c[i], value: parseInt(e.target.value) || 0 }; setSkills(c);
                      clear(`skills.${i}.value`);
                    }}
                  />
                </FieldError>
                <label className="inline-flex items-center gap-1 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    className="rounded border-sky-300 text-mythos focus:ring-mythos"
                    checked={!!s.isMythos}
                    onChange={(e) => {
                      const c = [...skills]; c[i] = { ...c[i], isMythos: e.target.checked }; setSkills(c);
                    }}
                  />
                  克苏鲁神话
                </label>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => setSkills(skills.filter((_, j) => j !== i))}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>

          <div className="subpanel space-y-3">
            <p className="text-sm font-semibold text-ink">添加新技能</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
              <div>
                <label className="label text-xs">名称</label>
                <input className="input" placeholder="技能名称" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs">初始值</label>
                <input type="number" className="input" value={newSkill.value} min={0}
                  onChange={(e) => setNewSkill({ ...newSkill, value: parseInt(e.target.value) || 0 })} />
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (newSkill.name) {
                    setSkills([...skills, newSkill]);
                    setNewSkill({ name: '', value: 50 });
                    scrollListToBottom(skillsListRef);
                  }
                }}
              >
                ＋ 添加
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <section className="card space-y-4">
            <header>
              <h2 className="text-lg font-bold text-ink">武器</h2>
              <p className="mt-1 text-sm text-ink-soft">填写名称、使用技能、伤害表达式。</p>
            </header>

            {weapons.length === 0 ? (
              <p className="text-sm text-ink-soft">还没添加武器。</p>
            ) : (
              <ul ref={weaponsListRef} className="max-h-96 divide-y divide-sky-100 overflow-y-auto rounded-2xl border border-sky-200">
                {weapons.map((w, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 font-semibold text-ink">{w.name}</span>
                    <span className="text-xs text-ink-soft">{w.skill} · {w.damage}{w.range ? ` · ${w.range}` : ''}</span>
                    <button type="button" className="btn-ghost text-xs" onClick={() => setWeapons(weapons.filter((_, j) => j !== i))}>
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="subpanel space-y-3">
              <p className="text-sm font-semibold text-ink">添加武器</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label text-xs">名称</label>
                  <input className="input" value={newWeapon.name} onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">使用技能</label>
                  <input className="input" value={newWeapon.skill} onChange={(e) => setNewWeapon({ ...newWeapon, skill: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">伤害表达式</label>
                  <input className="input font-mono" placeholder="1d6" value={newWeapon.damage} onChange={(e) => setNewWeapon({ ...newWeapon, damage: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">射程（可选）</label>
                  <input className="input" value={newWeapon.range} onChange={(e) => setNewWeapon({ ...newWeapon, range: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" className="btn-primary" onClick={() => {
                  if (newWeapon.name) {
                    setWeapons([...weapons, newWeapon]);
                    setNewWeapon({ name: '', skill: '', damage: '', range: '' });
                    scrollListToBottom(weaponsListRef);
                  }
                }}>
                  ＋ 添加武器
                </button>
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <header>
              <h2 className="text-lg font-bold text-ink">装备</h2>
              <p className="mt-1 text-sm text-ink-soft">背包、工具、信物……任意你想要的道具。</p>
            </header>

            {equipment.length === 0 ? (
              <p className="text-sm text-ink-soft">还没添加装备。</p>
            ) : (
              <ul ref={equipmentListRef} className="max-h-96 divide-y divide-sky-100 overflow-y-auto rounded-2xl border border-sky-200">
                {equipment.map((e, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1 font-semibold text-ink">{e.name}</span>
                    <span className="text-xs text-ink-soft">× {e.quantity}</span>
                    <button type="button" className="btn-ghost text-xs" onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}>
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="subpanel space-y-3">
              <p className="text-sm font-semibold text-ink">添加装备</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                <div>
                  <label className="label text-xs">名称</label>
                  <input className="input" value={newEquip.name} onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">数量</label>
                  <input type="number" className="input" value={newEquip.quantity} min={1}
                    onChange={(e) => setNewEquip({ ...newEquip, quantity: parseInt(e.target.value) || 1 })} />
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (newEquip.name) {
                      setEquipment([...equipment, newEquip]);
                      setNewEquip({ name: '', quantity: 1 });
                      scrollListToBottom(equipmentListRef);
                    }
                  }}
                >
                  ＋ 添加
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {step === 5 && (
        <div className="card space-y-5">
          <header>
            <h2 className="text-lg font-bold text-ink">背景与备注</h2>
            <p className="mt-1 text-sm text-ink-soft">背景会在游戏内展示给其他玩家；备注只有你本人能看。</p>
          </header>
          <FieldError error={get('background')}>
            <label className="label">调查员背景</label>
            <textarea className="input min-h-[200px]" value={background} onChange={(e) => { setBackground(e.target.value); clear('background'); }} />
          </FieldError>
          <FieldError error={get('notes')}>
            <label className="label">玩家私有备注</label>
            <textarea className="input min-h-[120px]" value={notes} onChange={(e) => { setNotes(e.target.value); clear('notes'); }} />
          </FieldError>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="flex justify-between gap-2">
        <button type="button" className="btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
          ← 上一步
        </button>
        {step < 5 ? (
          <button type="button" className="btn-primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !name}>
            下一步 →
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? (editingId ? '保存中…' : '创建中…') : (editingId ? '保存车卡' : '创建车卡')}
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
  return 1;
}