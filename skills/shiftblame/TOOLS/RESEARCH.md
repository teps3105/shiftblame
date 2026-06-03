# 研究工具包

本文件整理 shiftblame 可用的研究工具，供 PM/DEV 在 L1 宣告後應使用的執行工具。後續新增工具時直接追加列表項目即可。

## 工具列表

### Open Design — 前端設計研究

- **適用場景**：PM 階段前端設計研究、視覺規格產出
- **定位**：AI 設計工作環境，透過 MCP 資源讓 Agent 讀取設計相關內容
- **在 shiftblame 中的使用方式**：
  - PM：整理需求對應的畫面、元件、互動與視覺方向
  - PM：定義品質標準與設計驗證標準（履行品質保證職責）
  - DEV：依規格實作與進行自行驗收（履行品質控制職責）
- **主要輸出**：畫面結構、互動流程、元件規格、視覺語言、可供老闆直接查看的設計內容
- **Open Design 是什麼**：一套 AI 設計工作環境，不是拿來產生程式碼，而是幫 PM 做三件事：整理畫面方向與視覺規格、讀取可重用的設計技能與設計語言、把設計成果留在專案裡給老闆查看並讓下游 DEV 接手

#### 常見資源怎麼讀

- `od://focus/active`：先看目前有沒有活躍專案。`active: false` 表示正常狀態沒有開啟中的設計專案；`active: true` 表示已有活躍專案可接續
- `od://skills/<name>/SKILL.md`：已知要做哪類設計產物時讀它（線框、元件規格、固定格式交付物）
- `od://design-systems/<slug>/DESIGN.md`：決定整體視覺語言、品牌方向、色彩或排版調性時讀它

#### 最小可用操作順序

1. 開啟 Open Design 環境
2. 先讀 `od://focus/active`
3. 沒有活躍專案 → 把需求拆成要補的畫面、互動或風格，決定讀 skill 還是 design system
4. 有活躍專案 → 先理解現有設計內容，再補缺的規格
5. 需要方法時讀 skill；需要整體視覺語言時讀 design system
6. 把可交接的設計規格寫回 PM `result.md`，不要只留在設計工具裡

#### 什麼時候讀什麼

- 想知道「這種設計產物通常怎麼做」→ 先讀 skill
- 想知道「整體風格要長成什麼樣子」→ 先讀 design system
- 想知道「現在專案裡有沒有可接著做的內容」→ 先讀 `od://focus/active`

#### 研究結論怎麼寫回 PM `result.md`

至少回寫：畫面目標、版面區塊、元件清單、互動流程、視覺語言、老闆去哪裡看設計稿。`result.md` 負責留下可交接的設計規格與決策；Open Design 專案負責承載實際可查看的設計內容。未定案資訊留在 `.shiftblame/<slug>/SLUG.md`，不寫進 ROADMAP。

#### 使用原則

- 先讀活躍專案狀態，再決定下一步
- 不把研究結論只留在工具裡
- 可交接的規格一定要寫回 PM `result.md`
- 開發中的暫時判斷、退回原因、未定案想法寫進 `SLUG.md`
- 不把開發中的設計待辦直接寫進 `ROADMAP.md`

---

### Nexgame — 遊戲開發資源索引

- **適用場景**：遊戲開發專案的工具與素材查找
- **定位**：面向 AI 遊戲創作者的工具、素材、路線、資訊和社區平台（https://nexgame.fun/）
- **在 shiftblame 中的使用方式**：
  - PM：競品研究入口、工具鏈規劃參考、素材授權合規查核（履行品質保證職責）
  - DEV：快速找素材與工具、原型占位素材、驗證素材授權合規（履行品質控制職責）
- **Nexgame 是什麼**：不是單一工具，而是遊戲開發資源索引——把遊戲創作各階段需要的工具、素材網站、AI 服務和學習路線整理在一個地方，方便按任務查找

#### 資源分類

- **圖像與視覺生成**：Midjourney、DALL-E 3、Stable Image、Leonardo.ai、Scenario.com、Layer.ai、Comfy、Krea.ai、Recraft.ai、Ideogram、即夢
- **3D 模型與資產**：Sketchfab、CGTrader、TurboSquid、Meshy.ai、Tripo3D、Rodin、Mixamo、Poly Haven、ambientCG、BlenderKit、ShareTextures
- **音效與音樂**：Freesound、Pixabay Sound Effects、Zapsplat、Suno、Udio、AIVA、ElevenLabs Sound Effects、Stable Audio、BBC Sound Effects、GameAudioGDC、Audiomicro、Epidemic Sound
- **語音與對話**：ElevenLabs、Fish Audio、火山引擎 TTS、Convai、Inworld.ai、Character.ai、Resemble.ai、Play.ht、豆包、魔音工坊
- **遊戲引擎與框架**：Unity、Unreal、Godot、Phaser、Babylon.js、PlayCanvas、GDevelop、Construct、Buildbox、Ludo.ai、Rosebud.ai
- **程式碼與開發**：Cursor、Claude Code、GitHub Copilot、Cline、Bolt.new、Replit AI、v0、Lovable、Codex、Trae AI、通義靈碼、Windsurf、Codeium
- **動畫與動捕**：Cascadeur、DeepMotion、Move.ai、Plask、Rokoko、LottieFiles、Rive
- **企劃與設計參考**：Game UI Database、Interface In Game、Machinations、GameRefinery
- **素材市場**：Kenney.nl、OpenGameArt、Itch.io、CraftPix、GameDev Market、Game Art 2D、Unity Asset Store、Unreal Marketplace、Fab.com、Lospec、Pixel Joint

#### 使用原則

- Nexgame 是索引入口，不是工具本身——找到資源後需到原站使用
- 素材授權必須在原站逐條確認，不得假設免費可商用
- 工具選型以本輪使用者需求為準，不得把 Nexgame 收錄當成必用清單
- 開發中的工具選擇記錄在 `.shiftblame/<slug>/SLUG.md`，不寫入 ROADMAP
- 資源分類持續更新，使用時以原站最新內容為準

---

### （後續研究工具追加處）
