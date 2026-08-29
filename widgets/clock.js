/**
 * 模块职责：时间组件 —— 显示当前时间，格式与内容由配置决定
 * 依赖方向：只用 `setup(api)` 注入的那些；农历经包的 node 侧取
 * 生命周期：随组件挂载 setup 一次，自带一个 setInterval，卸载时清掉
 * 注意事项：**这枚组件示范的是「配置改完即生效」。** 五项配置全部经 `api.config` 读，而它是一个
 *          computed —— 故渲染函数里每次取值都是当下的值，不必刷新页面。**须每次现取，
 *          不能在 setup 里解构存下来**：解构的那一刻取到的是当时的值，此后配置改了它不会变，
 *          而这种错的表现是「改了配置没反应」，与「配置没保存上」看起来一模一样。
 *
 *          **自带节拍，不用 `api.onTick`。** 全局节拍是给采样用的（默认数秒一次），而时钟要
 *          每秒一次；反过来把全局节拍调到每秒一次，会让所有采样组件都跟着每秒发一次请求。
 *          间隔本身是配置项，故这个 interval 要能随配置重建 —— 见 `retime`。
 *
 *          **农历在 node 侧算。** 查表数据不该进浏览器；且那份依赖装不上时，这一项要能
 *          自己退回不显示并说明，而不是让整枚组件报错（同「测不到时不要显示 0」）。
 */

/** 星期的中文说法，`Date.getDay()` 的顺序 */
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

/**
 * 补足两位
 * @param value 数字
 * @returns 两位字符串
 */
function pad(value) {
  return String(value).padStart(2, "0")
}

/** 时间组件 */
export const clockWidget = {
  id: "example.clock",
  page: "overview",
  title: "时间",
  defaultLayout: { w: 3, h: 2, minW: 2, minH: 2, resizable: true },

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 当前时刻；每个节拍换一个新的 Date */
    const now = api.ref(new Date())
    /** 农历文字；空串意为不显示或还没取到 */
    const lunar = api.ref("")
    /** 农历取不到的原因，多半是依赖没装 */
    const lunarError = api.ref("")

    /** 计时器句柄 */
    let timer
    /** 上一次用的间隔秒数，配置改了才重建计时器 */
    let period = 0

    /**
     * 按配置重建计时器
     *
     * 每次重画都调它，但只在间隔真的变了时才动手 —— 每次重画都清掉再建一个，
     * 会让秒针在使用者改任何一项无关配置时错一拍。
     * @param seconds 间隔秒数
     */
    const retime = seconds => {
      if (seconds === period) return
      period = seconds
      if (timer !== undefined) clearInterval(timer)
      timer = setInterval(() => {
        now.value = new Date()
      }, seconds * 1000)
    }

    /**
     * 取农历
     *
     * 只在开了那一项时才请求，且按日期缓存：农历一天只变一次，而这枚组件每秒重画。
     */
    let lunarDay = ""
    const loadLunar = async date => {
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      if (key === lunarDay) return
      lunarDay = key
      try {
        // 不传日期：node 侧自己取「今天」。受限上下文的 handler 读不到查询串，
        // 且农历的今天该由跑着的机器说，而不是由一个可能时区不同的浏览器说
        const got = await api.own("lunar")
        lunar.value = got.text
        lunarError.value = ""
      } catch (err) {
        lunar.value = ""
        lunarError.value = err instanceof Error ? err.message : String(err)
      }
    }

    /*
     * 自带的计时器要自己收
     *
     * `api.onTick` 会自动退订，而这一个是本组件自己建的 —— 不收的话，组件从版面上
     * 移除之后它仍每秒跑一次、仍在改一个没人看的 ref，直到整页刷新。
     */
    api.onUnmounted(() => {
      if (timer !== undefined) clearInterval(timer)
    })

    return () => {
      // 每次现取，不解构存下来 —— 见文件头
      const cfg = api.config.value
      const seconds = typeof cfg.interval === "number" ? cfg.interval : 1
      const showSeconds = cfg.showSeconds !== false
      const showWeekday = cfg.showWeekday !== false
      const showLunar = cfg.showLunar === true
      const half = cfg.format === "12h"

      retime(seconds)

      const at = now.value
      const hours = half ? at.getHours() % 12 || 12 : at.getHours()
      const time =
        `${pad(hours)}:${pad(at.getMinutes())}` + (showSeconds ? `:${pad(at.getSeconds())}` : "")
      const suffix = half ? (at.getHours() < 12 ? " AM" : " PM") : ""

      if (showLunar) void loadLunar(at)

      /*
       * 用面板自带的 `.stat`（大字 + 说明），不自定义类名
       *
       * **面板插件带不了 CSS。** 写一个面板样式表里没有的类名，那一行就是无样式的纯文本 ——
       * 而它不报任何错。故一律取既有的类：`.stat`（b 是大字、span 是说明）、`.card`、
       * `.hint`、`.err`、`.mono`、`.plain`、`.toolbar`、`.tag`、`.banner`。
       */
      const lines = [
        api.h("b", {}, `${time}${suffix}`),
        api.h(
          "span",
          {},
          `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
            (showWeekday ? ` 星期${WEEKDAYS[at.getDay()]}` : "")
        )
      ]

      if (showLunar && lunar.value !== "") lines.push(api.h("span", {}, lunar.value))
      /*
       * 农历取不到时说明缘由，而不是静默少一行
       *
       * 使用者刚刚勾上了「显示农历」，若什么都不出现，他会以为那个开关坏了。
       */
      if (showLunar && lunarError.value !== "") {
        lines.push(api.h("span", {}, "农历取不到（多半是包的依赖没装上），暂只显示公历"))
      }

      return api.h("div", { class: "stat" }, lines)
    }
  }
}
