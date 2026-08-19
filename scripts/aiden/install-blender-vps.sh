#!/usr/bin/env bash
#
# Installs headless Blender on the KOBA VPS for the Aiden SKIN
# assembly pipeline (features/aiden/lib/blender-assembly.ts +
# scripts/aiden/assemble_skin.py), then smoke-tests it.
#
# This was prepared because item 2 of the Blender wiring work
# ("install + smoke-test Blender on the actual VPS") isn't something
# that could be done from the sandbox this was written in — no SSH
# access, no credentials entered even when offered. Run this yourself,
# via SSH or Plesk's own web terminal — not via the Plesk REST API,
# which doesn't do general system package management.
#
# Downloads the official Blender release tarball rather than using
# apt/yum's Blender package, which tends to lag several versions
# behind and vary by distro — this pins a known-good version instead.
#
# Usage (as root or with sudo):
#   chmod +x install-blender-vps.sh
#   ./install-blender-vps.sh
#
# After it finishes, add this to the KOBA app's environment (wherever
# AIDEN_* / TRIPO_API_KEY / REPLICATE_API_TOKEN already live, e.g. a
# systemd unit's Environment= lines or a .env file the process loads):
#   AIDEN_BLENDER_BINARY=/opt/blender/blender
#
# Then restart the KOBA app process so it picks up the new env var.

set -euo pipefail

BLENDER_VERSION="4.2.3"
BLENDER_MAJOR_MINOR="4.2"
INSTALL_DIR="/opt/blender"
TARBALL_NAME="blender-${BLENDER_VERSION}-linux-x64.tar.xz"
DOWNLOAD_URL="https://download.blender.org/release/Blender${BLENDER_MAJOR_MINOR}/${TARBALL_NAME}"

echo "==> Checking for an existing Blender install at ${INSTALL_DIR}"
if [ -x "${INSTALL_DIR}/blender" ]; then
  CURRENT_VERSION=$("${INSTALL_DIR}/blender" --version | head -n1 || true)
  echo "    Found: ${CURRENT_VERSION}"
  echo "    Delete ${INSTALL_DIR} first if you want to reinstall/upgrade."
else
  echo "==> Installing OS-level dependencies Blender's headless mode needs"
  # libxrender/libxi/libxfixes/libxkbcommon are typically present on a
  # desktop-derived Ubuntu base but NOT on a minimal server image —
  # Blender links against them even in --background mode.
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y --no-install-recommends \
      libxrender1 libxi6 libxfixes3 libxkbcommon0 libgl1 libxxf86vm1 \
      curl xz-utils ca-certificates
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y libXrender libXi libXfixes libxkbcommon mesa-libGL libXxf86vm curl xz ca-certificates
  elif command -v yum >/dev/null 2>&1; then
    yum install -y libXrender libXi libXfixes libxkbcommon mesa-libGL libXxf86vm curl xz ca-certificates
  else
    echo "!! Unrecognized package manager — install libXrender/libXi/libXfixes/libxkbcommon/libGL/libXxf86vm manually, then re-run this script." >&2
    exit 1
  fi

  echo "==> Downloading Blender ${BLENDER_VERSION} from ${DOWNLOAD_URL}"
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "${TMP_DIR}"' EXIT
  curl -fL --output "${TMP_DIR}/${TARBALL_NAME}" "${DOWNLOAD_URL}"

  echo "==> Extracting to ${INSTALL_DIR}"
  mkdir -p "${INSTALL_DIR}"
  tar -xJf "${TMP_DIR}/${TARBALL_NAME}" -C "${INSTALL_DIR}" --strip-components=1
fi

BLENDER_BIN="${INSTALL_DIR}/blender"
if [ ! -x "${BLENDER_BIN}" ]; then
  echo "!! Extraction finished but ${BLENDER_BIN} isn't executable — something went wrong." >&2
  exit 1
fi

echo "==> Verifying the binary runs headless"
"${BLENDER_BIN}" --background --version

echo "==> Smoke-testing scripts/aiden/assemble_skin.py's Python syntax (bpy itself only resolves inside Blender's own interpreter)"
"${BLENDER_BIN}" --background --python-expr "
import ast
with open('$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/assemble_skin.py') as f:
    ast.parse(f.read())
print('assemble_skin.py: syntax OK')
"

cat <<EOF

==============================================================
Blender ${BLENDER_VERSION} installed at: ${BLENDER_BIN}

Next steps:
  1. Add this to KOBA's environment and restart the app process:
       AIDEN_BLENDER_BINARY=${BLENDER_BIN}

  2. Real end-to-end smoke test (not just syntax): submit an actual
     SKIN generation job through the live product once
     AIDEN_BLENDER_BINARY is set and Tripo/Replicate credentials are
     configured, and confirm the resulting asset opens correctly in a
     glTF viewer with all three PBR maps visibly wired in (normal
     detail, specular/roughness variation, any emissive glow). This
     script only confirms Blender itself runs and the assembly
     script's Python parses — it does NOT run the actual mesh+PBR
     assembly end to end, since that needs a real Tripo mesh and real
     Kandinsky-generated maps to test against.
==============================================================
EOF
