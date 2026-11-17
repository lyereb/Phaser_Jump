from pathlib import Path
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'src/game/checkpoints.ts'
s=p.read_text(encoding='utf-8').replace('const frame = texture.get();', "const frame = texture.get('__BASE');").replace("scene.add.image(0, BAG_TOP, BAG)", "scene.add.image(0, BAG_TOP, BAG, '__BASE')").replace("const frame = scene.textures.get(BAG).get();", "const frame = scene.textures.get(BAG).get('__BASE');")
p.write_text(s,encoding='utf-8')
p=root/'.work/checkpoint/validation.html'
s=p.read_text(encoding='utf-8')
s=s.replace('  const g=await reset();\n  report({meters:', '  const g=await reset();\n  g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));\n  report({meters:',1)
s=s.replace("const g=await reset();jump(g);simulateJump(g);", "const g=await reset();check(g.checkpoints.gate.image.frame.name==='__BASE','完整袋子不能使用半张裂开帧');jump(g);simulateJump(g);",1)
p.write_text(s,encoding='utf-8')
