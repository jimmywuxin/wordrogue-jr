# WordRogue-Jr · 开发日志

## v0.3 (2026-07-11)

### 已完成
- **Web Audio 合成音效模块**: 新增 `src/audio/sfx.js`,不依赖外部音频文件,直接 OscillatorNode 合成 hit / shoot / wrong / skip / hurt / win / lose / click 八种短音效;内置静音开关 + iOS Safari 音频解锁
- **关卡智能抽词**: `src/data/words.js` 新增 `selectLevelWords(levelId, wrongWords)` — 抽词时优先把**错词本里属于本关卡的词**强制带上,剩余名额从关卡随机抽(默认 10 个);错词复习不再只靠单独模式,关卡内自然高密度出现
- **引擎 / UI / 存档升级**: 跨 11 个文件,1109 行新增 / 206 行删除
  - `src/engine/game.js` (+378 行): 核心玩法逻辑
  - `src/ui/game.js` (+228 行) / `modals.js` (+127 行) / `level.js` (+86 行) / `menu.js` (+63 行) / `review.js` (+63 行): 界面与交互
  - `src/save/storage.js` (+66 行): 存档系统增强
  - `src/ui/style.css` (+174 行): 视觉样式
  - `src/main.js` + `index.html`: 接入音频解锁与新模块

### 设计决策
- **音频走合成而非采样**: 零资源依赖、首屏零延迟、iPad 离线可用;代价是音色简陋(纯方波/三角波),作为儿童游戏的反馈够用
- **错词强制带进每关(而非只刷错词)**: 错词命中率提高,但仍有正反馈随机词,避免孩子觉得永远只看到不会的词
- **SFX 静音独立于主音量**: `setEnabled(false)` 把 masterGain 拉到 0,但偏好不持久化 — 让"不想听"和"暂时静音"分开处理

### 待办
(沿用 v0.2.0;本版尚未逐项确认解决,需后续 review)
- [ ] g4 Unit 2 / Unit 3 / Unit 7 缺失(双栏切分问题)
- [ ] g4 / g5 / g6 下册词库缺失(PDF 下载问题)
- [ ] OCR 质量清洗: 长词被截断 / 序数词切碎
- [ ] 关卡名加课本单元主题(现在是 "Unit N")
- [ ] 关卡线性解锁太死板(必须通关 1 才能开 2)
- [ ] CSS 没区分 unlocked/locked 视觉
- [ ] PNG 图片替换 emoji 占位
- [ ] 8 个主题地图 + 怪物种类扩展
- [ ] 错词复习强化 + 家长观测后台(本版部分推进: 关卡内优先错词)
- [ ] iPad 触屏完整适配
- [ ] 部署 README + 家长使用指引

---

## v0.2.0 (2026-07-10)

### 🎮 现在可以试玩
👉 **https://jimmywuxin.github.io/wordrogue-jr/** (GitHub Pages,公网部署)

### 已完成
- **词库从 PDF 自动抽取**: 4-6 年级 276 词 / 18 关(替换原 50 词占位)
- 5 本 PDF 完整提取: g4-upper / g5-upper / g5-lower / g6-upper / g6-lower
- 2 本未提取: g4-lower-1/2(GitHub raw 限速下不到)
- 端到端验证: 选人 → 选关 → 进游戏 OK
- **GitHub 仓库创建**: https://github.com/jimmywuxin/wordrogue-jr
- **GitHub Pages 部署**: https://jimmywuxin.github.io/wordrogue-jr/

### 词库抽取的关键技术问题
粤教粤人版 PDF 是文字型(非图片),但有以下坑:
- **双栏排版**导致 by-unit 段在文本流里挤成 1 行,Unit 1-3 互相穿插
- **字间距控制字符** `\x07` 被 pdfplumber 当字面字符吐,污染正则
- **嵌入字体只用了子集**: 部分标题被 cid 编码吞了(g6-upper)
- **多栏切词混串**: `subject 科目 Tuesday 星期二` 一行塞两对词

解决方案: `docs/extract_words.py` 重写 OCR 抽取逻辑
- 按 PDF "Vocabulary (by unit)" 段切 Unit(而不是按 alphabetical)
- `\x00-\x09\x0b-\x1f` 替空,**保留 `\n`** 维持换行结构
- 双栏同行多词用 `re.finditer` 一次抓多对
- cid 字体启发: ≥3 个 Unit N 标记 + 下页继续

### 待办
- [ ] g4 Unit 2 / Unit 3 / Unit 7 缺失(双栏切分问题)
- [ ] g4 / g5 / g6 下册词库缺失(PDF 下载问题)
- [ ] OCR 质量清洗: 部分长词被截断 / 序数词切碎
- [ ] 关卡名加课本单元主题(现在是 "Unit N")
- [ ] 关卡线性解锁太死板(必须通关 1 才能开 2)
- [ ] CSS 没区分 unlocked/locked 视觉
- [ ] PNG 图片替换 emoji 占位
- [ ] 8 个主题地图 + 怪物种类扩展
- [ ] 错词复习强化 + 家长观测后台
- [ ] iPad 触屏完整适配
- [ ] 部署 README + 家长使用指引

---

## v0.1.0 (2026-07-08)

### 已完成
- 项目脚手架 + 目录结构
- 4-6 年级粤教粤人版初始词库(50 个词,后续 PDF OCR 补充)
- 选人主菜单(支持多用户、新建/删除)
- 选关卡屏幕(根据年级过滤 + 通关锁定)
- 游戏引擎(canvas 顶视角 + WASD + 鼠标 + 触屏)
- 看图选词模式(4 选 1,4 年级用)
- 拼词模式(打英文,5-6 年级用)
- 关卡完成总结 + 星数评级
- 错词本(自动累加答错的词)
- localStorage 存档 + 导入/导出 JSON
- 错词复习屏幕

### 设计决策
- 像素风 + emoji 图形占位(暂用 emoji,后期可换 PNG)
- 单玩家本地多用户(同设备,人物卡片切换)
- 拼错/打错怪:不扣血到 0 失败,而是扣 1 血 + 入错词本(儿童友好)
- 失败门槛 = 血 10 扣完才 fail;3 颗星 = 满血 100% 命中通关
- 答错时记录错词,但答对时主动移除错词标记
