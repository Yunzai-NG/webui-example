/**
 * 模块职责：一言组件 —— 一张卡片显示一句话，右上角可换一句
 * 依赖方向：只用 `setup(api)` 注入的那些；不 import 任何东西
 * 生命周期：随组件挂载 setup 一次，返回的渲染函数此后每次重画都跑
 * 注意事项：**这枚组件示范的是「组件自己的交互」。** 面板上多数组件是只读的（采样来了就画），
 *          而这一枚有一个按钮，点了要发请求、要转圈、可能失败。三种状态各有各的画法，
 *          少画一种就会出现「点了没反应」。
 *
 *          **取数走包自己的 node 侧（`api.own`），不在浏览器里直连 hitokoto.cn。** 两个理由：
 *          浏览器直连要看对方的 CORS 头，而那不是我们能控制的东西；而且类型参数存在配置里，
 *          由 node 侧读同一份配置拼进请求，浏览器就不必知道那个参数怎么拼。
 *
 *          **失败时保留上一句话。** 一次网络失败把已经显示着的句子换成一行错误，等于
 *          「点一下就丢了内容」；故错误另起一行小字，句子留在原处。
 */

/** 一言组件 */
export const hitokotoWidget = {
  id: "example.hitokoto",
  page: "overview",
  title: "一言",
  defaultLayout: { w: 4, h: 2, minW: 3, minH: 2, resizable: true },

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 当前句子；undefined 意为还没取到过 */
    const quote = api.ref(undefined)
    /** 正在取数 */
    const loading = api.ref(false)
    /** 上一次失败的原因；成功后清空 */
    const failed = api.ref("")

    /**
     * 取一句
     *
     * 并发点击直接忽略后来的那次：两个请求同时在飞时，后回来的那个会覆盖先回来的，
     * 而使用者看到的是「句子闪了一下又变了」。
     */
    const load = async () => {
      if (loading.value) return
      loading.value = true
      try {
        const got = await api.own("hitokoto")
        /*
         * node 侧把「上游不给」当作正常返回值，故成功的响应里也可能是一条错话
         *
         * 它不抛错是刻意的：抛出去那条路由就回 500，而 500 说的是「服务端有 bug」，
         * 第三方接口慢不是那件事。见 `server/index.js` 的 `tryFetchOne`。
         */
        if (typeof got?.error === "string") failed.value = got.error
        else {
          quote.value = got
          failed.value = ""
        }
      } catch (err) {
        failed.value = err instanceof Error ? err.message : String(err)
      } finally {
        loading.value = false
      }
    }

    void load()

    return () => {
      const head = api.h("header", {}, [
        api.h("h3", {}, "一言"),
        api.h(
          "button",
          {
            class: "ghost",
            disabled: loading.value,
            title: "换一句",
            onClick: () => void load()
          },
          loading.value ? "取数中…" : "换一句"
        )
      ])

      const body =
        quote.value === undefined
          ? api.h("p", { class: "hint" }, loading.value ? "正在取第一句…" : "还没有取到句子")
          : [
              // 这一枚只用面板现成的类，不带自己的 css；自带样式表那一路见 `widgets/marquee.js`
              api.h("p", {}, quote.value.text),
              api.h(
                "p",
                { class: "hint" },
                [quote.value.from, quote.value.author].filter(item => item !== undefined && item !== "").join(" · ")
              )
            ]

      return api.h("article", { class: "card" }, [
        head,
        ...(Array.isArray(body) ? body : [body]),
        // 失败另起一行，句子留在原处 —— 见文件头
        failed.value === "" ? null : api.h("p", { class: "err" }, `取数失败：${failed.value}`)
      ])
    }
  }
}
