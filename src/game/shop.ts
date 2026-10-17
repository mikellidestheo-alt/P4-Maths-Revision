/** Cosmetic rewards only. Nothing here changes the maths or gives an advantage. */
import { WEAR, type WearSlot } from './look';

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  slot: 'lantern' | 'decor' | 'outfit' | 'friends' | WearSlot;
  /** exclusive slots: only one equipped at a time */
  exclusive: boolean;
  desc: string;
}

export const SHOP: ShopItem[] = [
  // the camper's clothes and accessories (one per slot)
  ...WEAR.map((w) => ({ id: w.id, name: w.name, price: w.price, slot: w.slot, exclusive: true, desc: w.desc })),
  { id: 'lantern-gold', name: 'Golden lantern glow', price: 0, slot: 'lantern', exclusive: true, desc: 'Warm and cosy.' },
  { id: 'lantern-blue', name: 'Moonlight blue glow', price: 20, slot: 'lantern', exclusive: true, desc: 'Cool and calm.' },
  { id: 'lantern-pink', name: 'Rose pink glow', price: 20, slot: 'lantern', exclusive: true, desc: 'Soft and pretty.' },
  { id: 'lantern-green', name: 'Firefly green glow', price: 20, slot: 'lantern', exclusive: true, desc: 'Like Ember!' },
  { id: 'decor-lights', name: 'Fairy lights', price: 30, slot: 'decor', exclusive: false, desc: 'Twinkly lights between the trees.' },
  { id: 'decor-bunting', name: 'Bunting', price: 25, slot: 'decor', exclusive: false, desc: 'Colourful flags over the tent.' },
  { id: 'decor-pumpkin', name: 'Pumpkin lantern', price: 30, slot: 'decor', exclusive: false, desc: 'A smiley autumn pumpkin.' },
  { id: 'decor-rug', name: 'Cosy rug', price: 20, slot: 'decor', exclusive: false, desc: 'A stripy rug by the fire.' },
  { id: 'decor-flag', name: 'Star flag', price: 25, slot: 'decor', exclusive: false, desc: 'A flag with a golden star.' },
  { id: 'decor-mushrooms', name: 'Glowing mushrooms', price: 30, slot: 'decor', exclusive: false, desc: 'Little mushrooms that glow.' },
  { id: 'decor-hammock', name: 'Hammock', price: 40, slot: 'decor', exclusive: false, desc: 'For lazy afternoons.' },
  { id: 'outfit-woolly', name: 'Woolly hat for Wren', price: 25, slot: 'outfit', exclusive: true, desc: 'Red with a bobble.' },
  { id: 'outfit-explorer', name: 'Explorer hat for Wren', price: 30, slot: 'outfit', exclusive: true, desc: 'Ready for adventure.' },
  { id: 'outfit-crown', name: 'Flower crown for Wren', price: 30, slot: 'outfit', exclusive: true, desc: 'Fresh from the meadow.' },
  { id: 'friends-bows', name: 'Bow ties for the friends', price: 30, slot: 'friends', exclusive: true, desc: 'Very smart.' },
  { id: 'friends-party', name: 'Party hats for the friends', price: 35, slot: 'friends', exclusive: true, desc: 'For the Dawn party!' },
];

export const itemById = (id: string) => SHOP.find((i) => i.id === id);

/** Shop sections, in display order. */
export const SHOP_GROUPS: { title: string; slots: ShopItem['slot'][] }[] = [
  { title: 'Your camper', slots: ['top', 'head', 'face', 'neck', 'back'] },
  { title: 'Wren’s hats', slots: ['outfit'] },
  { title: 'Camp', slots: ['decor', 'lantern'] },
  { title: 'Forest friends', slots: ['friends'] },
];
