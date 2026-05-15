'use strict';

const BaseScreen = (() => {

  // ── アップグレード定義 ──
  const DEFS = {
    maxHp: {
      cost:  (lv) => (lv + 1) * 20,          // 20G, 40G, 60G ...
      label: (lv) => `${100 + lv * 20}`,     // 現在の最大HP
    },
    atkPow: {
      cost:  (lv) => (lv + 1) * 15,           // 15G, 30G, 45G ...
      label: (lv) => `${20 + lv * 5}`,        // 現在の攻撃力
    },
    repairRate: {
      cost:  (lv) => (lv + 1) * 25,           // 25G, 50G, 75G ...
      label: (lv) => `${10 + lv}`,            // 現在の修復率
    },
  };

  // ── 画面を開いたとき ──
  function open() {
    refresh();
  }

  // ── 表示更新 ──
  function refresh() {
    const d      = saveData;                          // main.js のグローバル
    const upg    = d.upgrades;
    const maxHp  = getMaxHp(upg);
    const curHp  = d.currentHp ?? maxHp;
    const rate   = getRepairRate(upg);

    // 所持G
    document.getElementById('base-gold').textContent = d.gold;

    // HPバー
    const pct = Math.min(curHp / maxHp * 100, 100);
    const bar  = document.getElementById('base-hp-bar');
    bar.style.width      = pct + '%';
    bar.style.background = pct > 50 ? '#22cc44' : pct > 25 ? '#ccaa00' : '#dd2200';
    document.getElementById('base-hp-text').textContent = `${curHp} / ${maxHp}`;

    // 各アップグレードカード
    for (const key of ['maxHp', 'atkPow', 'repairRate']) {
      const lv   = upg[key] ?? 0;
      const cost = DEFS[key].cost(lv);
      document.getElementById(`lv-${key}`).textContent   = lv;
      document.getElementById(`eff-${key}`).textContent  = DEFS[key].label(lv);
      document.getElementById(`cost-${key}`).textContent = cost;
      document.getElementById(`btn-${key}`).disabled     = d.gold < cost;
    }

    // 修復カード
    const missing    = Math.max(0, maxHp - curHp);
    const fullCost   = Math.ceil(missing / rate);
    const canAfford  = d.gold >= fullCost;
    const partial    = !canAfford && missing > 0;
    const partialHp  = Math.floor(d.gold * rate);

    document.getElementById('eff-repair-now').textContent = rate;
    document.getElementById('eff-baseDef').textContent    = getBaseDef(upg);
    document.getElementById('repair-missing').textContent  = missing;
    document.getElementById('repair-cost').textContent     = fullCost;

    const note = document.getElementById('repair-afford-note');
    if (partial && d.gold > 0) {
      note.textContent = `G不足 → ${partialHp}HP分修復可`;
    } else {
      note.textContent = '';
    }

    document.getElementById('btn-repair').disabled = missing === 0 || d.gold <= 0;
  }

  // ── アップグレード実行 ──
  function upgrade(key) {
    const lv   = saveData.upgrades[key] ?? 0;
    const cost = DEFS[key].cost(lv);
    if (saveData.gold < cost) return;

    saveData.gold -= cost;
    saveData.upgrades[key] = lv + 1;

    // maxHp を上げた場合、現在HPの上限も引き上げる（HP 0 のときは 0 のまま）
    if (key === 'maxHp') {
      const newMax = getMaxHp(saveData.upgrades);
      if (saveData.currentHp === null || saveData.currentHp === undefined) {
        saveData.currentHp = newMax;
      } else {
        saveData.currentHp = Math.min(saveData.currentHp + 20, newMax);
      }
    }

    Save.commit(saveData);
    refresh();
  }

  // ── 修復実行 ──
  function repair() {
    const upg    = saveData.upgrades;
    const maxHp  = getMaxHp(upg);
    const curHp  = saveData.currentHp ?? maxHp;
    const rate   = getRepairRate(upg);
    const missing = Math.max(0, maxHp - curHp);
    if (missing === 0 || saveData.gold <= 0) return;

    const fullCost  = Math.ceil(missing / rate);

    if (saveData.gold >= fullCost) {
      // フル修復
      saveData.gold      -= fullCost;
      saveData.currentHp  = maxHp;
    } else {
      // 部分修復（持ってるGで買えるだけ）
      const healHp = Math.floor(saveData.gold * rate);
      saveData.gold      = 0;
      saveData.currentHp = Math.min(curHp + healHp, maxHp);
    }

    Save.commit(saveData);
    refresh();
  }

  // ── public ──
  return { open, refresh, upgrade, repair };
})();

// ── セーブデータから計算するヘルパー（main.js / defense.js でも使う） ──
function getMaxHp(upgrades)     { return 100 + (upgrades.maxHp     ?? 0) * 20; }
function getAtkPow(upgrades)    { return  20 + (upgrades.atkPow    ?? 0) *  5; }
function getRepairRate(upgrades){ return  10 + (upgrades.repairRate ?? 0);      }
function getBaseDef(upgrades)   { return        upgrades.repairRate ?? 0;       }
