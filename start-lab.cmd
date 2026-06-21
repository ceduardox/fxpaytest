@echo off
cd /d %~dp0
if exist start-lab.out.log del /q start-lab.out.log
if exist start-lab.err.log del /q start-lab.err.log
start "" /b node server.js 1>>start-lab.out.log 2>>start-lab.err.log
