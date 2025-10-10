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
					case 'compileShader':
						this.compileShader(
							message,
							webviewView
						);
						return;
					case 'openIncludeFloderDialg':
						this.openIncludeFloderDialg(webviewView);
						return;
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	comileShader_dxc(message, webviewView) {
		// 获取dxc.exe路径
			const dxcPath = path.join(this.context.extensionPath, 'external', 'dxc', 'bin', 'x64', 'dxc.exe');

			// 构建编译参数
			const args = [];

			// 获取当前活动编辑器中的着色器文件路径
			const activeEditor = vscode.window.activeTextEditor;
			if (!activeEditor) {
				vscode.window.showErrorMessage('No active editor found. Please open a shader file first.');
				return;
			}

			const shaderFilePath = activeEditor.document.uri.fsPath;
			args.push(shaderFilePath); // 添加输入文件路径

			// 添加着色器模型参数
			if (message.shaderMode) {
				args.push(`-T${message.shaderMode}`);
			}

			// 添加输出类型参数
			if (message.outputType) {
				args.push(`-E${message.entryPoint || 'main'}`); // 入口点，默认为main
				args.push(`-Fo${path.join(vscode.workspace.rootPath || '', 'compiled', 'output.' + message.outputType.toLowerCase())}`);
			}

			// 添加宏定义
			if (message.macros && message.macros.length > 0) {
				message.macros.forEach(macro => {
					args.push(`-D${macro}`);
				});
			}

			// 添加Include路径
			if (message.includePaths && message.includePaths.length > 0) {
				message.includePaths.forEach(path => {
					args.push(`-I${path}`);
				});
			}

			// 添加额外选项
			if (message.additionalOptionEnabled && message.additionalOption) {
				args.push(message.additionalOption);
			}

			// 输出编译命令信息
			vscode.window.showInformationMessage(`Running: ${dxcPath} ${args.join(' ')}`);

			// 确保输出目录存在
			const outputDir = path.join(vscode.workspace.rootPath || '', 'compiled');
			if (!fs.existsSync(outputDir)) {
				try {
					fs.mkdirSync(outputDir, { recursive: true });
					vscode.window.showInformationMessage(`Created output directory: ${outputDir}`);
				} catch (mkdirError) {
					vscode.window.showErrorMessage(`Failed to create output directory: ${mkdirError.message}`);
					return;
				}
			}

			// 执行dxc.exe
			const { exec } = require('child_process');
			exec(`${dxcPath} ${args.join(' ')}`, (error, stdout, stderr) => {
				let result = '';
				if (error) {
					result = `Compilation failed: ${error.message}\n\n${stderr}`;
					vscode.window.showErrorMessage(result);
				} else {
					result = `Compilation successful!\n\n${stdout}`;
					vscode.window.showInformationMessage('Shader compiled successfully');
				}

				// 发送编译结果到webview
				webviewView.webview.postMessage({
					command: 'compileResult',
					result: result
				});
			});
	}

	comileShader_fxc(message, webviewView) {
	}

	comileShader_glslang(message, webviewView) {
	}

	// 编译着色器
	compileShader(message, webviewView) {
		try {
			// 根据编译器类型选择编译函数
			switch (message.compiler) {
				case 'dxc':
					this.comileShader_dxc(message, webviewView);;
					break;
				case 'fxc':
					this.comileShader_fxc(message, webviewView);;
					break;
				case 'glslang':
					this.comileShader_glslang(message, webviewView);;
					break;
				default:
					vscode.window.showErrorMessage(`Unsupported compiler: ${message.compiler}`);
					return;
			}

			// 调用编译函数
			vscode.window.showInformationMessage(`Compiling shader with model ${message.shaderMode} to ${message.outputType} using ${message.compiler}`);
			
		} catch (error) {
			vscode.window.showErrorMessage(`Compilation failed: ${error.message}`);
		}
	}

	// 打开文件夹选择对话框
	openIncludeFloderDialg(webviewView) {
		try {
			// 显示文件夹选择对话框
			vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: 'Select Include Folder'
			}).then(result => {
				if (result && result[0]) {
					// 获取选定的文件夹路径
					const folderPath = result[0].fsPath;

					// 发送选定的文件夹路径到webview
					webviewView.webview.postMessage({
						command: 'folderSelected',
						path: folderPath
					});
				}
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open folder dialog: ${error.message}`);
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
