import type { ResourceType, UnitType } from './config';

export type Inventory = Record<ResourceType, number>;
export type Army = Record<UnitType, number>;

export const emptyInv = (): Inventory => ({ wood: 0, steel: 0, wire: 0, horse: 0 });
export const emptyArmy = (): Army => ({ defense: 0, melee: 0, range: 0, rideable: 0 });

export const game = {
  seed: 1,
  inventories: [emptyInv(), emptyInv()],
  armies: [emptyArmy(), emptyArmy()],
};

export function newGame(): void {
  game.seed = Math.floor(Math.random() * 1e9);
  game.inventories = [emptyInv(), emptyInv()];
  game.armies = [emptyArmy(), emptyArmy()];
}
