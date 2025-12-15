// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// 创建全局OutputChannel实例，用于输出日志
// 创建OutputChannel时指定languageId为'log'，这样VS Code会使用日志格式的语法高亮
const outputChannel = vscode.window.createOutputChannel('ShaderCross', 'log');

function getShaderCrossResultDissamblyName() {
	return 'shadercross_resultDissambly';
}

// 视图提供者类
class ShaderCrossViewProvider {
	constructor(context) {
		this.context = context;
		// 初始化配置存储
		this.configurationKey = 'shaderCross.lastUsedSettings';
		// 维护最新配置副本
		this.currentConfig = this.getSavedConfiguration() || this.getDefaultConfig();
		// 直接使用context.globalState
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

						// 发送编译完成消息
						if (webviewView && webviewView.webview) {
							webviewView.webview.postMessage({
								command: 'compileComplete'
							});
						}

						// 保存配置
						this.saveConfiguration(message);
						return;
				case 'saveConfiguration':
				// 更新当前配置副本
				this.currentConfig = message.config;
				this.saveConfiguration(message.config);
				return;
				case 'openIncludeFloderDialg':
					this.openIncludeFloderDialg(webviewView);
					return;
				}
			},
			undefined,
			this.context.subscriptions
		);

		// 视图可见性变化处理
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				const savedConfig = this.getSavedConfiguration();
				if (savedConfig) {
					webviewView.webview.postMessage({
						command: 'restoreConfiguration',
						config: savedConfig
					});
					// 更新当前配置副本
					this.currentConfig = savedConfig;
				}
			} else {
				// 当webview失去可见性时（包括切换到别的插件），直接保存配置
				console.log('Webview became invisible, saving configuration...');
				// 如果currentConfig为null，尝试从存储获取或使用默认配置
				if (!this.currentConfig) {
					this.currentConfig = this.getSavedConfiguration() || this.getDefaultConfig();
				}
				this.saveConfiguration(this.currentConfig);
			}
		});
		
		// 立即尝试发送配置
		if (webviewView.visible) {
			const savedConfig = this.getSavedConfiguration() || this.getDefaultConfig();
			// 更新当前配置副本
			this.currentConfig = savedConfig;
			webviewView.webview.postMessage({
				command: 'restoreConfiguration',
				config: savedConfig
			});
		}
		
		// 添加视图销毁前的事件处理
		webviewView.onDidDispose(() => {
			// 在webview删除前直接保存配置
			console.log('Webview is disposing, saving configuration...');
			if (this.currentConfig) {
				this.saveConfiguration(this.currentConfig);
			}
		}, undefined, this.context.subscriptions);
	}

	log(level, message) {
		// 格式化日志消息，使用VS Code OutputChannel标准的着色格式
		const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 23);
		
		// 根据VS Code OutputChannel标准，使用特定格式的标签会自动着色
		let formattedMessage = '';
		
		switch (level.toLowerCase()) {
			case 'error':
				formattedMessage = `${timestamp} [error] > ${message}`; // 红色
				break;
			case 'warn':
			case 'warning':
				formattedMessage = `${timestamp} [warn] > ${message}`; // 黄色
				break;
			case 'info':
				formattedMessage = `${timestamp} [info] > ${message}`; // 绿色（注意使用小写）
				break;
			default:
				formattedMessage = `${timestamp} [info] > ${message}`; // 默认使用info格式
		}
		
		// 输出到OutputChannel
		outputChannel.appendLine(formattedMessage);
		
		// 开发环境仍然输出到控制台
		if (level === 'error') {
			console.error(formattedMessage);
		} else if (level === 'warn' || level === 'warning') {
			console.warn(formattedMessage);
		} else {
			console.log(formattedMessage);
		}
	}

	// 保存配置到VS Code存储
	saveConfiguration(config) {
		// 如果没有提供配置且当前配置为空，则不保存
		if (!config && !this.currentConfig) {
			return;
		}
		
		// 使用提供的配置或当前配置副本
		const configToSave = config || this.currentConfig;
		
		try {
			// 清理和验证配置数据，移除空值和无效数据
			const configurationToSave = {
				compiler: configToSave.compiler || '',
				shaderType: configToSave.shaderType || '',
				shaderMode: configToSave.shaderMode || '',
				outputType: configToSave.outputType || '',
				entryPoint: configToSave.entryPoint || '',
				additionalOptionEnabled: !!configToSave.additionalOptionEnabled,
				additionalOption: configToSave.additionalOption || '',
				shaderLanguage: configToSave.shaderLanguage || '',
				macros: Array.isArray(configToSave.macros) ? configToSave.macros.filter(m => m && m.trim()) : [],
				includePaths: Array.isArray(configToSave.includePaths) ? configToSave.includePaths.filter(p => p && p.trim()) : []
			};
			
			// 优先保存到工作区状态，如果存在工作区则保存到工作区，否则保存到全局状态
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				this.context.workspaceState.update(this.configurationKey, configurationToSave);
			} else {
				this.context.globalState.update(this.configurationKey, configurationToSave);
			}
		} catch (error) {
			this.log('error', `Failed to save configuration: ${error.message}`);
		}
	}

	// 获取默认配置
	getDefaultConfig() {
		return {
			compiler: '',
			shaderType: '',
			shaderMode: '',
			outputType: '',
			entryPoint: '',
			additionalOptionEnabled: false,
			additionalOption: '',
			shaderLanguage: '',
			macros: [],
			includePaths: []
		};
	}
	
	// 从VS Code存储获取保存的配置
	getSavedConfiguration() {
			try {
				let savedConfig = null;
				if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
					savedConfig = this.context.workspaceState.get(this.configurationKey);
				} else {
					savedConfig = this.context.globalState.get(this.configurationKey);
				}
				
				if (savedConfig) {
					// 确保返回的配置对象具有所有必要的字段，避免UI错误
					return {
						compiler: savedConfig.compiler || '',
						shaderType: savedConfig.shaderType || '',
						shaderMode: savedConfig.shaderMode || '',
						outputType: savedConfig.outputType || '',
						entryPoint: savedConfig.entryPoint || '',
						additionalOptionEnabled: !!savedConfig.additionalOptionEnabled,
						additionalOption: savedConfig.additionalOption || '',
						shaderLanguage: savedConfig.shaderLanguage || '',
						macros: Array.isArray(savedConfig.macros) ? savedConfig.macros : [],
						includePaths: Array.isArray(savedConfig.includePaths) ? savedConfig.includePaths : []
					};
				}
				return null;
			} catch (error) {
				this.log('error', `Failed to get saved configuration: ${error.message}`);
				return null;
			}
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
			this.log('warn', `Delete Temp Files Failed: ${cleanupError.message}`);
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
		return getShaderCrossResultDissamblyName();
	}

	saveAndShowResultDissamblyToTempFile(tmpDir, preprocessContent, showText) {
		const resultDissamblyPath = path.join(tmpDir, `${this.getResultDissamblyFileName()}.txt`);

		// 写入到结果文件
		fs.writeFileSync(resultDissamblyPath, preprocessContent, 'utf8');
		// 打开结果文件到当前编辑器
		vscode.workspace.openTextDocument(resultDissamblyPath).then(doc => {
			vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
		});
	}

	showResultDissamblyToTempDoc(tmpDir, resultDissamblyContent, showText) {
		const resultDissamblyPath = path.join(tmpDir, this.getResultDissamblyFileName());

		// 检查是否存在包含指定名称的临时文档
		// 使用URI包含文件名或语言ID来识别临时文档，这样更可靠
		const resultFileName = path.basename(resultDissamblyPath).toLowerCase();
		let existingEditor = vscode.window.visibleTextEditors.find(editor => 
			editor.document.uri.toString().toLowerCase().includes(resultFileName)
		);

		fs.writeFileSync(resultDissamblyPath, '', 'utf8');
		
		if (!existingEditor) {
			// 创建新的临时文档，指定语言为plaintext，并设置文档名称为shadercross_resultDissambly
			// 使用虚拟文档显示反编译结果，避免临时文件
			vscode.workspace.openTextDocument(resultDissamblyPath).then(doc => {
				vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside, preserveFocus: false });
				// 将 doc 中的内容改为 resultDissamblyContent
				const edit = new vscode.WorkspaceEdit();
				const fullRange = new vscode.Range(
					doc.positionAt(0),
					doc.positionAt(doc.getText().length)
				);
				edit.replace(doc.uri, fullRange, resultDissamblyContent);
				vscode.workspace.applyEdit(edit).then(success => {
					if (success) {
						vscode.window.showTextDocument(doc).then(editor => {
							this.locateAndShowCode(editor, doc, showText);
						});
						// 指定语言模式为HLSL
						vscode.languages.setTextDocumentLanguage(doc, 'hlsl');
					}
				});
			});
		} else {
			// 如果已存在临时文档窗口，则更新其内容
			existingEditor.edit(edit => {
				edit.replace(new vscode.Range(0, 0, existingEditor.document.lineCount, 0), resultDissamblyContent);
				// 指定语言模式为HLSL
				vscode.languages.setTextDocumentLanguage(existingEditor.document, 'hlsl');
			}).then(success => {
				if (success) {
					this.locateAndShowCode(existingEditor, existingEditor.document, showText);
				}
			});
		}
	}

	showResultDissambly(tmpDir, resultDissamblyContent, showText) {
		// this.saveAndShowResultDissamblyToTempFile(tmpDir, preprocessContent);
		this.showResultDissamblyToTempDoc(tmpDir, resultDissamblyContent, showText);
	}

	findAndLocateCodeInDocument(document, showText) {
		const text = document.getText();
		const index = text.indexOf(showText);
		if (index === -1) return null;

		const startPos = document.positionAt(index);
		const endPos = document.positionAt(index + showText.length);
		return new vscode.Range(startPos, endPos);
	}

	locateAndShowCode(editor, doc, showText) {
		let findSuccess = false;

		// 确保编辑操作成功完成后再查找文本
		if (showText) {
			const range = this.findAndLocateCodeInDocument(doc, showText);
			if (range) {
				editor.selection = new vscode.Selection(range.start, range.end);
				editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
				findSuccess = true;
			}
		}

		if (!findSuccess) {
			// 如果未找到指定文本，滚动到文档顶部
			editor.selection = new vscode.Selection(
				doc.positionAt(0),
				doc.positionAt(0)
			);
			editor.revealRange(
				new vscode.Range(
					doc.positionAt(0),
					doc.positionAt(0)
				),
				vscode.TextEditorRevealType.InCenter
			);
		}
	}

	trimPreprocessContent(preprocessContent) {
		if (!preprocessContent) {
			return '';
		}
		
		// 按行分割内容
		const lines = preprocessContent.split('\n');
		const resultLines = [];
		
		// 处理每一行
		for (let line of lines) {
			// 清除所有以#line开头的行
			if (line.trim().startsWith('#line')) {
				continue;
			}
			
			// 处理空行
			if (line.trim() === '') {
				continue;
			} 

			resultLines.push(line);
		}
		
		// 合并处理后的行
		return resultLines.join('\n');
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
			this.log('error', 'No active editor found. Please open a shader file.');
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
				this.log('error', `Failed to write unsaved shader to temp file: ${writeError.message}`);
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
				if (message.shaderLanguage != 'hlsl2021') {
					args.push('-HV 2016');
				}
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
		this.log('info', `Executing command: dxc ${argCmd}`);

		// 执行dxc.exe
		const { execSync } = require('child_process');
		const { spawnSync } = require('child_process');
		try {
			// 记录编译开始时间
			const startTime = Date.now();

			const result = spawnSync(`${dxcPath}`, argCmd.split(' '), { 
				encoding: 'utf8',
				maxBuffer: 10 * 1024 * 1024
			});
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(4);

			// 检查是否有警告信息（警告通常输出到stderr）
			const stderr = result.stderr || '';

			// 检查是否包含警告信息
			if (result.status !== 0) {
				throw new Error(`Shader Compilation Failed:\n${stderr.trim()}`);
			}

			if (stderr.toLowerCase().includes('warning')) {
				// 提取并输出警告信息
				const warningLines = stderr.split('\n').filter(line => 
					line.toLowerCase().includes('warning')
				);
				if (warningLines.length > 0) {
					this.log('warning', `Shader Compilation Warning:\n${warningLines.join('\n')}`);
				}
			}

			// 即使有警告，只要编译成功就继续处理

			vscode.window.showInformationMessage(`着色器编译成功（${elapsed} 秒）`);
			this.log('info', `Shader compilation successful (${elapsed} seconds)`);

			switch (message.outputType.toLowerCase()) {
					case 'dxil':
						// 使用dxc反编译DXIL
						const dxilDisasmCmd = `"${dxcPath}" -dumpbin "${outputCompiledPath}"`;
						try {
							const disasmStdout = execSync(dxilDisasmCmd, { encoding: 'utf8' });
							try {
								this.showResultDissambly(tmpDir, disasmStdout, '; Resource Bindings:');
							} catch (writeError) {
								this.log('error', `Write DXIL Disassembly Result Failed: ${writeError.message}`);
							}
						} catch (disasmError) {
							this.log('error', `DXIL Disassembly Failed: ${disasmError.message}`);
						}
						break;
					case 'hlsl-preprocess':
						// HLSL预处理模式：直接读取预处理结果并打开
						try {
							const preprocessContent = this.trimPreprocessContent(fs.readFileSync(outputCompiledPath, 'utf8'));
							this.showResultDissambly(tmpDir, preprocessContent, null);
						} catch (readWriteError) {
							this.log('error', `Read HLSL Preprocess Result Failed: ${readWriteError.message}`);
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
								this.showResultDissambly(tmpDir, disResult, '// SPIR-V 反射信息:');
							}).catch(err => {
								this.log('error', `Dump SPIR-V Reflection Info Failed: ${err.message}`);
							});
						} catch (disasmError) {
							this.log('error', `spirv-dis Disassemble SPIR-V Failed: ${disasmError.message}`);
						}
						break;
					case 'glsl':
						// 使用spirv-cross反编译GLSL
						try {
							const spirvDisPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');
							const spirvDisCmd = `"${spirvDisPath}" "${outputCompiledPath}" -V`;

							const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
							this.showResultDissambly(tmpDir, disStdout, null);
						} catch (disasmError) {
							this.log('error', `spirv-cross Disassemble GLSL Failed: ${disasmError.message}`);
						}
						break;
					case 'msl':
						// 使用spirv-cross反编译出MSL
						try {
							const spirvCrossPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');
							const spirvDisCmd = `"${spirvCrossPath}" "${outputCompiledPath}" --msl`;

							const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
							this.showResultDissambly(tmpDir, disStdout, 'using namespace metal;');
						} catch (disasmError) {
							this.log('error', `spirv-cross Generate MSL Failed: ${disasmError.message}`);
						}
						break;
					default:
						break;
				}
		} catch (error) {
			vscode.window.showErrorMessage(`着色器编译失败`);
			this.log('error', error.message);
		}

		// 删除临时编译输出文件
		this.deleteTempFiles([outputCompiledPath, tempShaderFilePath]);
	}

	// 编译着色器
	comileShader_fxc(tmpDir, message, webviewView) {
		// 获取fxc.exe路径
		const fxcPath = path.join(this.context.extensionPath, 'external', 'fxc', 'fxc.exe');

		// 构建编译参数
		const args = [];

		// 获取当前活动编辑器中的着色器文件路径
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('未找到活动的编辑器，请先打开一个着色器文件。');
			this.log('error', 'No active editor found. Please open a shader file.');
			return;
		}

		// 定义输出文件名
		let bHLSLPreprocess = false;
		let outputFileName;
		switch (message.outputType.toLowerCase()) {
			case 'hlsl-preprocess':
				outputFileName = 'output.hlsl';
				bHLSLPreprocess = true;
				break;
			case 'dxbc':
				outputFileName = 'output.fxo';
				break;
			default:
				vscode.window.showErrorMessage(`fxc 不支持的输出类型: ${message.outputType}`);
				return;
		}

		if (!bHLSLPreprocess)
		{
			// 添加着色器模型参数
			args.push(`/T ${message.shaderType}_${message.shaderMode}`);
		}

		// 添加入口点参数
		args.push(`/E ${message.entryPoint || 'main'}`); // 入口点，默认为main

		// 添加宏定义
		if (message.macros && message.macros.length > 0) {
			message.macros.forEach(macro => {
				args.push(`/D ${macro}`);
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
				this.log('error', `Failed to write unsaved shader to temp file: ${writeError.message}`);
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

				args.push(`/I ${resolvedPath}`);
			});
		}

		// 临时输出路径
		const outputCompiledPath = path.join(tmpDir, outputFileName);
		if (!bHLSLPreprocess) {
			args.push(`/Fo ${outputCompiledPath}`);
		}
		else
		{
			args.push(`/P ${outputCompiledPath}`);
		}

		args.push(`${shaderFilePath}`); // 添加输入文件路径	

		const argCmd = args.join(' ');

		// 输出编译命令信息
		vscode.window.showInformationMessage(`执行编译: fxc ${argCmd}`);
		this.log('info', `Executing command: fxc ${argCmd}`);

		// 执行fxc.exe
		const { execSync } = require('child_process');
		const { spawnSync } = require('child_process');
		try {
			// 记录编译开始时间
			const startTime = Date.now();
			// 注意：execSync和spawnSync的主要区别在于参数传递方式
			// execSync: 接收一个完整的命令字符串，会通过shell执行，支持路径中的空格（用引号包围）
			// spawnSync: 接收命令和参数数组，不通过shell执行，需要特殊处理路径中的空格
			
			// 方式1：继续使用execSync（当前正常工作的方式）
			/*
			const result = execSync(`"${fxcPath}" ${argCmd}`, {
				encoding: 'utf8',
				maxBuffer: 10 * 1024 * 1024
			});
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(4);
			*/
			
			
			// 方式2：使用spawnSync实现，添加cwd参数解决工作目录问题
			// 获取当前活动文档所在的目录作为工作目录
			const activeEditor = vscode.window.activeTextEditor;
			const cwd = activeEditor && activeEditor.document.uri.fsPath ? 
				path.dirname(activeEditor.document.uri.fsPath) : 
				process.cwd();
			
			const result = spawnSync(fxcPath, argCmd.split(' '), {
				encoding: 'utf8',
				maxBuffer: 10 * 1024 * 1024,
				cwd: cwd  // 设置工作目录，解决fxc编译器的搜索目录错误
			});		
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(4);

			const stderr = result.stderr || '';
			if (result.status !== 0) {
				throw new Error(`Shader Compilation Failed:\n${stderr.trim()}`);
			}
			
			// 检查是否包含警告信息
			if (stderr.toLowerCase().includes('warning')) {
				// 提取并输出警告信息
				const warningLines = stderr.split('\n').filter(line => 
					line.toLowerCase().includes('warning')
				);
				if (warningLines.length > 0) {
					this.log('warning', `Shader Compilation Warning:\n${warningLines.join('\n')}`);
				}
			}

			// 即使有警告，只要编译成功就继续处理

			vscode.window.showInformationMessage(`着色器编译成功（${elapsed} 秒）`);
			this.log('info', `Shader compilation successful (${elapsed} seconds)`);

			switch (message.outputType.toLowerCase()) {
				case 'hlsl-preprocess':
					// HLSL预处理模式：直接读取预处理结果并打开
					try {
						// 读取预处理后的文件内容
						const preprocessContent = this.trimPreprocessContent(fs.readFileSync(outputCompiledPath, 'utf8'));
						this.showResultDissambly(tmpDir, preprocessContent, null);
					} catch (readWriteError) {
						this.log('error', `Read HLSL Preprocess Result Failed: ${readWriteError.message}`);
					}
					break;
				case 'dxbc':
					// 使用fxc反编译FXC字节码
					const fxcDisasmCmd = `"${fxcPath}" /dumpbin "${outputCompiledPath}"`;
					try {
						const disasmStdout = execSync(fxcDisasmCmd, { encoding: 'utf8' });
						this.showResultDissambly(tmpDir, disasmStdout, '// Resource Bindings:');
					} catch (disasmError) {
						this.log('error', `Dump DXBC Failed: ${disasmError.message}`);
					}
					break;
				default:
					break;
			}
		} catch (error) {
			vscode.window.showErrorMessage(`着色器编译失败`);
			this.log('error', error.message);
		}

		// 删除临时编译输出文件
		this.deleteTempFiles([outputCompiledPath, tempShaderFilePath]);
	}

	// 编译着色器
	comileShader_glslang(tmpDir, message, webviewView) {
		// 获取glslangValidator路径
		const glslangPath = path.join(this.context.extensionPath, 'external', 'glslang', 'glslangValidator.exe');

		// 构建编译参数
		const args = [];

		// 获取当前活动编辑器中的着色器文件路径
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showErrorMessage('未找到活动的编辑器，请先打开一个着色器文件。');
			this.log('error', 'No active editor found. Please open a shader file.');
			return;
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
				this.log('error', `Failed to write unsaved shader to temp file: ${writeError.message}`);
				return;
			}
		}

		const bHlsl = message.shaderLanguage.toLowerCase() === 'hlsl';
		if (bHlsl) {
			args.push(`-D -e ${message.entryPoint || 'main'} --hlsl-enable-16bit-types`);
		}

		// 自动绑定uniform变量
		args.push('--auto-map-bindings');
		args.push('--auto-map-locations');

		// 确定着色器阶段
		let shaderStage = message.shaderType.toLowerCase();
		switch (message.shaderType.toLowerCase()) {
			case 'vs':
				shaderStage = 'vert';
				break;
			case 'ps':
				shaderStage = 'frag';
				break;
			case 'gs':
				shaderStage = 'geom';
				break;
			case 'cs':
				shaderStage = 'comp';
				break;
			case 'hs':
				shaderStage = 'tesc';
				break;
			case 'ds':
				shaderStage = 'tese';
				break;
			case 'rs':
				shaderStage = 'task';
				break;
			case 'ms':
				shaderStage = 'mesh';
				break;
		}

		// 设置着色器阶段
		args.push(`-S ${shaderStage}`);

		// 添加宏定义
		if (message.macros && message.macros.length > 0) {
			message.macros.forEach(macro => {
				args.push(`--D ${macro}`);
			});
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
				
				args.push(`-I${resolvedPath}`);
			});
		}

		// 添加额外选项
		if (message.additionalOptionEnabled && message.additionalOption) {
			args.push(message.additionalOption);
		}

		// 根据outputType定义输出文件名
		let outputFileName = 'output.spv';
		args.push('-V'); // 生成SPIR-V二进制文件（Vulkan语义）

		// 临时输出路径
		const outputCompiledPath = path.join(tmpDir, outputFileName);

		// 设置输出文件路径
		args.push(`-o ${outputCompiledPath}`);

		// 添加输入文件路径
		args.push(shaderFilePath);

		const argCmd = args.join(' ');

		// 输出编译命令信息
		vscode.window.showInformationMessage(`执行编译: glslangValidator ${argCmd}`);
		this.log('info', `Executing command: glslangValidator ${argCmd}`);

		// 执行glslangValidator.exe
		const { execSync } = require('child_process');
		const { spawnSync } = require('child_process');
		try {
			// 记录编译开始时间
			const startTime = Date.now();
			// 使用spawnSync代替execSync，以便分别捕获stdout和stderr
			const result = spawnSync(`${glslangPath}`, argCmd.split(' '), { 
				encoding: 'utf8',
				maxBuffer: 10 * 1024 * 1024
			});
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(4);

			// 检查是否有警告信息（警告通常输出到stderr）
			const stderr = result.stderr || '';

			if (result.status !== 0) {
				throw new Error(`Shader Compilation Failed:\n${stderr.trim()}`);
			}

			// 检查是否包含警告信息
			if (stderr.toLowerCase().includes('warning')) {
				// 提取并输出警告信息
				const warningLines = stderr.split('\n').filter(line => 
					line.toLowerCase().includes('warning')
				);
				if (warningLines.length > 0) {
					this.log('warning', `Shader Compilation Warning:\n${warningLines.join('\n')}`);
				}
			}

			// 即使有警告，只要编译成功就继续处理

			vscode.window.showInformationMessage(`着色器编译成功（${elapsed} 秒）`);
			this.log('info', `Shader compilation successful (${elapsed} seconds)`);

			switch (message.outputType.toLowerCase()) {
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
								this.showResultDissambly(tmpDir, disResult, '// SPIR-V 反射信息:');
							});
					} catch (spirvDisError) {
						vscode.window.showErrorMessage(`SPIR-V 反编译失败: ${spirvDisError.message}`);
						this.log('error', `Failed to disassemble SPIR-V: ${spirvDisError.message}`);
						return;
					}
					break;
				case 'glsl':
					// 使用spirv-cross反编译GLSL
					try {
						const spirvDisPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');
						const spirvDisCmd = `"${spirvDisPath}" "${outputCompiledPath}" -V`;

						const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
						this.showResultDissambly(tmpDir, disStdout, null);
					}
					catch (disasmError) {
						this.log('error', `spirv-cross Disassemble GLSL Failed: ${disasmError.message}`);
					}
					break;
				case 'msl':
					// 使用spirv-cross反编译出MSL
					try {
						const spirvCrossPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');
						const spirvDisCmd = `"${spirvCrossPath}" "${outputCompiledPath}" --msl`;

						const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
						this.showResultDissambly(tmpDir, disStdout, 'using namespace metal;');
					}
					catch (disasmError) {
						this.log('error', `spirv-cross Generate MSL Failed: ${disasmError.message}`);
					}
					break;
				case 'hlsl':
					// 使用spirv-cross反编译出HLSL
					try {
						const spirvCrossPath = path.join(this.context.extensionPath, 'external', 'spirv-cross', 'spirv-cross.exe');
						const spirvDisCmd = `"${spirvCrossPath}" "${outputCompiledPath}" --hlsl`;

						const disStdout = execSync(spirvDisCmd, { encoding: 'utf8' });
						this.showResultDissambly(tmpDir, disStdout, null);
					} catch (disasmError) {
						this.log('error', `spirv-cross Generate HLSL Failed: ${disasmError.message}`);
					}
					break;
			}
		} catch (error) {
				vscode.window.showErrorMessage(`着色器编译失败: ${error.message}`);
				this.log('error', `Failed to compile shader: ${error.message}`);
			return;
		}
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
					this.log('error', `Failed to create temporary output directory: ${mkdirError.message}`);
					return;
				}
			}

			// 如果当前活动编辑器中的文档是反编译结果临时文件，则跳过生成并提示
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document.fileName.endsWith(this.getResultDissamblyFileName())) {
				vscode.window.showWarningMessage(`请选择有效的 Shader 文件，当前窗口为 ${this.getResultDissamblyFileName()}`);
				this.log('warning', `Please select a valid Shader file, current window is ${this.getResultDissamblyFileName()}`);
				return;
			}

			// 根据编译器类型选择编译函数
			switch (message.compiler) {
				case 'dxc':
					this.comileShader_dxc(tmpDir, message, webviewView);
					break;
				case 'fxc':
					this.comileShader_fxc(tmpDir, message, webviewView);
					break;
				case 'glslang':
					this.comileShader_glslang(tmpDir, message, webviewView);
					break;
				default:
					vscode.window.showErrorMessage(`使用非法的编译器: ${message.compiler}`);
					return;
			}
		} catch (error) {
			vscode.window.showErrorMessage(`编译失败: ${error.message}`);
		} finally {
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

	// 监听活动视图容器变化，确保切换到别的插件时触发存盘
	const activeViewColumnListener = vscode.window.onDidChangeActiveTextEditor(() => {
		// 当活动编辑器变化时，检查当前视图是否可见
		// 如果不可见，确保配置已经保存
		// 注意：这里不需要直接发送保存命令，因为onDidChangeVisibility事件已经会处理
		// 但是可以在这里添加额外的日志或调试信息
		console.log('Active editor changed, configuration save handled by onDidChangeVisibility');
	});

	context.subscriptions.push(activeViewColumnListener);
}


// This method is called when your extension is deactivated
function deactivate() {
	console.log('ShaderCross extension is now inactive!');
}

module.exports = {
	activate,
	deactivate
}
