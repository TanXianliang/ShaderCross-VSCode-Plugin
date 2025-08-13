# 解决npm脚本执行权限问题

## 问题描述
当您运行`npm -v`命令时，可能会遇到以下错误：
```
npm : 无法加载文件 E:\Program Files\nodejs\npm.ps1，因为在此系统上禁止运行脚本。有关详细信息，请参阅 https:/go.microsoft.com/fwlink/?LinkID=135170 中的 about_Execution_Policies。
所在位置 行:1 字符: 1
+ npm -v
+ ~~~
    + CategoryInfo          : SecurityError: (:) []，PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

这是由于Windows PowerShell的执行策略限制导致的。默认情况下，PowerShell不允许运行未签名的脚本。

## 解决方案
您可以通过以下几种方法解决此问题：

### 方法1：临时更改执行策略（推荐）
1. 以管理员身份打开PowerShell
2. 运行以下命令：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. 当提示确认时，输入`Y`并按Enter
4. 关闭PowerShell窗口并重新打开一个新的窗口
5. 尝试运行`npm -v`验证是否解决问题

### 方法2：使用Command Prompt (cmd.exe)而不是PowerShell
1. 打开命令提示符(cmd.exe)
2. 在命令提示符中运行npm命令，例如：
   ```cmd
   npm -v
   ```

### 方法3：永久更改执行策略（需要管理员权限）
1. 以管理员身份打开PowerShell
2. 运行以下命令：
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
   ```
3. 当提示确认时，输入`Y`并按Enter

## 执行策略说明
- `Restricted`: 不允许运行任何脚本（默认）
- `RemoteSigned`: 允许运行本地创建的脚本，但要求从互联网下载的脚本必须签名
- `Unrestricted`: 允许运行任何脚本，不管来源和是否签名

## 完成后
解决npm权限问题后，您可以继续安装Yeoman和VS Code扩展生成器：
```bash
npm install -g yo generator-code
```

然后按照README.md中的指南继续开发插件。