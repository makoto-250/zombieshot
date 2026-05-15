# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 実行方法

ビルドシステムなし。`index.html` をブラウザで直接開くだけ。ローカルサーバーで動かす場合は任意（例: `python -m http.server`）。横向き（landscape）のみ対応。

## Git運用
- コードを変更・実装したら必ずgit add, commit, pushまで行うこと
- コミットメッセージは変更内容を簡潔に日本語で書くこと
- pushは`git push origin main`で行うこと

## アーキテクチャ概要

バニラJS製のゾンビディフェンスゲーム。モジュールはすべてIIFE（即時実行関数式）パターン。

### 画面管理（main.js）

`navigate(to)` 関数が `top / defense / base / explore` の4画面を切り替える。`saveData`（グローバル変数）が唯一の共有状態で `localStorage` に永続化される。

スクリプトの読み込み順序（index.html）:
```
defense.js → base.js → explore.js → main.js
```
`main.js` が最後なのは、他3ファイルが定義するモジュールと helper 関数に依存するため。

### セーブデータ構造（main.js の Save モジュール）

```js
{
  day, maxDay, gold, currentHp,
  speedUnlocked, speed3Unlocked, speedActive,
  day1TalkCount,                          // 1日目会話の再生回数（0〜2）
  day11TalkShown, day21TalkShown,         // 各日イベント再生済みフラグ
  day31TalkShown, day41TalkShown, day51TalkShown,
  speedTutorialShown, speed3TutorialShown, // 速度チュートリアル済みフラグ
  upgrades: {
    maxHp, atkPow, repairRate,   // base.js のアップグレード
    allyLevel, bombLevel, rangeLevel  // explore.js のアップグレード
  }
}
```

### 防衛ゲームループ（defense.js）

Canvas 描画。`Defense.start()` → `loop()` → `requestAnimationFrame` で毎フレーム実行。

状態はすべて `S` オブジェクト（モジュール内ローカル）に集約：

- `S.enemies` / `S.allies` / `S.bullets` / `S.particles` — 各エンティティ配列
- `S.spawnQ` — `buildWave(day)` で生成したウェーブキュー
- `S.speed` — 1/2/3x 速度倍率（loop内で `steps` 回ロジックを回す）
- `S.baseDef` — 拠点防御力（repairRate レベルと同値）
- `S.warningTimer` / `S.warningShown` — ボス出現前 WARNING アニメーション管理

フレームごとの処理順: `spawnStep → moveEnemies → allyStep → allyAnimStep → bulletStep → particleStep → phaseCheck → draw`

`warningTimer` は `draw()` 内でデクリメントされる（リアルフレーム基準）。ゲームロジックのフレームと混在しないよう注意。

### 敵スプライトシステム（defense.js）

| 定数 | 役割 |
|---|---|
| `ZOMBIE_IMGS` | タイプ別の Image 配列 |
| `ZOMBIE_WALK_SEQ` | タイプ別のフレームインデックス列（ping-pong ループ） |
| `ZOMBIE_FRAME_DUR` | 1コマあたりのゲームフレーム数 |

新タイプを追加する際は `ZOMBIE_IMGS` と `ZOMBIE_WALK_SEQ` の両方にエントリが必要。

### 敵タイプ（ETYPES）

| タイプ | 特徴 | 画像 |
|---|---|---|
| walker | 低速・高HP | zombie_z1_1〜3（3枚） |
| runner | 高速・低HP | zombie_z2_1〜4（4枚） |
| brute  | 超低速・超高HP | zombie_z3_1〜4（4枚） |
| flyer  | 空中・中速 | zombie_z4_1〜4（4枚） |
| boss_walker | 10日目末尾に1体・高HP | zombie_b1_1〜4（4枚） |

`drawWalker()` の描画サイズ係数はタイプごとに個別設定（runner=1.3、brute=1.6875、flyer=1.8、boss_walker=2.6、その他=2.25）。HPバーのY オフセットも walker/boss_walker=-60、brute=-20、その他=0 と個別設定。

### ボス演出（defense.js）

`spawnStep()` でボスが次の出現対象になると `S.warningShown=true` / `S.warningTimer=130` をセット。ボスの spawn interval は通常より120フレーム長い。`draw()` 内で WARNING テキストをフラッシュ描画（フェードイン・点滅・フェードアウト）。

### 会話イベントシステム（main.js）

`navigate('defense')` 内の if-else チェーンで判定。判定順：

1. 1日目会話（`day1TalkCount < 2`）
2. 31日目イベント
3. 41日目イベント
4. 51日目イベント
5. 21日目イベント
6. 3倍速チュートリアル（`speed3Unlocked && !speed3TutorialShown`）
7. 11日目イベント → 完了後に3倍速チュートリアルを連鎖
8. 2倍速チュートリアル（`speedUnlocked && !speedTutorialShown`）

`startDialogue(lines, onComplete)` が共通関数。行の先頭文字で自動スタイル切替：`（` → グレー斜体（ト書き）、`『』` → 羊皮紙色斜体（書き物・録音）、その他 → 白（台詞）。`\n` は `white-space: pre-line` で改行表示。

### クロスファイルの共有ヘルパー関数

`base.js` と `explore.js` の末尾にグローバル関数として定義されており、`main.js` と `defense.js` から参照される：

```js
// base.js
getMaxHp(upgrades)      // 100 + lv*20
getAtkPow(upgrades)     // 20 + lv*5
getRepairRate(upgrades) // 10 + lv
getBaseDef(upgrades)    // repairRate レベルそのまま（防御力）

// explore.js
getAllyCount(upgrades)   // 1 + allyLevel
getBombCount(upgrades)   // bombLevel
getRangeRatio(upgrades)  // 0.8〜1.0
```

### 座標系

Canvas は画面サイズにリサイズ。内部論理座標は幅 `GAME_W = 960` 固定。高さは `gh() = canvas.height * 960 / canvas.width` で動的計算。描画時に `scale()` でスケール変換。
