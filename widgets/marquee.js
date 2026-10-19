/**
 * 模块职责：跑马灯组件 —— 一行字横向滚动，两端虚化，字号由中间向两边渐小
 * 依赖方向：只用 `setup(api)` 注入的那些；样式在包根的 `style.css` 里
 * 生命周期：随组件挂载 setup 一次，句子取一次；位移与逐字缩放由一个 rAF 循环驱动，卸载时停
 * 注意事项：**逐字缩放只改 transform，不改字号。** 改 `font-size` 每帧都要重排整行，而 transform
 *          只走合成；字距因此不随之收紧，看起来像一串在弧面上滚动的字，正是要的效果。
 *
 *          **字的位置只在内容或宽度变了时量一次**（`offsetLeft`），每帧按位移推算，
 *          不在循环里读布局 —— 那会让每一帧都强制重排。
 *
 *          两端虚化用 `mask-image` 的线性渐变，颜色无关，故深浅两模式与任何强调色下都一样。
 *          关掉动画的人看到的是静止的一行（仍按位置缩放），悬停或获得焦点时停下来好读完。
 */

/** 取不到句子时滚动的那行字 */
const FALLBACK = "Yunzai NG —— 内核之外的一切都是插件"

/** 滚动速度，像素每秒 */
const SPEED = 42

/** 两端字号的下限，相对中间 */
const MIN_SCALE = 0.62

/** 跑马灯组件 */
export const marqueeWidget = {
  id: "example.marquee",
  page: "overview",
  title: "跑马灯",
  defaultLayout: { w: 4, h: 1, minW: 3, minH: 1, resizable: true },
  defaultHidden: true,

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 滚动的那行字 */
    const text = api.ref(FALLBACK)

    void (async () => {
      try {
        const got = await api.own("hitokoto")
        if (typeof got?.text === "string" && got.text !== "") text.value = got.text
      } catch {
        // 兜底句子已在 ref 里
      }
    })()

    const still = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

    /** 视窗、轨道与轨道里每个字；由 ref 回调写入 */
    let box
    let track
    /** 每个字的中心相对轨道左端的位置，以及一份内容的宽度 */
    let centers = []
    let spans = []
    let period = 0
    let offset = 0
    let paused = false
    let last = 0
    let frame
    let measuredFor = ""

    /** 量一遍字的位置；内容或宽度变了才需要 */
    const measure = () => {
      if (track === undefined) return
      spans = [...track.querySelectorAll(".mq-ch")]
      centers = spans.map(el => el.offsetLeft + el.offsetWidth / 2)
      const half = track.querySelector(".mq-copy")
      period = half instanceof HTMLElement ? half.offsetWidth : 0
      measuredFor = `${text.value}|${box?.clientWidth ?? 0}`
    }

    /** 按当前位移摆字：越靠两端越小 */
    const paint = () => {
      if (box === undefined || track === undefined) return
      if (measuredFor !== `${text.value}|${box.clientWidth}`) measure()
      const width = box.clientWidth
      const mid = width / 2
      track.style.transform = `translate3d(${-offset}px, 0, 0)`
      for (let i = 0; i < spans.length; i += 1) {
        const x = centers[i] - offset
        if (x < -40 || x > width + 40) continue
        const t = Math.min(1, Math.abs(x - mid) / mid)
        const k = Math.cos((t * Math.PI) / 2)
        spans[i].style.transform = `scale(${(MIN_SCALE + (1 - MIN_SCALE) * k).toFixed(3)})`
        spans[i].style.opacity = (0.4 + 0.6 * k).toFixed(3)
      }
    }

    const step = at => {
      frame = requestAnimationFrame(step)
      const dt = last === 0 ? 0 : Math.min(at - last, 100)
      last = at
      if (!paused && !still && period > 0) offset = (offset + (SPEED * dt) / 1000) % period
      paint()
    }

    api.onUnmounted(() => {
      if (frame !== undefined) cancelAnimationFrame(frame)
    })

    /**
     * 一份内容：逐字包一层，字号缩放落在每个字上
     * @param hidden 是否对读屏器隐藏（第二份是重复）
     * @returns vnode
     */
    const copy = hidden =>
      api.h(
        "span",
        { class: "mq-copy", ...(hidden ? { "aria-hidden": "true" } : {}) },
        [...`${text.value}　·　`].map(ch => api.h("span", { class: "mq-ch" }, ch))
      )

    return () =>
      api.h(
        "div",
        {
          class: "card marquee",
          role: "marquee",
          tabindex: 0,
          "aria-label": text.value,
          onMouseenter: () => (paused = true),
          onMouseleave: () => (paused = false),
          onFocusin: () => (paused = true),
          onFocusout: () => (paused = false)
        },
        [
          // 虚化落在内层视窗上：落在卡片上会连卡片的底色与描边一起淡掉
          api.h(
            "div",
            {
              class: "mq-view",
              ref: el => {
                box = el ?? undefined
                if (box !== undefined && frame === undefined) frame = requestAnimationFrame(step)
              }
            },
            [
              // 同一句重复两遍，是无缝循环的做法：位移走满一份的宽度时正好与起点重合
              api.h(
                "div",
                {
                  class: "mq-track",
                  ref: el => {
                    track = el ?? undefined
                    measuredFor = ""
                  }
                },
                [copy(false), copy(true)]
              )
            ]
          )
        ]
      )
  }
}
