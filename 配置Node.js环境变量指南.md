# 配置Node.js环境变量指南

如果您已经安装了Node.js，但在命令行中运行`node -v`或`npm -v`时出现"无法识别"的错误，这通常是因为Node.js的安装路径没有添加到系统的PATH环境变量中。

## 检查Node.js安装路径
首先，您需要确定Node.js的安装路径。默认情况下，Node.js通常安装在以下位置：
- 32位系统：`C:\Program Files (x86)\nodejs`
- 64位系统：`C:\Program Files\nodejs`

请打开文件资源管理器，确认Node.js的安装位置。

## 手动配置环境变量
1. 右键点击"此电脑"（或"我的电脑"），选择"属性"
2. 点击"高级系统设置"
3. 点击"环境变量"按钮
4. 在"系统变量"区域中，找到并选择"Path"变量，然后点击"编辑"
5. 点击"新建"，然后输入Node.js的安装路径（例如`C:\Program Files\nodejs`）
6. 点击"确定"保存更改
7. 关闭所有打开的命令行窗口，然后重新打开一个新的命令行窗口
8. 运行`node -v`和`npm -v`来验证配置是否成功

## 自动配置脚本
您也可以使用以下批处理脚本来自动配置环境变量。请将以下内容保存为`配置Node.js环境变量.bat`文件，然后以管理员身份运行：

```batch
@echo off

:: 请修改为您的Node.js安装路径
set NODE_PATH=C:\Program Files\nodejs

:: 检查路径是否存在
if not exist "%NODE_PATH%" (
    echo 错误: 找不到Node.js安装路径 %NODE_PATH%
    echo 请修改脚本中的NODE_PATH变量为正确的安装路径
    pause
    exit /b 1
)

:: 添加到系统PATH
setx PATH "%PATH%;%NODE_PATH%" /M

:: 验证配置
echo Node.js路径已添加到系统环境变量
node -v
if %ERRORLEVEL% EQU 0 (
    echo Node.js配置成功!
) else (
    echo 配置失败，请尝试手动配置环境变量
)

pause
```

## 配置完成后
配置完成后，您可以返回VS Code插件开发指南，继续安装Yeoman和VS Code扩展生成器：
```bash
npm install -g yo generator-code
```

如果您仍然遇到问题，请尝试重新安装Node.js，并确保在安装过程中勾选了"Add to PATH"选项。