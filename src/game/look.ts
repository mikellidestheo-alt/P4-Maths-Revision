/**
 * How the camper looks: boy or girl (chosen on the title screen) plus clothes and accessories from the shop.
 * Pure data — the 3D model (world/models.ts) and the 2D picture (ui/art.ts) both draw from a Look.
 */
export type AvatarKind = 'boy' | 'girl';
export type WearSlot = 'top' | 'head' | 'face' | 'neck' | 'back';

export interface WearItem {
  id: string;
  name: string;
  price: number;
  slot: WearSlot;
  desc: string;
  /** tops: shirt colour and pattern */
  colour?: string;
  pattern?: 'plain' | 'stripes' | 'star';
}

/** Camper clothes and accessories sold in the shop (one per slot can be worn). */
export const WEAR: WearItem[] = [
  { id: 'wear-top-red', name: 'Red hoodie', price: 20, slot: 'top', colour: '#c8433a', desc: 'Warm for chilly nights.' },
  { id: 'wear-top-purple', name: 'Purple jumper', price: 20, slot: 'top', colour: '#7b4fc4', desc: 'Soft and snuggly.' },
  { id: 'wear-top-green', name: 'Camp shirt', price: 20, slot: 'top', colour: '#3f8f5a', desc: 'Forest green, like a real ranger.' },
  { id: 'wear-top-stripes', name: 'Rainbow stripes', price: 30, slot: 'top', colour: '#e8743b', pattern: 'stripes', desc: 'All the colours!' },
  { id: 'wear-top-star', name: 'Star T-shirt', price: 30, slot: 'top', colour: '#27346b', pattern: 'star', desc: 'A big golden star.' },
  { id: 'wear-head-bobble', name: 'Bobble hat', price: 25, slot: 'head', desc: 'Red with a bobble on top.' },
  { id: 'wear-head-explorer', name: 'Explorer hat', price: 30, slot: 'head', desc: 'Ready for adventure.' },
  { id: 'wear-head-crown', name: 'Flower crown', price: 30, slot: 'head', desc: 'Fresh from the meadow.' },
  { id: 'wear-head-ears', name: 'Bunny ears', price: 25, slot: 'head', desc: 'Hop hop!' },
  { id: 'wear-head-pirate', name: 'Pirate hat', price: 35, slot: 'head', desc: 'Ahoy, camper!' },
  { id: 'wear-face-glasses', name: 'Round glasses', price: 20, slot: 'face', desc: 'For reading the trail map.' },
  { id: 'wear-face-shades', name: 'Star sunglasses', price: 25, slot: 'face', desc: 'Very cool.' },
  { id: 'wear-neck-scarf', name: 'Cosy scarf', price: 20, slot: 'neck', desc: 'Stripy and warm.' },
  { id: 'wear-back-pack', name: 'Explorer backpack', price: 30, slot: 'back', desc: 'Room for snacks.' },
  { id: 'wear-back-cape', name: 'Hero cape', price: 35, slot: 'back', desc: 'Maths hero!' },
];

export interface Look {
  avatar: AvatarKind;
  shirt: string;
  trousers: string;
  skin: string;
  hair: string;
  pattern: 'plain' | 'stripes' | 'star';
  /** worn item id per slot (null = nothing) */
  head: string | null;
  face: string | null;
  neck: string | null;
  back: string | null;
}

const BASE: Record<AvatarKind, Pick<Look, 'shirt' | 'trousers' | 'skin' | 'hair'>> = {
  boy: { shirt: '#e8743b', trousers: '#2f3f7a', skin: '#f2c79c', hair: '#5a341e' },
  girl: { shirt: '#d9558f', trousers: '#2f3f7a', skin: '#f2c79c', hair: '#6b3a1e' },
};

export const wearById = (id: string | undefined) => WEAR.find((w) => w.id === id);

/** The camper's look from the save's `equipped` map (avatar + one item per wear slot). */
export function lookOf(equipped: Record<string, string>, avatar?: AvatarKind): Look {
  const kind: AvatarKind = avatar ?? (equipped.avatar === 'girl' ? 'girl' : 'boy');
  const top = wearById(equipped.top);
  const worn = (slot: WearSlot) => (wearById(equipped[slot])?.slot === slot ? equipped[slot] : null);
  return {
    avatar: kind,
    ...BASE[kind],
    ...(top?.slot === 'top' ? { shirt: top.colour! } : {}),
    pattern: top?.slot === 'top' ? top.pattern ?? 'plain' : 'plain',
    head: worn('head'),
    face: worn('face'),
    neck: worn('neck'),
    back: worn('back'),
  };
}

/** A short key that changes whenever the look does (so the 3D camper is only rebuilt when needed). */
export const lookKey = (l: Look) => [l.avatar, l.shirt, l.pattern, l.head, l.face, l.neck, l.back].join('|');
