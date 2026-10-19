/**
 * 模块职责：时钟组件 —— 三种 SVG 表盘（指针 / 数字 / 圆环），点表盘或右上角切换
 * 依赖方向：只用 `setup(api)` 注入的那些；不 import 任何东西
 * 生命周期：随组件挂载 setup 一次，自带一个每秒的计时器，卸载时清掉
 * 注意事项：**这一枚只管「现在几点」。** 日期类事实在日历那一枚里，报时每秒重画，而日历一天才变一次。
 *
 *          **自带节拍，不用 `api.onTick`。** 全局节拍是给采样用的（5 秒一拍），而秒针要每秒一次。
 *
 *          **表盘样式按浏览器记住**（localStorage），不进包配置：这是看的人自己的偏好，
 *          换一台电脑看同一个面板的人不该被别人的选择改掉。存不下（隐私模式）就每次从指针式开始。
 *
 *          **指针不加过渡。** 59 秒到 0 秒那一下过渡会让秒针倒转一整圈；每秒跳一格本就是表的样子。
 *          颜色一律取面板令牌，故随外观页的强调色与深浅模式一起变。
 */

/** 星期的中文说法，`Date.getDay()` 的顺序 */
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

/** 三种表盘，顺序即点击切换的顺序 */
const FACES = [
  { id: "analog", label: "指针" },
  { id: "digital", label: "数字" },
  { id: "rings", label: "圆环" }
]

/** 表盘样式的存放键 */
const FACE_KEY = "webui-example.clock.face"

/** 圆环表盘三圈的半径，由外到内：时、分、秒 */
const RING_R = [52, 42, 32]

/**
 * 补足两位
 * @param value 数字
 * @returns 两位字符串
 */
function pad(value) {
  return String(value).padStart(2, "0")
}

/**
 * 读上次选的表盘
 * @returns 表盘标识；读不到时为指针式
 */
function readFace() {
  try {
    const got = localStorage.getItem(FACE_KEY)
    if (FACES.some(face => face.id === got)) return got
  } catch {
    // 隐私模式下读不到，用默认
  }
  return FACES[0].id
}

/**
 * 记下这次选的表盘
 * @param id 表盘标识
 */
function writeFace(id) {
  try {
    localStorage.setItem(FACE_KEY, id)
  } catch {
    // 存不下就不存，下次从默认开始
  }
}

/**
 * 一段圆弧的描边参数：从 12 点起顺时针走 `ratio` 圈
 * @param r 半径
 * @param ratio 0-1
 * @returns `stroke-dasharray` 与周长
 */
function arc(r, ratio) {
  const length = 2 * Math.PI * r
  return { dash: `${(length * ratio).toFixed(2)} ${length.toFixed(2)}`, length }
}

/** 时钟组件 */
export const clockWidget = {
  id: "example.clock",
  page: "overview",
  title: "时钟",
  defaultLayout: { w: 4, h: 4, minW: 3, minH: 2, resizable: true, fit: true },

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 当前时刻；每秒换一个新的 Date */
    const now = api.ref(new Date())
    /** 当前表盘 */
    const face = api.ref(readFace())

    /*
     * 每次都对齐到下一个整秒，而不是 `setInterval(…, 1000)`
     *
     * 后者从挂载那一刻起算，与真实的秒界差着一个随机的零头，还会越走越偏。多等 5 毫秒是
     * 给计时器提前触发留的余量，否则拿到的仍是上一秒。
     */
    let timer
    const schedule = () => {
      timer = setTimeout(() => {
        now.value = new Date()
        schedule()
      }, 1005 - (Date.now() % 1000))
    }
    schedule()
    api.onUnmounted(() => {
      clearTimeout(timer)
    })

    /**
     * 换到某种表盘；不传则换到下一种
     * @param id 表盘标识
     */
    const pick = id => {
      const index = FACES.findIndex(item => item.id === face.value)
      const next = id ?? FACES[(index + 1) % FACES.length].id
      face.value = next
      writeFace(next)
    }

    /** 指针式：60 道刻度、12 个数字、三根针 */
    const analog = at => {
      const sec = at.getSeconds()
      const min = at.getMinutes() + sec / 60
      const hour = (at.getHours() % 12) + min / 60
      const ticks = Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0
        return api.h("line", {
          class: major ? "clk-tick clk-tick-major" : "clk-tick",
          x1: 60,
          y1: major ? 7 : 8,
          x2: 60,
          y2: major ? 15 : 12,
          transform: `rotate(${i * 6} 60 60)`
        })
      })
      const numbers = [12, 3, 6, 9].map(n => {
        const angle = (n / 12) * 2 * Math.PI
        return api.h(
          "text",
          { class: "clk-num", x: 60 + Math.sin(angle) * 37, y: 60 - Math.cos(angle) * 37, "dominant-baseline": "central" },
          String(n)
        )
      })
      const hand = (cls, angle, length, tail) =>
        api.h("line", { class: cls, x1: 60, y1: 60 + tail, x2: 60, y2: 60 - length, transform: `rotate(${angle} 60 60)` })
      return [
        api.h("circle", { class: "clk-face", cx: 60, cy: 60, r: 56 }),
        ...ticks,
        ...numbers,
        hand("clk-hand clk-hour", hour * 30, 28, 6),
        hand("clk-hand clk-min", min * 6, 40, 8),
        hand("clk-hand clk-sec", sec * 6, 46, 12),
        api.h("circle", { class: "clk-pin", cx: 60, cy: 60, r: 3.5 })
      ]
    }

    /** 数字式：大字时分，外圈一道秒进度 */
    const digital = at => {
      const sec = at.getSeconds()
      const ring = arc(54, sec / 60)
      return [
        api.h("circle", { class: "clk-track", cx: 60, cy: 60, r: 54 }),
        api.h("circle", {
          class: "clk-arc clk-arc-sec",
          cx: 60,
          cy: 60,
          r: 54,
          "stroke-dasharray": ring.dash,
          transform: "rotate(-90 60 60)"
        }),
        api.h("text", { class: "clk-big", x: 60, y: 56, "dominant-baseline": "central" }, `${pad(at.getHours())}:${pad(at.getMinutes())}`),
        api.h("text", { class: "clk-small", x: 60, y: 80, "dominant-baseline": "central" }, `${pad(sec)} 秒`)
      ]
    }

    /** 圆环式：外到内三圈分别是时、分、秒 */
    const rings = at => {
      const sec = at.getSeconds()
      const min = at.getMinutes() + sec / 60
      const hour = at.getHours() + min / 60
      const parts = [hour / 24, min / 60, sec / 60]
      return [
        ...RING_R.flatMap((r, i) => {
          const one = arc(r, parts[i])
          return [
            api.h("circle", { class: "clk-track", cx: 60, cy: 60, r }),
            api.h("circle", {
              class: `clk-arc clk-arc-${i}`,
              cx: 60,
              cy: 60,
              r,
              "stroke-dasharray": one.dash,
              transform: "rotate(-90 60 60)"
            })
          ]
        }),
        api.h("text", { class: "clk-mid", x: 60, y: 60, "dominant-baseline": "central" }, `${pad(at.getHours())}:${pad(at.getMinutes())}`)
      ]
    }

    const DRAW = { analog, digital, rings }

    return () => {
      const at = now.value
      const current = FACES.find(item => item.id === face.value) ?? FACES[0]
      const spoken = `${at.getHours()}点${at.getMinutes()}分${at.getSeconds()}秒`

      return api.h("article", { class: "card clock" }, [
        api.h("header", { class: "clk-head" }, [
          api.h("h3", {}, "时钟"),
          api.h(
            "div",
            { class: "clk-switch", role: "group", "aria-label": "表盘样式" },
            FACES.map(item =>
              api.h(
                "button",
                {
                  type: "button",
                  class: item.id === current.id ? "clk-opt on" : "clk-opt",
                  "aria-pressed": item.id === current.id ? "true" : "false",
                  onClick: () => pick(item.id)
                },
                item.label
              )
            )
          )
        ]),
        api.h(
          "button",
          {
            type: "button",
            class: "clk-dial",
            title: "点击切换表盘",
            "aria-label": `现在 ${spoken}，${current.label}表盘，点击切换`,
            onClick: () => pick()
          },
          [
            api.h(
              "svg",
              { viewBox: "0 0 120 120", "aria-hidden": "true", focusable: "false", class: `clk-svg clk-${current.id}` },
              DRAW[current.id](at)
            )
          ]
        ),
        api.h(
          "p",
          { class: "clk-date" },
          `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} 周${WEEKDAYS[at.getDay()]}`
        )
      ])
    }
  }
}
