#!/bin/bash

echo "启动 Teo Recorder 前后端分离版本"
echo

# 启动后端服务
echo "1. 启动后端服务..."
cd backend && pixi run start &
BACKEND_PID=$!

sleep 3

# 启动前端服务
echo "2. 启动前端服务..."
cd frontend && pixi run start &
FRONTEND_PID=$!

echo
echo "服务启动中..."
echo "前端地址: http://localhost:8080"
echo "后端地址: http://localhost:5000"
echo "管理界面: http://localhost:5000/admin"
echo
echo "按 Ctrl+C 退出..."

# 等待用户中断
trap "echo '停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait