#!/bin/bash
# Kopierer three.js og QR-encoderen ind i public/vendor, så public/ er et selvstændigt statisk site, der kan
# rsynces hvor som helst. Kør igen, når npm install har skiftet version.
set -euo pipefail
cd "$(dirname "$0")"
J=node_modules/three/examples/jsm
mkdir -p public/vendor/addons/loaders public/vendor/addons/libs public/vendor/addons/utils
cp node_modules/three/build/three.module.js public/vendor/three.module.js
cp $J/loaders/GLTFLoader.js public/vendor/addons/loaders/
cp $J/libs/meshopt_decoder.module.js public/vendor/addons/libs/
cp $J/utils/BufferGeometryUtils.js public/vendor/addons/utils/
cp node_modules/qrcode-generator/dist/qrcode.js public/vendor/qrcode.js
echo "vendor opdateret: three $(node -p "require('./node_modules/three/package.json').version"), qrcode-generator $(node -p "require('./node_modules/qrcode-generator/package.json').version")"
