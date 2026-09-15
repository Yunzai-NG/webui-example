/**
 * 模块职责：一言组件 —— 一整块引言排版，左下角两枚图标按钮（换一句 / 复制）
 * 依赖方向：只用 `setup(api)` 注入的那些；不 import 任何东西
 * 生命周期：随组件挂载 setup 一次，返回的渲染函数此后每次重画都跑
 * 注意事项：示范「组件自己的交互」与「包自带样式表」：多数组件是只读的（采样来了就画），
 *          而这一枚有两个按钮 —— 一个要发请求、要转圈、可能失败，一个要写剪贴板。
 *          取数走包自己的 node 侧（`api.own`）而非浏览器直连：CORS 头不由我们决定，
 *          且接口地址在配置里，由 node 侧读同一份配置发请求。
 *          **失败时保留上一句话**：把已显示的句子换成一行错误等于「点一下就丢了内容」，
 *          故错误另起一行小字。排版用本包的 `quote-*` 一族而非面板的 `.card`（那是左对齐的通用容器）。
 */

/** 「换一句」的图标：一段带箭头的回转，读作「再来一个」 */
const ICON_REFRESH = "M3.5 8a8.5 8.5 0 0 1 14.6-4.4M20.5 16A8.5 8.5 0 0 1 5.9 20.4M3.5 3.5V8h4.5M20.5 20.5V16h-4.5"

/** 「复制」的图标：两枚错开的方框 */
const ICON_COPY = "M9 9h10v10H9zM5 15V5h10"

/** 复制成功后那句提示留多久（毫秒） */
const COPIED_MS = 1600

/** 一言组件 */
export const hitokotoWidget = {
  id: "example.hitokoto",
  page: "overview",
  title: "一言",
  defaultLayout: { w: 6, h: 2, minW: 3, minH: 2, resizable: true },

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
    /** 刚刚复制成功；`COPIED_MS` 之后自行熄灭 */
    const copied = api.ref(false)

    /** 复制提示的熄灭定时器 */
    let copyTimer

    /*
     * 自己起的定时器要自己收
     *
     * 不收的话，组件从版面上移除之后它仍会改一个没人看的 ref。`api.onTick` 会自动退订，
     * 而这一个是本组件建的。
     */
    api.onUnmounted(() => {
      if (copyTimer !== undefined) clearTimeout(copyTimer)
    })

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

    /**
     * 把当前句子写进剪贴板
     *
     * `navigator.clipboard` 在非安全上下文下不存在（面板常经 `http://` 的内网地址打开），
     * 故**必须判断它在不在**，否则那一下是一句控制台报错加「点了没反应」。取不到时
     * 借道 `document.execCommand("copy")` —— 它已废弃但在 http 下仍然可用，而这里要的
     * 恰是那个场景。
     */
    const copy = async () => {
      const item = quote.value
      if (item === undefined) return
      const text = [item.text, item.from].filter(one => one !== undefined && one !== "").join(" —— ")

      let done = false
      if (navigator.clipboard !== undefined) {
        try {
          await navigator.clipboard.writeText(text)
          done = true
        } catch {
          // 用户拒绝了剪贴板权限，退到下面那条路
        }
      }
      if (!done) {
        const area = document.createElement("textarea")
        area.value = text
        // 移出视野而不是 `display: none`：后者选不中，于是 execCommand 复制到的是空串
        area.style.position = "fixed"
        area.style.left = "-9999px"
        document.body.append(area)
        area.select()
        try {
          done = document.execCommand("copy")
        } catch {
          done = false
        }
        area.remove()
      }

      if (!done) {
        failed.value = "这个浏览器不让我们写剪贴板，请手动选中复制"
        return
      }
      copied.value = true
      if (copyTimer !== undefined) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => {
        copied.value = false
      }, COPIED_MS)
    }

    void load()

    /**
     * 一枚图标按钮
     *
     * 图标一律描边加 `currentColor`，与面板自身的图标同一套画法：颜色由所在语境的前景色
     * 决定，故深浅两模式无须各写一份。
     * @param path svg 的 path 数据
     * @param label 无障碍名称，同时作为 `title`
     * @param onClick 点击时做什么
     * @param disabled 是否禁用
     * @returns vnode
     */
    const iconButton = (path, label, onClick, disabled) =>
      api.h(
        "button",
        { class: "quote-act", type: "button", "aria-label": label, title: label, disabled, onClick },
        [
          api.h(
            "svg",
            {
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "1.7",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "aria-hidden": "true",
              focusable: "false"
            },
            [api.h("path", { d: path })]
          )
        ]
      )

    return () => {
      const item = quote.value
      /** 出处一行：来源与作者之间用间隔号，两者都没有时整行不出现 */
      const source = item === undefined ? "" : [item.from, item.author].filter(one => one !== undefined && one !== "").join(" · ")

      const body =
        item === undefined
          ? api.h("p", { class: "quote-text quote-waiting" }, loading.value ? "正在取第一句…" : "还没有取到句子")
          : api.h("p", { class: "quote-text" }, item.text)

      return api.h("article", { class: "quote" }, [
        /*
         * 句子那一段单独包一层，滚动落在它身上
         *
         * 不让 `.quote` 自己滚：两枚按钮要贴住卡片左下角，而一个滚动容器里的绝对定位子元素
         * 是跟着内容滚的 —— 长句子往下滚，按钮就滑出视野了。包一层之后按钮留在流里、
         * 恒在底部，句子在上半截自己滚。
         */
        api.h("div", { class: "quote-main" }, [
          // 大引号是纯装饰，读屏器念不出「”」也不损失信息，故 aria-hidden
          api.h("span", { class: "quote-mark", "aria-hidden": "true" }, "”"),
          body,
          source === "" ? null : api.h("p", { class: "quote-from" }, source),
          /*
           * 失败另起一行，句子留在原处 —— 见文件头
           *
           * 与「已复制」共用这一行：两者不会同时发生（复制成功即清不掉一条取数失败，
           * 但那条错此时已无人在意），且各占一行会让卡片高度随状态跳动。
           */
          failed.value !== ""
            ? api.h("p", { class: "quote-note quote-err" }, `取数失败：${failed.value}`)
            : copied.value
              ? api.h("p", { class: "quote-note" }, "已复制")
              : null
        ]),
        api.h("div", { class: "quote-acts" }, [
          iconButton(ICON_REFRESH, loading.value ? "取数中" : "换一句", () => void load(), loading.value),
          iconButton(ICON_COPY, "复制这句", () => void copy(), item === undefined)
        ])
      ])
    }
  }
}
