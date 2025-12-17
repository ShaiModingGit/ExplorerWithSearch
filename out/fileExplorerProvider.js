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
        this.searchQuery = '';
        this.suffixFilter = '';
        this.searchResults = new Set();
        this.expandedFolders = new Set();
        this.isSearching = false;
        this.abortSearch = false;
    }
    setTreeView(treeView) {
        this.treeView = treeView;
    }
    async setSearchQuery(query) {
        this.searchQuery = query.toLowerCase();
        // If both search and filter are empty, just refresh without searching
        if (!this.searchQuery && !this.suffixFilter) {
            this.searchResults.clear();
            this.expandedFolders.clear();
            this.refresh();
            return;
        }
        this.abortSearch = false;
        this.isSearching = true;
        this.refresh(); // Show loading state
        await this.updateSearchResults();
        this.isSearching = false;
        if (!this.abortSearch) {
            this.refresh();
            await this.expandSearchResults();
        }
    }
    async setSuffixFilter(suffix) {
        this.suffixFilter = suffix.toLowerCase();
        // If both search and filter are empty, just refresh without searching
        if (!this.searchQuery && !this.suffixFilter) {
            this.searchResults.clear();
            this.expandedFolders.clear();
            this.refresh();
            return;
        }
        this.abortSearch = false;
        this.isSearching = true;
        this.refresh(); // Show loading state
        // Re-run the search with the new filter
        await this.updateSearchResults();
        this.isSearching = false;
        if (!this.abortSearch) {
            this.refresh();
            await this.expandSearchResults();
        }
    }
    async updateSearchResults() {
        this.searchResults.clear();
        this.expandedFolders.clear();
        if (!this.searchQuery && !this.suffixFilter) {
            return;
        }
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        const maxResults = 1000; // Limit results for performance
        let totalResults = 0;
        let lastRefreshCount = 0;
        // Callback to handle results progressively
        const onResultFound = (result, parents) => {
            this.searchResults.add(result.fsPath);
            totalResults++;
            // Mark all parent folders for expansion
            for (const parent of parents) {
                this.expandedFolders.add(parent.fsPath);
            }
            // Refresh UI every 50 results for progressive display
            if (totalResults - lastRefreshCount >= 50) {
                lastRefreshCount = totalResults;
                this.refresh();
            }
        };
        for (const folder of vscode.workspace.workspaceFolders) {
            if (this.abortSearch || totalResults >= maxResults) {
                break;
            }
            await (0, utils_1.searchFiles)(folder.uri, this.searchQuery, this.suffixFilter, folder.uri, onResultFound, () => this.abortSearch || totalResults >= maxResults);
        }
    }
    async expandSearchResults() {
        // Skip auto-expansion for performance - folders are already marked
        // and will show correctly in the tree view
        // Users can manually expand folders if needed
        return;
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
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        // Show loading indicator
        if (element.toString() === 'file:///searching') {
            const loadingItem = new vscode.TreeItem('Searching...');
            loadingItem.iconPath = new vscode.ThemeIcon('sync~spin');
            loadingItem.tooltip = 'Please wait while searching for files';
            return loadingItem;
        }
        return this.createTreeItem(element);
    }
    async getChildren(element) {
        if (!element) {
            // Show loading indicator at root level when searching
            if (this.isSearching && vscode.workspace.workspaceFolders) {
                // Return a special URI to show loading message
                return [vscode.Uri.parse('file:///searching')];
            }
            // Return workspace folders as root
            if (vscode.workspace.workspaceFolders) {
                return vscode.workspace.workspaceFolders.map(folder => folder.uri);
            }
            return [];
        }
        // Don't show children while searching
        if (this.isSearching) {
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
            if (this.searchQuery || this.suffixFilter) {
                fileItems = fileItems.filter(item => {
                    const isDirectory = item.type === vscode.FileType.Directory;
                    // Always show folders that contain matching files
                    if (isDirectory && this.expandedFolders.has(item.uri.fsPath)) {
                        return true;
                    }
                    // Show files that match the search
                    if (!isDirectory && this.searchResults.has(item.uri.fsPath)) {
                        return true;
                    }
                    return false;
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
        const shouldExpand = isWorkspaceRoot || this.expandedFolders.has(uri.fsPath);
        // Create tree item with highlighting if searching
        let label = basename;
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