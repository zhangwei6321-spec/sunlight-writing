#!/usr/bin/env python3
"""把任意静态目录以「脱离进程组」的方式守护化起一个 HTTP 服务。

为什么需要它：在 WorkBuddy 的执行环境里，用 `nohup ... &` 启动的进程仍留在本次
工具调用的进程组内，调用一结束就被一起回收（表现为端口空、curl 502）。这里用
double-fork + os.setsid() 把子进程变成独立会话的首进程，从而长期存活。

用法：
    SERVE_ROOT=/path/to/dir SERVE_PORT=8777 python3 serve-daemon.py

环境变量（均可选）：
    SERVE_ROOT  默认 /Users/kafuqia/WorkBuddy/01/file-reader
    SERVE_HOST  默认 127.0.0.1
    SERVE_PORT  默认 8777
    SERVE_LOG   默认 ~/Library/Logs/zongjuan-serve.log
"""
import os
import re
import sys
import json as _json

ROOT = os.environ.get("SERVE_ROOT", "/Users/kafuqia/WorkBuddy/01/file-reader")
HOST = os.environ.get("SERVE_HOST", "127.0.0.1")
PORT = os.environ.get("SERVE_PORT", "8777")
LOG = os.path.expanduser(os.environ.get("SERVE_LOG", "~/Library/Logs/zongjuan-serve.log"))

# 杀掉两样继承来的东西：WorkBuddy 工具沙箱的临时出口代理（只在单次调用期间存活），
# 以及调用方私有变量（CODEBUDDY_* / CLAUDE_* 内含会话信息与明文 token）。
PROXY_VARS = ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy")
ENV_PREFIXES_TO_DROP = ("CODEBUDDY_", "CLAUDE_")


def daemonize() -> None:
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        os._exit(0)

    os.chdir(ROOT)
    os.umask(0o022)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    os.dup2(fd, 0)
    os.dup2(fd, 1)
    os.dup2(fd, 2)
    if fd > 2:
        os.close(fd)

    for name in PROXY_VARS:
        os.environ.pop(name, None)
    for name in [k for k in os.environ if k.startswith(ENV_PREFIXES_TO_DROP)]:
        os.environ.pop(name, None)

    sys.stderr.write("\n=== serve %s on http://%s:%s ===\n" % (ROOT, HOST, PORT))
    sys.stderr.flush()
    # 直接在当前进程里跑服务，不要再 exec（省一层进程）
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    from functools import partial
    import mimetypes

    # 补充几个内置表在部分系统上认不出的类型
    for ext, ctype in (
        (".mp4", "video/mp4"), (".m4v", "video/mp4"), (".m4a", "audio/mp4"),
        (".webm", "video/webm"), (".webp", "image/webp"), (".avif", "image/avif"),
        (".woff2", "font/woff2"), (".wasm", "application/wasm"),
    ):
        mimetypes.add_type(ctype, ext)

    class _Slice:
        """只读文件的前 N 个字节，喂给 shutil.copyfileobj。"""

        def __init__(self, fp, length):
            self.fp = fp
            self.left = length

        def read(self, n=-1):
            if self.left <= 0:
                return b""
            if n is None or n < 0 or n > self.left:
                n = self.left
            chunk = self.fp.read(n)
            self.left -= len(chunk)
            return chunk

        def close(self):
            self.fp.close()

    # ===== 通用数据持久化：data/<key>.json，供各页面保存历史/输入/作品数据 =====
    DATA_DIR = os.path.join(ROOT, "data")

    def _load_data(key):
        p = os.path.join(DATA_DIR, key + ".json")
        if not os.path.exists(p):
            return {}
        try:
            with open(p, encoding="utf-8") as f:
                return _json.load(f)
        except Exception:
            return {}

    def _save_data(key, payload):
        os.makedirs(DATA_DIR, exist_ok=True)
        p = os.path.join(DATA_DIR, key + ".json")
        with open(p, "w", encoding="utf-8") as f:
            _json.dump(payload, f, ensure_ascii=False, indent=2)

    def _valid_key(key):
        return bool(key) and bool(re.match(r"^[\w-]+$", key))

    def _write_json(self, code, obj):
        body = _json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    class Handler(SimpleHTTPRequestHandler):
        def send_response(self, *args, **kwargs):
            self._has_accept_ranges = False
            return super().send_response(*args, **kwargs)

        def end_headers(self):
            # 音视频拖动进度条靠它：没有 Accept-Ranges，前端会当成不可 seek 的资源
            if not getattr(self, "_has_accept_ranges", False):
                self.send_header("Accept-Ranges", "bytes")
                self._has_accept_ranges = True
            # 开发/演示场景，永远拿最新文件，别被浏览器缓存骗了
            self.send_header("Cache-Control", "no-store, must-revalidate")
            super().end_headers()

        def send_head(self):
            """在标准实现之上加单区间 Range 支持（Player 拖进度必需）。"""
            rng = self.headers.get("Range")
            if not rng:
                return super().send_head()

            path = self.translate_path(self.path)
            if os.path.isdir(path):
                return super().send_head()
            try:
                f = open(path, "rb")
            except OSError:
                return super().send_head()

            try:
                size = os.fstat(f.fileno()).st_size
                m = re.match(r"bytes=(\d*)-(\d*)\s*$", rng.strip())
                if not m or (m.group(1) == "" and m.group(2) == ""):
                    raise ValueError("bad range")
                if m.group(1) == "":
                    length = int(m.group(2))
                    start, end = max(0, size - length), size - 1
                else:
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else size - 1
                if start >= size or start > end:
                    raise ValueError("unsatisfiable")
                end = min(end, size - 1)
                length = end - start + 1
            except ValueError:
                f.close()
                self.send_response(416)
                self.send_header("Content-Range", "bytes */%d" % size)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None

            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Accept-Ranges", "bytes")
            self._has_accept_ranges = True
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
            self.send_header("Content-Length", str(length))
            self.send_header("Last-Modified", self.date_time_string(os.fstat(f.fileno()).st_mtime))
            self.end_headers()
            f.seek(start)
            return _Slice(f, length)

        def do_GET(self):
            path = self.path.split("?")[0]
            if path == "/api/data":
                from urllib.parse import urlparse, parse_qs
                qs = parse_qs(urlparse(self.path).query)
                key = (qs.get("key") or [""])[0]
                if not _valid_key(key):
                    _write_json(self, 400, {"ok": False, "err": "bad key"})
                    return
                _write_json(self, 200, {"ok": True, "key": key, "data": _load_data(key)})
                return
            super().do_GET()

        def log_message(self, fmt, *args):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))
            sys.stderr.flush()

        # 保存 AI 短篇「产出链接」分享页：POST /api/save-share
        def do_POST(self):
            try:
                path = self.path.split("?")[0]
                if path == "/api/data":
                    length = int(self.headers.get("Content-Length") or 0)
                    if length <= 0 or length > 32 * 1024 * 1024:
                        _write_json(self, 400, {"ok": False, "err": "bad length"})
                        return
                    raw = self.rfile.read(length)
                    try:
                        payload = _json.loads(raw.decode("utf-8"))
                    except Exception:
                        _write_json(self, 400, {"ok": False, "err": "bad json"})
                        return
                    key = payload.get("key") or ""
                    if not _valid_key(key) or "data" not in payload:
                        _write_json(self, 400, {"ok": False, "err": "bad key"})
                        return
                    _save_data(key, payload.get("data"))
                    _write_json(self, 200, {"ok": True, "key": key})
                    return
                if path != "/api/save-share":
                    self.send_response(404)
                    self.end_headers()
                    return
                length = int(self.headers.get("Content-Length") or 0)
                if length <= 0 or length > 4 * 1024 * 1024:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"bad length")
                    return
                raw = self.rfile.read(length)
                try:
                    payload = _json.loads(raw.decode("utf-8"))
                except Exception:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"bad json")
                    return
                html = payload.get("html") or ""
                title = (payload.get("title") or "AI短篇").strip() or "AI短篇"
                if not html or len(html) > 3 * 1024 * 1024:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"bad html")
                    return
                shares_dir = os.path.join(ROOT, "shares")
                os.makedirs(shares_dir, exist_ok=True)
                import time as _time
                ts = _time.strftime("%Y%m%d-%H%M%S")
                name = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", title)[:40] or "AI短篇"
                fname = "%s-%s.html" % (name, ts)
                fpath = os.path.join(shares_dir, fname)
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(html)
                rel = "/shares/" + fname
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(_json.dumps({"ok": True, "url": rel, "file": fname}).encode("utf-8"))
            except Exception as e:
                try:
                    self.send_response(500)
                    self.send_header("Content-Type", "text/plain; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(("err: %s" % e).encode("utf-8"))
                except Exception:
                    pass

        def log_message(self, fmt, *args):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))
            sys.stderr.flush()

    srv = ThreadingHTTPServer((HOST, int(PORT)), partial(Handler, directory=ROOT))
    srv.serve_forever()


if __name__ == "__main__":
    daemonize()
