import * as vscode from 'vscode';
import { FileExplorerProvider } from './fileExplorerProvider';
import { SearchViewProvider } from './searchViewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('File Explorer++ extension is now active');

    // Ensure toolbar buttons are always visible
    const config = vscode.workspace.getConfiguration('workbench.view');
    const alwaysShowActions = config.get('alwaysShowHeaderActions');
    if (alwaysShowActions !== true) {
        config.update('alwaysShowHeaderActions', true, vscode.ConfigurationTarget.Global);
    }

    // Create the file explorer provider
    const fileExplorerProvider = new FileExplorerProvider(context);

    // Restore saved view mode, prioritizing saved state over default config
    const savedViewMode = context.workspaceState.get<'tree' | 'list'>('fileExplorePlusPlus.viewMode');
    if (savedViewMode) {
        fileExplorerProvider.setViewMode(savedViewMode);
    } else {
        // Apply default view mode from configuration if no saved state
        const explorerConfig = vscode.workspace.getConfiguration('fileExplorePlusPlus');
        const defaultViewMode = explorerConfig.get<'tree' | 'list'>('defaultViewMode', 'tree');
        fileExplorerProvider.setViewMode(defaultViewMode);
    }

    // Import utility to get excluded extensions
    const { getExcludedExtensionsFromWorkspace } = require('./utils');

    // Apply workspace exclude extensions as automatic filter
    const applyWorkspaceExcludes = () => {
        const excludedExtensions = getExcludedExtensionsFromWorkspace();
        fileExplorerProvider.setWorkspaceExcludeExtensions(excludedExtensions);
    };
    applyWorkspaceExcludes();

    // Watch for workspace configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('files.exclude')) {
                applyWorkspaceExcludes();
            }
            if (e.affectsConfiguration('fileExplorePlusPlus.defaultViewMode')) {
                const explorerConfig = vscode.workspace.getConfiguration('fileExplorePlusPlus');
                const viewMode = explorerConfig.get<'tree' | 'list'>('defaultViewMode', 'tree');
                fileExplorerProvider.setViewMode(viewMode);
            }
        })
    );

    // Restore saved search state
    const savedSearch = context.workspaceState.get<string>('fileExplorePlusPlus.searchQuery', '');
    const savedFilter = context.workspaceState.get<string>('fileExplorePlusPlus.filterSuffix', '');

    if (savedSearch) {
        fileExplorerProvider.setSearchQuery(savedSearch);
    }
    if (savedFilter) {
        fileExplorerProvider.setSuffixFilter(savedFilter);
    }

    // Create and register the search view provider
    const searchViewProvider = new SearchViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SearchViewProvider.viewType, searchViewProvider)
    );

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

    fileExplorerProvider.onDidIndexProgress((progress) => {
        searchViewProvider.setStatus('indexing', progress);
    });

    // Watch for file changes to trigger re-indexing and refresh
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const handleFileChange = () => {
        // Debounce re-indexing to avoid too many updates
        fileExplorerProvider.rebuildIndex();
        fileExplorerProvider.refresh();
    };

    // Debounce helper
    let debounceTimer: NodeJS.Timeout;
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
    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.refresh', () => {
            fileExplorerProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.rebuildIndex', async () => {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Rebuilding File Explorer++ index...'
                },
                async () => {
                    await fileExplorerProvider.rebuildIndex();
                    fileExplorerProvider.refresh();
                }
            );

            vscode.window.showInformationMessage('File Explorer++ index rebuilt.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.toggleViewMode', () => {
            fileExplorerProvider.toggleViewMode();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.openFile', (resource: vscode.Uri) => {
            vscode.window.showTextDocument(resource);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.revealInExplorer', async () => {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const uri = activeEditor.document.uri;
                await treeView.reveal(uri, { select: true, focus: true, expand: true });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.newFile', async (node?: vscode.Uri) => {
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
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to create file: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.newFolder', async (node?: vscode.Uri) => {
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
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.deleteEntry', async (node: vscode.Uri) => {
            const result = await vscode.window.showWarningMessage(
                `Are you sure you want to delete '${node.fsPath}'?`,
                { modal: true },
                'Delete'
            );

            if (result === 'Delete') {
                try {
                    await vscode.workspace.fs.delete(node, { recursive: true, useTrash: true });
                    fileExplorerProvider.refresh();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to delete: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.renameEntry', async (node: vscode.Uri) => {
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
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to rename: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.copyPath', async (node: vscode.Uri) => {
            await vscode.env.clipboard.writeText(node.fsPath);
            vscode.window.showInformationMessage('Path copied to clipboard');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.copyRelativePath', async (node: vscode.Uri) => {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(node);
            if (workspaceFolder) {
                const relativePath = vscode.workspace.asRelativePath(node, false);
                await vscode.env.clipboard.writeText(relativePath);
                vscode.window.showInformationMessage('Relative path copied to clipboard');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.openInExplorer', async (node: vscode.Uri) => {
            if (!node) {
                vscode.window.showErrorMessage('No file or folder selected');
                return;
            }

            try {
                const stat = await vscode.workspace.fs.stat(node);
                const pathToOpen = node.fsPath;
                const { exec } = require('child_process');

                // If it's a file, use /select to highlight it in Windows Explorer
                // If it's a folder, just open the folder
                if (stat.type === vscode.FileType.File) {
                    exec(`explorer.exe /select,"${pathToOpen}"`);
                } else {
                    exec(`explorer.exe "${pathToOpen}"`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open in Explorer: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.focusSearch', async () => {
            await searchViewProvider.focusSearchInput();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('fileExplorePlusPlus.setKeybinding', async () => {
            await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', 'fileExplorePlusPlus.focusSearch');
        })
    );

    // Auto reveal on active editor change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            const config = vscode.workspace.getConfiguration('fileExplorePlusPlus');
            const autoReveal = config.get<boolean>('autoReveal', true);

            if (autoReveal && editor) {
                treeView.reveal(editor.document.uri, { select: true, focus: false });
            }
        })
    );
}

export function deactivate() { }
