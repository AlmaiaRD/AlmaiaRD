@echo off
chcp 65001 >nul
title Migrar Imagenes (Almaia)
color 0A
echo ============================================
echo   MIGRACION DE IMAGENES DE PRODUCTOS
echo   (no cierre esta ventana hasta que termine)
echo ============================================
echo.

cd /d "%~dp0"

echo [1/4] Verificando Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  ERROR: No se encontro Node.js instalado.
  echo  Instalalo desde https://nodejs.org/ (version LTS) y vuelve a ejecutar.
  echo.
  pause
  exit /b 1
)
echo  Node.js OK
echo.

echo [2/4] Instalando dependencias (solo la primera vez, puede tardar)...
call npm install >nul 2>nul
echo  Dependencias listas.
echo.

echo [3/4] Instalando el navegador para capturar imagenes (solo la primera vez)...
call npx playwright install chromium >nul 2>nul
echo  Navegador listo.
echo.

echo [4/4] Ejecutando la migracion...
echo  Procesando 201 productos... (puede tardar varios minutos)
echo.
node scripts\migrate-images.mjs

echo.
echo ============================================
echo   TERMINADO. Revise el resumen de arriba.
echo   Detalle guardado en:
echo   scripts\migrate-images-results.txt
echo ============================================
echo.
pause
