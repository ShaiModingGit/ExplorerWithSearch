"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const fileExplorerProvider_1 = require("./fileExplorerProvider");
const searchViewProvider_1 = require("./searchViewProvider");
function activate(context) {
    console.log('File Explorer++ extension is now active');
    // Create the file explorer provider
    const fileExplorerProvider = new fileExplorerProvider_1.FileExplorerProvider();
    // Restore saved search state
    const savedSearch = context.workspaceState.get('fileExplorePlusPlus.searchQuery', '');
    const savedFilter = context.workspaceState.get('fileExplorePlusPlus.filterSuffix', '');
    if (savedSearch) {
        fileExplorerProvider.setSearchQuery(savedSearch);
    }
    if (savedFilter) {
        fileExplorerProvider.setSuffixFilter(savedFilter);
    }
    // Create and register the search view provider
    const searchViewProvider = new searchViewProvider_1.SearchViewProvider(context.extensionUri, context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(searchViewProvider_1.SearchViewProvider.viewType, searchViewProvider));
    // Connect search view to file explorer
    searchViewProvider.onSearchChange(async (query) => {
        await fileExplorerProvider.setSearchQuery(query);
        searchViewProvider.setStatus('ready');
    });
    searchViewProvider.onFilterChange(async (filter) => {
        await fileExplorerProvider.setSuffixFilter(filter);
        searchViewProvider.setStatus('ready');
    });
    searchViewProvider.onAbort(() => {
        fileExplorerProvider.abort();
    });
    searchViewProvider.onClear(() => {
        fileExplorerProvider.setSearchQuery('');
        fileExplorerProvider.setSuffixFilter('');
    });
    // Connect file explorer status to search view
    fileExplorerProvider.onDidIndexChange((isIndexing) => {
        searchViewProvider.setStatus(isIndexing ? 'indexing' : 'ready');
    });
    // Watch for file changes to trigger re-indexing and refresh
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const handleFileChange = () => {
        // Debounce re-indexing to avoid too many updates
        fileExplorerProvider.rebuildIndex();
        fileExplorerProvider.refresh();
    };
    // Debounce helper
    let debounceTimer;
    const debouncedHandleFileChange = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(handleFileChange, 1000);
    };
    watcher.onDidCreate(debouncedHandleFileChange);
    watcher.onDidDelete(debouncedHandleFileChange);
    // We don't need to re-index on content change (onDidChange) unless we were indexing content, 
    // but here we only index filenames. However, renaming is a create+delete event usually, 
    // but sometimes handled differently. 
    // If we want to be safe, we can watch rename if available, but create/delete covers most structure changes.
    // Actually, onDidChange is for file content. We only care about structure.
    context.subscriptions.push(watcher);
    // Register the tree data provider
    const treeView = vscode.window.createTreeView('fileExplorePlusPlus.treeView', {
        treeDataProvider: fileExplorerProvider,
        showCollapseAll: true,
        canSelectMany: false
    });
    // Give the provider access to the tree view for expanding nodes
    fileExplorerProvider.setTreeView(treeView);
    context.subscriptions.push(treeView);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.refresh', () => {
        fileExplorerProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.openFile', (resource) => {
        vscode.window.showTextDocument(resource);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.revealInExplorer', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const uri = activeEditor.document.uri;
            await treeView.reveal(uri, { select: true, focus: true, expand: true });
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.newFile', async (node) => {
        let targetUri = node;
        if (!targetUri && vscode.workspace.workspaceFolders) {
            targetUri = vscode.workspace.workspaceFolders[0].uri;
        }
        if (!targetUri) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter file name',
            placeHolder: 'newFile.txt'
        });
        if (fileName) {
            const stat = await vscode.workspace.fs.stat(targetUri);
            const parentUri = stat.type === vscode.FileType.Directory ? targetUri : vscode.Uri.joinPath(targetUri, '..');
            const newFileUri = vscode.Uri.joinPath(parentUri, fileName);
            try {
                await vscode.workspace.fs.writeFile(newFileUri, new Uint8Array());
                await vscode.window.showTextDocument(newFileUri);
                fileExplorerProvider.refresh();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to create file: ${error}`);
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.newFolder', async (node) => {
        let targetUri = node;
        if (!targetUri && vscode.workspace.workspaceFolders) {
            targetUri = vscode.workspace.workspaceFolders[0].uri;
        }
        if (!targetUri) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        const folderName = await vscode.window.showInputBox({
            prompt: 'Enter folder name',
            placeHolder: 'newFolder'
        });
        if (folderName) {
            const stat = await vscode.workspace.fs.stat(targetUri);
            const parentUri = stat.type === vscode.FileType.Directory ? targetUri : vscode.Uri.joinPath(targetUri, '..');
            const newFolderUri = vscode.Uri.joinPath(parentUri, folderName);
            try {
                await vscode.workspace.fs.createDirectory(newFolderUri);
                fileExplorerProvider.refresh();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.deleteEntry', async (node) => {
        const result = await vscode.window.showWarningMessage(`Are you sure you want to delete '${node.fsPath}'?`, { modal: true }, 'Delete');
        if (result === 'Delete') {
            try {
                await vscode.workspace.fs.delete(node, { recursive: true, useTrash: true });
                fileExplorerProvider.refresh();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to delete: ${error}`);
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.renameEntry', async (node) => {
        const oldName = node.fsPath.split(/[\\/]/).pop() || '';
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name',
            value: oldName
        });
        if (newName && newName !== oldName) {
            const parentUri = vscode.Uri.joinPath(node, '..');
            const newUri = vscode.Uri.joinPath(parentUri, newName);
            try {
                await vscode.workspace.fs.rename(node, newUri);
                fileExplorerProvider.refresh();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to rename: ${error}`);
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.copyPath', async (node) => {
        await vscode.env.clipboard.writeText(node.fsPath);
        vscode.window.showInformationMessage('Path copied to clipboard');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('fileExplorePlusPlus.copyRelativePath', async (node) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(node);
        if (workspaceFolder) {
            const relativePath = vscode.workspace.asRelativePath(node, false);
            await vscode.env.clipboard.writeText(relativePath);
            vscode.window.showInformationMessage('Relative path copied to clipboard');
        }
    }));
    // Auto reveal on active editor change
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        const config = vscode.workspace.getConfiguration('fileExplorePlusPlus');
        const autoReveal = config.get('autoReveal', true);
        if (autoReveal && editor) {
            treeView.reveal(editor.document.uri, { select: true, focus: false });
        }
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map