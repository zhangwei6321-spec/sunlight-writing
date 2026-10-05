#!/bin/bash
cd "$(dirname "$0")"
nohup python3 -m http.server 8666 --bind 0.0.0.0 > /tmp/rgyw-server.log 2>&1 &
echo $! > /tmp/rgyw-server.pid
echo "服务器已启动，PID: $(cat /tmp/rgyw-server.pid)"
echo "日志: /tmp/rgyw-server.log"
echo "停止: kill \$(cat /tmp/rgyw-server.pid)"
