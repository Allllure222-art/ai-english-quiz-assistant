# AI 英语出题助手（MVP）

基于 Next.js + OpenAI 的英语题目生成工具，面向教师、家长和自学用户。  
支持中文界面、初中英语出题、文档上传解析、证据定位和每日次数限制，适合快速上线收集首批反馈。

## 核心功能

- 中文化界面（首页、加载页、答题页、结算页、错误提示）
- 出题方向改造为初中英语：
  - 题型：阅读理解 / 完形填空
  - 难度：初级（A1-A2）/ 中级（B1-B2）/ 高级（C1）
  - 默认题量：阅读理解 5 题，完形填空 20 空
  - 可选题量：阅读理解 4/5，完形填空 10/15/20
- 输入方式：粘贴文本 / 上传 PDF / 上传 DOCX / 文章来源中心
- 统一解析结构 `ParsedDocument`（页、行、字符区间）
- 每题附带依据定位（`sourceEvidence` + `sourcePosition`）
- 支持“查看原文依据”：点击后自动滚动到对应页行并高亮（黄色）
- 桌面端原文固定在右侧面板，移动端自动降级为上下布局
- 新增 Reading Hub：站内发现文章、阅读文章并一键生成题目
- 登录 + 次数限制（MVP）：
  - 游客：每日 3 次
  - 登录用户：每日 20 次
- 出题等待体验：答题页在调用 `/api/chat`（**非流式 JSON**）时展示**分阶段中文提示**、**已等待秒数**、**可取消**；超时与 422/502/429 等给出**可操作指引**（重试 / 回首页 / 检查网络）。
- 学习小知识：等待出题时轮播轻量提示（`Facts` 组件）

## 技术栈

- Next.js 13（App Router）
- React + Tailwind CSS
- OpenAI Chat Completions（**非流式 JSON 输出**，`response_format: json_object`）
- NextAuth（GitHub 登录）

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 配置环境变量

新建 `.env.local`：

```bash
OPENAI_API_KEY=your_openai_api_key
NEXTAUTH_SECRET=your_random_long_secret
NEXTAUTH_URL=http://localhost:3000
GITHUB_ID=your_github_oauth_app_id
GITHUB_SECRET=your_github_oauth_app_secret
READING_CACHE_TTL_MINUTES=45
```

### 3) 启动项目

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 部署到公网（长期公开，推荐 Vercel）

本项目为 **Next.js App Router**，可直接部署到 [Vercel](https://vercel.com/)，之后你只需 **git push** 到已绑定的分支，线上会自动重新构建发布。

### 1. 把代码放到 GitHub

**建议的仓库名：`ai-english-quiz-assistant`**（与「AI 英语出题助手」对应，全小写、连字符，符合 GitHub 常见命名）。

本机项目目录里**已经完成** `git init`、默认分支 `main` 和**首次提交**。你还需要：

1. 在浏览器打开 [GitHub → New repository](https://github.com/new)，**Repository name** 填 `ai-english-quiz-assistant`，选 Public 或 Private，**不要**勾选 “Add a README”（保持空仓库）。  
2. **重要**：下面命令里的 **`你的GitHub用户名` 必须改成你在 GitHub 上的真实登录名**（打开 [github.com](https://github.com) 看右上角头像 → Your profile，浏览器地址栏里是 `https://github.com/这里的就是用户名`）。**不要把中文「你的GitHub用户名」原样粘贴进命令**，否则会连不上仓库。

3. **若终端提示「无法将 git 项识别为…」**：先**完全关闭并重新打开** Cursor 终端（或重启 Cursor），让系统加载已配置的 Git 路径；仍不行时，在本仓库根目录用脚本推送（把 `zhangsan` 换成你的登录名）：

```powershell
.\scripts\push-to-github.ps1 -GitHubUser zhangsan
```

4. 若 `git` 已可用，在本项目根目录执行（同样把登录名换成你的）：

```bash
git remote add origin https://github.com/登录名/ai-english-quiz-assistant.git
git push -u origin main
```

若之前已经错误执行过 `git remote add`，需要先删掉再添加：

```bash
git remote remove origin
git remote add origin https://github.com/登录名/ai-english-quiz-assistant.git
git push -u origin main
```

若已安装 [GitHub CLI](https://cli.github.com/)，可先 `gh auth login`，再在本目录执行一键创建并推送：

```bash
gh repo create ai-english-quiz-assistant --public --source=. --remote=origin --push
```

若尚未安装 Git，可先安装 [Git for Windows](https://git-scm.com/download/win) 或使用 [GitHub Desktop](https://desktop.github.com/) 将本文件夹发布到上述仓库名。

### 2. 在 Vercel 导入项目

**方式 A（推荐）**：用 GitHub 连接，便于以后 **push 即自动更新**。

1. 登录 [Vercel](https://vercel.com/) → **Add New…** → **Project**  
2. **Import** 你的 GitHub 仓库，Framework Preset 选 **Next.js**（一般会自动识别）  
3. 点击 **Deploy** 完成首次部署，记下分配的域名，例如 `https://你的项目.vercel.app`

**方式 B**：本机已安装 Node 时，也可在项目根目录执行 `npx vercel`（按提示登录并链接项目），适合快速上线；长期仍建议把代码放到 GitHub 并与 Vercel 绑定，方便同步更新。

### 3. 配置环境变量

在 Vercel 项目 → **Settings** → **Environment Variables** 中，至少添加（与本地 `.env.local` 一致，值换成你自己的）：

| 变量名 | 说明 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI API Key，**必填**，否则无法出题 |
| `NEXTAUTH_SECRET` | 随机长字符串，用于会话加密，**必填** |
| `NEXTAUTH_URL` | **线上根地址**，例如 `https://你的项目.vercel.app`（**不要**末尾加 `/`；与 Vercel 域名一致） |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth App，**需要「GitHub 登录」时必填** |
| `READING_CACHE_TTL_MINUTES` | 可选，默认 `45` |

保存后建议在 **Deployments** 里对最新部署点 **Redeploy**，使新变量生效。

### 4. GitHub OAuth（若启用登录）

在 GitHub → **Settings** → **Developer settings** → **OAuth Apps** 中，编辑你的应用：

- **Homepage URL**：`https://你的项目.vercel.app`
- **Authorization callback URL**：`https://你的项目.vercel.app/api/auth/callback/github`

与 Vercel 上的 `NEXTAUTH_URL` 使用同一域名。

### 5. 时间与套餐说明

- 若部署后出现 **504 / Function timeout**：Vercel 默认无服务器函数超时较短，可在 Vercel 项目 **Settings → Functions** 调高上限（Hobby 常见最长约 60 秒）；或升级 Next.js 至 14+ 后在 `app/api/chat/route.js`、`app/api/parse-document/route.js` 中使用官方支持的 `export const maxDuration = 60`。
- 将 Vercel 给你的 **https 链接** 发给他人即可长期访问；后续你在 GitHub 上 **push** 新提交，Vercel 会自动构建新版本。

## API 与数据契约

## Reading Hub 方案说明

- 方案A（已采用）：RSS 聚合
  - 优点：实现快、稳定、维护成本低、合规风险相对低
  - 缺点：正文完整度依赖 RSS 源，部分来源只有摘要
- 方案B（本期未做）：白名单抓取
  - 优点：可控性更高，潜在可拿到更完整正文
  - 缺点：版权与反爬风险更高，维护成本明显增加

本期 MVP 采用 **RSS 聚合 + 内存缓存（默认45分钟）+ 失败时本地降级样例数据**。

- 列表会过滤**过短**条目（默认词数低于 `READING_MIN_ARTICLE_WORDS`，见 `lib/readingHub.js`），避免噪音材料进入阅读/出题。

### `POST /api/parse-document`

用于把文本/PDF/DOCX 转换为统一的 `ParsedDocument`。

请求（multipart/form-data）：

- 文本输入：
  - `inputType=text`
  - `text=<英文材料>`
- 文件输入：
  - `inputType=file`
  - `file=<pdf/docx>`

成功返回示例：

```json
{
  "parsedDocument": {
    "documentId": "uuid",
    "sourceType": "pdf",
    "fullText": "...",
    "promptText": "...",
    "pages": [
      {
        "pageNumber": 1,
        "text": "...",
        "lines": [
          {
            "lineNumber": 1,
            "text": "...",
            "charStart": 0,
            "charEnd": 52
          }
        ]
      }
    ],
    "searchableIndex": [
      {
        "page": 1,
        "line": 1,
        "text": "..."
      }
    ]
  }
}
```

错误返回示例：

```json
{
  "code": "UNSUPPORTED_FILE_TYPE",
  "message": "仅支持 PDF 或 DOCX 文件，请检查后重试。"
}
```

常见错误码：

- `INVALID_INPUT`：请求参数错误
- `UNSUPPORTED_FILE_TYPE`：不是 PDF/DOCX
- `DOCUMENT_PARSE_FAILED`：解析失败（含空文本/超限等）

### `POST /api/chat`

请求体：

```json
{
  "quizType": "reading",
  "difficulty": "intermediate",
  "numQuestions": 4,
  "parsedDocument": {
    "...": "来自 /api/parse-document 的对象"
  }
}
```

字段说明：

- `quizType`：`reading`（阅读理解）或 `cloze`（完形填空）
- `difficulty`：`beginner` / `intermediate` / `advanced`
- `numQuestions`：
  - `reading` 支持 4 或 5（默认 5）
  - `cloze` 支持 10 / 15 / 20（默认 20）

阅读理解响应示例：

```json
{
  "questions": [
    {
      "questionType": "reading",
      "subType": "detail",
      "query": "...",
      "choices": ["...", "...", "...", "..."],
      "answer": 0,
      "explanationZh": "...",
      "sourceEvidence": "...",
      "sourcePosition": {
        "page": 1,
        "lineStart": 8,
        "lineEnd": 8,
        "charStart": 13,
        "charEnd": 48,
        "quote": "lived alone and often felt lonely",
        "precision": "exact"
      }
    }
  ]
}
```

完形填空响应示例：

```json
{
  "questions": [
    {
      "questionType": "cloze",
      "blankIndex": 1,
      "query": "Tom ____ to Grandma's house after lunch.",
      "choices": ["rode", "ride", "riding", "rides"],
      "answer": 0,
      "explanationZh": "...",
      "sourceEvidence": "After lunch, they rode their bikes to Grandma’s house.",
      "sourcePosition": {
        "page": 1,
        "lineStart": 12,
        "lineEnd": 12,
        "charStart": 17,
        "charEnd": 21,
        "quote": "rode",
        "precision": "exact"
      }
    }
  ]
}
```

超限返回（HTTP 429）：

```json
{
  "code": "DAILY_LIMIT_REACHED",
  "message": "游客今日可免费生成 3 次，你已用完。请先登录后继续（登录用户每日 20 次）。"
}
```

模型输出校验错误（HTTP 422）：

```json
{
  "code": "QUIZ_SCHEMA_INVALID",
  "message": "题目结构校验失败，请重试。"
}
```

### `GET /api/reading/sources`

返回可用文章来源配置摘要。

响应示例：

```json
{
  "sources": [
    {
      "id": "bbc-world",
      "name": "BBC World",
      "category": "news",
      "feedUrl": "https://feeds.bbci.co.uk/news/world/rss.xml"
    }
  ]
}
```

### `GET /api/reading/articles`

按分类/难度/关键词分页获取文章列表。

查询参数：

- `category`：`all/news/technology/business/science/culture`
- `difficulty`：`all/junior_friendly/standard/challenging`
- `keyword`：标题关键词
- `page`：页码（默认1）
- `pageSize`：每页条数（默认10）

响应示例：

```json
{
  "data": [
    {
      "id": "nyt-tech%3A%3A...",
      "title": "...",
      "sourceName": "NYTimes Technology",
      "sourceUrl": "https://...",
      "publishedAt": "2026-05-13T00:00:00.000Z",
      "category": "technology",
      "summary": "...",
      "content": "...",
      "language": "en",
      "licenseNote": "内容版权归原来源网站所有。",
      "estimatedReadingMinutes": 3,
      "difficulty": "standard",
      "hasFullContent": true
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 9,
    "total": 30,
    "totalPages": 4
  }
}
```

### `GET /api/reading/articles/[id]`

获取文章详情（站内阅读页使用）。

错误返回示例：

```json
{
  "code": "ARTICLE_NOT_FOUND",
  "message": "文章不存在或已下线，请返回列表重新选择。"
}
```

## 部署提示（MVP）

- 推荐部署到 Vercel
- 配置上述环境变量
- GitHub OAuth 回调地址需包含：
  - 本地：`http://localhost:3000/api/auth/callback/github`
  - 线上：`https://your-domain.com/api/auth/callback/github`

## 已知限制

- 当前次数限制使用进程内内存计数，适合 MVP 验证，不保证多实例一致性
- 生产环境建议迁移到 Redis / KV / 数据库实现全局配额计数
- PDF 文本抽取依赖文件质量，扫描版 PDF 可能只能返回近似定位

## 手工测试清单

1. 首页粘贴英文文本并生成，题目正常展示。
2. 上传 `.pdf` 后生成，题目页出现“原文定位”区域。
3. 上传 `.docx` 后生成，题目页出现“原文定位”区域。
4. 上传超过 10MB 文件，出现中文错误提示。
5. 上传非 pdf/docx 文件，出现“仅支持 PDF 或 DOCX”错误。
6. 题目解释区点击“查看原文依据”，页面滚动到定位行。
7. `precision=exact` 时按字符区间高亮子串。
8. `precision=approximate` 时整行高亮。
9. 切换不同题目的“查看原文依据”，高亮跟随更新。
10. 解析失败场景（空文本/损坏文件）页面不崩溃且有中文提示。
11. 阅读理解模式返回 `questionType=reading` 且包含 `subType`。
12. 完形填空模式返回 `questionType=cloze` 且 `blankIndex` 递增。
13. 题目解析区可点击“查看原文依据”，自动滚动并高亮对应证据。
14. 连续点击不同题目定位按钮，高亮和 tooltip 信息正确更新且不冲突。
15. 桌面端原文区域固定在右侧面板，页面滚动时面板保持可见。
16. 完形填空切换题型后默认题量自动切到 20，且可正常生成 20 空。
17. 访问 `/reading-hub` 可看到文章列表、分类筛选、难度筛选和关键词搜索。
18. 点击“全文阅读”可进入 `/reading/[id]` 站内阅读页。
19. 从阅读页点击“生成阅读理解/完形填空”后，可直接进入出题页面并看到“当前材料来源”。
20. RSS源不可用时，系统可降级到站内样例文章，页面不白屏。
21. **出题等待**：进入 `/quiz` 后可见分阶段中文提示与「已等待 N 秒」；点击「取消本次出题」后应出现可恢复错误态，且「使用同一材料重新生成」可用。
22. **超时**：将 `QUIZ_FETCH_TIMEOUT_MS` 临时改小或断网重连，验证超时/网络类中文指引与重试按钮。
23. **失败重试**：在出题失败后不返回首页，点击「使用同一材料重新生成」应重新拉题且不崩溃。
24. **完形揭晓**：在「逐题查看解析」下完成一空并揭晓；切换到「全部做完再校对」应清空已揭晓；未完成全部题时「提交全部」禁用且悬浮提示可读。
25. **完形结算**：全部作答完成后应跳转 `/end-screen`（与阅读理解一致），并显示题型说明。
26. **原文面板**：完形题目 `precision=approximate` 且 `charStart=charEnd=0` 时，右侧对应行整行弱高亮并显示「空 n」占位，不出现整行空白错乱。
27. **同一行多空**：多题落在同一行且区间重叠或近似时，右侧仍以整行模式展示多个空位标签，顺序与题号一致。
28. **Reading Hub**：列表页顶部可见「RSS 摘要可能影响出题」类提示文案。