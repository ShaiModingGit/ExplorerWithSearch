import * as vscode from 'vscode';
import * as path from 'path';
import { FileItem, FileSortOrder } from './types';
import { shouldExclude, sortFileItems, getFileIcon, searchFiles, sortBySearchRelevance, getParentFolders, matchesSearch, matchesSuffixFilter, indexWorkspace, countWorkspaceFiles } from './utils';

export class FileExplorerProvider implements vscode.TreeDataProvider<vscode.Uri> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.Uri | undefined | null | void> = new vscode.EventEmitter<vscode.Uri | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.Uri | undefined | null | void> = this._onDidChangeTreeData.event;

    private _onDidIndexChange: vscode.EventEmitter<boolean> = new vscode.EventEmitter<boolean>();
    readonly onDidIndexChange: vscode.Event<boolean> = this._onDidIndexChange.event;

    private _onDidIndexProgress: vscode.EventEmitter<{ processed: number; total: number }> = new vscode.EventEmitter<{ processed: number; total: number }>();
    readonly onDidIndexProgress: vscode.Event<{ processed: number; total: number }> = this._onDidIndexProgress.event;

    private searchQuery: string = '';
    private suffixFilter: string = '';
    private workspaceExcludeExtensions: string = '';
    private searchResults: Set<string> = new Set();
    private expandedFolders: Set<string> = new Set();
    private treeView?: vscode.TreeView<vscode.Uri>;
    private isSearching: boolean = false;
    private abortSearch: boolean = false;
    private currentSearchToken: number = 0;
    private viewMode: 'tree' | 'list' = 'tree';
    private context?: vscode.ExtensionContext;

    // Indexing properties
    private fileIndex: { uri: vscode.Uri, name: string, nameWithoutExtLower: string, extLower: string, root: vscode.Uri }[] = [];
    private isIndexed: boolean = false;
    private isIndexing: boolean = false;
    private indexingPromise: Promise<void> | undefined;

    constructor(context?: vscode.ExtensionContext) {
        this.context = context;
    }

    setTreeView(treeView: vscode.TreeView<vscode.Uri>): void {
        this.treeView = treeView;
    }

    setWorkspaceExcludeExtensions(extensions: string): void {
        this.workspaceExcludeExtensions = extensions;
        this.refresh();
    }

    private shouldExcludeByWorkspace(fileExt: string): boolean {
        // Check if file extension is in workspace exclude list
        if (!this.workspaceExcludeExtensions) {
            return false;
        }
        const excludedExts = this.workspaceExcludeExtensions.split(',').map(s => s.trim());
        for (const ext of excludedExts) {
            if (!ext) { continue; }
            const excludeExt = ext.startsWith('.') ? ext : `.${ext}`;
            if (fileExt === excludeExt) {
                return true;
            }
        }
        return false;
    }

    private getUserSuffixFilter(): string {
        // Return only user-defined suffix filter
        return this.suffixFilter;
    }

    async setSearchQuery(query: string): Promise<void> {
        const myToken = ++this.currentSearchToken;
        this.searchQuery = query.toLowerCase();

        // If both search and filter are empty, just refresh without searching
        const userFilter = this.getUserSuffixFilter();
        if (!this.searchQuery && !userFilter) {
            this.searchResults.clear();
            this.expandedFolders.clear();
            this.refresh();
            return;
        }

        this.abortSearch = false;
        this.isSearching = true;
        this.refresh(); // Show loading state

        try {
            await this.updateSearchResults(myToken);
        } finally {
            if (this.currentSearchToken === myToken) {
                this.isSearching = false;
                if (!this.abortSearch) {
                    this.refresh();
                    await this.expandSearchResults();
                }
            }
        }
    }

    async setSuffixFilter(suffix: string): Promise<void> {
        const myToken = ++this.currentSearchToken;
        this.suffixFilter = suffix.toLowerCase();

        // If both search and filter are empty, just refresh without searching
        const userFilter = this.getUserSuffixFilter();
        if (!this.searchQuery && !userFilter) {
            this.searchResults.clear();
            this.expandedFolders.clear();
            this.refresh();
            return;
        }

        this.abortSearch = false;
        this.isSearching = true;
        this.refresh(); // Show loading state

        try {
            // Re-run the search with the new filter
            await this.updateSearchResults(myToken);
        } finally {
            if (this.currentSearchToken === myToken) {
                this.isSearching = false;
                if (!this.abortSearch) {
                    this.refresh();
                    await this.expandSearchResults();
                }
            }
        }
    }

    async rebuildIndex(): Promise<void> {
        this.isIndexed = false;
        this.indexingPromise = undefined;
        await this.buildIndex();

        // Re-run search if active
        const userFilter = this.getUserSuffixFilter();
        if (this.searchQuery || userFilter) {
            const myToken = ++this.currentSearchToken;
            this.isSearching = true;
            this.refresh();
            try {
                await this.updateSearchResults(myToken);
            } finally {
                if (this.currentSearchToken === myToken) {
                    this.isSearching = false;
                    if (!this.abortSearch) {
                        this.refresh();
                        await this.expandSearchResults();
                    }
                }
            }
        }
    }

    private async buildIndex(): Promise<void> {
        if (this.isIndexed) {
            return;
        }

        if (this.indexingPromise) {
            return this.indexingPromise;
        }

        this.indexingPromise = (async () => {
            this.isIndexing = true;
            this._onDidIndexChange.fire(true);
            this.fileIndex = [];

            // Pre-count files so we can report progress
            let totalFiles = 0;
            if (vscode.workspace.workspaceFolders) {
                for (const folder of vscode.workspace.workspaceFolders) {
                    totalFiles += await countWorkspaceFiles(folder.uri, () => false);
                }
            }

            let processed = 0;
            let lastProgressTime = 0;
            const emitProgress = () => {
                const now = Date.now();
                if (now - lastProgressTime > 200 || processed === totalFiles) {
                    this._onDidIndexProgress.fire({ processed, total: totalFiles });
                    lastProgressTime = now;
                }
            };

            // Emit initial progress
            this._onDidIndexProgress.fire({ processed, total: totalFiles });

            if (vscode.workspace.workspaceFolders) {
                for (const folder of vscode.workspace.workspaceFolders) {
                    await indexWorkspace(
                        folder.uri,
                        (uri, name) => {
                            const ext = path.extname(name);
                            const nameWithoutExt = path.basename(name, ext);
                            this.fileIndex.push({
                                uri,
                                name,
                                nameWithoutExtLower: nameWithoutExt.toLowerCase(),
                                extLower: ext.toLowerCase(),
                                root: folder.uri
                            });
                            processed++;
                            emitProgress();
                        },
                        () => false // Don't abort indexing, it's one-time
                    );
                }
            }

            // Final progress update
            this._onDidIndexProgress.fire({ processed, total: totalFiles });

            this.isIndexed = true;
            this.isIndexing = false;
            this._onDidIndexChange.fire(false);
            this.indexingPromise = undefined;
        })();

        return this.indexingPromise;
    }

    private async updateSearchResults(token: number): Promise<void> {
        this.searchResults.clear();
        this.expandedFolders.clear();

        const userFilter = this.getUserSuffixFilter();
        if (!this.searchQuery && !userFilter) {
            return;
        }

        // Ensure index is built
        if (!this.isIndexed) {
            await this.buildIndex();
        }

        // Check if this search has been superseded
        if (this.currentSearchToken !== token) {
            return;
        }

        const maxResults = 1000; // Limit results for performance
        let totalResults = 0;
        let lastRefreshCount = 0;

        // Filter the index
        for (const item of this.fileIndex) {
            if (this.abortSearch || totalResults >= maxResults || this.currentSearchToken !== token) {
                break;
            }

            // Check search query
            if (this.searchQuery && !item.nameWithoutExtLower.includes(this.searchQuery)) {
                continue;
            }

            // Exclude workspace-excluded extensions
            if (this.shouldExcludeByWorkspace(item.extLower)) {
                continue;
            }

            // Check user suffix filter (supports comma-separated suffixes)
            const userFilter = this.getUserSuffixFilter();
            if (userFilter) {
                const suffixes = userFilter.split(',').map(s => s.trim());
                let matchesSuffix = false;

                for (const suf of suffixes) {
                    if (!suf) { continue; }
                    const filterExt = suf.startsWith('.') ? suf : `.${suf}`;
                    if (item.extLower === filterExt) {
                        matchesSuffix = true;
                        break;
                    }
                }

                if (!matchesSuffix) {
                    continue;
                }
            }

            // Match found
            this.searchResults.add(item.uri.fsPath);
            totalResults++;

            // Mark all parent folders for expansion
            const parents = getParentFolders(item.uri, item.root);
            for (const parent of parents) {
                this.expandedFolders.add(parent.fsPath.toLowerCase());
            }

            // Refresh UI every 50 results for progressive display
            if (totalResults - lastRefreshCount >= 50) {
                lastRefreshCount = totalResults;
                this.refresh();
                // Yield to UI
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    private async expandSearchResults(): Promise<void> {
        if (this.searchResults.size > 0 && this.treeView) {
            // Reveal the first result to ensure tree is open
            const first = this.searchResults.values().next().value;
            if (first) {
                try {
                    await this.treeView.reveal(vscode.Uri.file(first), { select: false, focus: false, expand: true });
                } catch (e) { }
            }
        }
    }

    getSearchQuery(): string {
        return this.searchQuery;
    }

    getSuffixFilter(): string {
        return this.suffixFilter;
    }

    abort(): void {
        this.abortSearch = true;
        this.isSearching = false;
        this.refresh();
    }

    toggleViewMode(): void {
        this.viewMode = this.viewMode === 'tree' ? 'list' : 'tree';
        if (this.context) {
            this.context.workspaceState.update('fileExplorePlusPlus.viewMode', this.viewMode);
        }
        this.refresh();
    }

    setViewMode(mode: 'tree' | 'list'): void {
        this.viewMode = mode;
        if (this.context) {
            this.context.workspaceState.update('fileExplorePlusPlus.viewMode', this.viewMode);
        }
        this.refresh();
    }

    getViewMode(): 'tree' | 'list' {
        return this.viewMode;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.Uri): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return this.createTreeItem(element);
    }

    async getChildren(element?: vscode.Uri): Promise<vscode.Uri[]> {
        // List view: return flat list of all files
        if (this.viewMode === 'list' && !element) {
            // Ensure index is built
            if (!this.isIndexed) {
                await this.buildIndex();
            }

            // Filter and return matching files
            let files = this.fileIndex;

            const userFilter = this.getUserSuffixFilter();
            if (this.searchQuery || userFilter) {
                files = files.filter(item => {
                    // Check search query
                    if (this.searchQuery && !item.nameWithoutExtLower.includes(this.searchQuery)) {
                        return false;
                    }

                    // Exclude workspace-excluded extensions
                    if (this.shouldExcludeByWorkspace(item.extLower)) {
                        return false;
                    }

                    // Check user suffix filter
                    if (userFilter) {
                        const suffixes = userFilter.split(',').map(s => s.trim());
                        let matchesSuffix = false;

                        for (const suf of suffixes) {
                            if (!suf) { continue; }
                            const filterExt = suf.startsWith('.') ? suf : `.${suf}`;
                            if (item.extLower === filterExt) {
                                matchesSuffix = true;
                                break;
                            }
                        }

                        if (!matchesSuffix) {
                            return false;
                        }
                    }

                    return true;
                });
            } else {
                // No search/filter active, but still exclude workspace extensions
                files = files.filter(item => !this.shouldExcludeByWorkspace(item.extLower));
            }

            // Sort by search relevance if searching
            if (this.searchQuery) {
                files = [...files].sort((a, b) => {
                    const aName = a.nameWithoutExtLower;
                    const bName = b.nameWithoutExtLower;
                    const query = this.searchQuery;

                    // Check if name starts with query (highest priority)
                    const aStarts = aName.startsWith(query);
                    const bStarts = bName.startsWith(query);
                    if (aStarts && !bStarts) { return -1; }
                    if (!aStarts && bStarts) { return 1; }

                    // Then by index position (earlier is better)
                    const aIndex = aName.indexOf(query);
                    const bIndex = bName.indexOf(query);
                    if (aIndex !== bIndex) { return aIndex - bIndex; }

                    // Finally by name length (shorter is better)
                    return aName.length - bName.length;
                });
            }

            return files.map(f => f.uri);
        }

        // Tree view: existing logic
        if (!element) {
            // Return workspace folders as root
            if (vscode.workspace.workspaceFolders) {
                return vscode.workspace.workspaceFolders.map(folder => folder.uri);
            }
            return [];
        }

        try {
            const entries = await vscode.workspace.fs.readDirectory(element);
            const config = vscode.workspace.getConfiguration('fileExplorePlusPlus');
            const sortOrder = config.get<string>('sortOrder', 'default') as FileSortOrder;

            // Filter and map entries
            let fileItems: FileItem[] = entries
                .filter(([name]) => !shouldExclude(name, element))
                .map(([name, type]) => ({
                    name,
                    uri: vscode.Uri.joinPath(element, name),
                    type
                }));

            // Apply search and suffix filtering
            const userFilter = this.getUserSuffixFilter();
            if (this.searchQuery || userFilter) {
                fileItems = fileItems.filter(item => {
                    const isDirectory = item.type === vscode.FileType.Directory;

                    // Always show folders that contain matching files
                    if (isDirectory && this.expandedFolders.has(item.uri.fsPath.toLowerCase())) {
                        return true;
                    }

                    // Show files that match the search
                    if (!isDirectory && this.searchResults.has(item.uri.fsPath)) {
                        return true;
                    }

                    return false;
                });
            } else {
                // No search/filter, but still exclude workspace-excluded extensions
                fileItems = fileItems.filter(item => {
                    const isDirectory = item.type === vscode.FileType.Directory;
                    if (isDirectory) {
                        return true; // Always show directories
                    }
                    const fileExt = path.extname(item.name).toLowerCase();
                    return !this.shouldExcludeByWorkspace(fileExt);
                });
            }

            // Sort based on configuration or search relevance
            let sortedItems: FileItem[];
            if (this.searchQuery) {
                // Separate folders and files
                const folders = fileItems.filter(item => item.type === vscode.FileType.Directory);
                const files = fileItems.filter(item => item.type === vscode.FileType.File);

                // Sort files by search relevance
                const sortedFiles = sortBySearchRelevance(files, this.searchQuery);

                // Folders first, then sorted files
                sortedItems = [...folders, ...sortedFiles];
            } else {
                sortedItems = sortFileItems(fileItems, sortOrder);
            }

            return sortedItems.map((item: FileItem) => item.uri);
        } catch (error) {
            console.error(`Error reading directory ${element.fsPath}:`, error);
            return [];
        }
    }

    getParent(element: vscode.Uri): vscode.ProviderResult<vscode.Uri> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(element);
        if (workspaceFolder && element.fsPath === workspaceFolder.uri.fsPath) {
            return undefined;
        }
        return vscode.Uri.joinPath(element, '..');
    }

    private async createTreeItem(uri: vscode.Uri): Promise<vscode.TreeItem> {
        const stat = await vscode.workspace.fs.stat(uri);
        const isDirectory = stat.type === vscode.FileType.Directory;
        const basename = path.basename(uri.fsPath);

        // Check if this is a workspace root folder or should be expanded for search
        const isWorkspaceRoot = vscode.workspace.workspaceFolders?.some(
            folder => folder.uri.fsPath === uri.fsPath
        );
        const shouldExpand = isWorkspaceRoot || this.expandedFolders.has(uri.fsPath.toLowerCase());

        // Create tree item with highlighting if searching
        let label: string | vscode.TreeItemLabel = basename;
        let description: string | undefined = undefined;

        // In list view, show the file path as description
        if (this.viewMode === 'list' && !isDirectory) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (workspaceFolder) {
                const relativePath = path.relative(workspaceFolder.uri.fsPath, path.dirname(uri.fsPath));
                description = relativePath || workspaceFolder.name;
            }
        }

        if (this.searchQuery && !isDirectory) {
            const nameWithoutExt = path.basename(basename, path.extname(basename));
            const ext = path.extname(basename);
            const query = this.searchQuery;
            const lowerName = nameWithoutExt.toLowerCase();
            const lowerQuery = query.toLowerCase();
            const matchIndex = lowerName.indexOf(lowerQuery);

            if (matchIndex !== -1) {
                // Create label with highlights
                label = {
                    label: basename,
                    highlights: [[matchIndex, matchIndex + query.length]]
                };
            }
        }

        const treeItem = new vscode.TreeItem(
            label,
            isDirectory
                ? (shouldExpand ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
                : vscode.TreeItemCollapsibleState.None
        );

        // Set ID to ensure state is reset during search or view mode change
        if (this.searchQuery) {
            treeItem.id = uri.fsPath + '?search=' + this.viewMode;
        } else {
            treeItem.id = uri.fsPath + '?mode=' + this.viewMode;
        }

        // Set description for list view
        if (description) {
            treeItem.description = description;
        }

        treeItem.resourceUri = uri;
        treeItem.contextValue = isDirectory ? 'folder' : 'file';
        treeItem.iconPath = getFileIcon(uri, isDirectory);

        if (!isDirectory) {
            treeItem.command = {
                command: 'fileExplorePlusPlus.openFile',
                title: 'Open File',
                arguments: [uri]
            };
        }

        // Add tooltips
        treeItem.tooltip = new vscode.MarkdownString();
        treeItem.tooltip.appendMarkdown(`**${basename}**\n\n`);
        treeItem.tooltip.appendText(`Path: ${uri.fsPath}\n`);
        treeItem.tooltip.appendText(`Type: ${isDirectory ? 'Directory' : 'File'}\n`);

        if (!isDirectory) {
            const sizeKB = (stat.size / 1024).toFixed(2);
            treeItem.tooltip.appendText(`Size: ${sizeKB} KB\n`);
        }

        const modifiedDate = new Date(stat.mtime);
        treeItem.tooltip.appendText(`Modified: ${modifiedDate.toLocaleString()}`);

        return treeItem;
    }
}
