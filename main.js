'use strict';

// ── 永続セーブデータ ──
const Save = (() => {
  const KEY = 'zombieshot_v1';

  const defaults = () => ({
    day:            1,
    maxDay:         1,
    gold:           0,
    currentHp:      null,
    speedUnlocked:  false,
    speed3Unlocked: false,
    speedActive:    1,      // 現在の速度 1/2/3
    day1TalkCount:      0,
    day11TalkShown:     false,
    day21TalkShown:     false,
    day31TalkShown:     false,
    day41TalkShown:     false,
    day51TalkShown:     false,
    speedTutorialShown:  false,
    speed3TutorialShown: false,
    upgrades: {
      maxHp:      0,
      atkPow:     0,
      repairRate: 0,
    },
  });

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      const d = defaults();
      d.day            = saved.day            ?? d.day;
      d.maxDay         = saved.maxDay         ?? d.maxDay;
      d.gold           = saved.gold           ?? d.gold;
      d.currentHp      = saved.currentHp      ?? d.currentHp;
      d.speedUnlocked  = saved.speedUnlocked  ?? d.speedUnlocked;
      d.speed3Unlocked = saved.speed3Unlocked ?? d.speed3Unlocked;
      d.day1TalkCount      = saved.day1TalkCount      ?? 0;
      d.day11TalkShown     = saved.day11TalkShown     ?? false;
      d.day21TalkShown     = saved.day21TalkShown     ?? false;
      d.day31TalkShown     = saved.day31TalkShown     ?? false;
      d.day41TalkShown     = saved.day41TalkShown     ?? false;
      d.day51TalkShown     = saved.day51TalkShown     ?? false;
      d.speedTutorialShown  = saved.speedTutorialShown  ?? false;
      d.speed3TutorialShown = saved.speed3TutorialShown ?? false;
      // 旧セーブ(boolean)との互換
      const sa = saved.speedActive;
      d.speedActive = (sa === true) ? 2 : (typeof sa === 'number' ? sa : 1);
      Object.assign(d.upgrades, saved.upgrades ?? {});
      return d;
    } catch {
      return defaults();
    }
  }

  function commit(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }

  return { load, commit };
})();

let saveData = Save.load();

// ── 画面管理 ──
const screens = {
  top:     document.getElementById('screen-top'),
  defense: document.getElementById('screen-defense'),
  base:    document.getElementById('screen-base'),
  explore: document.getElementById('screen-explore'),
};

let currentScreen = 'top';

function navigate(to) {
  if (to === currentScreen) return;

  if (currentScreen === 'defense') Defense.stop();

  const from = screens[currentScreen];
  const dest = screens[to];

  from.classList.add('fade-out');
  setTimeout(() => {
    from.classList.remove('active', 'fade-out');
    dest.classList.add('active', 'fade-in');
    setTimeout(() => dest.classList.remove('fade-in'), 300);
    currentScreen = to;

    if (to === 'defense') {
      document.getElementById('defense-overlay').classList.add('hidden');
      const goldCheckpoint = saveData.gold;
      const upg   = saveData.upgrades;
      const maxHp = getMaxHp(upg);
      const curHp = saveData.currentHp ?? maxHp;

      const launchDefense = () => {
        setTimeout(() =>
          Defense.start(
            saveData.day,
            {
              baseHpMax:     maxHp,
              baseHpCurrent: curHp,
              baseDef:       getBaseDef(upg),
              allyAtk:       getAtkPow(upg),
              allyCount:      getAllyCount(upg),
              allyRangeRatio: getRangeRatio(upg),
              bombCount:      getBombCount(upg),
              goldStart:      goldCheckpoint,
              speedUnlocked:  saveData.speedUnlocked  ?? false,
              speed3Unlocked: saveData.speed3Unlocked ?? false,
              speedActive:    saveData.speedActive    ?? 1,
            },
            (win, finalGold, finalHp) => onDefenseEnd(win, finalGold, finalHp, goldCheckpoint)
          ),
        60);
      };

      const talkCount = saveData.day1TalkCount ?? 0;
      if (saveData.day === 1 && talkCount < 2) {
        const DIALOGUES = [
          ['こんな所に拠点?', '、、、、、、', '使えるものはなにつかってでも生き延びなきゃ、、、'],
          ['こんな所に拠点?', '誰かいないのかしら', 'なんとしても生き延びなきゃ、、、'],
        ];
        saveData.day1TalkCount = talkCount + 1;
        Save.commit(saveData);
        startDialogue(DIALOGUES[talkCount], launchDefense);
      } else if (saveData.speed3Unlocked && !(saveData.speed3TutorialShown ?? false)) {
        saveData.speed3TutorialShown = true;
        Save.commit(saveData);
        showSpeedTutorial(launchDefense, '3倍速モードが解放されました。<br>タップすると速度が3倍になります。');
      } else if (saveData.day === 11 && !(saveData.day11TalkShown ?? false)) {
        saveData.day11TalkShown = true;
        Save.commit(saveData);
        const afterDay11 = () => {
          if (saveData.speed3Unlocked && !(saveData.speed3TutorialShown ?? false)) {
            saveData.speed3TutorialShown = true;
            Save.commit(saveData);
            showSpeedTutorial(launchDefense, '3倍速モードが解放されました。<br>タップすると速度が3倍になります。');
          } else {
            launchDefense();
          }
        };
        startDialogue([
          '……まだ食料はある',
          '水も、しばらくは大丈夫そうだな',
          '（周囲を見回す）',
          'ここなら……問題なさそうだ',
          '（棚を整理していると紙が落ちる）',
          'あれ……？',
          'メモ？',
          '（汚れた紙を開く）',
          '『100日耐えることができれば――』',
          '（その先は血で滲み、破れている）',
          '……100日？',
          'なにかあるの……',
        ], afterDay11);
      } else if (saveData.day === 21 && !(saveData.day21TalkShown ?? false)) {
        saveData.day21TalkShown = true;
        Save.commit(saveData);
        startDialogue([
          '（拠点の外から物音）',
          '「……？」',
          '（ドンッ）',
          '（バリケードが揺れる）',
          '「っ……！」',
          '（外を見る）',
          '（大量のゾンビ）',
          '「なんで急にこんな数……！」',
          '（さらに衝撃音）',
          '（壁の一部が崩れる）',
          '「まずい……ここはもう持たない……！」',
          '（荷物をまとめる）',
          '「くそっ……」',
          '「やっと落ち着けると思ったのに……！」',
          '（机の下に古い地図）',
          '（赤丸で囲まれた場所）',
          '「北の農場」\n「地下あり」',
          '「……農場？」',
          '（遠くで叫び声）',
          '（ゾンビが侵入）',
          '「行くしかない……！」',
        ], launchDefense);
      } else if (saveData.day === 31 && !(saveData.day31TalkShown ?? false)) {
        saveData.day31TalkShown = true;
        Save.commit(saveData);
        startDialogue([
          '（夜の農村）',
          '（風の音）',
          '（発電機の低い駆動音）',
          '「……静かすぎる」',
          '（窓の外を見る）',
          '（畑の奥に人影）',
          '「……誰？」',
          '（ライトを向ける）',
          '（消える）',
          '「……気のせい？」',
          '（ドアの近くに何か落ちている）',
          '「……これ」',
          '（録音機）',
          '（再生ノイズ）',
          '『もし聞こえてるなら、そこを離れて』',
          '『アイツらは観察してる』',
          '『100日まで生かす気』',
          '『私は――』',
          '（ノイズ）',
          '「……誰なの」',
          '（録音機の裏）',
          'No.32',
          '「……32？」',
        ], launchDefense);
      } else if (saveData.day === 41 && !(saveData.day41TalkShown ?? false)) {
        saveData.day41TalkShown = true;
        Save.commit(saveData);
        startDialogue([
          '（咳き込む主人公）',
          '「……っ」',
          '（腕を見る）',
          '（黒い痣のようなもの）',
          '「なに……これ……」',
          '（ふらつく）',
          '（冷蔵庫を開ける）',
          '（食料がほぼ空）',
          '「食料も……もうない……」',
          '（外）',
          '（畑が荒れている）',
          '（動物の死骸）',
          '「ここも終わり……」',
          '（発電機停止）',
          '（灯りが消える）',
          '「っ……！」',
          '（静寂）',
          '（少しして遠くからサイレン）',
          '「……？」',
          '（遠くの街が一瞬だけ光る）',
          '「街……？」',
          '（農場地下を調べる）',
          '（古い無線機）',
          '（雑音）',
          '『――生存者は中央隔離区域へ――』',
          '『医薬品配給を――』',
          '『研究棟地下――』',
          '（ノイズ）',
          '「研究棟……？」',
          '（無線機の横に地図）',
          '（街の一部に丸）',
          'CENTRAL DISTRICT',
          '「……行くしかない」',
          '（主人公が荷物を背負う）',
          '（壁を見る）',
          '（以前より増えた数字）',
          '12\n34\n41\n×\n×\n67',
          '「……あなたたちも、そこへ向かったの？」',
        ], launchDefense);
      } else if (saveData.day === 51 && !(saveData.day51TalkShown ?? false)) {
        saveData.day51TalkShown = true;
        Save.commit(saveData);
        startDialogue([
          '「……もう少しで街」',
          '（背後から物音）',
          '（ゾンビの唸り声）',
          '「……っ？」',
          '（大量のゾンビ）',
          '「まずい……！」',
          '（走る）',
          '（息切れ）',
          '「なんでこんな数が……！」',
          '（フェンスを乗り越える）',
          '（視界の先）',
          'BURGER HOUSE',
          '「……！」',
          '（店へ駆け込む）',
          '（ドアを閉める）',
          '（バリケードを押さえる）',
          '（ゾンビが外を叩く）',
          '「はぁっ……はぁっ……」',
          '（しばらくして静かになる）',
          '（店内）',
          '（子供向けメニュー）',
          '（腐ったハンバーガー）',
          '（乾いた血痕）',
          '「……ここも、避難所だったの」',
          '（壁に落書き）',
          '『食料は厨房』\n『2階は危険』\n『夜に声がする』',
          '「……」',
          '（厨房を漁る）',
          '（缶詰を発見）',
          '「……まだ食べれそう」',
          '（少し安心した表情）',
          '（突然、2階から物音）',
          '（ギシッ）',
          '「……誰かいるの？」',
          '（沈黙）',
          '（ライトを向ける）',
          '（壁に大量の日数）',
          '3日目\n8日目\n15日目\n22日目\n39日目\n51日目　やっと半分、、、',
          '「……51？」',
          '（主人公、自分の日数を見る）',
          '「……たまたまだよね」',
        ], launchDefense);
      } else if (saveData.speedUnlocked && !(saveData.speedTutorialShown ?? false)) {
        saveData.speedTutorialShown = true;
        Save.commit(saveData);
        showSpeedTutorial(launchDefense);
      } else {
        launchDefense();
      }
    }

    if (to === 'base') {
      BaseScreen.open();
    }

    if (to === 'explore') {
      ExploreScreen.open();
    }

    if (to === 'top') {
      updateTopScreen();
    }
  }, 200);
}

// ── 防衛終了コールバック ──
function onDefenseEnd(win, finalGold, finalHp, goldCheckpoint) {
  saveData.currentHp = finalHp;   // HP は勝敗問わず実態を保存

  if (win) {
    if (saveData.day >= 5)  saveData.speedUnlocked  = true;
    if (saveData.day >= 10) saveData.speed3Unlocked = true;
    saveData.maxDay = Math.max(saveData.maxDay ?? 1, saveData.day);
    saveData.day   += 1;
    saveData.gold  = finalGold;
    const maxHp    = getMaxHp(saveData.upgrades);
    saveData.currentHp = Math.min(finalHp + Math.floor(maxHp * 0.3), maxHp);
  } else {
    saveData.day       = 1;
    saveData.gold      = goldCheckpoint;              // G はステージ開始時に巻き戻し
    saveData.currentHp = getMaxHp(saveData.upgrades); // 新しい守備隊が来て満HP回復
  }
  Save.commit(saveData);
}

// ── トップ画面の表示更新 ──
function updateTopScreen() {
  document.getElementById('top-defense-day').textContent = `次: ${saveData.day}日目`;
  document.getElementById('top-defense-max').textContent = `最高: ${saveData.maxDay ?? 1}日目`;
  document.getElementById('top-gold').textContent        = `G ${saveData.gold}`;
}

// 初期表示
updateTopScreen();

// ── 設定モーダル ──
function openSettings() {
  document.getElementById('modal-settings').classList.remove('hidden');
}

function closeSettings(e) {
  if (e && e.target !== document.getElementById('modal-settings')) return;
  document.getElementById('modal-settings').classList.add('hidden');
}

function confirmDelete() {
  document.getElementById('modal-settings').classList.add('hidden');
  document.getElementById('modal-confirm').classList.remove('hidden');
}

function closeConfirm(e) {
  if (e && e.target !== document.getElementById('modal-confirm')) return;
  document.getElementById('modal-confirm').classList.add('hidden');
}

function deleteData() {
  try { localStorage.removeItem('zombieshot_v1'); } catch {}
  saveData = Save.load();   // デフォルト値で初期化
  document.getElementById('modal-confirm').classList.add('hidden');
  updateTopScreen();
}

// ── 2倍速チュートリアル ──
function showSpeedTutorial(onComplete, msg) {
  const overlay    = document.getElementById('speed-tutorial');
  const spotlight  = document.getElementById('speed-tutorial-spotlight');
  const msgEl      = document.getElementById('speed-tutorial-msg');
  const btn        = document.getElementById('speed-btn');
  if (msg) msgEl.innerHTML = msg;

  btn.classList.remove('hidden');
  const rect = btn.getBoundingClientRect();

  spotlight.style.left   = (rect.left   - 8) + 'px';
  spotlight.style.top    = (rect.top    - 8) + 'px';
  spotlight.style.width  = (rect.width  + 16) + 'px';
  spotlight.style.height = (rect.height + 16) + 'px';

  msgEl.style.right = (window.innerWidth - rect.right - 8) + 'px';
  msgEl.style.top   = (rect.bottom + 12) + 'px';

  overlay.classList.remove('hidden');

  overlay.addEventListener('click', function handler() {
    overlay.classList.add('hidden');
    btn.classList.add('hidden');
    overlay.removeEventListener('click', handler);
    onComplete();
  }, { once: true });
}

// ── 会話イベント ──
function startDialogue(lines, onComplete) {
  const overlay = document.getElementById('dialogue-overlay');
  const textEl  = document.getElementById('dialogue-text');
  let idx = 0;

  function renderLine(text) {
    textEl.textContent = text;
    if (text.startsWith('（')) {
      textEl.style.color = '#aaa';
      textEl.style.fontStyle = 'italic';
    } else if (text.startsWith('『')) {
      textEl.style.color = '#e8d8a0';
      textEl.style.fontStyle = 'italic';
    } else {
      textEl.style.color = '#fff';
      textEl.style.fontStyle = 'normal';
    }
  }

  renderLine(lines[idx]);
  overlay.classList.remove('hidden');

  function advance() {
    idx++;
    if (idx >= lines.length) {
      overlay.classList.add('hidden');
      overlay.removeEventListener('click', advance);
      onComplete();
    } else {
      renderLine(lines[idx]);
    }
  }

  overlay.addEventListener('click', advance);
}

// Android back button support (Capacitor)
document.addEventListener('backbutton', () => {
  if (currentScreen !== 'top') navigate('top');
}, false);
