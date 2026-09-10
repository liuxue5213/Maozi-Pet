# 竞品分析（追加式日志）

## 2026-09-10 08:45 扫描（日间周期：任务化习惯赛道）

| 竞品/共识 | 核心做法 | 对本项目的启示（R25 已落地） |
|------|---------|--------------|
| **Habitica**（Google Play） | 习惯/待办直变 RPG 任务：完成得经验金币，角色升级；ADHD 社区常推荐 | 现实行为（习惯打卡）接入任务系统是对标核心——`habit1` 任务把 Finch 式习惯闭环与 Pou 式任务奖励焊在一起 |
| **Finch Journeys/Quests**（Slate 2026-09 评测 / r/finch） | 温和游戏化：Goal Ideas→Journey→Quest 分层，每日任务轻量不焦虑 | 任务奖励保持微量（+10），文案延续无压力框架；不做 Habitica 式「失败扣血」惩罚 |
| **Duolingo daily quest**（行业共识源头） | 每日任务=XP 目标+挑战，是习惯 App 任务化的原型 | `rps3`/`visit1` 把 App 内互动也纳入任务面，形成「现实行为+社交行为+ App 互动」三层日任务闭环 |

来源：[Google Play-Habitica](https://play.google.com/store/apps/details?id=com.habitrpg.android.habitica)、[Slate-Finch 评测](https://slate.com/technology/2026/09/finch-app-self-care-wellness-review.html)、[r/finch-Quest 系统](https://www.reddit.com/r/finch/comments/1epa6hg/things_you_should_know_about_finch_app/)、[NerdSIP-习惯 App 对比](https://nerdsip.com/blog/best-apps-to-build-good-habits)、[habi.app-Finch 替代品](https://habi.app/insights/finch-alternatives/)

## 2026-09-10 08:40 扫描（日间周期 08 点轮：streak 冻结券机制细节）

| 竞品/共识 | 核心做法 | 对本项目的启示（R23 已落地） |
|------|---------|--------------|
| **Duolingo streak freeze**（官方 Shop/Digia UX 拆解） | 冻结券是「防断第一道防线」：**上限持有 2 张**，漏打日自动生效保住 streak；商店用宝石购买 | 我们的 MAX_FREEZES=2 与其上限一致；获取走里程碑（7/14/21 天 +1）而非付费——反焦虑定位下不把「保护」做成付费焦虑 |
| **Duolingo streak repair/resurrect**（Android Police） | 限时活动让断签用户付费复活最长 streak | 断签修复是后续候选（R25+），先做事前保护（冻结券）再做事后修复 |
| **No Freeze February 社区反噬**（r/duolingo） | 部分用户觉得冻结券让 streak「变便宜」，发起不用券挑战 | 印证保护需克制：我们规定**连漏两天不桥接**（保护 ≠ 无限豁免）、桥接日必须直接接回真实打卡记录，streak 含金量不被稀释 |

来源：[Digia-Duolingo 习惯提醒 UX 拆解](https://www.digia.tech/post/duolingo-habit-forming-reminders-retention-architecture)、[Medium-Duolingo streak 系统设计拆解](https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f)、[UX Collective-更健康的 streak 设计](https://uxdesign.cc/3-reframing-streaks-on-duolingo-5-ideas-for-a-more-healthy-and-flexible-approach-to-language-8fd89545771e)、[Android Police-streak 复活](https://www.androidpolice.com/lost-a-big-duolingo-streak-you-can-get-it-back-all-this-month/)、[r/duolingo-No Freeze February](https://www.reddit.com/r/duolingo/comments/1qsqj88/no_freeze_february/)

## 2026-09-10 08:00 扫描（日间周期：定位文案/商店页赛道）

| 竞品 | 核心做法 | 对本项目的启示 |
|------|---------|--------------|
| **Finch**（App Store 编辑精选） | 商店页一句话定位 =「Take care of your pet by taking care of yourself」互惠照顾框架；广告投放瞄准抑郁症/日常失序人群的「低压力陪伴」而非效率工具 | README 定位语采纳互惠框架；我们已有的习惯→宠物成长闭环正是这套叙事的产品化，文案要跟上实现 |
| **Finch 商业验证**（sparrowapps 复盘） | $30M ARR 零融资；ADHD/心理健康社区口碑自传播（r/adhdwomen：宠物机制是他们能坚持的唯一原因） | 「无压力」不是营销话术而是留存机制——R20 断签文案走查方向正确，后续 streak 冻结券延续 |
| **self-care pet 品类**（aidorable） | 「照顾虚拟宠物=完成自我微行动」成为独立品类 | 帽子AI宠物的习惯打卡+里程碑已站进该品类；商店页素材（海报导出）可按此叙事组织 |

来源：[foxdata-Finch 编辑精选拆解](https://foxdata.com/en/blogs/finch-as-app-store-editors-choice-a-self-care-companion/)、[sparrowapps-Finch $30M ARR 复盘](https://blog.sparrowapps.io/p/finch-how-a-self-care-app-hit-30m-arr-without-vc-money)、[motion-Finch 投放素材库](https://motionapp.com/library/brands/finch)、[aidorable-self-care pet 品类](https://www.aidorable.ai/blog/self-care-pet-app)

## 2026-09-10 08:00 扫描（日间周期 08 点轮：推送/提醒赛道）

| 竞品/共识 | 核心做法 | 对本项目的启示 |
|------|---------|--------------|
| **行为触发推送**（AppBot 2026 / OneSignal） | 按用户行为状态触发，而非固定时刻；非紧急消息延后到用户可能的空闲档 | R19 采用：18-22 点碎片档 + 「今日未打才提醒」，不做无差别定时轰炸 |
| **Duolingo streak 机制**（trophy.so 10 例拆解 / 官方文档） | streak freeze 提前购买/成就兑换、streak repair 补救、Streak Society（100 天俱乐部）身份荣耀 | 🔴 「streak 冻结券」是新候选功能：宽宥机制保护付费/高价值用户的长期积累，与「无压力」定位兼容（防断签焦虑而非制造） |
| **AI 预测发送时刻**（Chela / Reclaim / yougot） | 机器学习按个人历史选最优推送时刻 | 我们无用户行为数据积累，先用启发式窗口；等推送 open 数据攒起来再做个性化时刻 |
| **习惯 App 90 天实测**（habi.app） | 多数习惯应用第 2 周被弃 | 提醒+streak 保护正是第 2 周流失的对症药；我们的宠物情感绑定是差异化护城河 |

来源：[AppBot-2026 推送最佳实践](https://appbot.co/blog/app-push-notifications-2026-best-practices/)、[OneSignal-推送 8 条军规](https://onesignal.com/blog/onesignal-guide-push-notification-best-practices-2026/)、[trophy.so-streak 玩法 10 例](https://trophy.so/blog/streaks-feature-gamification-examples)、[Duolingo-streak 官方说明](https://www.duolingo.com/help/what-is-a-streak)、[Chela-AI 习惯提醒](https://chela.io/blog/ai-reminder-app-habits.html)、[habi.app-6 款实测](https://habi.app/insights/best-habit-tracker-apps/)

## 2026-09-10 06:00 收官轮扫描（第二夜终轮）

**习惯打卡赛道垂直竞品 + 2026 行业趋势**：

| 竞品/趋势 | 核心做法 | 对本项目的启示 |
|------|---------|--------------|
| **Habit-chi**（Google Play） | 20+ 只动画宠物**随打卡进度真实进化**，streak 驱动宠物演变 | 🔴 我们的 streak 只是数字外显——「连续 3/7/21 天 → 宠物真实成长（经验/专属颜值/徽章）」是习惯系统的下一块拼图 |
| **Pawbit**（App Store） | 完成目标养虚拟宠物 + Streak 特性 | 同上，验证「streak→宠物进化」是品类标配 |
| **AI 特性渗透 58%**（habit-streak 2026 报告） | 新上线习惯应用过半带 AI：预测性习惯建议 + 按用户行为自适应的动态提醒 | 可复用既有 push 基建：按打卡历史生成个性化提醒文案（「小猫等你喝水等了 3 天」） |
| **「无 streak 压力」设计思潮**（habi.app 测评） | 反焦虑：断签不清零/不惩罚，宠物「想念而非责备」 | 我们的断签仅重置计数（streak=1 可重来）已相对温和；需走查确认断签文案无惩罚语气 |
| **Pengu 崛起要素**（Liftoff 拆解） | streak + 进度系统 + 社交三件套 | 习惯数据可入社交外显（帖子/串门展示好友 streak），与既有 frame 外显同构 |

**下一夜立项结论**：① 习惯 streak 里程碑→宠物成长绑定（经验/限定颜值/徽章三选或并行）；② AI 个性化打卡提醒（复用 push 基建 + 习惯历史）；③ APK 构建交付为第一优先——两夜 17 轮功能全部待下个构建才能真机生效，构建/真机验证是最大交付风险。

来源：[Aidorable-虚拟宠物自我关怀指南](https://www.aidorable.ai/blog/virtual-pet-self-care-app)、[Habit-chi](https://play.google.com/store/apps/details?id=com.nondev777.habitchi&hl=en)、[Pawbit](https://apps.apple.com/no/app/pawbit-habit-tracker/id6753361788)、[2026 习惯追踪行业报告](https://habit-streak.com/en/blog/habit-tracking/state-of-habit-tracking-2026)、[Liftoff-Learna 与 Pengu 增长拆解](https://liftoff.ai/blog/apps-and-trends-to-watch-engagement-strategies-fueling-learna-and-pengus-rise/)、[habi.app-无压力设计测评](https://habi.app/insights/best-habit-tracker-apps/)

## 2026-09-10 第 15 轮扫描（05:05，会话D）

**2026 年 8-9 月新竞品情报**：

| 竞品/数据 | 核心做法 | 对本项目的启示 |
|------|---------|--------------|
| **OtterLife** | AI 健康管理 + 海獭养成：现实健康习惯游戏化为宠物成长，「21 天习惯理论」设计 30 天留存目标；上线一年用户破百万 | 🔴 **现实习惯→宠物成长绑定**是我们最大未覆盖方向（已有每日任务但全是 App 内动作） |
| **BitePal** | AI 食物识别 + 虚拟「减肥搭子」，宠物随用户健康行为成长；2026-01 月流水 $176.6 万（美国占 46%） | 工具型养成的付费验证——绑定现实行为的宠物有真金白银的商业化力 |
| **Friends/Pengu** | 共养（Co-pet）+ AI 宠物伙伴 Bao/Mellow；D1 留存 80%+、7 日近 60%、下载 2261 万 | 共养是留存最强设计（我们只有单向串门，重功能暂缓）；AI 伙伴补充单人场景可参考 |
| **Finch** | D1 留存近 60%（订阅类顶级） | 印证「自我关怀任务→宠物成长」：用户为宠物照顾自己 |
| **QQ宠物 AI 版** | 混元 Hy3 四型灵魂人格（小太阳/粘人精/淘气包/小戏精） | 我们有 5 型性格但外显弱（仅 RPS 台词+海报语录），人格一致性可加强 |
| **市场规模** | AI 虚拟宠物 $28 亿(2025)→$147 亿(2034)，CAGR 20.2% | 赛道确认高增长，聚焦差异化不追大厂共养/硬件 |

**结论（第 16 轮立项）**：**习惯打卡系统**——用户自定义现实习惯（喝水/早睡/运动等）每日打卡 → 宠物 +心情/经验/低额金币；连续打卡 streak 外显（宠物状态加成）。对标 Finch/OtterLife/BitePal 三家共同验证的「工具型养成」，把留存钩从「宠物依赖你」升级为「你和宠物互相成就」。轻实现：新表 + 4 个 API + 首页卡片，无 AI 依赖。

来源：[App Store-Friends](https://apps.apple.com/us/app/friends-pengu-bao-mellow/id6462927800)、[钛媒体-Friends 留存](https://www.tmtpost.com/7161536.html)、[智源社区-OtterLife](https://hub.baai.ac.cn/view/50016)、[虎嗅-BitePal](https://www.huxiu.com/article/4832185.html)、[腾讯新闻-小火人/Friends 数据](https://news.qq.com/rain/a/20251229A04PDE00)、[东方财富-QQ宠物 AI](https://wap.eastmoney.com/a/202607273822243584.html)、[aidorable-2026 榜单](https://www.aidorable.ai/blog/tamagotchi-virtual-pet-apps)

## 2026-08-27 Run 1

**市场格局**（2025 全球虚拟宠物 App 市场 4.31 亿美元，三类玩家）：

| 类型 | 代表 | 核心武器 | 与本项目差距 |
|------|------|---------|------------|
| AI 对话驱动型 | 我的绿洲（GPT-3+强化学习）、iMoochi/Hopami | 宠物随养育方式形成独一无二个性、对话不可预测 | 🔴 **无记忆机制**：AI 每次对话都是白纸，prompt 声称"记住偏好"但实际不成立 |
| 传统养成+AR 型 | Tamadog、拓麻歌子 | 喂养/训练/**小游戏**/AR 实景 | 🟡 互动只有 5 个按钮，无任何实际玩法 |
| 硬件实体型 | 天猫精灵、AI 宠物机 | 软硬结合，儿童/老人陪伴 | 不构成直接竞争 |

**行业共识**（孤独经济）：核心竞争力 = 养成体验 + 个性化 + 可爱外观。"不死、无负担"是我们的定位优势（36氪：电子宠物=养宠平替）。

**差距优先级（今晚 7 轮的作战地图）**：
1. 🔴 **AI 记忆系统**（本轮）——记住用户昵称/喜好/叮嘱，注入人设；对标"我的绿洲"个性化
2. 🟡 每日任务系统（留存闭环：任务→奖励→商城消费）
3. 🟡 推送召回（宠物饿了/心情低落时推送，Expo Push）
4. ⚪ 互动小游戏（猜拳/捡球等轻量玩法）
5. ⚪ 成就徽章 + AI 情绪状态外显（对话语气随属性变化）

来源：[36氪-电子宠物大爆发](https://m.36kr.com/p/3214106962037638)、[CBNData-大厂挤爆AI宠物赛道](https://www.cbndata.com/information/295578)、[机核-我的绿洲](https://www.gcores.com/articles/139086)、[21经济网-天猫精灵](https://m.21jingji.com/article/20201226/herald/5aaa63e2bd2c9acf9266690c38ce7302.html)

## 2026-09-10 凌晨迭代（Run 2）

**新竞品情报**（AI 宠物赛道 2025-2026 动态）：

| 竞品 | 核心能力 | 对本项目的启示 |
|------|---------|--------------|
| 芙崽（Fuzai） | 记住 30 万用户日常；**每日持续"思考"**：梳理当天话题、建立记忆间联系、长周期成长任务 | 我们的记忆只有 6 类正则事实；下一步 = 宠物主动"回顾记忆"（晨间问候提及昨日），建立记忆→行为的闭环 |
| QQ宠物 AI 版（2026 复活） | 宠物**记录并分享日常**（学习/打工/冒险），沉淀"独家养成记忆" | 我们的 pet_memories + 档案馆可升级为「记忆日记/周报」分享物料 |
| 小火人 / 养企鹅 App | DAU 破亿；**双人共同领养**的社交养成 | 好友串门目前只读 + 占位按钮 → 接上后端已就绪的 care-grant 托管喂食 |
| Peppy: My Talking AI Pets | 语音互动 + 记忆回应 + 角色定制 | 语音为重功能暂缓；角色定制对应 P3 自定义形象 |
| 行业报告（知乎/钛媒体） | 共识：**长期记忆 + 情感计算 + 养成感 = 留存** | 记忆系统方向正确，必须让用户"看见"记忆才产生情感依赖 |

**信任型新发现**：2026-07「800 万人通宵抢救 AI 记忆」事件（新浪财经）——AI 宠物停服导致记忆丢失引发恐慌。→ 记忆数据的**可查看、可导出、可带走**本身是差异化信任特性（用户可查看/遗忘我们已有 API，导出列 P3）。

**结论**：优先级维持「记忆 UI 闭环 > 每日任务 > 推送召回 > 小游戏 > 成就」，新增 P2 候选「记忆日记分享」、P3 候选「记忆数据导出」。

来源：[华尔街见闻-芙崽](https://wallstreetcn.com/articles/3779249)、[紫牛新闻-QQ宠物回归](https://www.yzwb.net/news/ch/202607/t20260727_376478.html)、[钛媒体-AI宠物](https://www.tmtpost.com/7606130.html)、[腾讯新闻-小火人](https://news.qq.com/rain/a/20251229A04PDE00)、[新浪财经-AI记忆抢救](https://finance.sina.com.cn/wm/2026-07-23/doc-iniiunch4560162.shtml)

## 2026-09-10 凌晨迭代（Run 3）

**小游戏设计验证**（Pou——全球累计下载超 10 亿的电子宠物标杆）：

| 设计点 | Pou 的做法 | 对猜拳小游戏的落地启示 |
|--------|-----------|----------------------|
| 双重收益 | 小游戏既**填满 Fun 心情槽**又**赚金币**，一举两得 | 猜拳每次都 +心情，赢了额外 +金币；不做"输了扣属性"的惩罚 |
| 经济闭环 | 小游戏赚币 → 买食物/药水/装扮 → 养成消耗 | 币走全站统一每日 200 产出预算，防通胀；商城已有消耗口 |
| 留存钩 | 升级解锁内容 + 照料衰减拉回访 | 猜拳计经验值（参与成长曲线）+ 每日 20 局上限制造"明天再来" |
| 轻量优先 | 7 个小游戏各有独立入口 | 先做 1 个零素材、纯逻辑的猜拳验证玩法，跑通再加 |

**串门社交对照**（小火人双人共同领养 vs 本项目只读串门）：好友串门页的 🎁👍💌 三个占位按钮是"假功能"，比没有按钮更伤信任——本轮把 👍点赞 / 🎁送礼 做成真实 API（送礼花自己金币给好友宠物加属性 = 无负担利他社交），💌 直接移除。

来源：[Pou - Google Play](https://play.google.com/store/apps/details?id=me.pou.app3d)、[Poupedia-金币经济](https://poupedia.com/Pou_(game))、[Simple Wikipedia-Pou](https://simple.wikipedia.org/wiki/Pou_(video_game))

## 2026-09-10 第 4 轮：推送召回设计情报

- **Pushwoosh 游戏推送报告**：个性化推送可让游戏 DAU/MAU 提升至 3 倍；召回推送搭配小激励效果更佳
- **Reddit/Gamedev**：电子宠物"饥饿提醒"经典实现 = 通知时间按（剩余食物 ÷ 消耗速率）计算，回 App 取消、离开重设；本项目用服务端定时扫描等价实现且天然防卸载重装错乱
- **Apple 官方推荐**：My Tamagotchi Forever 因"通知提醒照料宠物"被 App Store 专题收录——照料提醒是电子宠物品类被平台认可的核心交互
- **QQ宠物回归**：接入大模型后"宠物主动找你聊天"是比推送更强的情感召回；我们的宠物主动回忆（Run 5 已做）即此思路
- **aidorable 免打扰原则**：频繁推送有害，需免打扰时段与粒度设置 → 已按"每宠物每类型每日 1 条"落地，免打扰时段 UI 列 P3

来源：[Pushwoosh](https://www.pushwoosh.com/zh/blog/game-app-push-notifications/)、[Reddit](https://www.reddit.com/r/gamemaker/comments/1j27pik/handling_the_passage_of_time_in_a_virtual_pet/)、[Apple](https://apps.apple.com/us/iphone/story/id1350681703?l=zh-Hans-CN)、[知乎-QQ宠物](https://zhuanlan.zhihu.com/p/2068773516984447500)、[aidorable](https://aidorable.ai)

## 2026-09-10 第二夜迭代（Run 5，03:15 检索）

**2026 虚拟宠物市场新动态**：

| 竞品/趋势 | 核心做法 | 对本项目的启示 |
|------|---------|------------|
| Finch 自我关怀宠物 | 用户完成每日健康任务（心情记录/日志）→ 宠物成长，留存标杆案例 | 印证每日任务方向；「宠物依赖你」是最强留存机制（Yu-kai Chou：胜过排行榜等所有机制） |
| Friends by Slay（Pengu） | 独自或与好友共同养成 AI 宠物，印度等新兴市场爆发 | 好友串门/托管方向正确 |
| Sweekar（Takway，CES 2026） | AI 驱动的拓麻歌子式口袋宠物 | AI+养成融合已是赛道共识 |
| 实体联动（Loona/Aura 机器人） | 虚拟宠物与实体机器人喂食/照料互通 | 重硬件，不做 |
| **睡眠-宠物绑定**（ResearchGate 研究） | 宠物成长与用户睡眠-觉醒行为绑定 → 正向改变作息习惯 | 🔴 本项目 energy 只有衰减无恢复渠道、无作息循环——**睡觉/哄睡系统**是拓麻歌子级标配，立项 Round 8 |

**结论**：睡觉作息系统补齐养成循环（白天互动消耗体力 → 夜里哄睡恢复）；「装扮可见性」修复（Round 7）回应「只卖颜值」定位的付费信任。

来源：[TheSmartSnout-2026 虚拟宠物指南](https://thesmartsnout.com/2026/02/21/virtual-pet-apps-guide-2026-ai-coparenting/)、[ACM-Brainy 虚拟宠物数字健康](https://dl.acm.org/doi/10.1145/3811427.3811476)、[Livemint-新兴市场宠物 App](https://www.livemint.com/)
