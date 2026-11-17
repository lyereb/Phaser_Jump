import { GameObjects, Scene } from 'phaser';

const HELMETS = [ 0xffd333, 0xff6662, 0xffa641, 0x87c86a, 0x6cc7ef, 0x459cff ];
const PAPER = [ 0xffedb2, 0xffd8d8, 0xffe0ba, 0xe0efc3, 0xd6f1ff, 0xcce9ff ];
const INK = 0x34211d;

/** Distinct local placeholders, deliberately not pretending to be real user photos. */
export function rankAvatar (scene: Scene, index: number): GameObjects.Container
{
    const slot = Math.max(0, Math.floor(index)) % HELMETS.length;
    const root = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(PAPER[slot]).fillCircle(0, 0, 47);
    g.lineStyle(4, INK).strokeCircle(0, 0, 47);
    g.fillStyle(HELMETS[slot]).fillRoundedRect(-31, 28, 62, 16, 10);
    g.lineStyle(3, INK).strokeRoundedRect(-31, 28, 62, 16, 10);
    g.fillStyle(0x493027).fillEllipse(0, 0, 71, 70);
    g.fillStyle(slot === 2 ? 0xefbf99 : 0xffd2af).fillRoundedRect(-28, -12, 56, 45, 22);
    g.lineStyle(3, INK).strokeRoundedRect(-28, -12, 56, 45, 22);
    g.fillStyle(HELMETS[slot]).fillEllipse(0, -23, 73, 42);
    g.lineStyle(3, INK).strokeEllipse(0, -23, 73, 42);
    g.fillStyle(HELMETS[slot]).fillRoundedRect(-37, -20, 74, 13, 6);
    g.lineStyle(3, INK).strokeRoundedRect(-37, -20, 74, 13, 6);
    g.fillStyle(0xffffff, 0.85).fillRoundedRect(-19, -35, 22, 5, 2);
    g.fillStyle(0x493027).fillTriangle(-25, -8, -8, -8, -20, 2).fillTriangle(-3, -8, 14, -8, 4, 1);
    g.fillStyle(INK).fillEllipse(-11, 9, 6, 9).fillEllipse(11, 9, 6, 9);
    g.fillStyle(0xff8b89, 0.75).fillEllipse(-20, 18, 12, 6).fillEllipse(20, 18, 12, 6);
    g.fillStyle(0x81372e).fillEllipse(0, 23, 12, 11);
    g.fillStyle(0xff8c8c).fillEllipse(0, 26, 7, 4);
    if (slot === 2)
    {
        g.lineStyle(2, INK).strokeCircle(-11, 9, 10).strokeCircle(11, 9, 10).lineBetween(-1, 9, 1, 9);
    }
    if (slot === 1)
    {
        g.fillStyle(0x493027).fillCircle(-32, 20, 8).fillCircle(32, 20, 8);
    }
    root.add(g);
    return root;
}
