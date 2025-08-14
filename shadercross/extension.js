// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');


// 视图提供者类
class ShaderCrossViewProvider {
	constructor(context) {
		this.context = context;
	}

	// 这个方法在VS Code需要显示视图时被调用


	resolveWebviewView(webviewView) {
		// 设置webview选项
		webviewView.webview.options = {
			enableScripts: true,
			retainContextWhenHidden: true
		};

		// 设置webview内容
		webviewView.webview.html = this.getWebviewContent(webviewView);

		// 处理来自webview的消息
		webviewView.webview.onDidReceiveMessage(
			(message) => {
				switch (message.command) {
					case 'openFile':
						this.openFile(message.fileName, webviewView);
						return;
					case 'compileShader':
						this.compileShader(
							message.fileName,
							message.inputFormat,
							message.outputFormat,
							webviewView
						);
						return;
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	// 打开文件并发送内容到webview
	openFile(fileName, webviewView) {
		try {
			// 在实际应用中，这里应该根据文件名从文件系统读取内容
			// 为了演示，我们返回一个模拟的着色器内容
			let fileContent = '';
			if (fileName.endsWith('.vert')) {
				fileContent = `#version 300 es

in vec3 a_position;

void main() {
  gl_Position = vec4(a_position, 1.0);
}`;
			} else if (fileName.endsWith('.frag')) {
				fileContent = `#version 300 es

precision highp float;

out vec4 outColor;

void main() {
  outColor = vec4(1.0, 0.0, 0.0, 1.0);
}`;
			} else if (fileName.endsWith('.glsl')) {
				fileContent = `// 工具函数
vec3 normalizeVec3(vec3 v) {
  float len = sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
  return v / len;
}`;
			}

			// 发送文件内容到webview
			webviewView.webview.postMessage({
				command: 'fileContent',
				fileName: fileName,
				content: fileContent
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
		}
	}

	// 编译着色器
	compileShader(fileName, inputFormat, outputFormat, webviewView) {
		try {
			vscode.window.showInformationMessage(`Compiling ${fileName} from ${inputFormat} to ${outputFormat}`);

			// 模拟编译过程
			setTimeout(() => {
				const result = `Compilation successful!

Converted ${fileName} from ${inputFormat} to ${outputFormat}.

Output:
// Compiled shader output would appear here
`;

				// 发送编译结果到webview
				webviewView.webview.postMessage({
					command: 'compileResult',
					result: result
				});
			}, 1000);
		} catch (error) {
			vscode.window.showErrorMessage(`Compilation failed: ${error.message}`);
		}
	}

	// 生成webview内容
	getWebviewContent(webviewView) {
		// 获取媒体资源的URI
		const getUri = (fileName) => {
			return webviewView.webview.asWebviewUri(
				vscode.Uri.file(path.join(this.context.extensionPath, 'resources', fileName))
			);
		};

		// 读取webview.html文件的内容
		try {
			const htmlPath = path.join(this.context.extensionPath, 'webview.html');
			let htmlContent = fs.readFileSync(htmlPath, 'utf8');

			// 无需替换VSCode API脚本引用，webview.html中使用了acquireVsCodeApi()

			return htmlContent;
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to read webview.html: ${error.message}`);
			return '<h1>Error loading webview content</h1>';
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('ShaderCross extension is now active!');

	// 注册视图提供者
	const viewProvider = new ShaderCrossViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('shaderCrossView', viewProvider)
	);

	// 注册命令
	const disposable = vscode.commands.registerCommand('shadercross.ShaderCross', function () {
		// 显示视图
		vscode.commands.executeCommand('workbench.view.extension.shaderCrossContainer');
	});

	context.subscriptions.push(disposable);
}


// This method is called when your extension is deactivated
function deactivate() {
	console.log('ShaderCross extension is now inactive!');
}

module.exports = {
	activate,
	deactivate
}
