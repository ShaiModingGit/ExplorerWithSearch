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
exports.FileExplorerProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const utils_1 = require("./utils");
class FileExplorerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._onDidIndexChange = new vscode.EventEmitter();
        this.onDidIndexChange = this._onDidIndexChange.event;
        this.searchQuery = '';
        this.suffixFilter = '';
        this.workspaceExcludeExtensions = '';
        this.searchResults = new Set();
        this.expandedFolders = new Set();
        this.isSearching = false;
        this.abortSearch = false;
        this.currentSearchToken = 0;
        this.viewMode = 'tree';
        // Indexing properties
        this.fileIndex = [];
        this.isIndexed = false;
        this.isIndexing = false;
    }
    setTreeView(treeView) {
        this.treeView = treeView;
    }
    setWorkspaceExcludeExtensions(extensions) {
        this.workspaceExcludeExtensions = extensions;
        this.refresh();
    }
    shouldExcludeByWorkspace(fileExt) {
        // Check if file extension is in workspace exclude list
        if (!this.workspaceExcludeExtensions) {
            return false;
        }
        const excludedExts = this.workspaceExcludeExtensions.split(',').map(s => s.trim());
        for (const ext of excludedExts) {
            if (!ext)
                continue;
            const excludeExt = ext.startsWith('.') ? ext : `.${ext}`;
            if (fileExt === excludeExt) {
                return true;
            }
        }
        return false;
    }
    getUserSuffixFilter() {
        // Return only user-defined suffix filter
        return this.suffixFilter;
    }
    async setSearchQuery(query) {
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
        }
        finally {
            if (this.currentSearchToken === myToken) {
                this.isSearching = false;
                if (!this.abortSearch) {
                    this.refresh();
                    await this.expandSearchResults();
                }
            }
        }
    }
    async setSuffixFilter(suffix) {
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
        }
        finally {
            if (this.currentSearchToken === myToken) {
                this.isSearching = false;
                if (!this.abortSearch) {
                    this.refresh();
                    await this.expandSearchResults();
                }
            }
        }
    }
    async rebuildIndex() {
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
            }
            finally {
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
    async buildIndex() {
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
            if (vscode.workspace.workspaceFolders) {
                for (const folder of vscode.workspace.workspaceFolders) {
                    await (0, utils_1.indexWorkspace)(folder.uri, (uri, name) => {
                        const ext = path.extname(name);
                        const nameWithoutExt = path.basename(name, ext);
                        this.fileIndex.push({
                            uri,
                            name,
                            nameWithoutExtLower: nameWithoutExt.toLowerCase(),
                            extLower: ext.toLowerCase(),
                            root: folder.uri
                        });
                    }, () => false // Don't abort indexing, it's one-time
                    );
                }
            }
            this.isIndexed = true;
            this.isIndexing = false;
            this._onDidIndexChange.fire(false);
            this.indexingPromise = undefined;
        })();
        return this.indexingPromise;
    }
    async updateSearchResults(token) {
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
                    if (!suf)
                        continue;
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
            const parents = (0, utils_1.getParentFolders)(item.uri, item.root);
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
    async expandSearchResults() {
        if (this.searchResults.size > 0 && this.treeView) {
            // Reveal the first result to ensure tree is open
            const first = this.searchResults.values().next().value;
            if (first) {
                try {
                    await this.treeView.reveal(vscode.Uri.file(first), { select: false, focus: false, expand: true });
                }
                catch (e) { }
            }
        }
    }
    getSearchQuery() {
        return this.searchQuery;
    }
    getSuffixFilter() {
        return this.suffixFilter;
    }
    abort() {
        this.abortSearch = true;
        this.isSearching = false;
        this.refresh();
    }
    toggleViewMode() {
        this.viewMode = this.viewMode === 'tree' ? 'list' : 'tree';
        this.refresh();
    }
    getViewMode() {
        return this.viewMode;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return this.createTreeItem(element);
    }
    async getChildren(element) {
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
                            if (!suf)
                                continue;
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
            }
            else {
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
                    if (aStarts && !bStarts) {
                        return -1;
                    }
                    if (!aStarts && bStarts) {
                        return 1;
                    }
                    // Then by index position (earlier is better)
                    const aIndex = aName.indexOf(query);
                    const bIndex = bName.indexOf(query);
                    if (aIndex !== bIndex) {
                        return aIndex - bIndex;
                    }
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
            const sortOrder = config.get('sortOrder', 'default');
            // Filter and map entries
            let fileItems = entries
                .filter(([name]) => !(0, utils_1.shouldExclude)(name, element))
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
            }
            else {
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
            let sortedItems;
            if (this.searchQuery) {
                // Separate folders and files
                const folders = fileItems.filter(item => item.type === vscode.FileType.Directory);
                const files = fileItems.filter(item => item.type === vscode.FileType.File);
                // Sort files by search relevance
                const sortedFiles = (0, utils_1.sortBySearchRelevance)(files, this.searchQuery);
                // Folders first, then sorted files
                sortedItems = [...folders, ...sortedFiles];
            }
            else {
                sortedItems = (0, utils_1.sortFileItems)(fileItems, sortOrder);
            }
            return sortedItems.map((item) => item.uri);
        }
        catch (error) {
            console.error(`Error reading directory ${element.fsPath}:`, error);
            return [];
        }
    }
    getParent(element) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(element);
        if (workspaceFolder && element.fsPath === workspaceFolder.uri.fsPath) {
            return undefined;
        }
        return vscode.Uri.joinPath(element, '..');
    }
    async createTreeItem(uri) {
        const stat = await vscode.workspace.fs.stat(uri);
        const isDirectory = stat.type === vscode.FileType.Directory;
        const basename = path.basename(uri.fsPath);
        // Check if this is a workspace root folder or should be expanded for search
        const isWorkspaceRoot = vscode.workspace.workspaceFolders?.some(folder => folder.uri.fsPath === uri.fsPath);
        const shouldExpand = isWorkspaceRoot || this.expandedFolders.has(uri.fsPath.toLowerCase());
        // Create tree item with highlighting if searching
        let label = basename;
        let description = undefined;
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
        const treeItem = new vscode.TreeItem(label, isDirectory
            ? (shouldExpand ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
            : vscode.TreeItemCollapsibleState.None);
        // Set ID to ensure state is reset during search or view mode change
        if (this.searchQuery) {
            treeItem.id = uri.fsPath + '?search=' + this.viewMode;
        }
        else {
            treeItem.id = uri.fsPath + '?mode=' + this.viewMode;
        }
        // Set description for list view
        if (description) {
            treeItem.description = description;
        }
        treeItem.resourceUri = uri;
        treeItem.contextValue = isDirectory ? 'folder' : 'file';
        treeItem.iconPath = (0, utils_1.getFileIcon)(uri, isDirectory);
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
exports.FileExplorerProvider = FileExplorerProvider;
//# sourceMappingURL=fileExplorerProvider.js.map