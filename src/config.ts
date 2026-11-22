export const GAME_W = 1280;
export const GAME_H = 720;

export const TILE = 32;
export const MAP_W = 64;
export const MAP_H = 40;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

export const PLAYER_SPEED = 210;
export const PLAYER_RADIUS = 12;
export const REACH = 80;
export const SPAWN = { x: WORLD_W / 2, y: WORLD_H / 2 };

export const FONT = '"Trebuchet MS", Arial, sans-serif';

export const RESOURCES = ['wood', 'steel', 'wire', 'horse'] as const;
export type ResourceType = (typeof RESOURCES)[number];

export const UNIT_TYPES = ['defense', 'melee', 'range', 'rideable'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const RES_INFO: Record<ResourceType, { label: string; hp: number; color: number; texture: string }> = {
  wood: { label: 'Wood', hp: 3, color: 0x8b5a2b, texture: 'res_wood' },
  steel: { label: 'Steel', hp: 4, color: 0xc8d0da, texture: 'res_steel' },
  wire: { label: 'Wire', hp: 3, color: 0xe0893a, texture: 'res_wire' },
  horse: { label: 'Horse', hp: 2, color: 0xa0703c, texture: 'res_horse' },
};

export const RECIPES: Record<UnitType, Partial<Record<ResourceType, number>>> = {
  defense: { steel: 2 },
  melee: { steel: 1, wood: 1 },
  range: { wire: 1, wood: 1 },
  rideable: { horse: 1, steel: 1 },
};

export interface UnitStats {
  label: string;
  desc: string;
  hp: number;
  speed: number;
  damage: number;
  /** melee: edge-to-edge reach; range: shooting distance */
  reach: number;
  cooldown: number;
  radius: number;
  mass: number;
}

export const UNIT_INFO: Record<UnitType, UnitStats> = {
  defense: {
    label: 'Defense', desc: 'Shield-bearer. Holds the line in front of your archers.',
    hp: 240, speed: 55, damage: 9, reach: 8, cooldown: 1.0, radius: 12, mass: 4,
  },
  melee: {
    label: 'Melee', desc: 'Swordsman. Charges in and fights up close.',
    hp: 110, speed: 75, damage: 16, reach: 8, cooldown: 0.8, radius: 10, mass: 1,
  },
  range: {
    label: 'Range', desc: 'Archer. Stays back and shoots arrows.',
    hp: 70, speed: 65, damage: 11, reach: 260, cooldown: 1.3, radius: 9, mass: 1,
  },
  rideable: {
    label: 'Rideable', desc: 'Cavalry. Fastest unit, hunts archers up close.',
    hp: 140, speed: 130, damage: 15, reach: 10, cooldown: 0.9, radius: 12, mass: 2,
  },
};

export const TEAM_COLORS = [0x3d7bff, 0xff4d4d];
export const TEAM_CSS = ['#6f9bff', '#ff6b6b'];
export const TEAM_NAMES = ['Player 1', 'Player 2'];

/** Gather duration in seconds (2 min). Override for testing with ?time=N */
export function gatherTime(): number {
  const p = new URLSearchParams(window.location.search).get('time');
  const n = p ? Number(p) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 120;
}

export function recipeText(t: UnitType): string {
  return Object.entries(RECIPES[t])
    .map(([r, n]) => `${n} ${RES_INFO[r as ResourceType].label}`)
    .join(' + ');
}
