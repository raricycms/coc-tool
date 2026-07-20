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

/**
 * 角色详情弹窗：所有人可见。
 *  - 所有人：看完整数值 + 技能 + 武器 + 物品
 *  - KP    ：额外获得武器 / 物品的「新增 / 编辑 / 删除」表单
 *
 * 设计：单 Modal，居中显示，背景遮罩，Esc 关闭。
 */
export function CharacterDetailModal({
  character, ownerUsername, isKp,
  onClose,
  onWeaponUpsert, onWeaponDelete,
  onEquipmentUpsert, onEquipmentDelete,
}: Props) {
  if (!character) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl my-8 max-h-[calc(100vh-4rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-white/10 -mx-5 -mt-5 px-5 py-3 mb-4">
          <div>
            <h2 className="font-bold text-lg">{character.name}</h2>
            {ownerUsername && (
              <div className="text-xs text-ink-100/40">@{ownerUsername}</div>
            )}
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>关闭 ✕</button>
        </header>

        <div className="overflow-y-auto pr-2 space-y-5 text-sm">
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
          {!isKp && (
            <p className="text-[10px] text-ink-100/30 italic text-center">
              只读视图 · 武器/物品由 KP 管理
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
      <h3 className="font-bold text-ink-100/70 mb-1.5">状态</h3>
      <div className="space-y-1.5">
        <Bar label="HP" value={char.hp} max={char.hpMax} pct={hpPct} color="bg-red-500" />
        <Bar label="SAN" value={char.san} max={char.sanMax} pct={sanPct} color="bg-violet-500" />
        {char.mpMax > 0 && <Bar label="MP" value={char.mp} max={char.mpMax} pct={mpPct} color="bg-sky-500" />}
        <div className="flex gap-2 text-xs text-ink-100/60 pt-1">
          <span>🎲 LUCK <b className="text-ink-100">{char.luck}</b></span>
          <span>🗡 DB <b className="text-ink-100">{char.damageBonus}</b></span>
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
      <h3 className="font-bold text-ink-100/70 mb-1.5">基础属性</h3>
      <div className="grid grid-cols-9 gap-1.5">
        {cells.map(([label, val]) => (
          <div key={label} className="rounded bg-white/[0.04] border border-white/5 py-1 text-center">
            <div className="text-[10px] text-ink-100/40">{label}</div>
            <div className="font-mono text-ink-100">{val}</div>
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
      <h3 className="font-bold text-ink-100/70 mb-1.5">技能（{sorted.length}）</h3>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
        {sorted.map((s) => (
          <li key={s.name} className="flex justify-between border-b border-white/[0.04] py-0.5">
            <span className={s.isMythos ? 'text-violet-300' : 'text-ink-100/80'}>
              {s.name}{s.isMythos && ' ✦'}
            </span>
            <span className="font-mono text-ink-100/70">{s.value}</span>
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
      <h3 className="font-bold text-ink-100/70 mb-1.5 flex items-center justify-between">
        <span>武器（{character.weapons.length}）</span>
        {isKp && <NewWeaponButton character={character} onUpsert={onUpsert} />}
      </h3>
      {character.weapons.length === 0 ? (
        <p className="text-xs text-ink-100/30">{isKp ? '还没有武器，点上方「+ 武器」新增。' : '没有武器。'}</p>
      ) : (
        <ul className="space-y-1.5">
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
      <button className="btn-ghost text-[10px] px-2 py-0.5" onClick={() => setOpen((v) => !v)}>
        {open ? '收起' : '+ 武器'}
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
    <div className="rounded bg-white/[0.03] border border-white/5 px-2.5 py-1.5">
      {!editing ? (
        <div className="flex items-baseline justify-between">
          <div className="text-xs">
            <b className="text-ink-100">{weapon.name}</b>
            <span className="text-ink-100/50 ml-1.5">
              · {weapon.skill} · {weapon.damage}
              {weapon.range && ` · 射程 ${weapon.range}`}
              {weapon.ammo != null && ` · 弹药 ${weapon.ammo}`}
            </span>
            {weapon.note && <span className="block text-[10px] text-ink-100/40 italic mt-0.5">{weapon.note}</span>}
          </div>
          {isKp && (
            <div className="flex gap-1 shrink-0">
              <button className="btn-ghost text-[10px] px-1.5 py-0" onClick={() => setEditing(true)}>✎</button>
              <button
                className="btn-danger text-[10px] px-1.5 py-0"
                onClick={() => {
                  if (confirm(`删除武器「${weapon.name}」？`)) onDelete(character.id, weapon.id);
                }}
              >✕</button>
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
      alert('名称 / 技能 / 伤害 是必填项');
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
    <div className="subpanel space-y-1.5 text-xs">
      <div className="grid grid-cols-2 gap-1.5">
        <input className="input text-xs" placeholder="名称 *" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <input className="input text-xs" placeholder="对应技能 *" value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={40} />
        <input className="input text-xs font-mono" placeholder="伤害表达式（如 1d6）*" value={damage} onChange={(e) => setDamage(e.target.value)} maxLength={20} />
        <input className="input text-xs" placeholder="射程（可选）" value={range} onChange={(e) => setRange(e.target.value)} maxLength={20} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="number"
          className="input text-xs"
          placeholder="弹药数（可选）"
          value={ammo}
          onChange={(e) => setAmmo(e.target.value)}
          min={0}
          max={9999}
        />
        <input className="input text-xs" placeholder="备注（可选）" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      <div className="flex justify-end gap-1.5 pt-1">
        <button className="btn-ghost text-[10px] px-2 py-0.5" onClick={onCancel}>取消</button>
        <button className="btn-primary text-[10px] px-2 py-0.5" onClick={submit}>
          {mode === 'create' ? '新增' : '保存'}
        </button>
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
      <h3 className="font-bold text-ink-100/70 mb-1.5 flex items-center justify-between">
        <span>物品（{character.equipment.length}）</span>
        {isKp && <NewEquipmentButton character={character} onUpsert={onUpsert} />}
      </h3>
      {character.equipment.length === 0 ? (
        <p className="text-xs text-ink-100/30">{isKp ? '还没有物品，点上方「+ 物品」新增。' : '没有物品。'}</p>
      ) : (
        <ul className="space-y-1.5">
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
      <button className="btn-ghost text-[10px] px-2 py-0.5" onClick={() => setOpen((v) => !v)}>
        {open ? '收起' : '+ 物品'}
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
    <div className="rounded bg-white/[0.03] border border-white/5 px-2.5 py-1.5">
      {!editing ? (
        <div className="flex items-baseline justify-between">
          <div className="text-xs">
            <b className="text-ink-100">{equipment.name}</b>
            <span className="text-ink-100/50 ml-1.5">· ×{equipment.quantity}</span>
            {equipment.note && <span className="block text-[10px] text-ink-100/40 italic mt-0.5">{equipment.note}</span>}
          </div>
          {isKp && (
            <div className="flex gap-1 shrink-0">
              <button className="btn-ghost text-[10px] px-1.5 py-0" onClick={() => setEditing(true)}>✎</button>
              <button
                className="btn-danger text-[10px] px-1.5 py-0"
                onClick={() => {
                  if (confirm(`删除物品「${equipment.name}」？`)) onDelete(character.id, equipment.id);
                }}
              >✕</button>
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
    <div className="subpanel space-y-1.5 text-xs">
      <div className="grid grid-cols-[1fr_6rem] gap-1.5">
        <input className="input text-xs" placeholder="名称 *" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <input
          type="number"
          className="input text-xs"
          placeholder="数量"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min={1}
          max={9999}
        />
      </div>
      <input className="input text-xs" placeholder="备注（可选）" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      <div className="flex justify-end gap-1.5 pt-1">
        <button className="btn-ghost text-[10px] px-2 py-0.5" onClick={onCancel}>取消</button>
        <button className="btn-primary text-[10px] px-2 py-0.5" onClick={submit}>
          {mode === 'create' ? '新增' : '保存'}
        </button>
      </div>
    </div>
  );
}

// ─────────────── shared bits ───────────────

function Bar({ label, value, max, pct, color }: { label: string; value: number; max: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-ink-100/60 font-medium">{label}</span>
        <span className="font-mono text-ink-100/90"><b>{value}</b><span className="text-ink-100/40">/{max}</span></span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
