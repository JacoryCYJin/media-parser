#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT/.dev"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"
MEDIA_DIR="$ROOT/apps/desktop"
MEDIA_CORE_DIR="$ROOT/services/media-core"
PID_FILE="$PID_DIR/desktop.pid"
LOG_FILE="$LOG_DIR/desktop.log"

usage() {
  cat <<'EOF'
Media Parser 开发服务脚本

用法:
  bash scripts/dev.sh [start]    启动桌面端
  bash scripts/dev.sh stop       停止当前 Media Parser 实例
  bash scripts/dev.sh restart    重启当前 Media Parser 实例
  bash scripts/dev.sh status     查看桌面端与 media-core 状态
  bash scripts/dev.sh logs       查看桌面端日志
  bash scripts/dev.sh ls         列出服务
EOF
}

ensure_runtime_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

is_pid_running() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
  [[ -f "$PID_FILE" ]] && cat "$PID_FILE"
}

process_cwd() {
  local pid="$1"

  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/ { sub(/^n/, ""); print; exit }'
}

desktop_root_pids() {
  local pid command

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    [[ "$(process_cwd "$pid")" == "$MEDIA_DIR" ]] || continue
    command="$(ps -o command= -p "$pid" 2>/dev/null || true)"
    [[ "$command" == *"node scripts/run-electron-vite.mjs dev"* ]] && printf '%s\n' "$pid"
  done < <(pgrep -f 'run-electron-vite\.mjs dev' 2>/dev/null || true)
}

media_core_pids() {
  local pid command

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    [[ "$(process_cwd "$pid")" == "$MEDIA_CORE_DIR" ]] || continue
    command="$(ps -o command= -p "$pid" 2>/dev/null || true)"
    [[ "$command" == *" run_dev.py"* ]] && printf '%s\n' "$pid"
  done < <(pgrep -f 'run_dev\.py' 2>/dev/null || true)
}

is_descendant_of() {
  local pid="$1"
  local ancestor="$2"
  local parent

  while [[ -n "$pid" && "$pid" != "1" ]]; do
    [[ "$pid" == "$ancestor" ]] && return 0
    parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    [[ -n "$parent" && "$parent" != "$pid" ]] || return 1
    pid="$parent"
  done

  return 1
}

has_runtime() {
  local managed_pid

  managed_pid="$(read_pid || true)"
  is_pid_running "$managed_pid" && return 0
  desktop_root_pids | grep -q . && return 0
  media_core_pids | grep -q . && return 0
  return 1
}

terminate_pid() {
  local pid="$1"
  local child

  if ! is_pid_running "$pid"; then
    return 0
  fi

  while read -r child; do
    [[ -n "$child" ]] && terminate_pid "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)

  kill "$pid" 2>/dev/null || true
}

wait_for_pid_exit() {
  local pid="$1"
  local attempt

  for ((attempt = 0; attempt < 20; attempt++)); do
    ! is_pid_running "$pid" && return 0
    sleep 0.2
  done

  return 1
}

start() {
  local pid

  ensure_runtime_dirs
  if has_runtime; then
    status
    echo "[media] 已检测到运行中的 Media Parser；请先执行: bash scripts/dev.sh stop" >&2
    return 1
  fi

  rm -f "$PID_FILE"
  if [[ ! -d "$MEDIA_DIR/node_modules" ]]; then
    echo "[media] 未检测到 node_modules，正在安装依赖..."
    (cd "$MEDIA_DIR" && npm install)
  fi

  (
    cd "$MEDIA_DIR"
    nohup npm run dev >"$LOG_FILE" 2>&1 < /dev/null &
    echo $! >"$PID_FILE"
  )

  sleep 1
  pid="$(read_pid || true)"
  if is_pid_running "$pid"; then
    echo "[media] 已启动桌面端 (pid=$pid, log=$LOG_FILE)"
  else
    echo "[media] 启动失败，查看日志: $LOG_FILE" >&2
    exit 1
  fi
}

stop() {
  local pid target stopped=0

  pid="$(read_pid || true)"
  if is_pid_running "$pid"; then
    terminate_pid "$pid"
    wait_for_pid_exit "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    stopped=$((stopped + 1))
  fi

  while read -r target; do
    [[ -n "$target" ]] || continue
    is_pid_running "$target" || continue
    terminate_pid "$target"
    wait_for_pid_exit "$target" 2>/dev/null || kill -9 "$target" 2>/dev/null || true
    stopped=$((stopped + 1))
  done < <(desktop_root_pids)

  while read -r target; do
    [[ -n "$target" ]] || continue
    is_pid_running "$target" || continue
    terminate_pid "$target"
    wait_for_pid_exit "$target" 2>/dev/null || kill -9 "$target" 2>/dev/null || true
    stopped=$((stopped + 1))
  done < <(media_core_pids)

  rm -f "$PID_FILE"

  if has_runtime; then
    echo "[media] 仍检测到未停止的 Media Parser 进程，请执行 status 查看" >&2
    return 1
  fi

  if [[ "$stopped" -gt 0 ]]; then
    echo "[media] 已停止 $stopped 个 Media Parser 启动链路"
  else
    echo "[media] 当前未运行"
  fi
}

status() {
  local managed_pid pid
  local found=0

  managed_pid="$(read_pid || true)"
  if is_pid_running "$managed_pid"; then
    printf '%-24s %-10s %-8s %s\n' "media" "launcher" "$managed_pid" "managed"
    found=1
  fi

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    if is_pid_running "$managed_pid" && is_descendant_of "$pid" "$managed_pid"; then
      printf '%-24s %-10s %-8s %s\n' "media" "desktop" "$pid" "managed"
    else
      printf '%-24s %-10s %-8s %s\n' "media" "desktop" "$pid" "manual"
    fi
    found=1
  done < <(desktop_root_pids)

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    if is_pid_running "$managed_pid" && is_descendant_of "$pid" "$managed_pid"; then
      printf '%-24s %-10s %-8s %s\n' "media" "media-core" "$pid" "managed"
    else
      printf '%-24s %-10s %-8s %s\n' "media" "media-core" "$pid" "manual"
    fi
    found=1
  done < <(media_core_pids)

  [[ "$found" -gt 0 ]] || printf '%-24s %-10s %-8s %s\n' "media" "desktop" "-" "stopped"
}

logs() {
  if [[ -f "$LOG_FILE" ]]; then
    tail -n 120 "$LOG_FILE"
  else
    echo "[media] 暂无日志: $LOG_FILE"
  fi
}

list_services() {
  printf '%-24s %s\n' "SERVICE" "COMMAND"
  printf '%-24s %s\n' "media" "npm run dev"
}

main() {
  case "${1:-start}" in
    start) start ;;
    stop) stop ;;
    restart)
      stop
      start
      ;;
    status) status ;;
    logs) logs ;;
    ls|list) list_services ;;
    -h|--help|help) usage ;;
    *)
      echo "未知 Media Parser 命令: $1" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
