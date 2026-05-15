'use strict';

const ExploreScreen = (() => {
  const ALLY_COSTS  = [100, 1000, 5000, 10000];
  const BOMB_COSTS  = [100, 1000, 3000];
  const RANGE_COSTS = [100, 1000, 3000, 10000];
  const RANGE_PCTS  = [80, 85, 90, 95, 100];   // Lv0〜4 の射程%

  function open() { refresh(); }

  function refresh() {
    const d       = saveData;
    const allyLv  = d.upgrades.allyLevel  ?? 0;
    const bombLv  = d.upgrades.bombLevel  ?? 0;
    const rangeLv = d.upgrades.rangeLevel ?? 0;

    document.getElementById('exp-gold').textContent = d.gold;

    // 仲間カード
    document.getElementById('exp-ally-lv').textContent    = allyLv;
    document.getElementById('exp-ally-count').textContent = 1 + allyLv;
    setCard('exp-ally', allyLv, ALLY_COSTS);

    // 爆弾カード
    document.getElementById('exp-bomb-lv').textContent    = bombLv;
    document.getElementById('exp-bomb-count').textContent = bombLv;
    setCard('exp-bomb', bombLv, BOMB_COSTS);

    // 武器カード
    document.getElementById('exp-range-lv').textContent  = rangeLv;
    document.getElementById('exp-range-pct').textContent = RANGE_PCTS[rangeLv];
    setCard('exp-range', rangeLv, RANGE_COSTS);
  }

  function setCard(prefix, lv, costs) {
    const btn  = document.getElementById(`${prefix}-btn`);
    const cost = document.getElementById(`${prefix}-cost`);
    if (lv < costs.length) {
      cost.textContent = costs[lv];
      btn.textContent  = '探す';
      btn.disabled     = saveData.gold < costs[lv];
    } else {
      cost.textContent = '---';
      btn.textContent  = 'MAX';
      btn.disabled     = true;
    }
  }

  function buyAlly() {
    const lv = saveData.upgrades.allyLevel ?? 0;
    if (lv >= ALLY_COSTS.length) return;
    const cost = ALLY_COSTS[lv];
    if (saveData.gold < cost) return;
    saveData.gold -= cost;
    saveData.upgrades.allyLevel = lv + 1;
    Save.commit(saveData);
    refresh();
    updateTopScreen();
  }

  function buyBomb() {
    const lv = saveData.upgrades.bombLevel ?? 0;
    if (lv >= BOMB_COSTS.length) return;
    const cost = BOMB_COSTS[lv];
    if (saveData.gold < cost) return;
    saveData.gold -= cost;
    saveData.upgrades.bombLevel = lv + 1;
    Save.commit(saveData);
    refresh();
    updateTopScreen();
  }

  function buyRange() {
    const lv = saveData.upgrades.rangeLevel ?? 0;
    if (lv >= RANGE_COSTS.length) return;
    const cost = RANGE_COSTS[lv];
    if (saveData.gold < cost) return;
    saveData.gold -= cost;
    saveData.upgrades.rangeLevel = lv + 1;
    Save.commit(saveData);
    refresh();
    updateTopScreen();
  }

  return { open, refresh, buyAlly, buyBomb, buyRange };
})();

// ── ヘルパー（main.js / defense.js から参照） ──
function getAllyCount(upgrades)   { return 1 + (upgrades.allyLevel  ?? 0); }
function getBombCount(upgrades)   { return      upgrades.bombLevel  ?? 0;  }
function getRangeRatio(upgrades)  {
  const pcts = [80, 85, 90, 95, 100];
  return pcts[upgrades.rangeLevel ?? 0] / 100;
}
