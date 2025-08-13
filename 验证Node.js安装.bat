@echo off

echo 正在验证Node.js安装...

try {
    node -v >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Node.js已安装: 
        node -v
    ) else (
        echo 错误: 未找到Node.js
        echo 请确保Node.js已安装并正确配置环境变量
        echo 参考: 配置Node.js环境变量指南.md
    )

    npm -v >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo npm已安装: 
        npm -v
    ) else (
        echo 错误: 未找到npm
        echo 请确保Node.js已安装并正确配置环境变量
        echo 参考: 配置Node.js环境变量指南.md
    )
} catch {
    echo 发生错误: %ERRORLEVEL%
}

pause