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

	deleteTempFiles(filePathArray) {
		try {
			if (!Array.isArray(filePathArray)) return;
			filePathArray.forEach(filePath => {
				if (filePath && fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			});
		} catch (cleanupError) {
			console.warn(`删除临时文件失败: ${cleanupError.message}`);
		}
	}

	// 提取SPIR-V反射信息
	dumpSpirVReflectionInfo(spvFilePath) {
		return new Promise((resolve, reject) => {
			let outputReflectionInfo = '';

			// 检查文件是否存在
			if (!fs.existsSync(spvFilePath)) {
				reject(new Error(`SPIR-V文件不存在: ${spvFilePath}`));
				return;
			}

			// 获取spirv-cross可执行文件路径
			const spirvCrossPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');

			// 检查spirv-cross是否存在
			if (!fs.existsSync(spirvCrossPath)) {
				reject(new Error(`未找到spirv-cross可执行文件: ${spirvCrossPath}`));
				return;
			}

			try {
				// 使用spirv-cross获取反射信息 - 同步执行
				const { execSync } = require('child_process');
				const cmd = `"${spirvCrossPath}" "${spvFilePath}" --reflect`;
				
				// 同步执行命令，等待完成
				const stdout = execSync(cmd, { encoding: 'utf8' });
				resolve(stdout);
			} catch (error) {
				// 捕获同步执行的错误
				reject(new Error(`执行spirv-cross失败: ${error.message}\n${error.stderr || ''}`));
			}
		});
	}

	// 映射描述符类型到友好名称
	_mapDescriptorType(type) {
		const typeMap = {
			'uniform': 'Uniform Buffer',
			'buffer': 'Storage Buffer',
			'texture2D': 'Sampled Image',
			'textureCube': 'Sampled Image',
			'texture3D': 'Sampled Image',
			'texture2DArray': 'Sampled Image',
			'sampler': 'Sampler',
			'sampler2D': 'Combined Image Sampler',
			'samplerCube': 'Combined Image Sampler',
			'image2D': 'Storage Image'
		};

		// 将类型转换为小写进行匹配
		const lowerType = type.toLowerCase();
		
		// 检查是否为已知类型
		for (const [key, value] of Object.entries(typeMap)) {
			if (lowerType.includes(key)) {
				return value;
			}
		}

		// 如果没有匹配到，返回原始类型
		return type;
	}

	getResultDissamblyFileName() {
		return 'resultDissambly.txt';
	}

	// 编译着色器
	comileShader_dxc(tmpDir, message, webviewView) {
	// 获取dxc.exe路径
		const dxcPath = path.join(this.context.extensionPath, 'external', 'dxc', 'bin', 'x64', 'dxc.exe');

		// 构建编译参数
		const args = [];

		// 获取当前活动编辑器中的着色器文件路径
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('未找到活动的编辑器，请先打开一个着色器文件。');
			return;
		}

		// 添加着色器模型参数
		args.push(`-T ${message.shaderType}_${message.shaderMode}`);

		// 添加入口点参数
		args.push(`-E ${message.entryPoint || 'main'}`); // 入口点，默认为main

		// 添加宏定义
		if (message.macros && message.macros.length > 0) {
			message.macros.forEach(macro => {
				args.push(`-D ${macro}`);
			});
		}

		// 获取当前活动编辑器中的着色器文件路径
		const dstFilePath = activeEditor.document.uri.fsPath;

		// 如果当前活动编辑器中的内容存在修改且没有存盘，则把当前内容存盘到临时目录的同名着色器文件
		let shaderFilePath = dstFilePath;
		let tempShaderFilePath;

		if (activeEditor.document.isDirty) {
			const shaderFileName = path.basename(dstFilePath);
			tempShaderFilePath = path.join(tmpDir, shaderFileName);
			try {
				fs.writeFileSync(tempShaderFilePath, activeEditor.document.getText(), 'utf8');
				shaderFilePath = tempShaderFilePath;
			} catch (writeError) {
				vscode.window.showErrorMessage(`无法将未保存的着色器写入临时文件: ${writeError.message}`);
				console.error(`Failed to write unsaved shader to temp file: ${writeError.message}`);
				return;
			}
		}
		
		// 添加Include路径
		if (message.includePaths && message.includePaths.length > 0) {
			message.includePaths.forEach(includePath => {
				// 检查是否为相对路径，如果是则转换为相对于dstFilePath的绝对路径
				let resolvedPath = includePath;
				const shaderDirPath = path.dirname(dstFilePath);
				
				// 如果不是绝对路径，则将其解析为相对于dstFilePath的绝对路径
				if (!path.isAbsolute(includePath)) {
					resolvedPath = path.resolve(shaderDirPath, includePath);
				}
				
				args.push(`-I ${resolvedPath}`);
			});
		}

		// 添加额外选项
		if (message.additionalOptionEnabled && message.additionalOption) {
			args.push(message.additionalOption);
		}

		let bHlslPreprocess = false;
		// 根据outputType定义输出文件名
		let outputFileName;
		switch (message.outputType.toLowerCase()) {
			case 'dxil':
				outputFileName = 'output.dxil';
				break;
			case 'hlsl':
				outputFileName = 'output.hlsl';
				if (message.shaderLanguage != 'hlsl2021') {
					args.push('-HV 2016');
				}
				break;
			case 'hlsl-preprocess':
				outputFileName = 'output.hlsl';
				if (message.shaderLanguage != 'hlsl2021') {
					args.push('-HV 2016');
				}
				args.push('-P');
				bHlslPreprocess = true;
				break;
			case 'glsl':
			case 'spir-v':
			case 'msl':
				outputFileName = 'output.spv';
				args.push('-spirv');
				break;
			default:
				vscode.window.showErrorMessage(`不支持的输出类型: ${message.outputType}`);
				return;
		}

		// 临时输出路径
		const outputCompiledPath = path.join(tmpDir, outputFileName);

		if (bHlslPreprocess)
			args.push(`-Fi ${outputCompiledPath}`);
		else
			args.push(`-Fo ${outputCompiledPath}`);

		args.push(shaderFilePath); // 添加输入文件路径

		const argCmd = args.join(' ');

		// 输出编译命令信息
		vscode.window.showInformationMessage(`执行编译: dxc ${argCmd}`);

		// 执行dxc.exe
		const { execSync } = require('child_process');
		// 记录编译开始时间
		const startTime = Date.now();

		let result = '';
		try {
			const stdout = execSync(`${dxcPath} ${argCmd}`);
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
			vscode.window.showInformationMessage(`着色器编译成功（${elapsed} 秒）`);

			switch (message.outputType.toLowerCase()) {
					case 'dxil':
						// 使用dxc反编译DXIL
						const dxilDisasmCmd = `"${dxcPath}" -dumpbin "${outputCompiledPath}"`;
						try {
							const disasmStdout = execSync(dxilDisasmCmd);

							// 反编译成功，将结果写入临时文件并打开
							const resultDissamblyPath = path.join(tmpDir, this.getResultDissamblyFileName());
							try {
								fs.writeFileSync(resultDissamblyPath, disasmStdout, 'utf8');
								// 打开反编译结果文件到当前编辑器
								vscode.workspace.openTextDocument(resultDissamblyPath).then(doc => {
									vscode.window.showTextDocument(doc, { preview: false });
								});
							} catch (writeError) {
								console.error(`写入反编译结果失败: ${writeError.message}`);
							}
							// 更新结果信息
							result += `\n\nDXIL 反编译结果已写入并打开: ${resultDissamblyPath}`;

						} catch (disasmError) {
							console.error(`反编译失败: ${disasmError.message}`);
						}
						break;
					case 'hlsl-preprocess':
						// HLSL预处理模式：直接读取预处理结果并打开
						try {
							const resultDissamblyPath = path.join(tmpDir, this.getResultDissamblyFileName());
							// 读取预处理后的文件内容
							const preprocessContent = fs.readFileSync(outputCompiledPath, 'utf8');
							// 写入到结果文件
							fs.writeFileSync(resultDissamblyPath, preprocessContent, 'utf8');
							// 打开结果文件到当前编辑器
							vscode.workspace.openTextDocument(resultDissamblyPath).then(doc => {
								vscode.window.showTextDocument(doc, { preview: false });
							});
							// 更新结果信息
							result += `\n\nHLSL 预处理结果已写入并打开: ${resultDissamblyPath}`;
						} catch (readWriteError) {
							console.error(`处理HLSL预处理结果失败: ${readWriteError.message}`);
						}
						break;
					case 'spir-v':
						// 使用spirv-dis反编译SPIR-V
						try {
							const spirvDisPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-dis.exe');
							const spirvDisCmd = `"${spirvDisPath}" "${outputCompiledPath}"`;
							const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
							// 将反编译结果存入 disResult
							let disResult = disStdout;

							// 处理SPIR-V输出，提取反射信息
							this.dumpSpirVReflectionInfo(outputCompiledPath)
								.then(reflectionInfo => {
								// 将反射信息拼接到反编译结果尾部
								disResult = disResult + '\n' + '// SPIR-V 反射信息:\n' + reflectionInfo;

								// 反编译成功，将结果写入临时文件并打开
								const resultDissamblyPath = path.join(tmpDir, this.getResultDissamblyFileName());
								fs.writeFileSync(resultDissamblyPath, disResult, 'utf8');
								vscode.workspace.openTextDocument(resultDissamblyPath).then(doc => {
									vscode.window.showTextDocument(doc, { preview: false });
								});

								result += `\n\nSPIR-V 反编译结果已写入并打开: ${resultDissamblyPath}`;
							}).catch(err => {
								console.error(`提取SPIR-V反射信息失败: ${err.message}`);
							});
						} catch (disasmError) {
							console.error(`spirv-dis 反编译失败: ${disasmError.message}`);
						}
						break;
					case 'glsl':
						// 使用spirv-cross反编译GLSL
						try {
							const spirvDisPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');
							const spirvDisCmd = `"${spirvDisPath}" "${outputCompiledPath}" -V`;

							const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
							const resultDissamblyPath = path.join(tmpDir, this.getResultDissamblyFileName());
							fs.writeFileSync(resultDissamblyPath, disStdout, 'utf8');
							vscode.workspace.openTextDocument(resultDissamblyPath).then(doc => {
								vscode.window.showTextDocument(doc, { preview: false });
							});
							result += `\n\nGLSL 反编译结果已写入并打开: ${resultDissamblyPath}`;
						}
						catch (disasmError) {
							console.error(`spirv-cross 反编译失败: ${disasmError.message}`);
						}
						break;
					case 'msl':
						// 使用spirv-cross反编译出MSL
						try {
							const spirvCrossPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');
							const spirvDisCmd = `"${spirvCrossPath}" "${outputCompiledPath}" --msl`;

							const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
							const resultDissamblyPath = path.join(tmpDir, this.getResultDissamblyFileName());
							fs.writeFileSync(resultDissamblyPath, disStdout, 'utf8');
							vscode.workspace.openTextDocument(resultDissamblyPath).then(doc => {
								vscode.window.showTextDocument(doc, { preview: false });
							});
							result += `\n\nMSL 反编译结果已写入并打开: ${resultDissamblyPath}`;
						}
						catch (disasmError) {
							console.error(`spirv-cross 生成MSL失败: ${disasmError.message}`);
						}
						break;
					default:
						break;
				}
		} catch (error) {
			result = `编译失败: ${error.message}\n\n${error.stderr || ''}\n\n`;
			vscode.window.showErrorMessage(`着色器编译失败`);
			console.error(result);
		}

		// 删除临时编译输出文件
		this.deleteTempFiles([outputCompiledPath, tempShaderFilePath]);
	}

	// 编译着色器
	comileShader_fxc(tmpDir, message, webviewView) {
	}

	// 编译着色器
	comileShader_glslang(tmpDir, message, webviewView) {
	}

	// 编译着色器
	compileShader(message, webviewView) {
		try {
			// 获取临时路径用于存储编译结果
			const tmpDir = path.join(require('os').tmpdir(), 'shadercross-vscode-plugin');
			if (!fs.existsSync(tmpDir)) {
				try {
					fs.mkdirSync(tmpDir, { recursive: true });
				} catch (mkdirError) {
					vscode.window.showErrorMessage(`无法创建临时输出目录: ${mkdirError.message}`);
					console.error(`Failed to create temporary output directory: ${mkdirError.message}`); // 输出到终端
					return;
				}
			}

			// 根据编译器类型选择编译函数
			switch (message.compiler) {
				case 'dxc':
					this.comileShader_dxc(tmpDir, message, webviewView);;
					break;
				case 'fxc':
					this.comileShader_fxc(tmpDir, message, webviewView);;
					break;
				case 'glslang':
					this.comileShader_glslang(tmpDir, message, webviewView);;
					break;
				default:
					vscode.window.showErrorMessage(`使用非法的编译器: ${message.compiler}`);
					return;
			}
		} catch (error) {
			vscode.window.showErrorMessage(`编译失败: ${error.message}`);
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
