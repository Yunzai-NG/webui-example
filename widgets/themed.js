/**
 * 模块职责：「跟着主题走」组件 —— 示范 `api.theme` 与 `api.ui`
 * 依赖方向：只用 `setup(api)` 注入的那些；不 import 任何东西
 * 生命周期：随组件挂载 setup 一次
 * 注意事项：**多数组件用不着本文件里的任何一样。** 颜色写成 `var(--text)`、外层用 `.card`，
 *          换主题时就自动跟着变。这一枚示范的是「更进一步」的两件事：
 *          1. 用面板自己的开关（`api.ui.Switch`）而不是手写一个 —— 主题给开关换了表情包滑块，
 *             这里就是那两张表情；手写的开关换不了皮。
 *          2. 读主题的图（`api.theme.asset("empty")`）—— 主题给了空状态插图就用它，没给就用自己的。
 *          需要 webui 0.7.0 起的 `api.theme` / `api.ui`；更早的 webui 没有这两样，故先判一下再用。
 */

/** 没有主题插图时自己画的那一枚：一片叶子 */
const LEAF = "M12 21c0-8 4-14 9-16-1 7-4 13-9 16zM12 21c0-6-3-10-8-12 0 6 3 10 8 12"

/** 「跟着主题走」组件 */
export const themedWidget = {
  id: "example.themed",
  page: "overview",
  title: "跟着主题走",
  defaultLayout: { w: 4, h: 3, minW: 3, minH: 2, resizable: true, fit: true },
  defaultHidden: true,

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    const on = api.ref(true)
    const h = api.h
    // 旧版 webui 没有这两样：退成一枚只说明情况的卡片，而不是报错
    const theme = api.theme
    const ui = api.ui

    return () => {
      if (theme === undefined || ui === undefined) {
        return h("div", { class: "card" }, [h("p", { class: "sub" }, "这一枚要 webui 0.7.0 起才有的 api.theme / api.ui")])
      }
      const art = theme.asset("empty")
      return h("div", { class: "card themed" }, [
        h("div", { class: "themed-head" }, [
          h("b", null, "跟着主题走"),
          h("span", { class: "tag" }, `${theme.id.value} · ${theme.scheme.value === "dark" ? "深色" : "浅色"}`)
        ]),
        art === undefined
          ? h(ui.Icon, { class: "themed-art", path: LEAF })
          : h("img", { class: "themed-art", src: art, alt: "" }),
        h("label", { class: "themed-row" }, [
          h(ui.Switch, { checked: on.value, label: "示例开关", onChange: value => (on.value = value) }),
          h("span", null, on.value ? "开着 —— 滑块是主题给的图" : "关着")
        ])
      ])
    }
  }
}
