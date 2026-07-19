'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_SKILLS, rollDie } from '@coc-tools/coc-rules';

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

  const randomPrimary = () => setPrimary(rollPrimary());

  const submit = async () => {
    setError(null);
    setLoading(true);
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, gender: gender || undefined, age, birthplace, residence,
        nationality, occupation, era, primary, skills, weapons, equipment,
        background, notes,
      }),
    });
    setLoading(false);
    const j = await res.json();
    if (!j.ok) {
      setError(j.error?.message || '创建失败');
      return;
    }
    router.push(`/characters/${j.data.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`px-3 py-1 rounded ${step >= s ? 'bg-brand-600' : 'bg-ink-800 text-ink-100/40'}`}>
            {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card space-y-4">
          <h2 className="font-bold">基础信息</h2>
          <div>
            <label className="label">姓名 *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">性别</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value as any)}>
                <option value="">未指定</option>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="label">年龄</label>
              <input type="number" className="input" value={age} min={15} max={90} onChange={(e) => setAge(parseInt(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="label">时代 *</label>
            <select className="input" value={era} onChange={(e) => setEra(e.target.value as any)}>
              <option value="modern">现代</option>
              <option value="1920s">1920s</option>
              <option value="victorian">维多利亚</option>
              <option value="ancient">古代</option>
              <option value="future">未来</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">职业</label>
              <input className="input" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="私家侦探 / 记者 / ..." />
            </div>
            <div>
              <label className="label">国籍</label>
              <input className="input" value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">出生地</label>
              <input className="input" value={birthplace} onChange={(e) => setBirthplace(e.target.value)} />
            </div>
            <div>
              <label className="label">住址</label>
              <input className="input" value={residence} onChange={(e) => setResidence(e.target.value)} />
            </div>
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
              <div key={k}>
                <label className="label uppercase">{k}</label>
                <input type="number" className="input" value={primary[k]} min={1} max={100}
                  onChange={(e) => setPrimary({ ...primary, [k]: parseInt(e.target.value) || 0 })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="font-bold">技能</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {skills.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="flex-1">{s.name}</span>
                <input type="number" className="input w-20" value={s.value} min={0} max={100}
                  onChange={(e) => {
                    const c = [...skills]; c[i] = { ...c[i], value: parseInt(e.target.value) || 0 }; setSkills(c);
                  }} />
                <button type="button" className="text-red-400" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="技能名" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} />
            <input type="number" className="input w-24" placeholder="值" value={newSkill.value} min={0} max={100}
              onChange={(e) => setNewSkill({ ...newSkill, value: parseInt(e.target.value) || 0 })} />
            <button type="button" className="btn-ghost" onClick={() => {
              if (newSkill.name) {
                setSkills([...skills, newSkill]);
                setNewSkill({ name: '', value: 50 });
              }
            }}>+</button>
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
                <button type="button" className="text-red-400" onClick={() => setWeapons(weapons.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div className="grid grid-cols-4 gap-2">
              <input className="input" placeholder="武器名" value={newWeapon.name} onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })} />
              <input className="input" placeholder="技能" value={newWeapon.skill} onChange={(e) => setNewWeapon({ ...newWeapon, skill: e.target.value })} />
              <input className="input" placeholder="伤害" value={newWeapon.damage} onChange={(e) => setNewWeapon({ ...newWeapon, damage: e.target.value })} />
              <input className="input" placeholder="射程" value={newWeapon.range} onChange={(e) => setNewWeapon({ ...newWeapon, range: e.target.value })} />
            </div>
            <button type="button" className="btn-ghost" onClick={() => {
              if (newWeapon.name) {
                setWeapons([...weapons, newWeapon]);
                setNewWeapon({ name: '', skill: '', damage: '', range: '' });
              }
            }}>+ 添加武器</button>
          </div>

          <div className="card space-y-3">
            <h2 className="font-bold">装备</h2>
            {equipment.map((e, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="flex-1">{e.name} × {e.quantity}</span>
                <button type="button" className="text-red-400" onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="装备名" value={newEquip.name} onChange={(e) => setNewEquip({ ...newEquip, name: e.target.value })} />
              <input type="number" className="input w-24" placeholder="数量" value={newEquip.quantity} min={1}
                onChange={(e) => setNewEquip({ ...newEquip, quantity: parseInt(e.target.value) || 1 })} />
              <button type="button" className="btn-ghost" onClick={() => {
                if (newEquip.name) {
                  setEquipment([...equipment, newEquip]);
                  setNewEquip({ name: '', quantity: 1 });
                }
              }}>+</button>
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card space-y-4">
          <h2 className="font-bold">背景 & 备注</h2>
          <div>
            <label className="label">调查员背景</label>
            <textarea className="input min-h-[200px]" value={background} onChange={(e) => setBackground(e.target.value)} />
          </div>
          <div>
            <label className="label">玩家私有备注</label>
            <textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
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