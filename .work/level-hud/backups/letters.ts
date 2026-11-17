import { GameObjects, Scene } from 'phaser';

const SHEET = 'letters';

/** Yellow digits 0–9 on the second row of UI/letters.png. */
const YELLOW_DIGITS = [
    { x: 56, y: 241, w: 78, h: 98 },
    { x: 174, y: 242, w: 56, h: 96 },
    { x: 271, y: 241, w: 71, h: 96 },
    { x: 377, y: 241, w: 71, h: 98 },
    { x: 475, y: 242, w: 78, h: 96 },
    { x: 583, y: 242, w: 70, h: 97 },
    { x: 685, y: 241, w: 73, h: 98 },
    { x: 789, y: 242, w: 71, h: 96 },
    { x: 890, y: 241, w: 74, h: 98 },
    { x: 992, y: 241, w: 75, h: 98 }
];

const TALLEST = 98;
/** On-screen height of a full digit. */
const DRAW_H = 96;
const GAP = 8;

const frameName = (digit: number) => `letter-yellow-${digit}`;

/** Red-roof house on the icon row of UI/letters.png. */
export const RETURN_FRAME = 'letter-return';
const RETURN_ICON = { x: 861, y: 77, w: 128, h: 118 };

export function loadLetterAssets (scene: Scene)
{
    scene.load.image(SHEET, 'UI/letters.png');
}

export function createLetterFrames (scene: Scene)
{
    const texture = scene.textures.get(SHEET);

    YELLOW_DIGITS.forEach((region, digit) =>
    {
        const name = frameName(digit);

        if (!texture.has(name))
        {
            texture.add(name, 0, region.x, region.y, region.w, region.h);
        }
    });

    if (!texture.has(RETURN_FRAME))
    {
        texture.add(RETURN_FRAME, 0, RETURN_ICON.x, RETURN_ICON.y, RETURN_ICON.w, RETURN_ICON.h);
    }
}

/** Height readout built from the yellow digits in letters.png. */
export class MeterDigits
{
    private root: GameObjects.Container;
    private glyphs: GameObjects.Image[] = [];

    constructor (scene: Scene, depth: number)
    {
        this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
    }

    setPosition (x: number, y: number)
    {
        this.root.setPosition(x, y);
    }

    setValue (meters: number)
    {
        const text = String(Math.max(0, Math.floor(meters)));
        const scene = this.root.scene;

        while (this.glyphs.length < text.length)
        {
            const image = scene.add.image(0, 0, SHEET, frameName(0))
                .setOrigin(0.5, 1)
                .setScrollFactor(0);

            this.root.add(image);
            this.glyphs.push(image);
        }

        const scale = DRAW_H / TALLEST;
        const widths: number[] = [];

        this.glyphs.forEach((image, index) =>
        {
            const used = index < text.length;

            image.setVisible(used);

            if (!used)
            {
                return;
            }

            image.setFrame(frameName(text.charCodeAt(index) - 48));
            image.setScale(scale);
            widths.push(image.displayWidth);
        });

        const total = widths.reduce((sum, width) => sum + width, 0) + GAP * Math.max(0, widths.length - 1);
        let cursor = -total / 2;

        widths.forEach((width, index) =>
        {
            const image = this.glyphs[index];

            image.x = cursor + width / 2;
            image.y = DRAW_H / 2;
            cursor += width + GAP;
        });
    }
}
