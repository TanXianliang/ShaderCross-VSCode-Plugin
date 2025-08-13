// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');

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

		// 直接返回内联的HTML内容
		return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Shader Cross Explorer</title>
			<style>
				:root {
					--primary-bg: #1e1e1e;
					--secondary-bg: #252526;
					--tertiary-bg: #333333;
					--text-color: #d4d4d4;
					--text-muted: #8a8a8a;
					--border-color: #333333;
					--accent-color: #0078d7;
					--hover-color: #005a9e;
					--tree-line-color: #444444;
				}

				* {
					margin: 0;
					padding: 0;
					box-sizing: border-box;
				}

				body {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
					background-color: var(--primary-bg);
					color: var(--text-color);
					height: 100vh;
					display: flex;
					flex-direction: column;
				}

				/* Header Styles */
				.header {
					padding: 8px 16px;
					background-color: var(--secondary-bg);
					border-bottom: 1px solid var(--border-color);
					display: flex;
					align-items: center;
					justify-content: space-between;
				}

				.header-title {
					font-size: 16px;
					font-weight: 600;
				}

				.toolbar {
					display: flex;
					gap: 8px;
				}

				.toolbar-button {
					background: none;
					border: none;
					color: var(--text-color);
					cursor: pointer;
					width: 28px;
					height: 28px;
					border-radius: 4px;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.toolbar-button:hover {
					background-color: var(--tertiary-bg);
				}

				/* Main Content Styles */
				.main-content {
					flex-grow: 1;
					display: flex;
					overflow: hidden;
				}

				/* Explorer Panel Styles */
				.explorer-panel {
					width: 250px;
					background-color: var(--secondary-bg);
					border-right: 1px solid var(--border-color);
					display: flex;
					flex-direction: column;
				}

				.explorer-header {
					padding: 8px 12px;
					font-weight: 600;
					border-bottom: 1px solid var(--border-color);
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.explorer-tree {
					flex-grow: 1;
					overflow-y: auto;
					padding: 8px 0;
				}

				/* Tree Item Styles */
				.tree-item {
					display: flex;
					align-items: center;
					padding: 4px 12px;
					cursor: pointer;
					position: relative;
				}

				.tree-item:hover {
					background-color: var(--tertiary-bg);
				}

				.tree-item.active {
					background-color: var(--accent-color);
					color: white;
				}

				.tree-toggle {
					width: 16px;
					height: 16px;
					margin-right: 4px;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.tree-icon {
					width: 16px;
					height: 16px;
					margin-right: 4px;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				/* Content Area Styles */
				.content-area {
					flex-grow: 1;
					display: flex;
					flex-direction: column;
					overflow: hidden;
					padding: 16px;
				}

				.no-selection {
					flex-grow: 1;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					color: var(--text-muted);
				}

				.no-selection svg {
					width: 64px;
					height: 64px;
					margin-bottom: 16px;
				}

				/* Editor Styles */
				.editor-container {
					flex-grow: 1;
					margin-top: 16px;
					display: flex;
					flex-direction: column;
					background-color: var(--secondary-bg);
					border-radius: 4px;
					overflow: hidden;
				}

				.editor-header {
					padding: 8px 12px;
					border-bottom: 1px solid var(--border-color);
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.editor-filename {
					font-size: 14px;
					color: var(--text-muted);
				}

				.editor-content {
					flex-grow: 1;
					overflow: hidden;
				}

				textarea {
					width: 100%;
					height: 100%;
					background-color: var(--secondary-bg);
					color: var(--text-color);
					border: none;
					padding: 12px;
					font-family: 'Consolas', 'Monaco', monospace;
					resize: none;
					outline: none;
				}

				/* Compiler Controls */
				.compiler-controls {
					margin-top: 16px;
					display: flex;
					gap: 10px;
					align-items: center;
				}

				select {
					background-color: var(--secondary-bg);
					color: var(--text-color);
					border: 1px solid var(--border-color);
					border-radius: 4px;
					padding: 6px 8px;
				}

				button {
					background-color: var(--accent-color);
					color: white;
					border: none;
					border-radius: 4px;
					padding: 8px 16px;
					cursor: pointer;
					font-size: 14px;
				}

				button:hover {
					background-color: var(--hover-color);
				}

				/* Output Panel */
				.output-panel {
					margin-top: 16px;
					background-color: var(--secondary-bg);
					border-radius: 4px;
					border: 1px solid var(--border-color);
					display: flex;
					flex-direction: column;
				}

				.output-header {
					padding: 8px 12px;
					border-bottom: 1px solid var(--border-color);
					font-weight: 600;
				}

				.output-content {
					flex-grow: 1;
					height: 150px;
					overflow-y: auto;
					padding: 12px;
					font-family: 'Consolas', 'Monaco', monospace;
					font-size: 14px;
				}
			</style>
		</head>
		<body>
			<div class="compiler-header" style="min-width: 200px;">
				<div class="header-title">Compiler Options</div>
			</div>
			<div class="compiler-options">
				<div style="display: flex; align-items: center; gap: 8px;">
					<div class="compiler-type" style="min-width: 128px; min-height: 20px;">Compiler</div>
					<select class="compiler-select">
						<option value="dxc">DXC</option>
						<option value="fxc">FXC</option>
						<option value="glslang">GLSLang</option>
					</select>
				</div>
				<div style="display: flex; align-items: center; gap: 8px;">
					<div class="shader-type" style="min-width: 128px; min-height: 20px;">Shader Type</div>
					<select class="shader-type-select">
						<option value="vs">Vertex</option>
						<option value="ps">Pixel</option>
						<option value="gs">Geometry</option>
						<option value="hs">Hull</option>
						<option value="ds">Domain</option>
						<option value="cs">Compute</option>
						<option value="rgen">RayGeneration</option>
						<option value="rint">RayIntersection</option>
						<option value="rahit">RayAnyHit</option>
						<option value="rchit">RayClosest Hit</option>
						<option value="rmiss">RayMiss</option>
						<option value="rcall">RayCallable</option>
						<option value="rs">Amplification</option>
						<option value="ms">Mesh</option>
					</select>
				</div>
				<div style="display: flex; align-items: center; gap: 8px;">
					<div class="shader-mode" style="min-width: 128px; min-height: 20px;">Shader Mode</div>
					<select class="shader-mode-select">
						<option value="5_0">sm5.0</option>
						<option value="5_1">sm5.1</option>
						<option value="6_0">sm6.0</option>
						<option value="6_1">sm6.1</option>
						<option value="6_2">sm6.2</option>
						<option value="6_3">sm6.3</option>
						<option value="6_4">sm6.4</option>
						<option value="6_5">sm6.5</option>
						<option value="6_6">sm6.6</option>
						<option value="6_7">sm6.7</option>
						<option value="6_8">sm6.8</option>
						<option value="450">450</option>
						<option value="460">460</option>
					</select>
				</div>
				<div style="display: flex; align-items: center; gap: 8px;">
					<div class="output-type" style="min-width: 128px; min-height: 20px;">Output Type</div>
					<select class="output-type-select">
						<option value="DXIL">DXIL</option>
						<option value="DXBC">DXBC</option>
						<option value="SPIR-V">SPIR-V</option>
						<option value="HLSL">HLSL</option>
						<option value="HLSL-Preprocess">HLSL-Preprocess</option>
						<option value="GLSL">GLSL</option>
						<option value="MSL">MSL</option>
					</select>
				</div>
				<div style="display: flex; align-items: center; gap: 8px;">
					<div class="entry-point" style="min-width: 128px; min-height: 20px;">Entry Point</div>
					<input type="text" class="entry-point-input" placeholder="main" style="background-color: var(--secondary-bg); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 8px; flex-grow: 1;">
				</div>
				<div style="display: flex; align-items: center; gap: 8px;">
					<div class="additional-option" style="min-width: 108px; min-height: 20px;">Additional Option</div>
					<input type="checkbox" class="additional-option-checkbox" style="width: 12px; height: 12px; min-width: 12px; min-height: 12px; max-width: 12px; max-height: 12px;">
					<input type="text" class="additional-option-input" placeholder="Enter additional option" style="background-color: var(--secondary-bg); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 8px; flex-grow: 1;">
				</div>
			</div>
			</div>
			<div class="shadercode-header">
				<div class="header-title" style="min-width: 200px;">Shader Code Options</div>
			</div>
		</body>
		</html>
		`;
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
