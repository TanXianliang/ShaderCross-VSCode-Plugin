# VS Code插件开发入门指南

## 前提条件
1. 安装Node.js（推荐v18以上版本）
   - 访问[Node.js官方下载页面](https://nodejs.cn/download/)下载并安装
2. 安装VS Code
3. 确保npm已安装（通常随Node.js一起安装）

## 步骤1：安装开发工具
打开命令行工具，运行以下命令安装Yeoman和VS Code扩展生成器：
```bash
npm install -g yo generator-code
```

## 步骤2：创建插件项目
1. 运行以下命令创建新插件项目：
   ```bash
   yo code
   ```
2. 按照提示回答问题：
   - 选择扩展类型：New Extension (JavaScript)
   - 输入插件名称：ShaderCross
   - 输入插件标识符：shadercross
   - 输入插件描述：A VS Code extension for shader development with a text input UI
   - 选择是否创建git仓库：根据需求选择
   - 选择包管理器：npm

## 步骤3：打开项目
创建完成后，运行以下命令在VS Code中打开项目：
```bash
code shadercross
```

## 步骤4：添加文本输入框界面
1. 打开`extension.js`文件，替换为以下代码：
```javascript
const vscode = require('vscode');

exports.activate = function(context) {
    console.log('ShaderCross extension is now active!');

    // 注册命令
    let disposable = vscode.commands.registerCommand('shadercross.showInputPanel', function() {
        // 创建并显示输入框
        vscode.window.showInputBox({
            placeHolder: 'Enter your shader code here',
            prompt: 'Shader Input',
            value: '',
            validateInput: (text) => {
                if (text.length < 3) {
                    return 'Shader code must be at least 3 characters long';
                }
                return null;
            }
        }).then(value => {
            if (value) {
                vscode.window.showInformationMessage(`You entered: ${value}`);
                // 这里可以添加处理输入的逻辑
            }
        });
    });

    context.subscriptions.push(disposable);

    // 添加到侧边栏
    const panel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    panel.text = 'ShaderCross';
    panel.command = 'shadercross.showInputPanel';
    panel.show();
    context.subscriptions.push(panel);
};

exports.deactivate = function() {
    console.log('ShaderCross extension is now inactive!');
};
```

2. 打开`package.json`文件，添加命令配置：
```json
"contributes": {
    "commands": [
        {
            "command": "shadercross.showInputPanel",
            "title": "Show Shader Input Panel"
        }
    ]
}
```

## 步骤5：测试插件
1. 按F5键运行插件
2. 在新打开的VS Code窗口中，按Ctrl+Shift+P打开命令面板
3. 输入"Show Shader Input Panel"并执行
4. 测试文本输入框功能

## 步骤6：打包和发布（可选）
1. 安装vsce工具：
   ```bash
   npm install -g vsce
   ```
2. 打包插件：
   ```bash
   vsce package
   ```
3. 发布到VS Code市场（需要Microsoft账户）：
   ```bash
   vsce publish
   ```