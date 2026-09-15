/**
 * 模块职责：跑马灯组件 —— 一行字横向滚动，示范包自带样式表怎么用
 * 依赖方向：只用 `setup(api)` 注入的那些；样式在包根的 `style.css` 里
 * 生命周期：随组件挂载 setup 一次，句子取一次；滚动全靠 CSS 动画，没有计时器
 * 注意事项：示范「自带一份 .css」：横向滚动要 `@keyframes` 与 `overflow: hidden`，行内样式写不了，
 *          故在 `package.json` 声明 `webuiPanel.style`，面板会把每条选择器限定到本包之后注入。
 *          类名故意取得很泛（`.marquee`、`.track`）：限定之后实际生效的是
 *          `[data-panel="panels/webui-example"] .track`，故不必手工加前缀。
 *          **动画名反而必须加前缀**：`@keyframes` 的名字是全局的，面板不会去改它，两个包各写一段
 *          叫 `roll` 的动画时后注入的会盖掉前一份，表现为「另一个插件的动画忽然变了速度」。
 *          颜色一律取 `var(--…)`：写死的色值在另一套主题下会看不见。
 */

/** 取不到句子时滚动的那行字 */
const FALLBACK = "Yunzai NG —— 内核之外的一切都是插件"

/** 跑马灯组件 */
export const marqueeWidget = {
  id: "example.marquee",
  page: "overview",
  title: "跑马灯",
  defaultLayout: { w: 6, h: 1, minW: 3, minH: 1, resizable: true },

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 滚动的那行字 */
    const text = api.ref(FALLBACK)

    /*
     * 取一句当滚动内容，取不到就用兜底那句
     *
     * 不给失败态另画一行：这一枚示范的是样式，一行滚不动的错误提示对那件事毫无帮助，
     * 而兜底句子让组件在任何情形下都长得完整。
     */
    void (async () => {
      try {
        const got = await api.own("hitokoto")
        if (typeof got?.text === "string" && got.text !== "") text.value = got.text
      } catch {
        // 兜底句子已在 ref 里，什么都不必做
      }
    })()

    return () =>
      api.h("div", { class: "card marquee" }, [
        /*
         * 同一句重复两遍，是无缝循环的做法
         *
         * 只放一份时，动画走到 -100% 那一刻屏上是空的，表现为「滚完一轮要等一段空白」。
         * 两份首尾相接，位移到 -50% 正好与起点重合，故 `animation` 无须任何延迟处理。
         */
        api.h("div", { class: "track" }, [
          api.h("span", {}, text.value),
          // 第二份对读屏器是重复内容，故藏起来
          api.h("span", { "aria-hidden": "true" }, text.value)
        ])
      ])
  }
}
