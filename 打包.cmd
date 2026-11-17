@echo off
cd /d "%~dp0"
echo.
echo 请选择打包环境:
echo   1  测试环境
echo   2  生产环境
echo.
choice /c 12 /n /m "请按 1 或 2: "
if errorlevel 2 goto prod
set PACK_TARGET=test
echo.
echo 正在打包测试环境，只会更新 dist 文件夹...
goto build
:prod
set PACK_TARGET=prod
echo.
echo 正在打包生产环境，只会更新 dist 文件夹...
:build
call npm run build
if errorlevel 1 goto fail
if not exist "dist\index.html" goto fail
echo.
echo 打包完成。游戏文件在 dist 文件夹。
goto end
:fail
echo.
echo 打包失败。dist\index.html 没有生成。
:end
echo.
pause