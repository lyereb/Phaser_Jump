import { GameObjects, Scene } from 'phaser';
import { AltitudeProgress, altitudeLayout } from './altitudeBackgroundModel';

const TEXTURES = ['background', 'altitude-clouds', 'altitude-atmosphere', 'altitude-moon'];

export function loadAltitudeBackgroundAssets (scene: Scene)
{
    scene.load.image(TEXTURES[1], 'Altitude/clouds.png');
    scene.load.image(TEXTURES[2], 'Altitude/atmosphere.png');
    scene.load.image(TEXTURES[3], 'Altitude/moon-space.png');
}

/** One virtual vertical strip made of ordinary textures, rather than one oversized GPU texture. */
export class AltitudeBackground
{
    readonly root: GameObjects.Container;
    private images: GameObjects.Image[] = [];
    private progress = new AltitudeProgress();
    private destroyed = false;

    constructor (private scene: Scene, depth: number)
    {
        this.root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
        for (const texture of TEXTURES)
        {
            const image = scene.add.image(0, 0, texture).setScrollFactor(0);
            this.images.push(image);
            this.root.add(image);
        }
        this.layout();
        this.installFrozenShakeCompensation();
    }

    update (meters: number, delta: number)
    {
        if (this.destroyed) return;
        this.progress.setMeters(meters);
        if (this.progress.update(delta)) this.layout();
    }

    freeze () { this.progress.freeze(); }

    private installFrozenShakeCompensation ()
    {
        // Run after Camera.preRender has computed this frame's random shake offset.
        this.root.addRenderStep((renderer, object, context, parent, step = 0, list, index) =>
        {
            this.compensateFrozenShake(context.camera ?? this.scene.cameras.main);
            this.root.renderWebGLStep(renderer, object, context, parent, step + 1, list, index);
        }, 0);
        // Canvas bypasses WebGL render steps and needs the same pre-draw correction.
        type CanvasRoot = GameObjects.Container & { renderCanvas: (
            renderer: Phaser.Renderer.Canvas.CanvasRenderer, object: GameObjects.Container,
            camera: Phaser.Cameras.Scene2D.Camera, parent?: GameObjects.Components.TransformMatrix) => void };
        const root = this.root as CanvasRoot;
        const draw = root.renderCanvas;
        root.renderCanvas = (renderer, object, camera, parent) =>
        {
            this.compensateFrozenShake(camera);
            draw.call(root, renderer, object, camera, parent);
        };
    }

    private compensateFrozenShake (camera: Phaser.Cameras.Scene2D.Camera)
    {
        if (!this.progress.status().frozen) return;
        // Phaser 4.2.1 Shake.preRender translates its view matrix by these world offsets.
        const shake = camera.shakeEffect as Phaser.Cameras.Scene2D.Effects.Shake & { _offsetX: number; _offsetY: number };
        this.root.setPosition(this.scene.scale.width / 2 - (shake.isRunning ? shake._offsetX : 0),
            this.scene.scale.height / 2 - (shake.isRunning ? shake._offsetY : 0));
    }

    /** Counteract zoom around the screen centre, retaining exactly the visible background crop. */
    layout ()
    {
        if (this.destroyed) return;
        const {width, height} = this.scene.scale;
        const zoom = Math.max(0.0001, this.scene.cameras.main.zoom);
        const panel = altitudeLayout(width, height, this.progress.value());
        this.root.setPosition(width / 2, height / 2).setScale(1 / zoom);
        this.images.forEach((image, index) =>
        {
            // A one-pixel bleed in each dimension prevents fractional camera clear-colour edges.
            image.setDisplaySize(panel.panelWidth + 2, panel.panelHeight + 2);
            const shift = index === this.images.length - 1 ? panel.moonShift : 0;
            image.setPosition(0, panel.offset - index * panel.stride + shift);
        });
    }

    status ()
    {
        return { ...this.progress.status(), ...altitudeLayout(this.scene.scale.width, this.scene.scale.height,
            this.progress.value()), images: this.images.length, destroyed: this.destroyed };
    }

    destroy ()
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.root.destroy();
        this.images = [];
    }
}
