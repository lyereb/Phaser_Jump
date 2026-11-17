import { GameObjects, Scene } from 'phaser';

/**
 * Debug corner UI.
 * - `npm run dev`: shown
 * - `npm run build`: hidden
 * Override with `true` / `false` if you need to force it either way.
 */
export const SHOW_DEBUG_UI = import.meta.env.DEV;

const MARGIN = 16;
const BUTTON_W = 112;
const BUTTON_H = 44;
const PANEL_W = 280;
const PANEL_H = 480;
const GAP = 8;
const ROW_H = 44;

type Row = {
    bg: GameObjects.Rectangle;
    label: GameObjects.Text;
};

type Stepper = {
    minus: GameObjects.Rectangle;
    minusLabel: GameObjects.Text;
    plus: GameObjects.Rectangle;
    plusLabel: GameObjects.Text;
    label: GameObjects.Text;
    format: () => string;
};

/** Plain corner button and box. Clicks are marked `ui` so they do not jump or restart. */
export class DebugPanel
{
    private readonly enabled = SHOW_DEBUG_UI;
    private open = false;
    private buttonBg: GameObjects.Rectangle | null = null;
    private buttonLabel: GameObjects.Text | null = null;
    private panelBg: GameObjects.Rectangle | null = null;
    private panelTitle: GameObjects.Text | null = null;
    private rows: Row[] = [];
    private steppers: Stepper[] = [];

    constructor (scene: Scene, depth: number)
    {
        if (!this.enabled)
        {
            return;
        }

        this.buttonBg = scene.add.rectangle(0, 0, BUTTON_W, BUTTON_H, 0x222222)
            .setStrokeStyle(2, 0xffffff)
            .setScrollFactor(0)
            .setDepth(depth)
            .setInteractive()
            .setData('ui', true);

        this.buttonLabel = scene.add.text(0, 0, '调试', {
            fontFamily: 'Arial',
            fontSize: 22,
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

        this.panelBg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x111111)
            .setStrokeStyle(2, 0xffffff)
            .setScrollFactor(0)
            .setDepth(depth)
            .setVisible(false)
            .setData('ui', true);

        this.panelTitle = scene.add.text(0, 0, '调试', {
            fontFamily: 'Arial',
            fontSize: 22,
            color: '#ffffff'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth + 1).setVisible(false);

        this.buttonBg.on('pointerdown', () => this.toggle());
    }

    /** Stack a plain button under the title. Only receives clicks while the panel is open. */
    addButton (label: string, onClick: () => void): { setLabel: (value: string) => void } | undefined
    {
        if (!this.buttonBg)
        {
            return;
        }

        const depth = this.buttonBg.depth;
        const bg = this.buttonBg.scene.add.rectangle(0, 0, PANEL_W - 32, ROW_H, 0x333333)
            .setStrokeStyle(2, 0xffffff)
            .setScrollFactor(0)
            .setDepth(depth + 1)
            .setVisible(false)
            .setData('ui', true);
        const text = this.buttonBg.scene.add.text(0, 0, label, {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setVisible(false);

        bg.on('pointerdown', () => onClick());
        this.rows.push({ bg, label: text });

        return {
            setLabel: (value: string) => text.setText(value)
        };
    }

    /**
     * One labelled value with − and +. Stays open so it can be tapped again.
     * `format` is read again after every step.
     */
    addStepper (format: () => string, onStep: (direction: number) => void)
    {
        if (!this.buttonBg)
        {
            return;
        }

        const scene = this.buttonBg.scene;
        const depth = this.buttonBg.depth;
        const minus = this.makeStepButton(scene, depth, '−');
        const plus = this.makeStepButton(scene, depth, '+');
        const label = scene.add.text(0, 0, format(), {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setVisible(false);

        const stepper: Stepper = {
            minus: minus.bg,
            minusLabel: minus.label,
            plus: plus.bg,
            plusLabel: plus.label,
            label,
            format
        };

        const step = (direction: number) =>
        {
            onStep(direction);
            label.setText(format());
        };

        minus.bg.on('pointerdown', () => step(-1));
        plus.bg.on('pointerdown', () => step(1));
        this.steppers.push(stepper);
    }

    private makeStepButton (scene: Scene, depth: number, caption: string)
    {
        const bg = scene.add.rectangle(0, 0, 44, 44, 0x333333)
            .setStrokeStyle(2, 0xffffff)
            .setScrollFactor(0)
            .setDepth(depth + 1)
            .setVisible(false)
            .setData('ui', true);
        const label = scene.add.text(0, 0, caption, {
            fontFamily: 'Arial',
            fontSize: 28,
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2).setVisible(false);

        return { bg, label };
    }

    close ()
    {
        if (this.open)
        {
            this.toggle();
        }
    }

    layout (width: number, height: number)
    {
        if (!this.buttonBg || !this.buttonLabel || !this.panelBg || !this.panelTitle)
        {
            return;
        }

        const buttonX = width - MARGIN - BUTTON_W / 2;
        const buttonY = MARGIN + BUTTON_H / 2;
        const panelH = Math.min(PANEL_H, Math.max(120, height - buttonY - BUTTON_H / 2 - GAP - MARGIN));
        const panelX = width - MARGIN - PANEL_W / 2;
        const panelY = buttonY + BUTTON_H / 2 + GAP + panelH / 2;

        this.buttonBg.setPosition(buttonX, buttonY);
        this.buttonLabel.setPosition(buttonX, buttonY);

        this.panelBg.setSize(PANEL_W, panelH);
        this.panelBg.setPosition(panelX, panelY);
        this.panelTitle.setPosition(panelX, panelY - panelH / 2 + 14);

        const rowTop = panelY - panelH / 2 + 52;
        let index = 0;

        this.steppers.forEach(stepper =>
        {
            const y = rowTop + index * (ROW_H + GAP) + ROW_H / 2;

            index += 1;
            stepper.minus.setPosition(panelX - 100, y);
            stepper.minusLabel.setPosition(panelX - 100, y);
            stepper.plus.setPosition(panelX + 100, y);
            stepper.plusLabel.setPosition(panelX + 100, y);
            stepper.label.setPosition(panelX, y);
            stepper.label.setText(stepper.format());

            if (this.open)
            {
                stepper.minus.setInteractive();
                stepper.plus.setInteractive();
            }
        });

        this.rows.forEach(row =>
        {
            const y = rowTop + index * (ROW_H + GAP) + ROW_H / 2;

            index += 1;
            row.bg.setPosition(panelX, y);
            row.label.setPosition(panelX, y);

            if (this.open)
            {
                row.bg.setInteractive();
            }
        });

        if (this.open)
        {
            this.panelBg.setInteractive();
        }
    }

    private toggle ()
    {
        if (!this.buttonLabel || !this.panelBg || !this.panelTitle)
        {
            return;
        }

        this.open = !this.open;
        this.buttonLabel.setText(this.open ? '关闭' : '调试');
        this.panelBg.setVisible(this.open);
        this.panelTitle.setVisible(this.open);

        this.steppers.forEach(stepper =>
        {
            stepper.label.setText(stepper.format());
            stepper.minus.setVisible(this.open);
            stepper.minusLabel.setVisible(this.open);
            stepper.plus.setVisible(this.open);
            stepper.plusLabel.setVisible(this.open);
            stepper.label.setVisible(this.open);

            if (this.open)
            {
                stepper.minus.setInteractive();
                stepper.plus.setInteractive();
            }
            else
            {
                stepper.minus.disableInteractive();
                stepper.plus.disableInteractive();
            }
        });

        this.rows.forEach(row =>
        {
            row.bg.setVisible(this.open);
            row.label.setVisible(this.open);

            if (this.open)
            {
                row.bg.setInteractive();
            }
            else
            {
                row.bg.disableInteractive();
            }
        });

        if (this.open)
        {
            this.panelBg.setInteractive();
        }
        else
        {
            this.panelBg.disableInteractive();
        }
    }
}
