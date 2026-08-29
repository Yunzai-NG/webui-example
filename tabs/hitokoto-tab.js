/**
 * 模块职责：一言页签 —— 插件页上多出一栏，列出本次会话取过的句子
 * 依赖方向：只用 `setup(api)` 注入的那些
 * 生命周期：页签被点开时挂载，切走即卸载（插件页给页签内容加了 key）
 * 注意事项：**这枚页签示范的是「插件可以自加页签」。** 页签占的是整块内容区，故它适合放
 *          「一张列表 + 几个动作」这类撑得起一页的东西 —— 而不是把一枚卡片放大。
 *
 *          **历史只存在这一份组件实例里，刻意不落盘。** 切走页签再回来就空了，这是预期：
 *          落盘要占一处存储、要定上限、要考虑清理，而它是一份示例里的趣味功能。
 *          真要留存的东西该走包自己的 node 侧。
 *
 *          **一次取一批，而不是循环调单句接口。** 十次请求与一次请求对使用者是同一件事，
 *          而对 hitokoto.cn 是十倍的量 —— 别人的免费接口。
 */

/** 一次取几句 */
const BATCH = 5

/** 一言页签 */
export const hitokotoTab = {
  id: "example.hitokoto",
  title: "一言",

  /**
   * @param api 面板注入的能力
   * @returns 渲染函数
   */
  setup(api) {
    /** 取到的句子，新的在前 */
    const list = api.ref([])
    /** 正在取数 */
    const loading = api.ref(false)
    /** 失败原因 */
    const failed = api.ref("")

    /** 再取一批 */
    const load = async () => {
      if (loading.value) return
      loading.value = true
      try {
        // 路径固定，不带查询串 —— 受限上下文的 handler 读不到查询串，见 `server/index.js`
        const got = await api.own("hitokoto/batch")
        // 新的在前：使用者点了「再取一批」，他要看的是刚取来的那些
        list.value = [...got, ...list.value]
        failed.value = ""
      } catch (err) {
        failed.value = err instanceof Error ? err.message : String(err)
      } finally {
        loading.value = false
      }
    }

    void load()

    return () => {
      const rows = list.value.map((item, i) =>
        api.h("li", { key: `${i}:${item.text}` }, [
          api.h("span", {}, item.text),
          api.h(
            "span",
            { class: "hint" },
            [item.from, item.author].filter(one => one !== undefined && one !== "").join(" · ")
          )
        ])
      )

      return api.h("div", {}, [
        api.h("div", { class: "toolbar" }, [
          api.h(
            "button",
            { class: "primary", disabled: loading.value, onClick: () => void load() },
            loading.value ? "取数中…" : "再取一批"
          ),
          api.h("span", { class: "hint" }, `本次会话已取 ${list.value.length} 句`)
        ]),
        failed.value === "" ? null : api.h("p", { class: "banner" }, `取数失败：${failed.value}`),
        list.value.length === 0
          ? api.h("p", { class: "card hint" }, loading.value ? "正在取第一批…" : "还没有句子")
          : api.h("ul", { class: "plain card" }, rows)
      ])
    }
  }
}
