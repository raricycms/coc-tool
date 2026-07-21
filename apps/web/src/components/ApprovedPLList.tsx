'use client';

/**
 * 招募详情页「已通过 PL」列表：
 * - 普通 pill 改为可点击按钮，弹出 CharacterViewModal。
 * - 角色被申请人删除（character === null）时按钮禁用。
 * - 不区分 KP / PL 视角：所有人（包括旁观 PL）都允许查看其它已通过 PL 的车卡。
 */

import { useState } from 'react';
import { CharacterViewModal, type ReadOnlyCharacter } from './CharacterViewModal';

export interface ApprovedPLItem {
  applicationId: string;
  applicantUsername: string;
  character: ReadOnlyCharacter | null;
}

interface Props {
  items: ApprovedPLItem[];
}

export function ApprovedPLList({ items }: Props) {
  const [viewing, setViewing] = useState<ApprovedPLItem | null>(null);

  if (items.length === 0) {
    return <p className="text-sm text-ink-soft">还没有 PL 通过审核。</p>;
  }

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {items.map((it) => (
          <li key={it.applicationId}>
            <button
              type="button"
              className="btn-soft text-sm disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!it.character}
              onClick={() => it.character && setViewing(it)}
              title={it.character ? `查看 @${it.applicantUsername} 的车卡` : '该角色已被删除'}
            >
              @{it.applicantUsername}
              {it.character && <span className="ml-1.5 text-xs text-ink-muted">· {it.character.name}</span>}
            </button>
          </li>
        ))}
      </ul>

      {viewing?.character && (
        <CharacterViewModal
          character={viewing.character}
          applicantUsername={viewing.applicantUsername}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}