# File Explorer++ Architecture

## Overview

This extension replicates the core functionality of VS Code's native file explorer as a standalone extension. The architecture follows VS Code's extension patterns and best practices.

## Core Components

### 1. Extension Entry Point (`src/extension.ts`)

The main activation point that:
- Registers the tree view provider
- Registers all commands (refresh, new file, delete, rename, etc.)
- Sets up file system watchers
- Handles auto-reveal functionality

**Key Functions:**
- `activate()`: Called when extension is activated
- `deactivate()`: Called when extension is deactivated

### 2. File Explorer Provider (`src/fileExplorerProvider.ts`)

Implements `vscode.TreeDataProvider<vscode.Uri>` to provide the tree structure:

**Key Methods:**
- `getTreeItem()`: Creates the visual representation of each file/folder
- `getChildren()`: Returns child items for a given parent (or root items)
- `getParent()`: Returns the parent of an item (for navigation)
- `refresh()`: Triggers a tree refresh

**Features:**
- Reads directories using VS Code's FileSystem API
- Filters files based on exclude patterns
- Sorts items based on user preferences
- Creates rich tooltips with file metadata

### 3. Types (`src/types.ts`)

TypeScript interfaces and type definitions:
- `FileItem`: Represents a file or folder in the tree
- `FileSortOrder`: Enum for sorting options

### 4. Utilities (`src/utils.ts`)

Helper functions for:
- **Exclusion filtering**: `shouldExclude()` - Checks glob patterns
- **Sorting**: `sortFileItems()` - Implements various sort orders
- **Icons**: `getFileIcon()` - Maps file types to icons
- **Formatting**: `formatFileSize()`, `getRelativePath()`

## VS Code APIs Used

### FileSystem API
```typescript
vscode.workspace.fs.readDirectory()   // Read folder contents
vscode.workspace.fs.stat()            // Get file stats
vscode.workspace.fs.writeFile()       // Create file
vscode.workspace.fs.createDirectory() // Create folder
vscode.workspace.fs.delete()          // Delete file/folder
vscode.workspace.fs.rename()          // Rename file/folder
```

### Tree View API
```typescript
vscode.window.createTreeView()        // Create the tree view
vscode.TreeDataProvider               // Interface to implement
vscode.TreeItem                       // Individual tree items
```

### Command API
```typescript
vscode.commands.registerCommand()     // Register commands
vscode.commands.executeCommand()      // Execute commands
```

### Configuration API
```typescript
vscode.workspace.getConfiguration()   // Read user settings
```

## Data Flow

```
User Action
    ↓
Command Handler (extension.ts)
    ↓
File System API / Provider Method
    ↓
Provider fires onDidChangeTreeData
    ↓
VS Code re-renders tree
```

## Extension Manifest (`package.json`)

Defines:
- **Views**: Contributes "File Explorer++" to the explorer
- **Commands**: All available commands with icons
- **Menus**: Context menus for tree items
- **Configuration**: User settings schema
- **Activation Events**: When to activate the extension

## Design Patterns

### 1. Observer Pattern
The `TreeDataProvider` uses an EventEmitter to notify VS Code of changes:
```typescript
private _onDidChangeTreeData: vscode.EventEmitter<...>
readonly onDidChangeTreeData: vscode.Event<...>
```

### 2. Command Pattern
Each user action is a registered command that can be invoked programmatically

### 3. Provider Pattern
The tree data provider separates data logic from UI rendering

## Similar to VS Code's Native Explorer

### What We Replicated:
- ✅ Tree view structure
- ✅ File/folder icons
- ✅ Create, delete, rename operations
- ✅ Context menus
- ✅ Path copying
- ✅ Exclude patterns
- ✅ Sort orders
- ✅ Auto-reveal
- ✅ Tooltips with metadata
- ✅ Trash support for deletion

### VS Code Source Code References:

The native explorer is located in the VS Code source at:
- `src/vs/workbench/contrib/files/browser/views/explorerView.ts`
- `src/vs/workbench/contrib/files/browser/fileActions.ts`
- `src/vs/base/browser/ui/tree/`

Our extension simplifies this architecture while maintaining core functionality.

## Extension Points

To extend this further, you could add:
- Drag and drop support
- Cut/copy/paste operations
- File decorations (git status, etc.)
- Quick open integration
- Custom views for specific file types
- Search within explorer
- Bookmark folders
- Multi-select operations

## Performance Considerations

- **Lazy loading**: Only loads visible tree nodes
- **Efficient filtering**: Excludes files at read time
- **Debounced updates**: File watcher changes are batched
- **Minimal stat calls**: Only stats when creating tree items

## Testing

To test the extension:
1. Press F5 to launch Extension Development Host
2. Open a workspace with various file types
3. Test each command from context menu and command palette
4. Verify exclusion patterns work
5. Test different sort orders
6. Check auto-reveal functionality

## Debugging Tips

- Use `console.log()` - visible in Debug Console
- Set breakpoints in TypeScript files
- Check "Output" panel for extension logs
- Use `vscode.window.showErrorMessage()` for user feedback
