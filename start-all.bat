@echo off
echo 启动 Teo Recorder 前后端分离版本
echo.

echo 1. 启动后端服务...
start "后端服务" cmd /c "cd backend && pixi run start"

timeout /t 3

echo 2. 启动前端服务...
start "前端服务" cmd /c "cd frontend && pixi run start"

echo.
echo 服务启动中...
echo 前端地址: http://localhost:8080
echo 后端地址: http://localhost:5000
echo 管理界面: http://localhost:5000/admin
echo.
echo 按任意键退出...
pause > nul