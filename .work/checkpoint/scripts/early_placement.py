from pathlib import Path
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'src/game/checkpointProgress.ts'
s=p.read_text(encoding='utf-8')
s=s.replace('''    isApproaching (meters: number, possibleGain: number)
    {
        return meters < this.next && meters + possibleGain >= this.next;
    }

''','')
s += '''
/** Project a fixed score-space milestone into the game's world-space stack.
 * Far targets start above the viewport; the final five metres fit one full hop.
 * This is continuous at the boundary, even though perfect lands award 1–5m.
 */
export function checkpointDistance (remainingMeters: number, jumpHeight: number, boxHeight: number)
{
    const remaining = Math.max(0, remainingMeters);
    const near = Math.min(5, remaining);
    const far = Math.max(0, remaining - 5);

    return jumpHeight * (0.65 + near * 0.06) + far * boxHeight * 0.25;
}
'''
p.write_text(s,encoding='utf-8')
p=root/'src/game/checkpoints.ts'
s=p.read_text(encoding='utf-8').replace("import { CheckpointProgress } from './checkpointProgress';", "import { CheckpointProgress, checkpointDistance } from './checkpointProgress';")
s=s.replace('    viewportKey: string;','    viewportKey: string;\n    targetY: number;')
a=s.index('    /** Prepare the goal before the jump that can reach this score milestone. */')
b=s.index('    beginJump ()',a)
s=s[:a]+'''    /** Always place the next fixed metre milestone, including at the start of a run. */
    prepare (meters: number, x: number, surfaceY: number, playerHeight: number, jumpHeight: number, boxHeight: number)
    {
        const distance = checkpointDistance(this.progress.nextMeters - meters, jumpHeight, boxHeight);
        const y = surfaceY - playerHeight - distance;

        if (!this.gate)
        {
            this.gate = this.createGate(this.progress.nextMeters);
            this.gate.root.setPosition(x, y);
            this.gate.targetY = y;
        }
        else
        {
            this.gate.root.x = x;
            if (Math.abs(this.gate.targetY - y) > 0.01)
            {
                this.gate.targetY = y;
                this.scene.tweens.killTweensOf(this.gate.root);
                // Scores and physical box heights differ. Reproject continuously instead of
                // teleporting the goal or toggling its visibility near the milestone.
                this.scene.tweens.add({ targets: this.gate.root, y, duration: 260, ease: 'Sine.Out' });
            }
        }
        this.layout();
    }

'''+s[b:]
s=s.replace('            label: this.gate?.meters ?? null,','''            label: this.gate?.meters ?? null,
            worldY: this.gate?.root.y ?? null,
            targetWorldY: this.gate?.targetY ?? null,
            screenY: this.gate ? this.gate.root.y - this.scene.cameras.main.scrollY : null,
            onScreen: this.gate ? this.gate.root.y + BAG_HEIGHT > this.scene.cameras.main.scrollY
                && this.gate.root.y - 32 < this.scene.cameras.main.scrollY + this.scene.scale.height : false,''')
s=s.replace("const gate = { root, rope, bag, image, meters, viewportKey: '' };", "const gate = { root, rope, bag, image, meters, viewportKey: '', targetY: 0 };")
p.write_text(s,encoding='utf-8')
p=root/'src/game/scenes/Game.ts'
s=p.read_text(encoding='utf-8')
a=s.index('    /** A centred support can earn the next perfect bonus; otherwise the next land is 1m. */')
b=s.index('    /** Keeps the board under',a)
s=s[:a]+'''    /** The next checkpoint is present from the start, projected from its fixed metre value. */
    private prepareCheckpoint ()
    {
        this.checkpoints.prepare(
            this.meters(), this.anchorX, this.top(this.body(this.support)),
            PLAYER_H, BOX_VISUAL_H * this.jumpBoxes, BOX_VISUAL_H
        );
    }

'''+s[b:]
p.write_text(s,encoding='utf-8')
p=root/'TODO.md'
s=p.read_text(encoding='utf-8')
s += '\n- [ ] checkpoint 从开局即预置在场景上方，角色越跳越接近；取消临近米数才创建和显示，位置更新平滑，不突然跳位；通过后提前预置下一处。\n'
p.write_text(s,encoding='utf-8')
