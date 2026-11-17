import { GameObjects, Geom, Input, Scene } from 'phaser';
import { playSfx } from '../audio';
import { bindResize } from '../layout';
import { CROWN_FRAME } from '../letters';
import { rankAvatar } from '../rankAvatar';
import { WeeklyLeaderboard, type RankedEntry, type WeeklySnapshot } from '../weeklyLeaderboard';
import { bindPressBounce } from '../pressBounce';

export const WEEKLY_RANK_SCENE = 'WeeklyRanking';
type RankingData = { leaderboard: WeeklyLeaderboard; onClose: () => void; onChallenge: () => void };
type PointerEvent = { stopPropagation: () => void };
const W = 640;
const H = 920;
const INK = 0x34211d;
const FONT = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';

/** Original champion + 2x2 tiles layout, not the reference's five stacked reward rows. */
export class WeeklyRanking extends Scene
{
    private options: RankingData;
    private chosen = false;
    private shade: GameObjects.Rectangle;
    private root: GameObjects.Container;
    private board: GameObjects.Container;
    private weekLabel: GameObjects.Text;
    private countdown: GameObjects.Text;
    private snapshotValue: WeeklySnapshot;
    private revision = '';
    private closeButton: GameObjects.Container;
    private backButton: GameObjects.Container;
    private challengeButton: GameObjects.Container;

    constructor () { super(WEEKLY_RANK_SCENE); }

    init (data: RankingData)
    {
        this.options = data;
        this.chosen = false;
        this.revision = '';
    }

    create ()
    {
        this.shade = this.add.rectangle(0, 0, 1, 1, 0x172746, 0.7)
            .setOrigin(0).setInteractive().setData('ui', true);
        for (const event of [ 'pointerdown', 'pointerup' ])
        {
            this.shade.on(event, (_p: Input.Pointer, _x: number, _y: number, e: PointerEvent) => e.stopPropagation());
        }
        this.root = this.add.container(0, 0);
        const panel = this.add.graphics();
        panel.fillStyle(0x131725, 0.4).fillRoundedRect(-W / 2 + 8, -H / 2 + 10, W, H, 34);
        panel.fillStyle(0xfff5d9).fillRoundedRect(-W / 2, -H / 2, W, H, 34);
        panel.lineStyle(6, INK).strokeRoundedRect(-W / 2, -H / 2, W, H, 34);
        panel.fillStyle(0x3fbbff).fillRoundedRect(-W / 2 + 8, -H / 2 + 8, W - 16, 123, 28);
        panel.fillStyle(0x3fbbff).fillRect(-W / 2 + 8, -H / 2 + 60, W - 16, 71);
        panel.lineStyle(3, 0xffffff, 0.7).strokeRoundedRect(-W / 2 + 12, -H / 2 + 12, W - 24, H - 24, 27);
        this.root.add(panel);
        this.text(0, -409, '周排行榜', 49, '#ffeb50', true, 7);
        this.weekLabel = this.text(0, -352, '', 23, '#694a36', false);
        this.board = this.add.container(0, 0);
        this.root.add(this.board);
        this.countdown = this.text(0, 329, '', 20, '#8d765e', false);
        this.challengeButton = this.button(82, 396, 318, 72, '开始挑战', 0xffcc32, () => this.choose('challenge'));
        this.backButton = this.button(-189, 396, 176, 72, '关闭', 0xf0e0cf, () => this.choose('close'), 28);
        this.closeButton = this.add.container(275, -410).setSize(50, 50)
            .setInteractive(new Geom.Circle(25, 25, 25), Geom.Circle.Contains).setData('ui', true);
        const x = this.add.graphics();
        x.fillStyle(0xfff6db).fillCircle(0, 0, 22);
        x.lineStyle(3, INK).strokeCircle(0, 0, 22).lineBetween(-7, -7, 7, 7).lineBetween(7, -7, -7, 7);
        this.closeButton.add(x);
        this.root.add(this.closeButton);
        bindPressBounce(this.closeButton, () => this.choose('close'), () => !this.chosen);
        this.refreshBoard();
        this.layout();
        bindResize(this, () => this.layout());
        this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshBoard() });
        this.input.keyboard?.on('keydown-ESC', this.onEscape, this);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', this.onEscape, this));
    }

    private text (x: number, y: number, value: string, size: number, color: string, bold = true, outline = 0, parent = this.root)
    {
        const label = this.add.text(x, y, value, {
            fontFamily: FONT, fontSize: size, fontStyle: bold ? 'bold' : 'normal', color,
            align: 'center', stroke: '#34211d', strokeThickness: outline
        }).setOrigin(0.5);
        parent.add(label);
        return label;
    }

    private fit (text: GameObjects.Text, width: number)
    {
        if (text.width > width) text.setScale(width / text.width);
    }

    private refreshBoard ()
    {
        const snapshot = this.options.leaderboard.snapshot();
        this.snapshotValue = snapshot;
        this.weekLabel.setText(`${snapshot.dateLabel}  ·  每周一刷新`);
        const minutes = Math.max(0, Math.ceil((snapshot.end - Date.now()) / 60000));
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor(minutes % 1440 / 60);
        const mins = minutes % 60;
        this.countdown.setText(`本地模拟榜  ·  ${days ? `${days}天${hours}小时` : `${hours}小时${mins}分`}后换周`);
        const revision = JSON.stringify([ snapshot.weekKey, snapshot.selfBest, snapshot.topFive ]);
        if (revision === this.revision) return;
        this.revision = revision;
        this.board.removeAll(true);
        snapshot.topFive.forEach((entry, index) => index === 0 ? this.champion(entry) : this.tile(entry, index - 1));
        this.personal(snapshot);
    }

    private card (x: number, y: number, width: number, height: number, color: number)
    {
        const root = this.add.container(x, y);
        const art = this.add.graphics();
        art.fillStyle(0x493226, 0.18).fillRoundedRect(-width / 2 + 3, -height / 2 + 5, width, height, 20);
        art.fillStyle(color).fillRoundedRect(-width / 2, -height / 2, width, height, 20);
        art.lineStyle(4, INK).strokeRoundedRect(-width / 2, -height / 2, width, height, 20);
        art.lineStyle(2, 0xffffff, 0.75).strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 15);
        root.add(art);
        this.board.add(root);
        return root;
    }

    private champion (entry: RankedEntry)
    {
        const root = this.card(0, -233, 574, 174, entry.isSelf ? 0xa9deff : 0xffe87b);
        const avatar = rankAvatar(this, entry.avatar).setPosition(-174, 2).setScale(1.22);
        root.add(avatar);
        this.text(-238, -59, '1', 25, '#6c3918', true, 0, root);
        this.text(85, -60, entry.isSelf ? '我 · 本周领跑' : '本周领跑骑手', 22, '#9a6324', true, 0, root);
        const name = this.text(50, -11, entry.name, 35, '#3e291c', true, 0, root);
        const score = this.text(51, 39, `${entry.meters} 米`, 47, '#ffffff', true, 5, root);
        this.fit(name, 238);
        this.fit(score, 260);
        // Same slot as the old drawn trophy: about 50×47, sitting on the right of the champion card.
        const crown = this.add.image(231, 13, 'letters', CROWN_FRAME).setOrigin(0.5);
        const crownH = 50;
        crown.setDisplaySize(crownH * crown.width / crown.height, crownH);
        root.add(crown);
    }

    private tile (entry: RankedEntry, index: number)
    {
        const x = index % 2 === 0 ? -149 : 149;
        const y = index < 2 ? -65 : 88;
        const colors = [ 0xe9f0f6, 0xffdfba, 0xfff4de, 0xfff4de ];
        const root = this.card(x, y, 278, 132, entry.isSelf ? 0xb7e7ff : colors[index]);
        root.add(rankAvatar(this, entry.avatar).setPosition(-80, 9).setScale(0.67));
        const medal = this.add.circle(-111, -43, 18, entry.isSelf ? 0x398eff : 0xffd565).setStrokeStyle(3, INK);
        root.add(medal);
        this.text(-111, -43, String(entry.rank), 22, entry.isSelf ? '#ffffff' : '#674223', true, 0, root);
        const name = this.text(40, -21, entry.isSelf ? '我' : entry.name, 29, entry.isSelf ? '#145ca4' : '#533324', true, 0, root);
        const score = this.text(41, 27, `${entry.meters} 米`, 33, '#ffffff', true, 4, root);
        this.fit(name, 153);
        this.fit(score, 160);
    }

    private personal (snapshot: WeeklySnapshot)
    {
        const root = this.card(0, 244, 574, 110, 0xd5edff);
        root.add(rankAvatar(this, 5).setPosition(-236, 0).setScale(0.7));
        this.text(-125, -29, '我的本周最佳', 22, '#286398', false, 0, root);
        const best = this.text(-90, 9, snapshot.selfBest ? `${snapshot.selfBest} 米` : '暂无成绩', 32, '#175aa0', true, 0, root);
        this.fit(best, 192);
        const rank = snapshot.selfRank !== null && snapshot.selfRank <= 5 ? `第 ${snapshot.selfRank} 名` : '暂未上榜';
        this.text(166, -21, rank, 30, '#2a6197', true, 0, root);
        const hint = snapshot.selfRank === 1 ? '本周继续领跑！'
            : snapshot.selfRank !== null && snapshot.selfRank <= 5 ? `再提升 ${snapshot.gapToNext} 米升一名`
                : `再跳 ${snapshot.gapToTopFive} 米进前五`;
        const message = this.text(93, 26, hint, 22, '#5b829f', false, 0, root);
        this.fit(message, 330);
    }

    private button (x: number, y: number, width: number, height: number, value: string, color: number, action: () => void, fontSize = 33)
    {
        const node = this.add.container(x, y).setSize(width, height)
            .setInteractive(new Geom.Rectangle(0, 0, width, height), Geom.Rectangle.Contains).setData('ui', true);
        const art = this.add.graphics();
        art.fillStyle(0x674332, 0.2).fillRoundedRect(-width / 2 + 2, -height / 2 + 5, width, height, 18);
        art.fillStyle(color).fillRoundedRect(-width / 2, -height / 2, width, height, 18);
        art.lineStyle(4, INK).strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
        art.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10, 13);
        node.add(art);
        this.text(0, 0, value, fontSize, '#55321e', true, 0, node);
        this.root.add(node);
        bindPressBounce(node, action, () => !this.chosen);
        return node;
    }

    private onEscape () { this.choose('close'); }

    private choose (action: 'close' | 'challenge')
    {
        if (this.chosen) return;
        this.chosen = true;
        playSfx(this, 'ui');
        const callback = action === 'close' ? this.options.onClose : this.options.onChallenge;
        this.scene.stop();
        callback();
    }

    private buttonBounds (node: GameObjects.Container)
    {
        const point = node.getWorldTransformMatrix().transformPoint(-node.width / 2, -node.height / 2);
        return new Geom.Rectangle(point.x, point.y, node.width * this.root.scaleX, node.height * this.root.scaleY);
    }

    status ()
    {
        return {
            ...this.snapshotValue, active: this.scene.isActive(), chosen: this.chosen,
            bounds: new Geom.Rectangle(this.root.x - W * this.root.scaleX / 2, this.root.y - H * this.root.scaleY / 2, W * this.root.scaleX, H * this.root.scaleY),
            closeBounds: this.buttonBounds(this.closeButton), backBounds: this.buttonBounds(this.backButton),
            challengeBounds: this.buttonBounds(this.challengeButton),
            layout: 'champion-plus-four-tiles-and-self', mockData: true
        };
    }

    private layout ()
    {
        const { width, height } = this.scale;
        this.shade.setSize(width, height);
        (this.shade.input!.hitArea as Geom.Rectangle).setTo(0, 0, width, height);
        this.root.setPosition(width / 2, height / 2).setScale(Math.max(0.1, Math.min(1.12, (width - 32) / W, (height - 32) / (H + 12))));
    }
}
