// 导航栏「随便看看」：点击时直接随机跳转到一篇文章，不经过 /random/ 中转页
(function () {
  var postList = null
  var pending = null

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

  function randomUrl() {
    return postList && postList.length
      ? '/' + postList[Math.floor(Math.random() * postList.length)]
      : '/archives/'
  }

  function go() {
    var url = randomUrl()
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
