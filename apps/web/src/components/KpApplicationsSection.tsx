'use client';

/**
 * 招募详情页的 KP 管理区块：报名列表 + 审批按钮 + 已通过 PL 的只读车卡查看入口。
 * 之所以拆出 client component：既需要 useState 控制弹窗，又需要 router.refresh() 反映审批结果。
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApplicationReviewButtons } from './ApplicationReviewButtons';
import { StartSessionButton } from './StartSessionButton';
import { CharacterViewModal, type ReadOnlyCharacter } from './CharacterViewModal';

export interface KpApplication {
  id: string;
  status: string;
  message?: string | null;
  createdAt: string;
  applicant: { id: string; username: string; avatarUrl: string | null };
  character: ReadOnlyCharacter | null;
}

interface Props {
  recruitmentId: string;
  recruitmentStatus: string;
  applications: KpApplication[];
  approvedCount: number;
  sessionId: string | null;
  sessionStatus: string | null;
}

export function KpApplicationsSection({
  recruitmentId,
  recruitmentStatus,
  applications,
  approvedCount,
  sessionId,
  sessionStatus,
}: Props) {
  const router = useRouter();
  const [viewing, setViewing] = useState<{ char: ReadOnlyCharacter; applicantUsername: string } | null>(null);

  // 已经开团：把 KP 引到 session 页；仍 OPEN：显示开团按钮
  const sessionActive = !!sessionId && sessionStatus !== 'FINISHED' && sessionStatus !== 'ABANDONED';

  return (
    <>
      <section className="card">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-soft">
          报名列表 · {applications.length}
        </h2>
        {applications.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有 PL 报名。</p>
        ) : (
          <ul className="divide-y divide-sky-100">
            {applications.map((a) => (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">@{a.applicant.username}</span>
                      <StatusTag status={a.status} />
                      {a.status === 'APPROVED' && a.character && (
                        <button
                          type="button"
                          className="btn-soft text-[11px]"
                          onClick={() => setViewing({ char: a.character!, applicantUsername: a.applicant.username })}
                        >
                          查看车卡
                        </button>
                      )}
                    </div>
                    {a.message && <p className="mt-2 text-sm text-ink">{a.message}</p>}
                    {!a.character && (
                      <p className="mt-1 text-xs italic text-ink-muted">该角色已被其所有人删除。</p>
                    )}
                  </div>
                  {a.status === 'PENDING' && (
                    <ApplicationReviewButtons recruitmentId={recruitmentId} appId={a.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 跑团已经开始：进入入口；尚未开团：在 OPEN 状态下显示开团按钮 */}
      {sessionActive && sessionId && (
        <div className="flex justify-end">
          <Link href={`/sessions/${sessionId}`} className="btn-primary">
            → 进入跑团
          </Link>
        </div>
      )}
      {!sessionActive && recruitmentStatus === 'OPEN' && (
        <StartSessionButton recruitmentId={recruitmentId} approvedCount={approvedCount} />
      )}

      {viewing && (
        <CharacterViewModal
          character={viewing.char}
          applicantUsername={viewing.applicantUsername}
          onClose={() => {
            setViewing(null);
            // 关闭弹窗顺手刷新一次，让 server-rendered 的状态保持新鲜
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:   { label: '待审核', cls: 'bg-warn/20 text-warn' },
    APPROVED:  { label: '已通过', cls: 'bg-ok/15 text-ok' },
    REJECTED:  { label: '已拒绝', cls: 'bg-bad/15 text-bad' },
    WITHDRAWN: { label: '已撤回', cls: 'bg-sky-100 text-ink-soft' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-sky-100 text-ink-soft' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}
