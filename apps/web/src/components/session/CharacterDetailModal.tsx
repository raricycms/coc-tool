'use client';

import { useState } from 'react';

export interface CharacterDetail {
  id: string;
  name: string;
  hp: number; hpMax: number;
  san: number; sanMax: number;
  mp: number; mpMax: number;
  luck: number;
  damageBonus: string;
  str: number; con: number; siz: number; dex: number;
  app: number; int: number; pow: number; edu: number;
  background?: string | null;
  skills: Array<{ name: string; value: number; isMythos: boolean }>;
  weapons: Array<{ id: string; name: string; skill: string; damage: string; range?: string | null; ammo?: number | null; note?: string | null }>;
  equipment: Array<{ id: string; name: string; quantity: number; note?: string | null }>;
}

interface Props {
  character: CharacterDetail | null;
  ownerUsername?: string;
  isKp: boolean;
  onClose: () => void;
  onWeaponUpsert: (payload: {
    characterId: string;
    id?: string;
    name: string;
    skill: string;
    damage: string;
    range?: string;
    ammo?: number;
    note?: string;
  }) => void;
  onWeaponDelete: (characterId: string, id: string) => void;
  onEquipmentUpsert: (payload: {
    characterId: string;
    id?: string;
    name: string;
    quantity: number;
    note?: string;
  }) => void;
  onEquipmentDelete: (characterId: string, id: string) => void;
}

export function CharacterDetailModal({
  character, ownerUsername, isKp,
  onClose,
  onWeaponUpsert, onWeaponDelete,
  onEquipmentUpsert, onEquipmentDelete,
}: Props) {
  if (!character) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="-mx-5 -mt-5 mb-4 flex shrink-0 items-start justify-between border-b border-sky-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-bold text-ink">{character.name}</h2>
            {ownerUsername && (
              <div className="text-xs text-ink-muted">@{ownerUsername}</div>
            )}
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>关闭 ✕</button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 text-sm">
          <DerivedStats char={character} />
          <PrimaryStats char={character} />
          <SkillsSection char={character} />
          <WeaponsSection
            character={character}
            isKp={isKp}
            onUpsert={onWeaponUpsert}
            onDelete={onWeaponDelete}
          />
          <EquipmentSection
            character={character}
            isKp={isKp}
            onUpsert={onEquipmentUpsert}
            onDelete={onEquipmentDelete}
          />
          {character.background && <BackgroundSection background={character.background} />}
          {!isKp && (
            <p className="text-center text-[11px] italic text-ink-muted">
              只读视图 · 武器和物品由 KP 管理
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DerivedStats({ char }: { char: CharacterDetail }) {
  const hpPct = char.hpMax > 0 ? Math.max(0, Math.min(100, (char.hp / char.hpMax) * 100)) : 0;
  const sanPct = char.sanMax > 0 ? Math.max(0, Math.min(100, (char.san / char.sanMax) * 100)) : 0;
  const mpPct = char.mpMax > 0 ? Math.max(0, Math.min(100, (char.mp / char.mpMax) * 100)) : 0;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">状态</h3>
      <div className="space-y-2">
        <Bar label="HP" value={char.hp} max={char.hpMax} pct={hpPct} color="bg-bad" />
        <Bar label="SAN" value={char.san} max={char.sanMax} pct={sanPct} color="bg-mythos" />
        {char.mpMax > 0 && <Bar label="MP" value={char.mp} max={char.mpMax} pct={mpPct} color="bg-macaron-300" />}
        <div className="flex gap-4 pt-1 text-xs text-ink-soft">
          <span>LUCK <b className="text-ink">{char.luck}</b></span>
          <span>伤害加值 <b className="text-ink">{char.damageBonus}</b></span>
        </div>
      </div>
    </section>
  );
}

function PrimaryStats({ char }: { char: CharacterDetail }) {
  const cells: Array<[string, number]> = [
    ['STR', char.str], ['CON', char.con], ['SIZ', char.siz], ['DEX', char.dex], ['APP', char.app],
    ['INT', char.int], ['POW', char.pow], ['EDU', char.edu], ['LUCK', char.luck],
  ];
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">基础属性</h3>
      <div className="grid grid-cols-9 gap-1.5">
        {cells.map(([label, val]) => (
          <div key={label} className="rounded-2xl border border-sky-200 bg-sky-50 py-1.5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
            <div className="font-mono text-sm font-bold text-ink">{val}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillsSection({ char }: { char: CharacterDetail }) {
  const sorted = [...char.skills].sort(
    (a, b) => (Number(b.isMythos) - Number(a.isMythos)) || (b.value - a.value),
  );
  if (sorted.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">技能 · {sorted.length}</h3>
      <ul className="grid grid-cols-2 gap-x-4 text-xs">
        {sorted.map((s) => (
          <li key={s.name} className="flex justify-between border-b border-sky-100 py-0.5">
            <span className={s.isMythos ? 'text-mythos font-semibold' : 'text-ink'}>
              {s.name}{s.isMythos && ' ✦'}
            </span>
            <span className="font-mono text-ink-soft">{s.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─────────────── Weapons ───────────────

function WeaponsSection({ character, isKp, onUpsert, onDelete }: {
  character: CharacterDetail; isKp: boolean;
  onUpsert: Props['onWeaponUpsert']; onDelete: Props['onWeaponDelete'];
}) {
  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">武器 · {character.weapons.length}</h3>
        {isKp && <NewWeaponButton character={character} onUpsert={onUpsert} />}
      </header>
      {character.weapons.length === 0 ? (
        <p className="text-xs text-ink-muted">{isKp ? '还没有武器，点右上方「+ 武器」新增。' : '没有武器。'}</p>
      ) : (
        <ul className="space-y-2">
          {character.weapons.map((w) => (
            <li key={w.id}>
              <WeaponRow weapon={w} character={character} isKp={isKp} onUpsert={onUpsert} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewWeaponButton({ character, onUpsert }: {
  character: CharacterDetail;
  onUpsert: Props['onWeaponUpsert'];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="btn-soft text-xs" onClick={() => setOpen((v) => !v)}>
        {open ? '收起' : '＋ 武器'}
      </button>
      {open && (
        <div className="mt-2">
          <WeaponForm
            mode="create"
            characterId={character.id}
            initial={{}}
            onSubmit={(payload) => {
              onUpsert({ characterId: character.id, ...payload });
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function WeaponRow({ weapon, character, isKp, onUpsert, onDelete }: {
  weapon: CharacterDetail['weapons'][number];
  character: CharacterDetail; isKp: boolean;
  onUpsert: Props['onWeaponUpsert']; onDelete: Props['onWeaponDelete'];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
      {!editing ? (
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs">
            <b className="text-ink">{weapon.name}</b>
            <span className="ml-1.5 text-ink-soft">
              · {weapon.skill} · {weapon.damage}
              {weapon.range && ` · 射程 ${weapon.range}`}
              {weapon.ammo != null && ` · 弹药 ${weapon.ammo}`}
            </span>
            {weapon.note && <span className="mt-0.5 block text-[10px] italic text-ink-muted">{weapon.note}</span>}
          </div>
          {isKp && (
            <div className="flex shrink-0 gap-1">
              <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => setEditing(true)}>编辑</button>
              <button
                className="btn-danger px-2 py-0.5 text-[11px]"
                onClick={() => {
                  if (confirm(`删除武器「${weapon.name}」？`)) onDelete(character.id, weapon.id);
                }}
              >删除</button>
            </div>
          )}
        </div>
      ) : (
        <WeaponForm
          mode="edit"
          characterId={character.id}
          initial={{
            id: weapon.id,
            name: weapon.name,
            skill: weapon.skill,
            damage: weapon.damage,
            range: weapon.range ?? '',
            ammo: weapon.ammo ?? undefined,
            note: weapon.note ?? '',
          }}
          onSubmit={(payload) => {
            onUpsert({ characterId: character.id, ...payload });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

interface WeaponFormState {
  id?: string;
  name: string;
  skill: string;
  damage: string;
  range?: string;
  ammo?: number;
  note?: string;
}

function WeaponForm({ mode, characterId, initial, onSubmit, onCancel }: {
  mode: 'create' | 'edit';
  characterId: string;
  initial: Partial<WeaponFormState>;
  onSubmit: (payload: Omit<WeaponFormState, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [skill, setSkill] = useState(initial.skill ?? '');
  const [damage, setDamage] = useState(initial.damage ?? '');
  const [range, setRange] = useState(initial.range ?? '');
  const [ammo, setAmmo] = useState(initial.ammo != null ? String(initial.ammo) : '');
  const [note, setNote] = useState(initial.note ?? '');

  const submit = () => {
    if (!name.trim() || !skill.trim() || !damage.trim()) {
      alert('名称 / 使用技能 / 伤害 是必填项');
      return;
    }
    onSubmit({
      id: initial.id,
      name: name.trim(),
      skill: skill.trim(),
      damage: damage.trim(),
      range: range.trim() || undefined,
      ammo: ammo ? parseInt(ammo, 10) : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="subpanel space-y-2 text-xs">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label text-xs">名称 <span className="text-bad">*</span></label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>
        <div>
          <label className="label text-xs">使用技能 <span className="text-bad">*</span></label>
          <input className="input" value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={40} />
        </div>
        <div>
          <label className="label text-xs">伤害表达式 <span className="text-bad">*</span></label>
          <input className="input font-mono" placeholder="1d6" value={damage} onChange={(e) => setDamage(e.target.value)} maxLength={20} />
        </div>
        <div>
          <label className="label text-xs">射程（可选）</label>
          <input className="input" value={range} onChange={(e) => setRange(e.target.value)} maxLength={20} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label text-xs">弹药数（可选）</label>
          <input type="number" className="input" value={ammo} onChange={(e) => setAmmo(e.target.value)} min={0} max={9999} />
        </div>
        <div>
          <label className="label text-xs">备注（可选）</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button className="btn-ghost text-xs" onClick={onCancel}>取消</button>
        <button className="btn-primary text-xs" onClick={submit}>{mode === 'create' ? '新增' : '保存'}</button>
      </div>
    </div>
  );
}

// ─────────────── Equipment ───────────────

function EquipmentSection({ character, isKp, onUpsert, onDelete }: {
  character: CharacterDetail; isKp: boolean;
  onUpsert: Props['onEquipmentUpsert']; onDelete: Props['onEquipmentDelete'];
}) {
  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">物品 · {character.equipment.length}</h3>
        {isKp && <NewEquipmentButton character={character} onUpsert={onUpsert} />}
      </header>
      {character.equipment.length === 0 ? (
        <p className="text-xs text-ink-muted">{isKp ? '还没有物品，点右上方「+ 物品」新增。' : '没有物品。'}</p>
      ) : (
        <ul className="space-y-2">
          {character.equipment.map((e) => (
            <li key={e.id}>
              <EquipmentRow equipment={e} character={character} isKp={isKp} onUpsert={onUpsert} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewEquipmentButton({ character, onUpsert }: {
  character: CharacterDetail;
  onUpsert: Props['onEquipmentUpsert'];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="btn-soft text-xs" onClick={() => setOpen((v) => !v)}>
        {open ? '收起' : '＋ 物品'}
      </button>
      {open && (
        <div className="mt-2">
          <EquipmentForm
            mode="create"
            characterId={character.id}
            initial={{}}
            onSubmit={(payload) => {
              onUpsert({ characterId: character.id, ...payload });
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function EquipmentRow({ equipment, character, isKp, onUpsert, onDelete }: {
  equipment: CharacterDetail['equipment'][number];
  character: CharacterDetail; isKp: boolean;
  onUpsert: Props['onEquipmentUpsert']; onDelete: Props['onEquipmentDelete'];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
      {!editing ? (
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs">
            <b className="text-ink">{equipment.name}</b>
            <span className="ml-1.5 text-ink-soft">× {equipment.quantity}</span>
            {equipment.note && <span className="mt-0.5 block text-[10px] italic text-ink-muted">{equipment.note}</span>}
          </div>
          {isKp && (
            <div className="flex shrink-0 gap-1">
              <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => setEditing(true)}>编辑</button>
              <button
                className="btn-danger px-2 py-0.5 text-[11px]"
                onClick={() => {
                  if (confirm(`删除物品「${equipment.name}」？`)) onDelete(character.id, equipment.id);
                }}
              >删除</button>
            </div>
          )}
        </div>
      ) : (
        <EquipmentForm
          mode="edit"
          characterId={character.id}
          initial={{
            id: equipment.id,
            name: equipment.name,
            quantity: equipment.quantity,
            note: equipment.note ?? '',
          }}
          onSubmit={(payload) => {
            onUpsert({ characterId: character.id, ...payload });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

interface EquipmentFormState {
  id?: string;
  name: string;
  quantity: number;
  note?: string;
}

function EquipmentForm({ mode, characterId, initial, onSubmit, onCancel }: {
  mode: 'create' | 'edit';
  characterId: string;
  initial: Partial<EquipmentFormState>;
  onSubmit: (payload: Omit<EquipmentFormState, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? '');
  const [quantity, setQuantity] = useState(initial.quantity != null ? String(initial.quantity) : '1');
  const [note, setNote] = useState(initial.note ?? '');

  const submit = () => {
    if (!name.trim()) { alert('名称必填'); return; }
    const q = parseInt(quantity, 10);
    if (!Number.isFinite(q) || q < 1) { alert('数量 ≥ 1'); return; }
    onSubmit({ id: initial.id, name: name.trim(), quantity: q, note: note.trim() || undefined });
  };

  return (
    <div className="subpanel space-y-2 text-xs">
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <div>
          <label className="label text-xs">名称 <span className="text-bad">*</span></label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div>
          <label className="label text-xs">数量</label>
          <input type="number" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} min={1} max={9999} />
        </div>
      </div>
      <div>
        <label className="label text-xs">备注（可选）</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button className="btn-ghost text-xs" onClick={onCancel}>取消</button>
        <button className="btn-primary text-xs" onClick={submit}>{mode === 'create' ? '新增' : '保存'}</button>
      </div>
    </div>
  );
}

function Bar({ label, value, max, pct, color }: { label: string; value: number; max: number; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-ink-soft">{label}</span>
        <span className="font-mono text-ink"><b>{value}</b><span className="text-ink-muted">/{max}</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sky-100">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BackgroundSection({ background }: { background: string }) {
  return (
    <section className="card">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">调查员背景</h3>
      <p className="whitespace-pre-wrap text-sm text-ink">{background}</p>
    </section>
  );
}