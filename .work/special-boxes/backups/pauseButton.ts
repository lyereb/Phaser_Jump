import { GameObjects, Scene } from 'phaser';

const MARGIN = 16;
const SIZE = 88;

export const PAUSE_KEY = 'ui-pause';
export const RESUME_KEY = 'ui-resume';

export function loadPauseAssets (scene: Scene)
{
    scene.load.image(PAUSE_KEY, 'UI/pause.png');
    scene.load.image(RESUME_KEY, 'UI/resume.png');
    scene.load.image('combo-1', 'UI/combo_1.png');
    scene.load.image('combo-2', 'UI/combo_2.png');
}

/**
 * Top-left pause / resume toggle. Marked `ui` so it does not jump or restart.
 * Resume asks the game to run a countdown first; call `finishResume` when it ends.
 */
export class PauseButton
{
    private paused = false;
    private locking = false;
    private button: GameObjects.Image;

    constructor (
        scene: Scene,
        depth: number,
        private onPause: () => void,
        private onResumeRequest: () => void
    )
    {
        this.button = scene.add.image(0, 0, PAUSE_KEY)
            .setScrollFactor(0)
            .setDepth(depth)
            .setDisplaySize(SIZE, SIZE)
            .setInteractive({ useHandCursor: true })
            .setData('ui', true);

        this.button.on('pointerup', () => this.toggle());
    }

    isPaused ()
    {
        return this.paused;
    }

    isResuming ()
    {
        return this.locking;
    }

    layout (_width: number, _height: number)
    {
        this.button.setPosition(MARGIN + SIZE / 2, MARGIN + SIZE / 2);
    }

    /** Call after the resume countdown finishes. */
    finishResume ()
    {
        this.paused = false;
        this.locking = false;
        this.button.setTexture(PAUSE_KEY);
    }

    private toggle ()
    {
        if (this.locking)
        {
            return;
        }

        if (!this.paused)
        {
            this.paused = true;
            this.button.setTexture(RESUME_KEY);
            this.onPause();
            return;
        }

        this.locking = true;
        this.button.setTexture(PAUSE_KEY);
        this.onResumeRequest();
    }
}
