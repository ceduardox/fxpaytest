@echo off
echo Sincronizando la copia del laboratorio (_lab_copy) con los archivos originales...
cd /d %~dp0
robocopy ".." "." /E /XD _lab_copy .git .local_pg18 .worktrees node_modules /XF .env COPIA_LAB.md start-lab.cmd start-lab.ps1 sync-lab.cmd *.log
echo Sincronizacion completada con exito!
pause
