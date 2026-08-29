/**
 * 模块职责：示例包的 node 侧 —— 代取一言、算农历
 * 依赖方向：可以用裸包名 import（这一半跑在 node 里），此处用到 lunar-typescript
 * 生命周期：webui 加载本包时 `setup(ctx)` 一次；注册的路由与 webui 同寿
 * 注意事项：**这一半示范的是「包可以带自己的依赖」。** 农历查表是一份不该进浏览器 bundle 的
 *          数据，故放在这里；而 `import "lunar-typescript"` 只在 node 里解析得开 ——
 *          浏览器侧那三个文件里一句裸包名都没有，理由见 `index.js` 文件头。
 *
 *          **依赖装不上时不让整个包塌掉。** 商店装包时依赖是可以不装的（使用者可以不勾），
 *          此时 `import` 会抛错。若在模块顶层静态 import，整份 node 侧连一条路由都注册不上，
 *          连一言也用不了 —— 而一言与农历毫无关系。故改为**用到时动态 import**，
 *          失败只让 `/lunar` 那一条返回错误，组件那侧自会退回只显示公历。
 *
 *          **代取一言而非让浏览器直连。** 一是 CORS 不由我们决定；二是类型参数在配置里，
 *          由这一侧读同一份配置拼进请求，浏览器就不必知道那个参数怎么拼。
 *
 *          **路由不收参数。** 受限上下文的 `route(path, handler)` 里 handler 无参，读不到
 *          查询串，故「取一句」与「取一批」是两条路径，日期由本侧自己取而不由浏览器传。
 *          后者反而更对：农历的「今天」该由跑着的机器说，而不是由一个可能时区不同的浏览器说。
 */

/** 一言接口地址 */
const ENDPOINT = "https://v1.hitokoto.cn"

/** 取一批时取几句 */
const BATCH = 5

/** 单次请求超时毫秒 */
const TIMEOUT_MS = 8000

/**
 * 取一句一言
 * @param types 类型参数，形如 `d,i,k`；空串为不限
 * @returns 句子
 * @throws 请求失败或超时时
 */
async function fetchOne(types) {
  const url = new URL(ENDPOINT)
  // hitokoto 的类型参数是重复的 c= 而非逗号分隔的一个值
  for (const one of types.split(",").map(item => item.trim()).filter(item => item !== "")) {
    url.searchParams.append("c", one)
  }
  url.searchParams.set("encode", "json")

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`一言接口返回 ${res.status}`)
  const got = await res.json()
  return {
    text: typeof got.hitokoto === "string" ? got.hitokoto : "",
    from: typeof got.from === "string" ? got.from : "",
    author: typeof got.from_who === "string" ? got.from_who : ""
  }
}

/**
 * 取一句，把「上游不给」变成一个正常的返回值而不是抛错
 *
 * **抛出去会让这条路由回 500，而 500 的意思是「服务端有 bug」。** 第三方接口慢或挂了不是
 * 那件事 —— 它是一种预期内的处境，本包对它无能为力，但该说清楚。实测踩到过：hitokoto.cn
 * 超时一次，路由回 500，浏览器控制台记一条 `Failed to load resource: 500`，于是核对脚本
 * 报「有非预期的报错」。追下去才发现是上游慢，而不是哪里写错了。
 *
 * 于是约定：成功给 `{ text, from, author }`，失败给 `{ error }`。浏览器侧据 `error`
 * 那一支显示一行小字，且**保留上一句话**（见 `widgets/hitokoto.js`）。
 * @param types 类型参数
 * @returns 句子或一条错话
 */
async function tryFetchOne(types) {
  try {
    return await fetchOne(types)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    // 超时的原话是「The operation was aborted due to timeout」，对使用者没有意义
    return { error: reason.includes("aborted due to timeout") ? "一言接口超时" : `取一言失败：${reason}` }
  }
}

/**
 * 算一个日期的农历
 *
 * 依赖动态 import，故它装不上时只有这一条路由报错。**每次调用都 import** ——
 * node 自带模块缓存，第二次起不会重新读盘，故不必自己再缓存一层。
 * @param date 日期
 * @returns 农历文字
 * @throws 依赖未安装时
 */
async function lunarTextOf(date) {
  const { Lunar } = await import("lunar-typescript")
  const lunar = Lunar.fromDate(date)
  // 形如「农历八月初六 丙午年 猴月」
  return `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getYearInGanZhi()}年`
}

/**
 * 本包的 node 侧入口
 *
 * **默认导出的是一个含 `setup` 的对象，不是一个函数。** 写成
 * `export default function setup(ctx)` 不会报语法错，只会得到一句
 * 「node 侧入口须默认导出一个含 setup 的对象」，而那条话在 node 侧的日志里 ——
 * 浏览器那侧看到的是「api.own 说本包没有 node 侧」，隔得很远。
 * @param ctx 受限上下文
 */
function setup(ctx) {
  /**
   * 取配置里的一言类型
   *
   * 每次现取，不在 setup 里存下来 —— 使用者改了配置要立刻生效。
   * @returns 类型参数
   */
  const types = () => {
    const raw = ctx.config().hitokotoTypes
    return typeof raw === "string" ? raw : ""
  }

  ctx.route("hitokoto", async () => tryFetchOne(types()))

  /*
   * 取一批：并发发出，失败的那些丢掉
   *
   * 用 allSettled 而非 all：五句里有一句超时就整批失败，会让「再取一批」在网络不稳时
   * 几乎总是空手而归，而四句已经够看了。全都失败时给空数组，页签那侧照旧显示上一批。
   */
  ctx.route("hitokoto/batch", async () => {
    const got = await Promise.allSettled(Array.from({ length: BATCH }, () => fetchOne(types())))
    // 失败的那些丢掉，成功的照给；全都失败时给空数组，页签那侧照旧显示上一批
    return got.filter(one => one.status === "fulfilled").map(one => one.value)
  })

  ctx.route("lunar", async () => {
    try {
      return { text: await lunarTextOf(new Date()) }
    } catch (err) {
      // 依赖没装是最常见的原因，故把它写在错话里，省去一次「为什么农历不出来」的排查
      ctx.logger.debug(`农历算不出来（多半是依赖未安装）：${err instanceof Error ? err.message : String(err)}`)
      throw new Error("农历需要本包的依赖 lunar-typescript，它尚未安装")
    }
  })

  ctx.logger.debug("示例包的 node 侧已就绪：一言代取与农历换算")
}

export default { setup }
