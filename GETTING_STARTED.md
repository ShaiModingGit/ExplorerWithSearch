# File Explorer++ - Getting Started

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Compile the Extension**
   ```bash
   npm run compile
   ```

3. **Run the Extension**
   - Press `F5` in VS Code to open a new Extension Development Host window
   - The extension will be automatically loaded

4. **Test the Extension**
   - Open any workspace/folder in the Extension Development Host
   - Look for "File Explorer++" in the Explorer view (Activity Bar)
   - Try creating files, folders, and using the context menu

## Development Workflow

### Watch Mode
For continuous development, use watch mode:
```bash
npm run watch
```

This will automatically recompile TypeScript files when you save changes.

### Testing Your Changes

1. Make changes to the source code in `src/`
2. If using watch mode, changes compile automatically
3. Reload the Extension Development Host window:
   - Press `Ctrl+R` (Windows/Linux) or `Cmd+R` (Mac)
   - Or use Command Palette: "Developer: Reload Window"

### Debugging

- Set breakpoints in your TypeScript files
- Use the Debug Console to inspect variables
- Check the Output panel for extension logs

## Available Commands

After starting the extension, try these commands:

- `Ctrl+Shift+P` → "File Explorer++: Refresh"
- Right-click on files/folders in the File Explorer++ view for more options

## Configuration

You can customize the extension by editing settings:

```json
{
  "fileExplorePlusPlus.exclude": {
    "**/.git": true,
    "**/node_modules": true
  },
  "fileExplorePlusPlus.sortOrder": "default",
  "fileExplorePlusPlus.autoReveal": true
}
```

## Next Steps

- Explore the source code in `src/extension.ts`
- Modify the tree provider in `src/fileExplorerProvider.ts`
- Add new commands in `package.json` and implement them in `src/extension.ts`
- Customize icons and styling

## Packaging the Extension

To create a `.vsix` file for distribution:

```bash
npm install -g @vscode/vsce
vsce package
```

This creates a `.vsix` file you can share or publish to the marketplace.

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
