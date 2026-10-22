#!/bin/sh
# Une el código y genera la página autónoma (index.html) a partir de app.html
cd "$(dirname "$0")"
cat src/01-core.js src/02-views.js src/03-sheets.js src/04-more.js src/05-gastos.js src/07-licencia.js src/08-extras.js src/06-actions.js src/09-actions2.js > app.js
{
  printf '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#0B3B8F">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icons/logo.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="icons/icon-192.png">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat app.html
  printf '\n</body>\n</html>\n'
} > index.html
