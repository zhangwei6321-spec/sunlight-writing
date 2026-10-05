/* 日光写作 · 数据持久化适配层
 *
 * 优先读写服务端 /api/data（由 serve-daemon.py 提供），
 * 一旦检测到没有后端（例如 GitHub Pages 这类纯静态托管），自动降级到 localStorage：
 * 功能不报错、数据照样存得住，只是不再跨设备共享。
 *
 * 用法：
 *   RGData.get(key).then(function (r) { r.data; r.source; });  // source: 'server' | 'local' | 'none'
 *   RGData.set(key, value).then(function (r) { r.ok; r.source; }); // source: 'server+local' | 'local'
 *   RGData.del(key);
 *   RGData.available().then(function (ok) {});
 */
(function (global) {
  'use strict';

  var LS_PREFIX = 'rgyw_srv_';   // 服务端数据的本地镜像键前缀
  var PROBE_TTL = 30000;         // 判定「无后端」后的静默期，避免反复发无效请求
  var _available = null;         // null=未知 / true=可用 / false=不可用
  var _checkedAt = 0;

  function lsKey(key) { return LS_PREFIX + String(key); }

  function lsGet(key) {
    try {
      var raw = global.localStorage.getItem(lsKey(key));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function lsSet(key, value) {
    try {
      global.localStorage.setItem(lsKey(key), JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  function lsDel(key) {
    try { global.localStorage.removeItem(lsKey(key)); } catch (e) { /* ignore */ }
  }

  /* 服务端在「该 key 没有数据」时返回 {}，视同空 */
  function isEmpty(v) {
    if (v === null || v === undefined) return true;
    if (typeof v !== 'object') return false;
    if (Array.isArray(v)) return v.length === 0;
    for (var k in v) {
      if (Object.prototype.hasOwnProperty.call(v, k)) return false;
    }
    return true;
  }

  function shouldTry() {
    if (_available === false && (Date.now() - _checkedAt) < PROBE_TTL) return false;
    return true;
  }

  function mark(ok) { _available = !!ok; _checkedAt = Date.now(); }

  /* 任何失败都不抛异常，统一 resolve(null)，调用方无需写 catch */
  function request(method, url, body) {
    if (typeof global.fetch !== 'function') return Promise.resolve(null);
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return global.fetch(url, opts).then(function (res) {
      if (!res || !res.ok) throw new Error('http ' + (res && res.status));
      return res.json();
    }).then(function (json) {
      mark(true);
      return json;
    }).catch(function () {
      mark(false);
      return null;
    });
  }

  function get(key) {
    if (!shouldTry()) {
      var cached = lsGet(key);
      return Promise.resolve({ data: cached, source: cached ? 'local' : 'none' });
    }
    return request('GET', '/api/data?key=' + encodeURIComponent(key)).then(function (json) {
      if (json && json.ok && !isEmpty(json.data)) {
        lsSet(key, json.data);                       // 服务端有数据 → 镜像到本地
        return { data: json.data, source: 'server' };
      }
      var local = lsGet(key);
      return { data: local, source: local ? 'local' : 'none' };
    });
  }

  function set(key, value) {
    var savedLocal = lsSet(key, value);              // 先落本地，静态站点也能存住
    if (!shouldTry()) {
      return Promise.resolve({ ok: savedLocal, source: 'local' });
    }
    return request('POST', '/api/data', { key: key, data: value }).then(function (json) {
      var ok = !!(json && json.ok);
      return { ok: ok || savedLocal, source: ok ? 'server+local' : 'local' };
    });
  }

  function del(key) {
    lsDel(key);
    return set(key, {});
  }

  function available() {
    if (_available !== null && !shouldTry()) return Promise.resolve(_available);
    return request('GET', '/api/data?key=__ping__').then(function (json) {
      return !!(json && json.ok);
    });
  }

  global.RGData = {
    get: get,
    set: set,
    del: del,
    available: available,
    localStorageKey: lsKey,
    hasLocal: function (key) { return lsGet(key) !== null; }
  };
})(window);
