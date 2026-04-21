# freeWar

le'o 设计的塔防式小游戏。

## 玩法

1. 在冰山界面选择难度（MVP 只开放"希望层"）
2. 在地图空格上放置己方单位（右侧菜单选择）
3. 单位自动攻击路径上的敌人
4. 撑过 5 波 = 胜利；基地血量归零 = 失败

## 运行

因为项目使用 ES Modules + `fetch` 加载数据，需要本地服务器（不能直接双击 `index.html`）：

```bash
# 任选一种
npx serve .
# 或
python3 -m http.server 8000
```

然后在浏览器打开 `http://localhost:8000`（或 npx serve 提示的地址）。

## 测试

```bash
npm install
npm test
```
