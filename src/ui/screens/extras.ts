import { h } from '../dom';
import type { App, Screen } from '../app';
import { nav } from '../nav';
import { SHOP, type ShopItem } from '../../game/shop';
import { FRIENDS, NIGHTS } from '../../game/nights';
import { isFinished } from '../../game/progress';
import { campScene, friendSvg } from '../art';
import { play } from '../../game/audio';
import { GAME } from '../../config/game';

export function shopScreen(app: App): Screen {
  const d = app.data;
  const coinsEl = h('span', { 'data-coins': '1' }, String(d.coins));
  const list = h('div', { class: 'shop-list' });
  const preview = h('div', { class: 'scene-wrap scene-small' });
  const renderPreview = () => {
    preview.innerHTML = '';
    preview.appendChild(campScene({ spook: GAME.spook, decor: app.decor(), outfit: d.equipped.outfit }));
  };
  const owned = (it: ShopItem) => d.owned.includes(it.id);
  const isOn = (it: ShopItem) => (it.exclusive ? d.equipped[it.slot] === it.id : owned(it) && d.equipped[it.id] !== 'off');
  function render() {
    list.innerHTML = '';
    coinsEl.textContent = String(d.coins);
    for (const it of SHOP) {
      const b = h('button', { type: 'button', class: `btn btn-small ${isOn(it) ? 'btn-on' : ''}`, 'data-item': it.id });
      if (!owned(it)) {
        b.textContent = `Buy · ${it.price} 🪙`;
        b.disabled = d.coins < it.price;
        b.setAttribute('aria-label', `Buy ${it.name} for ${it.price} coins`);
      } else if (it.exclusive) {
        b.textContent = isOn(it) ? (it.slot === 'lantern' ? 'Using ✓' : 'Wearing ✓') : it.slot === 'lantern' ? 'Use' : 'Wear';
        if (it.slot === 'lantern' && isOn(it)) b.disabled = true;
      } else {
        b.textContent = isOn(it) ? 'Showing ✓' : 'Show';
      }
      b.addEventListener('click', () => {
        if (!owned(it)) {
          if (d.coins < it.price) return;
          d.coins -= it.price;
          d.owned.push(it.id);
          if (it.exclusive) d.equipped[it.slot] = it.id;
          play('coin');
        } else if (it.exclusive) {
          if (isOn(it) && it.slot !== 'lantern') delete d.equipped[it.slot];
          else d.equipped[it.slot] = it.id;
          play('tap');
        } else {
          d.equipped[it.id] = isOn(it) ? 'off' : 'on';
          play('tap');
        }
        app.save();
        app.applySettings();
        render();
        renderPreview();
      });
      list.appendChild(h('div', { class: `shop-item ${owned(it) ? 'owned' : ''}` },
        h('div', { class: 'shop-text' }, h('strong', {}, it.name), h('span', {}, it.desc)), b));
    }
  }
  render();
  renderPreview();
  const back = () => nav.home(app);
  const el = h('div', { class: 'screen shop', 'data-screen': 'shop' },
    h('header', { class: 'topbar' }, h('button', { type: 'button', class: 'icon-btn', 'data-action': 'back', 'aria-label': 'Back to camp' }, '⟵'), h('h1', {}, 'Camp shop'), h('div', { class: 'coins' }, '🪙 ', coinsEl)),
    h('main', { class: 'shop-main' },
      preview,
      h('p', { class: 'small-help' }, 'Coins come from right answers and from fixing mistakes at the campfire. Everything here is just for fun!'),
      list));
  el.querySelector('[data-action="back"]')!.addEventListener('click', back);
  return { el, title: 'Shop', onBack: back };
}

export function friendsScreen(app: App): Screen {
  const d = app.data;
  const back = () => nav.home(app);
  const cards = FRIENDS.map((f, i) => {
    const found = isFinished(d, NIGHTS[i].n);
    return h('div', { class: `friend-card ${found ? 'found' : ''}` },
      friendSvg(f.id, { silhouette: !found, accessory: d.equipped.friends }, found ? `${f.name} the ${f.animal}` : 'a friend still to find'),
      h('strong', {}, found ? `${f.name} the ${f.animal}` : `Night ${i + 1}: ???`),
      h('span', {}, found ? f.line : `Lost somewhere in ${f.lostIn}.`));
  });
  const el = h('div', { class: 'screen friends', 'data-screen': 'friends' },
    h('header', { class: 'topbar' }, h('button', { type: 'button', class: 'icon-btn', 'data-action': 'back', 'aria-label': 'Back to camp' }, '⟵'), h('h1', {}, 'Forest friends')),
    h('main', { class: 'friends-grid' }, ...cards));
  el.querySelector('[data-action="back"]')!.addEventListener('click', back);
  return { el, title: 'Friends', onBack: back };
}
