// 导航栏「随便看看」：随机跳转，保证同一篇文章在所有文章轮询一遍后才会出现第二次
// 逻辑：洗牌队列存入 localStorage，按顺序取；一轮取完自动重新洗牌
// localStorage 不可写（隐私模式等）时退化为内存状态，单页面会话内仍保持轮询
(function () {
  var KEY = 'random-post-queue'
  var postList = null
  var pending = null
  var memState = null // 内存兜底状态
  var storageBroken = false // setItem 抛错一次后，本会话不再尝试 localStorage

  // Fisher-Yates 洗牌
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1))
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t
    }
    return arr
  }

  function loadState() {
    if (storageBroken) return memState
    var state = null
    try { state = JSON.parse(localStorage.getItem(KEY)) } catch (e) {}
    // localStorage 里是写不进去的旧数据时，以内存中的最新状态为准
    if (memState && (!state || !Array.isArray(state.queue) || (state.cursor || 0) < (memState.cursor || 0))) {
      return memState
    }
    return state
  }

  function saveState(state) {
    memState = state
    if (storageBroken) return
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch (e) {
      storageBroken = true
    }
  }

  // 从洗牌队列取下一篇（挂到 window，供 /random/ 中转页共用）
  window.getRandomPostUrl = function (list) {
    var state = loadState()

    // 队列与当前文章列表对齐：剔除已删除的，追加新增的
    var hasPriorQueue = state && Array.isArray(state.queue)
    var queue = hasPriorQueue
      ? state.queue.filter(function (p) { return list.indexOf(p) !== -1 })
      : []
    for (var i = 0; i < list.length; i++) {
      if (queue.indexOf(list[i]) === -1) queue.push(list[i])
    }

    var cursor = state && Number.isInteger(state.cursor) ? state.cursor : 0

    // 首次访问：先洗牌，保证第一轮就是随机顺序
    if (!hasPriorQueue) shuffle(queue)

    // 本轮走完：重新洗牌，开始新一轮
    if (cursor >= queue.length) {
      shuffle(queue)
      // 避免新一轮第一篇与上一轮最后一篇连续重复（last 存的是不含 / 的路径，与 queue 元素同格式）
      if (queue.length > 1 && state && state.last && queue[0] === state.last) {
        var t = queue[0]
        queue[0] = queue[queue.length - 1]
        queue[queue.length - 1] = t
      }
      cursor = 0
    }

    var url = queue.length ? '/' + queue[cursor] : '/archives/'
    saveState({ queue: queue, cursor: cursor + 1, last: queue.length ? queue[cursor] : '' })
    return url
  }

  function fetchList() {
    if (postList) return Promise.resolve(postList)
    if (pending) return pending
    pending = fetch('/random.json', { cache: 'no-cache' })
      .then(function (res) { return res.json() })
      .then(function (list) {
        postList = Array.isArray(list) ? list : []
        pending = null
        return postList
      })
      .catch(function () {
        pending = null
        return []
      })
    return pending
  }

  // 页面空闲时提前拉取文章列表，点击时零延迟
  if ('requestIdleCallback' in window) {
    requestIdleTimeout()
  } else {
    setTimeout(fetchList, 2000)
  }

  function requestIdleTimeout() {
    requestIdleCallback(fetchList, { timeout: 3000 })
  }

  function go() {
    var url = window.getRandomPostUrl(postList)
    if (window.pjax && window.pjax.loadUrl) {
      window.pjax.loadUrl(url)
    } else {
      window.location.href = url
    }
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a[href="/random/"]') : null
    if (!link) return
    e.preventDefault()
    e.stopPropagation()
    if (postList) {
      go()
    } else {
      fetchList().then(go)
    }
  })
})()
