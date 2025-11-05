# ShaderCross VSCode Extension

A powerful VSCode extension for shader development with cross-compilation capabilities.

## Features

- **Shader Cross-Compilation**: Convert shaders between different shading languages (HLSL, GLSL) using popular compilers like DXC, FXC, and GLSLang
- **Shader Mode Selection**: Support for various shader types including Vertex, Pixel (Fragment), Geometry, Compute, and more
- **Real-time Preview**: View compilation results and disassembled code directly in VSCode
- **Code Navigation**: Quickly locate and highlight specific code sections in the disassembled output
- **Intuitive UI**: User-friendly interface with proper option restrictions based on selected compiler

## Requirements

- VSCode version 1.100.3 or higher
- Node.js for extension development
- External shader compilers (included in the extension package):
  - DXC (DirectX Shader Compiler)
  - FXC (Legacy DirectX Shader Compiler)
  - GLSLang (GLSL Shader Compiler)
  - SPIRV-Cross (SPIR-V to high-level language conversion)

## Usage

1. Open the ShaderCross view from the Activity Bar
2. Select your preferred compiler (DXC, FXC, or GLSLang)
3. Choose appropriate shader mode and output options based on the selected compiler
4. Compile your shader and view the results in the output panel
5. Use the code navigation feature to highlight specific sections in the disassembled output

## Extension Settings

This extension contributes the following settings:

- `shadercross.outputPanel`: Configure output panel behavior
- `shadercross.compilerPath`: Custom paths for shader compilers (optional)

## Known Issues

- Some advanced shader features may not be fully supported across all compiler combinations
- Performance may vary depending on shader complexity and system resources

## Release Notes

### 0.0.1

Initial release of ShaderCross VSCode Extension with:
- Basic shader compilation support
- Cross-compilation between major shading languages
- Disassembly viewing and navigation
- Compiler-specific option restrictions

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License
