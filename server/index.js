/**
 * 模块职责：示例包的 node 侧 —— 代取一言、算农历与春节
 * 依赖方向：可以用裸包名 import（这一半跑在 node 里），此处用到 lunar-typescript
 * 生命周期：webui 加载本包时 `setup(ctx)` 一次；注册的路由与 webui 同寿
 * 注意事项：这一半示范「包可以带自己的依赖」：农历查表不该进浏览器 bundle，且裸包名只在 node 里
 *          解析得开（浏览器侧一句都没有，见 `index.js` 文件头）。
 *
 *          依赖用到时才动态 import：商店装包时可以不装依赖，顶层静态 import 会让整份 node 侧
 *          一条路由都注册不上，连与农历无关的一言也用不了。
 *
 *          代取一言而非浏览器直连：CORS 不由我们决定，且接口地址在配置里，浏览器不必知道它。
 *
 *          路由不收参数（受限上下文的 handler 无参），故取一句与取一批是两条路径；日期由本侧取，
 *          农历的「今天」该由跑着的机器说而非时区可能不同的浏览器。
 */

/** 接口地址没配时用的默认值，与 package.json 里那一项的 default 须一致 */
const DEFAULT_ENDPOINT = "https://v1.hitokoto.cn"

/** 取一批时取几句 */
const BATCH = 5

/** 单次请求超时毫秒 */
const TIMEOUT_MS = 8000

/**
 * 取一句一言
 *
 * 逐个试几种字段名而非只认一种：地址可换成别家接口或自建镜像，认不出时组件显示空句子，
 * 看起来像「接口挂了」。
 * @param endpoint 接口地址
 * @returns 句子
 * @throws 请求失败、超时或响应不是 JSON 时
 */
async function fetchOne(endpoint) {
  const res = await fetch(endpoint, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" }
  })
  if (!res.ok) throw new Error(`一言接口返回 ${res.status}`)
  const got = await res.json()

  const text = [got.hitokoto, got.text, got.content, got.sentence].find(one => typeof one === "string" && one !== "")
  if (text === undefined) throw new Error("一言接口的响应里找不到句子")

  const from = [got.from, got.source, got.origin].find(one => typeof one === "string" && one !== "")
  const author = [got.from_who, got.author, got.creator].find(one => typeof one === "string" && one !== "")

  return { text, from: from ?? "", author: author ?? "" }
}

/**
 * 取一句，把「上游不给」变成一个正常的返回值而不是抛错
 *
 * 抛出去这条路由会回 500，而 500 的意思是「服务端有 bug」—— 第三方接口慢或挂了不是那件事。
 * 故约定：成功给 `{ text, from, author }`，失败给 `{ error }`，浏览器侧据 `error` 那一支
 * 显示一行小字并保留上一句话（见 `widgets/hitokoto.js`）。
 * @param endpoint 接口地址
 * @returns 句子或一条错话
 */
async function tryFetchOne(endpoint) {
  try {
    return await fetchOne(endpoint)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    // 超时的原话是「The operation was aborted due to timeout」，对使用者没有意义
    return { error: reason.includes("aborted due to timeout") ? "一言接口超时" : `取一言失败：${reason}` }
  }
}

/**
 * 算一个日期的农历、干支与下一个春节
 *
 * 依赖动态 import，故它装不上时只有这一条路由报错；每次调用都 import，node 自带模块缓存。
 * 春节按「下一个」算而非「今年的那个」：后者会在正月里给出一个负的天数。
 * @param date 日期
 * @returns 农历各项与下一个春节的公历日期
 * @throws 依赖未安装时
 */
async function lunarOf(date) {
  const { Lunar, Solar } = await import("lunar-typescript")
  const lunar = Lunar.fromDate(date)

  /**
   * 某个农历年正月初一对应的公历日期（YYYY-MM-DD）
   * @param year 农历年
   * @returns 公历日期字符串
   */
  const springOf = year => Lunar.fromYmd(year, 1, 1).getSolar().toYmd()

  const solarYear = date.getFullYear()
  let spring = springOf(solarYear)
  // 今年的春节已经过了（含今天之前），下一个在明年
  if (spring < Solar.fromDate(date).toYmd()) spring = springOf(solarYear + 1)

  return {
    // 形如「七月十八」，不带「农历」二字 —— 那两个字由浏览器侧的排版决定要不要写
    month: `${lunar.getMonthInChinese()}月`,
    day: lunar.getDayInChinese(),
    /** 年月日三柱干支，形如「丙午年 丙申月 丙寅日」 */
    ganzhi: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    /** 生肖，一个字 */
    zodiac: lunar.getYearShengXiao(),
    /** 下一个春节的公历日期 */
    spring
  }
}

/**
 * 本包的 node 侧入口
 *
 * 默认导出的是一个含 `setup` 的对象而非一个函数：写成 `export default function setup(ctx)`
 * 不报语法错，只会让浏览器那侧看到「api.own 说本包没有 node 侧」，与真实原因隔得很远。
 * @param ctx 受限上下文
 */
function setup(ctx) {
  /**
   * 取配置里的一言接口地址
   *
   * 每次现取，不在 setup 里存下来 —— 使用者改了配置要立刻生效。留空按默认值算：
   * 一个空地址会让 `fetch` 抛一句「Failed to parse URL」，而使用者要的显然是「用默认的」。
   * @returns 接口地址
   */
  const endpoint = () => {
    const raw = ctx.config().hitokotoApi
    return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : DEFAULT_ENDPOINT
  }

  ctx.route("hitokoto", async () => tryFetchOne(endpoint()))

  /*
   * 取一批：并发发出，失败的那些丢掉
   *
   * 用 allSettled 而非 all：五句里有一句超时就整批失败，会让「再取一批」在网络不稳时
   * 几乎总是空手而归，而四句已经够看了。全都失败时给空数组，页签那侧照旧显示上一批。
   */
  ctx.route("hitokoto/batch", async () => {
    const at = endpoint()
    const got = await Promise.allSettled(Array.from({ length: BATCH }, () => fetchOne(at)))
    return got.filter(one => one.status === "fulfilled").map(one => one.value)
  })

  ctx.route("lunar", async () => {
    try {
      return await lunarOf(new Date())
    } catch (err) {
      // 依赖没装是最常见的原因，故把它写在错话里，省去一次「为什么农历不出来」的排查
      ctx.logger.debug(`农历算不出来（多半是依赖未安装）：${err instanceof Error ? err.message : String(err)}`)
      throw new Error("农历需要本包的依赖 lunar-typescript，它尚未安装")
    }
  })

  ctx.logger.debug("示例包的 node 侧已就绪：一言代取与农历换算")
}

export default { setup }
