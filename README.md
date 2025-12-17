# File Explorer++

An advanced file explorer extension for Visual Studio Code, inspired by VS Code's native file explorer with enhanced features and customization options.




## Features

![Features](https://github.com/ShaiModingGit/ExplorerWithSearch/blob/main/resources/howto.gif?raw=true)

### � Advanced Search & Filter
- **Real-time Search**: Search for files by name across your entire workspace
- **Filter by Extension**: Filter files by file type/extension (.ts, .js, .md, etc.)
- **Progressive Results**: Results appear as they're found for instant feedback
- **Performance Optimized**: Non-blocking search that keeps VS Code responsive
- **Search Controls**:
  - **Abort**: Stop search in progress at any time
  - **Clear**: Reset search and filter to show all files
- **Smart Debouncing**: Automatic 0.5s delay while typing to reduce unnecessary searches
- **Visual Feedback**: Animated loading indicator shows search progress

### �🗂️ Full File System Navigation
- Browse workspace folders and files in a tree view
- Collapse/expand folders
- Auto-reveal active file in the explorer

### 📝 File Operations
- **Create**: New files and folders
- **Delete**: Remove files and folders (with trash support)
- **Rename**: Rename files and folders
- **Open**: Double-click to open files

### 📋 Clipboard Operations
- Copy absolute path
- Copy relative path (workspace-relative)

### 🎨 Smart Icons
- File type-specific icons
- Folder icons
- Supports common file extensions (JS, TS, JSON, MD, Python, etc.)

### ⚙️ Configuration Options

#### Exclude Patterns
Configure which files and folders to hide:

```json
{
  "fileExplorePlusPlus.exclude": {
    "**/.git": true,
    "**/.svn": true,
    "**/node_modules": true,
    "**/.DS_Store": true
  }
}
```

#### Sort Order
Choose how files and folders are sorted:

```json
{
  "fileExplorePlusPlus.sortOrder": "default"
}
```

Options:
- `default` - Alphabetical, mixed files and folders
- `mixed` - Same as default
- `filesFirst` - Files before folders
- `type` - Group by file type/extension
- `modified` - Sort by modification date

#### Auto Reveal
Automatically reveal and focus files when opening them:

```json
{
  "fileExplorePlusPlus.autoReveal": true
}
```

## Commands

| Command | Description |
|---------|-------------|
| `File Explorer++: Refresh` | Refresh the file explorer view |
| `File Explorer++: Reveal in File Explorer++` | Reveal the active file in the explorer |
| `File Explorer++: New File` | Create a new file |
| `File Explorer++: New Folder` | Create a new folder |
| `File Explorer++: Delete` | Delete selected file/folder |
| `File Explorer++: Rename` | Rename selected file/folder |
| `File Explorer++: Copy Path` | Copy absolute path to clipboard |
| `File Explorer++: Copy Relative Path` | Copy workspace-relative path to clipboard |

## Usage

1. **Install the extension**
2. **Open a workspace** in VS Code
3. **Find the explorer** in the Activity Bar (left sidebar)
4. Look for the **"File Explorer++"** view

### Searching and Filtering

The extension includes a powerful search panel at the top:

#### Search Box
- **Type to search**: Start typing a filename to search across your workspace
- **Auto-search**: Results appear automatically 0.5 seconds after you stop typing
- **Live abort**: If you continue typing during an active search, it will automatically abort and restart with your new query
- **Abort button**: Manually stop a search in progress
- **Clear button**: Reset search and show all files

#### Filter Box
- **Enter file extension**: Type an extension like `.ts`, `.js`, or `.md`
- **Apply button**: Click to apply the filter (or press Enter)
- **Combined filtering**: Works together with search to narrow results
- **Persistent filter**: Filter remains active while you search

#### Search Features
- Results appear progressively as they're found (every 50 files)
- Maximum 1000 results for performance
- Search matches filename without extension
- Filter matches complete file extension
- Visual spinner shows when search is active
- Status messages: "Typing...", "Searching...", "Filtering...", "Aborted."

### Creating Files/Folders

- Click the **New File** (📄) or **New Folder** (📁) icon in the view title
- Or right-click on a folder and select "New File" or "New Folder"

### File Operations

- **Right-click** on any file or folder to see available actions
- **Double-click** files to open them
- **Drag and drop** support (coming soon)

### Keyboard Shortcuts

You can add custom keyboard shortcuts for any command in VS Code's Keyboard Shortcuts settings.

## Development

### Building from Source

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to compile TypeScript
4. Press `F5` to open a new VS Code window with the extension loaded

### Project Structure

```
File Explorer++/
├── src/
│   ├── extension.ts            # Extension entry point
│   ├── fileExplorerProvider.ts # Tree data provider with search logic
│   ├── searchViewProvider.ts   # Webview for search/filter UI
│   ├── types.ts                # TypeScript interfaces
│   └── utils.ts                # Utility functions (search, filter, sort)
├── .vscode/
│   ├── launch.json             # Debug configuration
│   └── tasks.json              # Build tasks
├── package.json                # Extension manifest
└── tsconfig.json               # TypeScript configuration
```

## Architecture

The extension follows VS Code's extension architecture:

- **TreeDataProvider**: Implements `vscode.TreeDataProvider` for file system visualization with integrated search/filter
- **WebviewViewProvider**: Custom search panel with real-time UI updates
- **File System API**: Uses VS Code's `workspace.fs` API for file operations
- **Async Search**: Progressive, non-blocking search with event loop yielding to maintain responsiveness
- **Commands**: Registered commands for all user actions
- **Configuration**: User settings via VS Code's configuration system
- **Event-driven**: Search, filter, abort, and clear operations use event emitters for loose coupling

## Requirements

- Visual Studio Code 1.75.0 or higher
- No external dependencies required

## Known Issues

- Search limited to 1000 results for performance
- Large directories may take time to complete full search
- Some file icons may not display correctly for uncommon file types

## Release Notes

### 1.0.0

Initial release with core features:
- File and folder browsing
- Create, delete, rename operations
- Copy path functionality
- Configurable exclude patterns
- Multiple sort orders
- Auto-reveal active file
- **Advanced search across workspace**
- **Filter by file extension**
- **Progressive result display**
- **Abort and clear controls**
- **Non-blocking, optimized performance**

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is provided as-is for educational and development purposes.

---

**Enjoy enhanced file exploration with File Explorer++!** 🚀


