@echo on
echo 启动后端服务...
echo 服务地址: http://localhost:5000
echo 管理界面: http://localhost:5000/admin
echo.
cd /d "%~dp0"
pixi run start