#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="${1:?Usage: setup-node.sh <node-version> [npm-version]}"
NPM_VERSION="${2:-}"

os_name="$(uname -s)"
arch_name="$(uname -m)"

case "${os_name}" in
  Linux) node_os="linux" ;;
  Darwin) node_os="darwin" ;;
  *)
    echo "Unsupported OS: ${os_name}" >&2
    exit 1
    ;;
esac

case "${arch_name}" in
  x86_64) node_arch="x64" ;;
  aarch64 | arm64) node_arch="arm64" ;;
  *)
    echo "Unsupported architecture: ${arch_name}" >&2
    exit 1
    ;;
esac

temp_dir="${AGENT_TEMPDIRECTORY:-${RUNNER_TEMP:-/tmp}}"
install_dir="${temp_dir}/node-v${NODE_VERSION}-${node_os}-${node_arch}"
archive_path="${temp_dir}/node-v${NODE_VERSION}-${node_os}-${node_arch}.tar.xz"
download_url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${node_os}-${node_arch}.tar.xz"

rm -rf "${install_dir}"
mkdir -p "${install_dir}"

echo "Downloading Node.js from ${download_url}"
curl -fsSL "${download_url}" -o "${archive_path}"
tar -xJf "${archive_path}" -C "${install_dir}" --strip-components=1

echo "##vso[task.prependpath]${install_dir}/bin"
export PATH="${install_dir}/bin:${PATH}"

echo "Node.js version: $(node -v)"

if [[ -n "${NPM_VERSION}" ]]; then
  npm install --global "npm@${NPM_VERSION}"
fi

echo "Node.js version after setup: $(node -v)"
echo "npm version after setup: $(npm -v)"
