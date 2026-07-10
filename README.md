# WordRogue-Jr · 词汇探险

**为小学生设计的网页版背单词 Roguelike 游戏(WASD 移动 + 鼠标发射)。**

- 📚 **词库**:粤教粤人版 4-6 年级(后续从 PDF 提取完整词表)
- 🎮 **玩法**:顶视角射击,鼠标瞄准,词块发射消灭怪物
- 👫 **多用户**:同台电脑两个孩子各开自己的账户
- 💾 **存档**:localStorage + 可导出 JSON 备份
- 📱 **跨平台**:macOS Safari / iPad Safari / Android Chrome 全支持

## 试玩地址

👉 **https://jimmywuxin.github.io/wordrogue-jr/** (GitHub Pages,公网部署,任何设备都能开)

## 快速开始

```bash
# 直接用浏览器打开
open index.html

# 或起个本地服务器(更稳)
python3 -m http.server 8000
# 然后浏览器开 http://localhost:8000
```

## 操作

| 操作 | 按键 |
|---|---|
| 移动 | WASD / 方向键 |
| 瞄准 | 鼠标 |
| 选词 / 拼词 | 鼠标点击选项 / 输入字母回车 |
| 跳过 | 「跳过」按钮 |
| 全屏 | F11 |

iPad 触屏:点击屏幕对应位置即可瞄准,顶部按钮选词。

## 项目结构

```
wordrogue-jr/
├── index.html                # 入口
├── src/
│   ├── main.js              # 启动
│   ├── engine/
│   │   ├── game.js          # Canvas 游戏主循环
│   │   └── input.js         # WASD/鼠标/触屏
│   ├── data/words.js        # 词汇表 + 关卡定义
│   ├── ui/
│   │   ├── menu.js          # 选人界面
│   │   ├── level.js         # 选关卡界面
│   │   ├── game.js          # 游戏屏协调
│   │   ├── review.js        # 错词复习
│   │   ├── modals.js        # 弹窗
│   │   └── style.css        # 像素风样式
│   └── save/storage.js      # localStorage 存档
├── textbook/                 # 课本 PDF(本地)
└── docs/CHANGELOG.md         # 开发日志
```

## 玩法说明

1. 进入游戏,选人或新建一个角色
2. 选择关卡(每关对应课本一个单元)
3. 屏幕上的"怪物"身上显示英文单词 + emoji 图
4. 看你顶部的"当前目标"(中文释义 + 图片)
5. 选择模式:
   - **看图选词**(4 年级):点击屏幕底部的 4 个英文单词按钮
   - **拼词模式**(5-6 年级):输入对应英文,回车发射
6. 打中对的怪物 = 怪物消失 + 加分;打错 = 掉 1 血 + 加入错词本

## 开发计划

- **v0.1** ✅ 项目骨架 + 基础玩法 + 多用户
- **v0.2** 真实词库补全 + PNG 图片替换 emoji
- **v0.3** 8 个主题地图 + 怪物种类扩展
- **v0.4** 错词复习强化 + 家长观测后台
- **v0.5** iPad 触屏完整适配
- **v0.9** 跨浏览器 / 跨设备测试 + 性能优化
- **v1.0** 部署 + 给孩子试玩

## 致谢

- `vocab-roguelike` 项目原型的启示
- TapXWorld/ChinaTextbook 提供教材 PDF 源
