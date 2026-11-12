#!/usr/bin/env bash
set -e

PLUGIN_NAME="antigravity-anti-fall"
TARGET_DIR="${HOME}/.gemini/config/plugins/${PLUGIN_NAME}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 正在安装 ${PLUGIN_NAME} 到 ${TARGET_DIR}..."

mkdir -p "$(dirname "${TARGET_DIR}")"

# 如果已存在同名软链接或目录，先安全移除
if [ -L "${TARGET_DIR}" ]; then
  rm -f "${TARGET_DIR}"
elif [ -d "${TARGET_DIR}" ]; then
  echo "⚠️ 发现已存在的旧目录，正在备份至 ${TARGET_DIR}.bak..."
  rm -rf "${TARGET_DIR}.bak"
  mv "${TARGET_DIR}" "${TARGET_DIR}.bak"
fi

# 建立软链接（支持动态开发）或直接复制
if [ "$1" == "--copy" ]; then
  cp -r "${SRC_DIR}" "${TARGET_DIR}"
  echo "📦 已完成文件复制安装。"
else
  ln -sf "${SRC_DIR}" "${TARGET_DIR}"
  echo "🔗 已建立软链接安装 (源码修改实时生效)。"
fi

echo ""
echo "✨ 安装成功！"
echo "💡 提示：重启 Antigravity 或等待几秒，插件 Sidecar 会自动启动并在输入框操作栏左侧亮起徽标。"
