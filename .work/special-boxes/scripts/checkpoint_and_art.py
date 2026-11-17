from pathlib import Path
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'src/game/checkpoints.ts'
s=p.read_text(encoding='utf-8')
a=s.index('    /** Always place the next fixed metre milestone')
b=s.index('    beginJump ()',a)
s=s[:a]+'''    /** Always place the next fixed metre milestone, including at the start of a run. */
    prepare (meters: number, x: number, surfaceY: number, playerHeight: number, jumpHeight: number, boxHeight: number)
    {
        const distance = checkpointDistance(this.progress.nextMeters - meters, jumpHeight, boxHeight);
        this.placeGoal(x, surfaceY - playerHeight - distance);
    }

    /** Project a milestone crossed by an automatic ten-box leap into that actual flight. */
    prepareLeap (meters: number, bonus: number, x: number, surfaceY: number, playerHeight: number, boostHeight: number)
    {
        const remaining = this.progress.nextMeters - meters;
        if (remaining > bonus) return;
        const fraction = Math.min(1, Math.max(0, remaining / bonus));
        const distance = Math.max(boostHeight * 0.12, boostHeight * 0.85 * fraction);
        this.placeGoal(x, surfaceY - playerHeight - distance);
    }

    private placeGoal (x: number, y: number)
    {
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
                this.scene.tweens.add({ targets: this.gate.root, y, duration: 260, ease: 'Sine.Out' });
            }
        }
        this.layout();
    }

'''+s[b:]
p.write_text(s,encoding='utf-8')
p=root/'.work/special-boxes/scripts/make_special_assets.py'
s=p.read_text(encoding='utf-8').replace('colorsys.hls_to_rgb(hue,l,s)','colorsys.hls_to_rgb(hue,l*0.96,min(s,0.87))')
s=s.replace('    im=im.resize((256*S,192*S),Image.Resampling.LANCZOS)\n    d=ImageDraw.Draw(im)', '''    body_fill=im.getpixel((70,110))
    im=im.resize((256*S,192*S),Image.Resampling.LANCZOS)
    d=ImageDraw.Draw(im)
    d.rectangle((73*S,79*S,195*S,154*S),fill=body_fill)''')
p.write_text(s,encoding='utf-8')
p=root/'src/game/itemEffects.ts'
s=p.read_text(encoding='utf-8').replace("`+${amount} 金币${perfect ? ' ×2' : ''}`", "perfect ? `完美 ×2\\n+${amount} 金币` : `+${amount} 金币`")
p.write_text(s,encoding='utf-8')
