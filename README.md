# freeWar

**le'o 设计的塔防式小游戏** —— 现代战争题材，攒金币放置单位，单位自动战斗。

## 🎮 在线试玩

<https://kevin-huikk.github.io/freeWar/>

（任何浏览器打开即玩，手机 / 平板 / 电脑都行）

## 玩法

1. 冰山界面选择难度（MVP 只开放**希望层**，其他 8 层待解锁）
2. 进入关卡后，右侧菜单选择要放置的单位
3. 在地图空格（非敌人路径、非已占用）上点击放置
4. 每秒自动获得金币，击杀敌人获得赏金
5. **撑过 5 波 = 胜利**；**基地血量归零 = 失败**
6. 胜/负后点击"返回冰山"重玩

## MVP 包含的单位（5 种）

| 单位 | 价格 | 射程 | 伤害 | 射速 |
|---|---|---|---|---|
| 民兵 | $10 | 2 | 5 | 1.0/s |
| 弓箭手 | $15 | 3 | 8 | 1.2/s |
| 步枪兵 | $40 | 3 | 15 | 1.5/s |
| 狙击手 | $100 | 6 | 60 | 0.5/s |
| 装甲车 | $500 | 4 | 40 | 2.0/s |

完整 45 种单位的清单在项目规划文档里，会逐步加入。

## 运行

游戏用了 ES Modules + `fetch` 加载 JSON，**不能直接双击** `index.html`，必须通过本地服务器：

```bash
# 方法一：Python（macOS 自带）
python3 -m http.server 8000

# 方法二：npx（需要 Node）
npx serve .
```

然后在浏览器打开 <http://localhost:8000>。

## 运行测试

```bash
npm install
npm test
```

测试覆盖纯逻辑部分：

- `tests/wave.test.js` — 波次调度器
- `tests/economy.test.js` — 金币经济
- `tests/combat.test.js` — 瞄准与伤害

渲染、输入等交给手动试玩验证。

## 项目结构

```
index.html          入口
css/style.css       样式（冰山 UI + 关卡布局）
js/
  main.js           启动 + 主循环 + 场景切换
  scene.js          场景状态机
  map.js            地图网格 + 路径
  wave.js           波次调度器
  enemy.js          敌人
  unit.js           己方单位
  projectile.js     投射物
  combat.js         瞄准 / 伤害（纯函数）
  economy.js        金币经济
  input.js          鼠标 + 菜单 UI
  ui.js             预留
data/
  levels.json       关卡与波次定义
  enemies.json      敌人模板
  units.json        己方单位模板
tests/              Vitest 单测
```

## 下一步（Post-MVP）

按原计划逐步加入：

1. 把 `data/units.json` 扩到 10 → 20 → 45 个单位（按 le'o 手稿）
2. 扩展 `data/levels.json` 出第 2~9 层
3. 替换色块占位图为真实贴图
4. 加音效 / BGM
5. `localStorage` 存档：已解锁到第几层
6. 决定建筑物系统是否加入（待 le'o 确认）
7. 核武器作为"大招道具"（充能条 / 冷却）

## 设计资料

两张 le'o 的手稿（兵种价目表 + 冰山图）建议拍照/扫描后放到 `assets/design/`，作为迭代参考。
