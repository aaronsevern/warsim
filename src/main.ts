import Phaser from 'phaser';
import './style.css';
import { GAME_H, GAME_W } from './config';
import { BattleScene } from './scenes/Battle';
import { BootScene } from './scenes/Boot';
import { GatherScene } from './scenes/Gather';
import { HandoffScene } from './scenes/Handoff';
import { MenuScene } from './scenes/Menu';
import { ShopScene } from './scenes/Shop';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#10151c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, HandoffScene, GatherScene, ShopScene, BattleScene],
});
