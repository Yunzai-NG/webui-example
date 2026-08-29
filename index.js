/**
 * 模块职责：面板插件示例包的入口 —— 把三枚组件与一个页签交给面板
 * 依赖方向：只依赖同包内的几个文件；不 import 任何裸包名
 * 生命周期：被浏览器 `import()` 一次，导出的定义随即登记
 * 注意事项：**入口固定是包根的 `index.js`，且这是浏览器直接执行的文件。** 没有构建步骤，
 *          故这里不能写 TypeScript、不能写 `.vue`、也**不能 `import "lunar-typescript"`** ——
 *          裸包名在浏览器里无从解析，那句 import 会让整个包连一枚组件都装不上。本包确实
 *          依赖 lunar-typescript，但它只在 node 侧（`server/index.js`）用，见那个文件。
 *
 *          **组件与页签是两个导出，不是一个数组。** 组件走 `export default [...]`，页签走
 *          `export const tabs = [...]`。两者的字段要求不同（组件要 `page` 与 `defaultLayout`，
 *          页签不要），混在一处会让校验无从分辨该按哪套规矩查。
 *
 *          **分成几个文件纯粹是为了好读**，面板只认这一个入口。写成一个文件同样成立。
 */
import { clockWidget } from "./widgets/clock.js"
import { hitokotoWidget } from "./widgets/hitokoto.js"
import { marqueeWidget } from "./widgets/marquee.js"
import { hitokotoTab } from "./tabs/hitokoto-tab.js"

/**
 * 本包提供的组件
 *
 * 一个模块一次给出多枚组件（见「一个包给出多枚组件」）。这也是本包想示范的第一件事：不必为了两枚
 * 组件做成两个包。
 *
 * 跑马灯那一枚用的是包自带的 `style.css`（由 `package.json` 的 `webuiPanel.style` 指出）——
 * 单文件面板插件没有这项能力，那是「做成包」的另一个理由。
 */
export default [hitokotoWidget, clockWidget, marqueeWidget]

/** 本包提供的页签，落在插件页上 */
export const tabs = [hitokotoTab]
