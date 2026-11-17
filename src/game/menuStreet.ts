import { GameObjects, Scene, WEBGL } from 'phaser';
import { advanceStreet, distanceFog, FACADE_COUNT, houseDepth, makeStreetHouses, positiveModulo,
    projectStreet, STREET, STREET_FAR, STREET_PERIOD, StreetHouse, StreetPoint, StreetView,
    streetView, visibleWallStart } from './menuStreetModel';

const FACADES = [
    { key: 'menu-street-peach', file: 'MenuStreet/shop-peach.jpg' },
    { key: 'menu-street-teal', file: 'MenuStreet/shop-teal.jpg' },
    { key: 'menu-street-cream', file: 'MenuStreet/shop-cream.jpg' },
    { key: 'menu-street-bakery', file: 'MenuStreet/shop-bakery.png' },
    { key: 'menu-street-juice', file: 'MenuStreet/shop-juice.png' },
    { key: 'menu-street-candy', file: 'MenuStreet/shop-candy.png' },
    { key: 'menu-street-icecream', file: 'MenuStreet/shop-icecream.png' },
    { key: 'menu-street-coffee', file: 'MenuStreet/shop-coffee.png' },
    { key: 'menu-street-cake', file: 'MenuStreet/shop-cake.png' }
];
// Enough slices that a window edge stays inside one slice instead of crawling across a seam.
const STRIPS = 32;
const FAR = STREET_FAR;

type HouseNode = {
    house: StreetHouse;
    facade: GameObjects.Mesh2D | null;
    end: GameObjects.Mesh2D | null;
    details: GameObjects.Graphics;
};

export function loadMenuStreetAssets (scene: Scene)
{
    if (FACADES.length !== FACADE_COUNT)
        throw new Error(`Menu street facades: expected ${FACADE_COUNT}, got ${FACADES.length}`);
    scene.load.image('menu-street-sky', 'MenuStreet/sky.jpg');
    scene.load.image('menu-street-city', 'MenuStreet/city.jpg');
    for (const facade of FACADES) scene.load.image(facade.key, facade.file);
}

/** All renderables stay below depth 1; no camera movement, input handlers or tweens. */
export class MenuStreetBackground
{
    private sky: GameObjects.Image;
    private city: GameObjects.Image;
    private road: GameObjects.Graphics;
    private nodes: HouseNode[] = [];
    private view: StreetView;
    private travel = 0;
    private destroyed = false;
    private canvasKey: string | null = null;
    private canvasImage: GameObjects.Image | null = null;
    private canvasTexture: Phaser.Textures.CanvasTexture | null = null;
    private canvasClock = 0;

    constructor (private scene: Scene)
    {
        this.sky = scene.add.image(0, 0, 'menu-street-sky').setDepth(0);
        this.city = scene.add.image(0, 0, 'menu-street-city').setDepth(0.01);
        this.road = scene.add.graphics().setDepth(0.02);
        this.view = streetView(scene.scale.width, scene.scale.height);
        const gpu = scene.game.renderer.type === WEBGL;
        if (!gpu)
        {
            // Mesh2D is WebGL-only. Same perspective geometry is textured on Canvas fallback.
            this.canvasKey = `menu-street-canvas-${scene.sys.settings.key}`;
            this.canvasTexture = scene.textures.createCanvas(this.canvasKey, 1, 1);
            this.canvasImage = scene.add.image(0, 0, this.canvasKey).setOrigin(0, 0).setDepth(0.1);
        }
        for (const house of makeStreetHouses())
        {
            this.nodes.push({ house, facade: gpu ? this.makeMesh(house.variant, STRIPS) : null,
                end: gpu ? this.makeMesh(house.variant, 1) : null,
                details: scene.add.graphics() });
        }
        this.resize(this.view.width, this.view.height);
        this.stabilizeFacades();
    }

    /** Mipmaps and anisotropy keep thin glass and door lines from sparkling as the wall scales. */
    private stabilizeFacades ()
    {
        const renderer = this.scene.game.renderer;
        if (renderer.type !== WEBGL) return;
        const webgl = renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        const gl = webgl.gl;
        const anisotropic = gl.getExtension('EXT_texture_filter_anisotropic') as {
            TEXTURE_MAX_ANISOTROPY_EXT: number;
            MAX_TEXTURE_MAX_ANISOTROPY_EXT: number;
        } | null;
        const maxAnisotropy = anisotropic
            ? gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number
            : 1;

        for (const facade of FACADES)
        {
            const wrapper = this.scene.textures.get(facade.key).source[0].glTexture;
            if (!wrapper?.pixels) continue;
            wrapper.update(
                wrapper.pixels, wrapper.width, wrapper.height, wrapper.flipY,
                gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE,
                gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR, wrapper.format
            );
            if (!anisotropic) continue;
            webgl.glTextureUnits.bind(wrapper, 0, true);
            gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, maxAnisotropy));
        }
    }

    private makeMesh (variant: number, strips: number)
    {
        const vertices = new Array<number>(strips * 16).fill(0);
        const indices: number[] = [];
        for (let i = 0; i < strips; i++)
        {
            const v = i * 4;
            indices.push(v, v + 1, v + 2, 0, v + 1, v + 2, v + 3, 0);
        }
        return this.scene.add.mesh2d(0, 0, FACADES[variant].key, vertices, indices, true)
            .setOrigin(0, 0).buildOrderedIndices(1, true);
    }

    resize (width: number, height: number)
    {
        if (this.destroyed) return;
        this.view = streetView(width, height);
        // Separate city crop: its measured base, rather than the generated image's nominal horizon.
        const cityHeight = height * 0.272;
        const skyHeight = this.view.horizon + height * 0.011 - cityHeight + 1;
        this.sky.setDisplaySize(width, skyHeight).setPosition(width / 2, skyHeight / 2);
        this.city.setDisplaySize(width, cityHeight).setPosition(width / 2,
            this.view.horizon + height * 0.011 - cityHeight / 2);
        if (this.canvasTexture && this.canvasImage)
        {
            const scale = Math.min(1, 900 / width, 1500 / height);
            this.canvasTexture.setSize(Math.ceil(width * scale), Math.ceil(height * scale));
            this.canvasImage.setDisplaySize(width, height);
        }
        this.draw();
    }

    update (delta: number)
    {
        if (this.destroyed) return;
        this.travel = advanceStreet(this.travel, delta);
        if (this.canvasTexture)
        {
            this.canvasClock += Math.min(50, Math.max(0, delta));
            if (this.canvasClock < 1000 / 30) return;
            this.canvasClock %= 1000 / 30;
        }
        this.draw();
    }

    private p (x: number, y: number, z: number) { return projectStreet(this.view, x, y, z); }

    private polygon (g: GameObjects.Graphics, points: StreetPoint[], color: number, alpha = 1)
    {
        g.fillStyle(color, alpha).beginPath().moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
        g.closePath().fillPath();
    }

    private groundQuad (g: GameObjects.Graphics, x1: number, x2: number, z1: number, z2: number,
        color: number, y = 0, alpha = 1)
    {
        this.polygon(g, [this.p(x1, y, z1), this.p(x2, y, z1), this.p(x2, y, z2), this.p(x1, y, z2)], color, alpha);
    }

    private drawRoad ()
    {
        const g = this.road.clear();
        const {width, height, horizon} = this.view;
        g.fillStyle(0x8799b9).fillRect(0, horizon, width, height - horizon);
        // The asphalt is invariant; dash/curb joints provide coherent world-space motion.
        for (const side of [-1, 1])
        {
            this.groundQuad(g, side * STREET.roadHalfWidth, side * STREET.sidewalkOuter,
                STREET.near, FAR, 0xdde0ed, 0.10);
            this.groundQuad(g, side * STREET.roadHalfWidth, side * (STREET.roadHalfWidth + 0.16),
                STREET.near, FAR, 0x7688a8);
            for (let i = 0; i < STREET.housesPerSide * 4; i++)
            {
                const z = STREET.near + positiveModulo(i * STREET.spacing / 4 - this.travel, STREET_PERIOD);
                this.groundQuad(g, side * (STREET.roadHalfWidth + 0.18), side * STREET.sidewalkOuter,
                    z, z + 0.035, 0xa8b0c4, 0.11, distanceFog(z));
            }
        }
        for (let i = 0; i < STREET.housesPerSide; i++)
        {
            const z = STREET.near + positiveModulo(i * STREET.dashSpacing - this.travel, STREET_PERIOD);
            this.groundQuad(g, -0.075, 0.075, z, z + STREET.dashLength, 0xfffbed, 0.01, distanceFog(z));
        }
        // Soften only the last few pixels at the vanishing point; no near-field motion blur.
        for (let i = 0; i < 12; i++)
        {
            g.fillStyle(0x98b6d0, (1 - i / 12) * 0.25).fillRect(0, horizon + i, width, 1);
        }
    }

    private wallPoints (house: StreetHouse, z: number, t: number)
    {
        const depth = z + house.length * t;
        const x = house.side * STREET.houseInner;
        return [this.p(x, house.height, depth), this.p(x, 0.11, depth)];
    }

    private drawMesh (node: HouseNode, z: number, alpha: number, depth: number)
    {
        const mesh = node.facade!, end = node.end!, house = node.house;
        mesh.setVisible(true).setAlpha(alpha).setDepth(depth);
        end.setVisible(z >= STREET.near).setAlpha(alpha).setDepth(depth + 0.0001);
        const start = visibleWallStart(house, z);
        for (let i = 0; i < STRIPS; i++)
        {
            const t1 = start + (1 - start) * i / STRIPS;
            const t2 = start + (1 - start) * (i + 1) / STRIPS;
            const [top1, bottom1] = this.wallPoints(house, z, t1);
            const [top2, bottom2] = this.wallPoints(house, z, t2);
            const u1 = house.side === -1 ? t1 : 1 - t1;
            const u2 = house.side === -1 ? t2 : 1 - t2;
            mesh.vertices.splice(i * 16, 16, top1.x, top1.y, u1, 0, bottom1.x, bottom1.y, u1, 1,
                top2.x, top2.y, u2, 0, bottom2.x, bottom2.y, u2, 1);
        }
        const inner = house.side * STREET.houseInner;
        const outer = house.side * (STREET.houseInner + STREET.houseWidth);
        const left = Math.min(inner, outer), right = Math.max(inner, outer);
        const a = this.p(left, house.height, z), b = this.p(left, 0.11, z);
        const c = this.p(right, house.height, z), d = this.p(right, 0.11, z);
        end.vertices.splice(0, 16, a.x, a.y, 0, 0, b.x, b.y, 0, 1, c.x, c.y, 1, 0, d.x, d.y, 1, 1);
    }

    private drawTree (node: HouseNode, z: number, alpha: number, depth: number, ctx?: CanvasRenderingContext2D)
    {
        const g = node.details.clear().setDepth(depth + 0.0002);
        const treeZ = z + node.house.length * 0.85;
        if (treeZ < STREET.near) return;
        const foot = this.p(node.house.side * 4.4, 0.12, treeZ);
        const crown = this.p(node.house.side * 4.4, 1.4, treeZ);
        const scale = this.view.focal / treeZ;
        if (foot.x < -scale || foot.x > this.view.width + scale) return;
        if (ctx)
        {
            // Paint trees in the same far-to-near pass as facades, not above all buildings.
            ctx.save();
            ctx.globalAlpha = alpha * 0.16;
            ctx.fillStyle = '#576e75';
            ctx.beginPath(); ctx.ellipse(foot.x, foot.y, scale * 0.45, scale * 0.07, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#9b653a'; ctx.fillRect(foot.x - scale * 0.07, crown.y, scale * 0.14, foot.y - crown.y);
            ctx.fillStyle = '#43d229'; ctx.strokeStyle = '#26953e'; ctx.lineWidth = Math.max(0.6, scale * 0.026);
            ctx.beginPath(); ctx.ellipse(crown.x, crown.y, scale * 0.41, scale * 0.51, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#6bdd30'; ctx.beginPath();
            ctx.ellipse(crown.x - scale * 0.14, crown.y - scale * 0.12, scale * 0.18, scale * 0.30, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
            return;
        }
        g.fillStyle(0x576e75, alpha * 0.16).fillEllipse(foot.x, foot.y, scale * 0.9, scale * 0.14);
        g.fillStyle(0x9b653a, alpha).fillRect(foot.x - scale * 0.07, crown.y, scale * 0.14, foot.y - crown.y);
        g.lineStyle(Math.max(0.6, scale * 0.026), 0x26953e, alpha);
        g.fillStyle(0x43d229, alpha).fillEllipse(crown.x, crown.y, scale * 0.82, scale * 1.02)
            .strokeEllipse(crown.x, crown.y, scale * 0.82, scale * 1.02);
        g.fillStyle(0x6bdd30, alpha).fillEllipse(crown.x - scale * 0.14, crown.y - scale * 0.12,
            scale * 0.36, scale * 0.60);
    }

    private draw ()
    {
        this.drawRoad();
        const ordered = this.nodes.map(node => ({node, z: houseDepth(node.house, this.travel)}))
            .sort((a, b) => b.z - a.z);
        const ctx = this.canvasTexture?.context;
        if (ctx && this.canvasTexture)
        {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.canvasTexture.width, this.canvasTexture.height);
            ctx.scale(this.canvasTexture.width / this.view.width, this.canvasTexture.height / this.view.height);
        }
        for (const {node, z} of ordered)
        {
            const alpha = distanceFog(z);
            const farX = this.p(node.house.side * STREET.houseInner, 0, z + node.house.length).x;
            const visible = z + node.house.length > STREET.near && alpha > 0.001
                && (node.house.side === -1 ? farX > -200 : farX < this.view.width + 200);
            node.facade?.setVisible(visible);
            node.end?.setVisible(visible);
            node.details.clear().setVisible(visible);
            if (!visible) continue;
            const depth = 0.1 + (1 - z / FAR) * 0.7;
            if (ctx) this.drawCanvasHouse(ctx, node.house, z, alpha);
            else this.drawMesh(node, z, alpha, depth);
            this.drawTree(node, z, alpha, depth, ctx);
        }
        if (ctx) this.canvasTexture!.refresh();
    }

    private drawCanvasHouse (ctx: CanvasRenderingContext2D, house: StreetHouse, z: number, alpha: number)
    {
        ctx.globalAlpha = alpha;
        const image = this.scene.textures.get(FACADES[house.variant].key).getSourceImage() as HTMLImageElement;
        const start = visibleWallStart(house, z);
        for (let i = 0; i < STRIPS; i++)
        {
            const t1 = start + (1 - start) * i / STRIPS;
            const t2 = start + (1 - start) * (i + 1) / STRIPS;
            const [a, b] = this.wallPoints(house, z, t1), [c, d] = this.wallPoints(house, z, t2);
            const u1 = (house.side === -1 ? t1 : 1 - t1) * image.width;
            const u2 = (house.side === -1 ? t2 : 1 - t2) * image.width;
            this.triangle(ctx, image, [a, b, c], [[u1, 0], [u1, image.height], [u2, 0]]);
            this.triangle(ctx, image, [b, c, d], [[u1, image.height], [u2, 0], [u2, image.height]]);
        }
        if (z < STREET.near) return;
        const x1 = house.side * STREET.houseInner, x2 = house.side * (STREET.houseInner + STREET.houseWidth);
        const a = this.p(Math.min(x1, x2), house.height, z), b = this.p(Math.min(x1, x2), 0.11, z);
        const c = this.p(Math.max(x1, x2), house.height, z), d = this.p(Math.max(x1, x2), 0.11, z);
        this.triangle(ctx, image, [a, b, c], [[0, 0], [0, image.height], [image.width, 0]]);
        this.triangle(ctx, image, [b, c, d], [[0, image.height], [image.width, 0], [image.width, image.height]]);
    }

    private triangle (ctx: CanvasRenderingContext2D, image: HTMLImageElement, p: StreetPoint[], uv: number[][])
    {
        const [u0, v0] = uv[0], [u1, v1] = uv[1], [u2, v2] = uv[2];
        const det = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
        if (Math.abs(det) < 0.001) return;
        const coeff = (a: number, b: number, c: number) => [
            (a * (v1 - v2) + b * (v2 - v0) + c * (v0 - v1)) / det,
            (a * (u2 - u1) + b * (u0 - u2) + c * (u1 - u0)) / det,
            (a * (u1 * v2 - u2 * v1) + b * (u2 * v0 - u0 * v2) + c * (u0 * v1 - u1 * v0)) / det
        ];
        const x = coeff(p[0].x, p[1].x, p[2].x), y = coeff(p[0].y, p[1].y, p[2].y);
        ctx.save();
        ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); ctx.lineTo(p[1].x, p[1].y); ctx.lineTo(p[2].x, p[2].y);
        ctx.closePath(); ctx.clip();
        ctx.transform(x[0], y[0], x[1], y[1], x[2], y[2]); ctx.drawImage(image, 0, 0); ctx.restore();
    }

    destroy ()
    {
        if (this.destroyed) return;
        this.destroyed = true;
        this.sky.destroy(); this.city.destroy(); this.road.destroy();
        for (const node of this.nodes) { node.facade?.destroy(); node.end?.destroy(); node.details.destroy(); }
        this.nodes = [];
        this.canvasImage?.destroy();
        if (this.canvasKey) this.scene.textures.remove(this.canvasKey);
        this.canvasTexture = null;
    }
}
