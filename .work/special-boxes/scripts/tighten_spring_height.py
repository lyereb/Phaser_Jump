from pathlib import Path
import math
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'src/game/springFlight.ts';s=p.read_text(encoding='utf-8').replace('SPRING_HEIGHT_BOXES = 11','SPRING_HEIGHT_BOXES = 10');p.write_text(s,encoding='utf-8')
h=883.2;g=2*h/.95**2;speed=g*.95;t=(speed+math.sqrt(speed*speed-2*g*742.4))/g
p=root/'.work/special-boxes/scripts/test_spring.cjs';s=p.read_text(encoding='utf-8').replace('971.52','883.2').replace('1.41135','1.32931').replace('1.411348627',repr(t));p.write_text(s,encoding='utf-8')
p=root/'.work/special-boxes/validation.html';s=p.read_text(encoding='utf-8').replace("highest>950&&highest<990,'应跳约11个视觉盒高'", "highest>860&&highest<905,'应跳约10个视觉盒高'");p.write_text(s,encoding='utf-8')
print('Spring height:',h,'Landing time:',t)
