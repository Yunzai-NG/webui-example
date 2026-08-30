/**
 * 模块职责：时钟组件 —— 一枚只报时刻的大字表，秒针每秒走一格
 * 依赖方向：只用 `setup(api)` 注入的那些；不 import 任何东西
 * 生命周期：随组件挂载 setup 一次，自带一个每秒的计时器，卸载时清掉
 * 注意事项：**这一枚只管「现在几点」。** 日期、周几、农历、干支、还剩多少天都在日历那一枚里
 *          （`widgets/calendar.js`）。两枚分开而不是一枚大卡片：报时要每秒重画，而日历那些
 *          一天才变一次 —— 合在一处等于让月历网格每秒重算一遍。
 *
 *          **自带节拍，不用 `api.onTick`。** 全局节拍是给采样用的（5 秒一拍），而秒针要每秒
 *          一次；反过来把全局节拍调快，会让所有采样组件都跟着每秒发一次请求。
 *
 *          **秒单独成一节、字号小一档。** 时分是要读的数，秒是用来确认「表在走」的 —— 三段
 *          同样大时，视线会被每秒都在变的那一段拽走。
 *
 *          **本组件没有任何配置项。** 12 小时制那类开关一并去掉了：本包的配置只留一言接口
 *          一项（见 `package.json`），而报时的写法在中文语境里没有歧义。
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

/** 时钟组件 */
export const clockWidget = {
  id: "example.clock",
  page: "overview",
  title: "时钟",
  defaultLayout: { w: 3, h: 2, minW: 2, minH: 2, resizable: true },

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 当前时刻；每秒换一个新的 Date */
    const now = api.ref(new Date())

    const timer = setInterval(() => {
      now.value = new Date()
    }, 1000)

    /*
     * 自带的计时器要自己收
     *
     * `api.onTick` 会自动退订，而这一个是本组件自己建的 —— 不收的话，组件从版面上移除之后
     * 它仍每秒跑一次、仍在改一个没人看的 ref，直到整页刷新。
     */
    api.onUnmounted(() => {
      clearInterval(timer)
    })

    return () => {
      const at = now.value

      return api.h("article", { class: "card clock" }, [
        api.h("div", { class: "clock-time" }, [
          api.h("b", {}, `${pad(at.getHours())}:${pad(at.getMinutes())}`),
          // 秒小一档、颜色淡一档，理由见文件头
          api.h("span", { class: "clock-sec" }, pad(at.getSeconds()))
        ]),
        api.h(
          "p",
          { class: "clock-date" },
          `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} 周${WEEKDAYS[at.getDay()]}`
        )
      ])
    }
  }
}
