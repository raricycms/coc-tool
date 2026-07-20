# Coc-tools · Claude 协作约定

## 提交节奏

**每次加完一个新功能（或修完一个独立 bug）都要立刻 `git commit`**——不要攒着。

哪怕只改了一个文件、哪怕 message 写得不漂亮，也比一个巨大 commit 强。理由：

- 这是一个多人项目的中长期演进基线；中途 `git revert` / `git bisect` 比对的就是这些边界
- 没 commit 的改动 == 在工作区里飘着，换个分支、换个会话就没了
- 性能 / 现场问题爆出来时，"现在到底跑了什么代码" 只能靠 git log 回答

提交前快速走一遍：

```bash
# 在仓根目录
npm run typecheck --workspace @coc-tools/realtime    # 若改了 realtime
cd apps/web && npx tsc --noEmit                       # 若改了 web
npm test --workspace @coc-tools/web                   # 跑回归，~30s
```

## commit message 风格

沿用仓库现状，conventional commit + 中文描述，scope 用子模块名：

```
feat(presence): 跑团页用户在线状态绿/灰实时显示
fix(ws): web/realtime SESSION_SECRET 不一致时启动 fail-loud
debug(ui): SessionClient 把 connect_error 真实原因显示在横幅
docs: ...     # 文档
chore: ...    # 配置/工具链
```

末尾加：

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## 不要 commit

- `.env` / `*.db` / 任何含密钥或数据库内容的文件（仓库 `.gitignore` 已覆盖）
- 未完成的中间产物（半成品 debug `console.log`、未清理的占位代码）
- 自动生成的 Prisma client / `.next/` / `dist/`
