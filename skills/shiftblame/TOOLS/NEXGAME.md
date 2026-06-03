# NEXGAME 遊戲開發工具包

本文件整理 Nexgame 未來游社（https://nexgame.fun/）的定位、資源分類與 shiftblame 中的使用方式。目標是讓 Agent 在 DEV 階段需要找遊戲開發工具、素材或參考時，能快速從這裡找到對應入口，不必從零搜尋。

## Nexgame 未來游社是什麼

Nexgame 未來游社是一個面向 AI 遊戲創作者的工具、素材、路線、資訊和社區平台。它不是一個單一工具，而是一個**遊戲開發資源索引**——把遊戲創作各階段需要的工具、素材網站、AI 服務和學習路線整理在一個地方，方便按任務查找。

對 shiftblame 來說，它的角色是：

- DEV 階段需要找工具或素材時的**快速索引入口**
- PM 階段做遊戲設計參考時的**競品和靈感來源**
- PM 階段確認工具鏈和素材授權是否合規（履行品質保證職責）

## 資源分類

Nexgame 收錄的資源涵蓋遊戲開發全流程，主要分類如下：

### 圖像與視覺生成

AI 圖像生成工具，用於概念圖、角色設計、場景草圖、素材生成：

- Midjourney、DALL-E 3、Stable Image（通用圖像生成）
- Leonardo.ai、Scenario.com、Layer.ai（遊戲資產專用生成）
- Comfy（工作流式生成管線）
- Krea.ai、Recraft.ai、Ideogram（可控生成與風格探索）
- 即夢（中文語境圖像生成）

### 3D 模型與資產

3D 模型市場和生成工具：

- Sketchfab、CGTrader、TurboSquid（模型市場）
- Meshy.ai、Tripo3D、Rodin（AI 3D 生成）
- Mixamo（角色綁定與動作庫）
- Poly Haven、ambientCG（免費 PBR 材質與 HDRI）
- BlenderKit、ShareTextures（材質資源）

### 音效與音樂

遊戲音效、配樂和聲音生成工具：

- Freesound、Pixabay Sound Effects、Zapsplat（免費音效庫）
- Suno、Udio、AIVA（AI 音樂生成）
- ElevenLabs Sound Effects、Stable Audio（AI 音效生成）
- BBC Sound Effects、GameAudioGDC（專業音效包）
- Audiomicro、Epidemic Sound（授權音樂庫）

### 語音與對話

角色配音、語音合成和對話系統：

- ElevenLabs、Fish Audio、火山引擎 TTS（語音合成）
- Convai、Inworld.ai、Character.ai（角色對話 AI）
- Resemble.ai、Play.ht（語音克隆）
- 豆包、魔音工坊（中文語音）

### 遊戲引擎與框架

遊戲開發引擎和快速原型工具：

- Unity、Unreal、Godot（主流引擎）
- Phaser、Babylon.js、PlayCanvas（網頁遊戲框架）
- GDevelop、Construct、Buildbox（無代碼/低代碼引擎）
- Ludo.ai、Rosebud.ai（AI 輔助遊戲創作）

### 程式碼與開發

AI 程式碼助手和開發工具：

- Cursor、Claude Code、GitHub Copilot、Cline（程式碼助手）
- Bolt.new、Replit AI、v0、Lovable（AI 全端開發）
- Codex、Trae AI、通義靈碼（程式碼生成）
- Windsurf、Codeium（AI IDE）

### 動畫與動捕

角色動畫和動作捕捉：

- Cascadeur（AI 輔助動畫）
- DeepMotion、Move.ai、Plask（AI 動作捕捉）
- Rokoko（動捕硬體與軟體）
- LottieFiles、Rive（UI 動效）

### 企劃與設計參考

遊戲設計參考和競品研究：

- Game UI Database（遊戲界面截圖參考）
- Interface In Game（遊戲交互案例）
- Machinations（遊戲系統設計）
- GameRefinery（市場分析與玩法拆解）

### 素材市場

遊戲素材交易和免費資源：

- Kenney.nl、OpenGameArt、Itch.io（免費遊戲素材）
- CraftPix、GameDev Market、Game Art 2D（2D 素材包）
- Unity Asset Store、Unreal Marketplace、Fab.com（引擎商店）
- Lospec、Pixel Joint（像素藝術社群）

## shiftblame 中的使用方式

### PM 階段

PM 在研究遊戲方向時，可用 Nexgame 作為：
- 競品研究入口：透過 GameRefinery、Game UI Database 等參考競品設計
- 工具鏈規劃參考：整理本輪適合使用的工具和素材來源
- 素材授權注意事項：標注需要確認授權的素材來源
- 素材授權合規查核：確認使用的素材符合商用授權（履行品質保證職責）
- 工具鏈驗證：確認工具選型合理（履行品質保證職責）

### DEV 階段

DEV 在產品開發時，可用 Nexgame 作為：
- 快速找素材：按分類找到需要的音效、圖像素材、3D 模型
- 快速找工具：按任務找到對應的 AI 工具或開發工具
- 原型素材：快速補齊原型需要的占位素材
- 驗證素材授權合規（履行品質控制職責）
- 驗證工具使用正確性（履行品質控制職責）

## 使用原則

- Nexgame 是索引入口，不是工具本身——找到資源後需要到原站使用
- 素材授權必須在原站逐條確認，不得假設免費可商用
- 工具選型以本輪使用者需求為準，不得把 Nexgame 收錄當成必用清單
- 開發中的工具選擇記錄在 `.shiftblame/<slug>/SLUG.md`，不寫入 ROADMAP
- Nexgame 的資源分類會持續更新，使用時以原站最新內容為準

## 一句話總結

Nexgame 未來游社是 shiftblame 在遊戲開發專案中的資源索引入口；它幫 Agent 按任務快速找到對應的工具和素材來源，實際使用和授權確認仍在原站完成。
