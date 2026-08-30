/**
 * 模块职责：日历组件 —— 大日号、月历网格、农历干支，以及年月周的剩余进度与距离春节
 * 依赖方向：只用 `setup(api)` 注入的那些；农历经包的 node 侧取
 * 生命周期：随组件挂载 setup 一次，自带一个分钟级计时器，卸载时清掉
 * 注意事项：**这枚组件示范的是「一枚组件带自己的样式表」。** 月历是个 7 列网格，
 *          面板的样式表里没有这种东西，故本包自带的 `style.css` 里有 `.cal-*` 一族 ——
 *          那些类名会被面板限定到本包之后才注入，改不到面板别处。
 *
 *          **节拍是分钟级，不是秒级。** 这一枚上没有秒 —— 最小的活动单位是「今天还剩多少」，
 *          而那个百分数一分钟才动一位小数。时钟那一枚要每秒一次，故两枚各自带表，
 *          都不用 `api.onTick`（那是给采样用的 5 秒一拍）。
 *
 *          **跨日要换日期，故计时器不能只更新「今天还剩多少」。** 整个 `now` 换一个新的 Date，
 *          月历网格与大日号因此自动跟着走；否则面板开着过夜，第二天看到的还是昨天。
 *
 *          **农历取不到时不让整枚组件报错**，只是少几行（同「测不到时不要显示 0」）。
 *          春节那一块与农历同源，故一并退场 —— 一个「距离春节 NaN 天」比不显示更糟。
 */

/** 星期表头，`Date.getDay()` 的顺序 */
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

/** 一天的毫秒数 */
const DAY_MS = 86_400_000

/** 计时器间隔：一分钟 */
const TICK_MS = 60_000

/** 月历网格固定 6 行 7 列 —— 行数随月份变会让卡片高度每月一跳 */
const CELLS = 42

/**
 * 一天的零点
 * @param date 日期
 * @returns 同一天的零点
 */
function midnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/**
 * 两个日期相差几天，按整天算
 * @param from 起
 * @param to 迄
 * @returns 天数
 */
function daysBetween(from, to) {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / DAY_MS)
}

/**
 * 今年是第几天
 * @param date 日期
 * @returns 序号，1 月 1 日为 1
 */
function dayOfYear(date) {
  return daysBetween(new Date(date.getFullYear(), 0, 1), date) + 1
}

/**
 * 一段区间还剩几天，**不含今天**
 *
 * 三条进度共用这一个口径，不各自写一遍减法。初版年那一条漏了减 1，于是同一天里
 * 「本年还剩」比「本月还剩」多算一天 —— 三个数各自看都像对的，只有并排时才露出来，
 * 而它们恰好就是并排的。
 *
 * 不含今天：今天已经过去大半，把它算作「还剩」会让周日那天显示「本周还剩1天」，
 * 而那一周实际上已经走完了。
 * @param at 当前时刻
 * @param until 区间终点（不含，即次年 / 次月 / 次周的起点）
 * @returns 剩余天数，最后一天为 0
 */
export function daysLeft(at, until) {
  return Math.max(daysBetween(at, until) - 1, 0)
}

/**
 * ISO 周数
 *
 * 取 ISO 而非「1 月 1 日所在周为第一周」：后者会让跨年那一周在两个年份里各有一个编号。
 * 算法是把日期挪到本周四，再看它是当年的第几个七天 —— ISO 的定义即「含当年第一个周四的
 * 那一周是第 1 周」。
 * @param date 日期
 * @returns 周数
 */
export function isoWeek(date) {
  const at = midnight(date)
  // getDay() 的周日是 0，ISO 里周日是 7
  const iso = at.getDay() === 0 ? 7 : at.getDay()
  at.setDate(at.getDate() + 4 - iso)
  const yearStart = new Date(at.getFullYear(), 0, 1)
  return Math.floor(daysBetween(yearStart, at) / 7) + 1
}

/**
 * 一段区间已经走过多少
 *
 * 按**毫秒**算而不是按天：按天算的话「本周还剩 0 天」会配一个 100.0%，而那一刻其实还有
 * 大半天 —— ref 里那三条进度是连续走的。
 * @param from 区间起点（含）
 * @param to 区间终点（不含）
 * @param at 当前时刻
 * @returns 0-1 的比例
 */
export function elapsedRatio(from, to, at) {
  const span = to.getTime() - from.getTime()
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (at.getTime() - from.getTime()) / span))
}

/**
 * 月历网格的 42 格
 *
 * 前后两段补上邻月的日子（灰显），故每月都是整 6 行。
 * @param date 当月内的任一天
 * @returns 42 个 `{ day, self }`，`self` 为真者属当月
 */
export function monthCells(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  // 从本月 1 日往前退到那一周的周日
  const start = new Date(first)
  start.setDate(1 - first.getDay())

  const out = []
  for (let i = 0; i < CELLS; i += 1) {
    const at = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    out.push({ day: at.getDate(), self: at.getMonth() === date.getMonth(), date: at })
  }
  return out
}

/** 日历组件 */
export const calendarWidget = {
  id: "example.calendar",
  page: "overview",
  title: "日历",
  defaultLayout: { w: 4, h: 5, minW: 3, minH: 4, resizable: true },

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 当前时刻；分钟级更新，跨日时整个换掉 */
    const now = api.ref(new Date())
    /** 农历各项；undefined 意为取不到或还没取到 */
    const lunar = api.ref(undefined)

    const timer = setInterval(() => {
      now.value = new Date()
    }, TICK_MS)

    api.onUnmounted(() => {
      clearInterval(timer)
    })

    /*
     * 农历按日期缓存
     *
     * 它一天只变一次，而这枚组件一分钟重画一次。取不到时把 `lunar` 留作 undefined ——
     * 那几行连同春节一并不显示，见文件头。
     */
    let fetchedDay = ""
    const loadLunar = async date => {
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (key === fetchedDay) return
      fetchedDay = key
      try {
        lunar.value = await api.own("lunar")
      } catch {
        lunar.value = undefined
      }
    }

    /**
     * 一条剩余进度
     * @param ratio 已过比例（0-1）
     * @param label 说明，如「本年还剩」
     * @param left 剩余天数
     * @returns vnode
     */
    const progress = (ratio, label, left) =>
      api.h("div", { class: "cal-prog" }, [
        api.h("span", { class: "cal-prog-num" }, `${(ratio * 100).toFixed(1)}%`),
        api.h("div", { class: "cal-prog-body" }, [
          api.h("p", { class: "cal-prog-label" }, [
            label,
            api.h("b", {}, String(left)),
            "天"
          ]),
          api.h(
            "div",
            {
              class: "cal-prog-slot",
              role: "progressbar",
              "aria-label": label,
              "aria-valuemin": "0",
              "aria-valuemax": "100",
              "aria-valuenow": Math.round(ratio * 100)
            },
            [api.h("div", { class: "cal-prog-fill", style: { width: `${ratio * 100}%` } })]
          )
        ])
      ])

    return () => {
      const at = now.value
      void loadLunar(at)

      const year = at.getFullYear()
      const month = at.getMonth()
      const info = lunar.value

      /* 年：1 月 1 日零点到次年 1 月 1 日零点 */
      const yearFrom = new Date(year, 0, 1)
      const yearTo = new Date(year + 1, 0, 1)
      /* 月：本月 1 日零点到次月 1 日零点 */
      const monthFrom = new Date(year, month, 1)
      const monthTo = new Date(year, month + 1, 1)
      /*
       * 周：本周一零点到次周一零点
       *
       * **周界取 ISO（周一为首），与上面那个周数同一口径** —— 而月历网格的表头是
       * 「日一二三四五六」，两者刻意不同。这不是笔误：周数按 ISO 算（见 `isoWeek`），
       * 若这里改用周日为首，星期日那天会显示「第 36 周 周日」配「本周还剩 6 天」——
       * 按 ISO，周日是第 36 周的最后一天，还剩 0 天。同一张卡上给出两个周界，
       * 而这个矛盾**不报错**，只在每周日出现一次。
       *
       * 网格表头保持周日在前，因为那是中文月历的通行排法（参考图亦然）；它只是一张
       * 表格的列序，不参与任何计算。
       */
      const weekFrom = midnight(at)
      /* getDay() 的周日是 0，ISO 里它是第 7 天，故要往前退 6 天而不是 0 天 */
      weekFrom.setDate(weekFrom.getDate() - (at.getDay() === 0 ? 6 : at.getDay() - 1))
      const weekTo = new Date(weekFrom.getFullYear(), weekFrom.getMonth(), weekFrom.getDate() + 7)

      /*
       * 头一块：周数与周几、大日号、公历与农历
       */
      const facts = [
        api.h("p", { class: "cal-week" }, `第${isoWeek(at)}周 周${WEEKDAYS[at.getDay()]}`),
        api.h("b", { class: "cal-day" }, String(at.getDate())),
        api.h("p", { class: "cal-sub" }, `${year}年${month + 1}月 第${dayOfYear(at)}天`)
      ]
      if (info !== undefined) {
        facts.push(api.h("p", { class: "cal-sub" }, `农历 ${info.month}${info.day}`))
        facts.push(api.h("p", { class: "cal-sub cal-ganzhi" }, info.ganzhi))
      }

      /*
       * 月历网格：表头七格 + 42 格日子
       *
       * 今天那一格加 `cal-today`（一枚圆底），邻月的日子加 `cal-other`（灰显）。
       * `aria-current` 让读屏器能报出「今天」而不只是一个数字。
       */
      const grid = api.h("div", { class: "cal-grid" }, [
        ...WEEKDAYS.map(name => api.h("span", { class: "cal-head" }, name)),
        ...monthCells(at).map(cell => {
          const today = cell.self && cell.day === at.getDate()
          return api.h(
            "span",
            {
              class: `cal-cell${cell.self ? "" : " cal-other"}${today ? " cal-today" : ""}`,
              "aria-current": today ? "date" : undefined
            },
            String(cell.day)
          )
        })
      ])

      const body = [
        api.h("div", { class: "cal-top" }, [
          api.h("div", { class: "cal-facts" }, facts),
          grid
        ]),
        progress(elapsedRatio(yearFrom, yearTo, at), "本年还剩", daysLeft(at, yearTo)),
        progress(elapsedRatio(monthFrom, monthTo, at), "本月还剩", daysLeft(at, monthTo)),
        progress(elapsedRatio(weekFrom, weekTo, at), "本周还剩", daysLeft(at, weekTo))
      ]

      /*
       * 距离春节：与农历同源，故农历取不到时这一块也不出现
       *
       * 当天就是春节时写「今天」而不是「0 天」—— 后者读起来像「还没到」。
       */
      if (info?.spring !== undefined) {
        const [sy, sm, sd] = info.spring.split("-").map(Number)
        const left = daysBetween(at, new Date(sy, sm - 1, sd))
        body.push(
          api.h("div", { class: "cal-spring" }, [
            api.h("p", { class: "cal-spring-label" }, "距离春节"),
            api.h("b", { class: "cal-spring-num" }, left === 0 ? "今天" : String(left)),
            api.h("p", { class: "cal-spring-date" }, info.spring)
          ])
        )
      }

      return api.h("article", { class: "card cal" }, [api.h("h3", {}, "日历"), ...body])
    }
  }
}
