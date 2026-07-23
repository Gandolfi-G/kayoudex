@echo off
cd /d "%~dp0"
echo.
echo === Kayoudex - commit et push ===
echo.
git status
echo.
echo Ajout des fichiers...
git add .
if errorlevel 1 goto error
echo.
echo Creation du commit...
git commit -m "Add Bob Sponge license"
if errorlevel 1 (
  echo.
  echo Aucun commit cree. Il n'y a peut-etre rien a committer, ou Git demande une action.
)
echo.
echo Push vers GitHub...
git push
if errorlevel 1 goto auth
echo.
echo Push termine.
pause
exit /b 0

:auth
echo.
echo Le push a echoue. Si le token GitHub est perime, lance cette commande puis relance ce fichier :
echo.
echo git credential-manager github login
echo.
pause
exit /b 1

:error
echo.
echo Une erreur Git est survenue avant le push.
pause
exit /b 1
