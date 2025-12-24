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
exports.indexWorkspace = exports.getParentFolders = exports.searchFiles = exports.sortBySearchRelevance = exports.getMatchIndex = exports.matchesSuffixFilter = exports.matchesSearch = exports.getRelativePath = exports.formatFileSize = exports.getFileIcon = exports.sortFileItems = exports.shouldExclude = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Check if a file/folder should be excluded based on configuration
 */
function shouldExclude(name, parentUri) {
    const config = vscode.workspace.getConfiguration('fileExplorePlusPlus');
    const excludePatterns = config.get('exclude', {});
    for (const pattern in excludePatterns) {
        if (excludePatterns[pattern]) {
            // Simple pattern matching (supports ** and *)
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/\\\\]*');
            const regex = new RegExp(`^${regexPattern}$`);
            if (regex.test(name)) {
                return true;
            }
        }
    }
    return false;
}
exports.shouldExclude = shouldExclude;
/**
 * Sort file items based on the configured sort order
 */
function sortFileItems(items, sortOrder) {
    const sorted = [...items];
    switch (sortOrder) {
        case 'default':
            // Folders first, then files, both alphabetically
            sorted.sort((a, b) => {
                const aIsDir = a.type === vscode.FileType.Directory;
                const bIsDir = b.type === vscode.FileType.Directory;
                if (aIsDir === bIsDir) {
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                }
                return aIsDir ? -1 : 1; // Folders first
            });
            break;
        case 'mixed':
            // Alphabetical, folders and files mixed
            sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            break;
        case 'filesFirst':
            sorted.sort((a, b) => {
                const aIsDir = a.type === vscode.FileType.Directory;
                const bIsDir = b.type === vscode.FileType.Directory;
                if (aIsDir === bIsDir) {
                    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                }
                return aIsDir ? 1 : -1; // Files first
            });
            break;
        case 'type':
            sorted.sort((a, b) => {
                const aIsDir = a.type === vscode.FileType.Directory;
                const bIsDir = b.type === vscode.FileType.Directory;
                if (aIsDir === bIsDir) {
                    if (aIsDir) {
                        // Both are directories
                        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                    }
                    else {
                        // Both are files, sort by extension then name
                        const aExt = path.extname(a.name);
                        const bExt = path.extname(b.name);
                        if (aExt === bExt) {
                            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                        }
                        return aExt.localeCompare(bExt);
                    }
                }
                return aIsDir ? -1 : 1; // Directories first
            });
            break;
        case 'modified':
            // This would require additional stat calls, keeping simple for now
            sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            break;
    }
    return sorted;
}
exports.sortFileItems = sortFileItems;
/**
 * Get appropriate icon for file or folder
 */
function getFileIcon(uri, isDirectory) {
    if (isDirectory) {
        return vscode.ThemeIcon.Folder;
    }
    const ext = path.extname(uri.fsPath).toLowerCase();
    // Return specific icons for common file types
    /* eslint-disable @typescript-eslint/naming-convention */
    const iconMap = {
        '.js': 'symbol-method',
        '.ts': 'symbol-method',
        '.json': 'symbol-namespace',
        '.md': 'markdown',
        '.py': 'symbol-method',
        '.java': 'symbol-class',
        '.cpp': 'symbol-method',
        '.c': 'symbol-method',
        '.h': 'symbol-method',
        '.css': 'symbol-color',
        '.scss': 'symbol-color',
        '.html': 'symbol-misc',
        '.xml': 'symbol-misc',
        '.yaml': 'symbol-misc',
        '.yml': 'symbol-misc',
        '.txt': 'file-text',
        '.pdf': 'file-pdf',
        '.png': 'file-media',
        '.jpg': 'file-media',
        '.jpeg': 'file-media',
        '.gif': 'file-media',
        '.svg': 'file-media',
        '.zip': 'file-zip',
        '.tar': 'file-zip',
        '.gz': 'file-zip',
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    const iconId = iconMap[ext] || 'file';
    return new vscode.ThemeIcon(iconId);
}
exports.getFileIcon = getFileIcon;
/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
exports.formatFileSize = formatFileSize;
/**
 * Get relative path from workspace folder
 */
function getRelativePath(uri) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    }
    return uri.fsPath;
}
exports.getRelativePath = getRelativePath;
/**
 * Check if a filename matches the search query
 */
function matchesSearch(filename, query) {
    if (!query) {
        return true;
    }
    return filename.toLowerCase().includes(query.toLowerCase());
}
exports.matchesSearch = matchesSearch;
/**
 * Check if a filename matches the suffix filter
 */
function matchesSuffixFilter(filename, suffix) {
    if (!suffix) {
        return true;
    }
    const ext = path.extname(filename).toLowerCase();
    const filterExt = suffix.startsWith('.') ? suffix.toLowerCase() : `.${suffix.toLowerCase()}`;
    return ext === filterExt;
}
exports.matchesSuffixFilter = matchesSuffixFilter;
/**
 * Get match index for sorting (prefix matches come first)
 */
function getMatchIndex(filename, query) {
    if (!query) {
        return -1;
    }
    const lowerFilename = filename.toLowerCase();
    const lowerQuery = query.toLowerCase();
    return lowerFilename.indexOf(lowerQuery);
}
exports.getMatchIndex = getMatchIndex;
/**
 * Sort file items by search relevance
 */
function sortBySearchRelevance(items, query) {
    if (!query) {
        return items;
    }
    return items.sort((a, b) => {
        const aName = path.basename(a.name, path.extname(a.name));
        const bName = path.basename(b.name, path.extname(b.name));
        const aIndex = getMatchIndex(aName, query);
        const bIndex = getMatchIndex(bName, query);
        // Both match at same position, sort alphabetically
        if (aIndex === bIndex) {
            return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
        }
        // Both have matches, sort by position (earlier matches first)
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        // One doesn't match (shouldn't happen if filtered correctly)
        if (aIndex === -1) {
            return 1;
        }
        if (bIndex === -1) {
            return -1;
        }
        return 0;
    });
}
exports.sortBySearchRelevance = sortBySearchRelevance;
/**
 * Recursively search for files matching query and suffix filter
 * Uses callback pattern for progressive results and yields to prevent blocking
 */
async function searchFiles(uri, query, suffixFilter, workspaceRoot, onResultFound, shouldAbort) {
    let operationCount = 0;
    async function searchRecursive(currentUri) {
        try {
            // Check if search should be aborted early
            if (shouldAbort && shouldAbort()) {
                return;
            }
            // Yield to event loop every 20 operations to prevent blocking
            operationCount++;
            if (operationCount % 20 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
            const entries = await vscode.workspace.fs.readDirectory(currentUri);
            // Separate directories and files for optimized processing
            const directories = [];
            const files = [];
            for (const [name, type] of entries) {
                if (shouldExclude(name, currentUri)) {
                    continue;
                }
                if (type === vscode.FileType.Directory) {
                    directories.push(name);
                }
                else if (type === vscode.FileType.File) {
                    files.push(name);
                }
            }
            // Process files first (faster) before diving into subdirectories
            for (const name of files) {
                if (shouldAbort && shouldAbort()) {
                    return;
                }
                const nameWithoutExt = path.basename(name, path.extname(name));
                if (matchesSearch(nameWithoutExt, query) && matchesSuffixFilter(name, suffixFilter)) {
                    const childUri = vscode.Uri.joinPath(currentUri, name);
                    const parents = getParentFolders(childUri, workspaceRoot);
                    onResultFound(childUri, parents);
                }
            }
            // Then recurse into directories
            for (const name of directories) {
                if (shouldAbort && shouldAbort()) {
                    return;
                }
                const childUri = vscode.Uri.joinPath(currentUri, name);
                await searchRecursive(childUri);
            }
        }
        catch (error) {
            // Silently ignore errors in individual directories
        }
    }
    await searchRecursive(uri);
}
exports.searchFiles = searchFiles;
/**
 * Get all parent folders of a URI up to the workspace root
 */
function getParentFolders(uri, workspaceRoot) {
    const parents = [];
    let current = vscode.Uri.joinPath(uri, '..');
    // Normalize paths for comparison to handle case sensitivity and different separators
    const rootPath = workspaceRoot.fsPath.toLowerCase();
    while (current.fsPath.toLowerCase() !== rootPath) {
        const currentPath = current.fsPath.toLowerCase();
        // Check if we've gone past the root or are outside
        if (!currentPath.startsWith(rootPath)) {
            break;
        }
        parents.push(current);
        current = vscode.Uri.joinPath(current, '..');
    }
    return parents;
}
exports.getParentFolders = getParentFolders;
/**
 * Recursively index all files in the workspace
 */
async function indexWorkspace(uri, onFileFound, shouldAbort) {
    let operationCount = 0;
    async function indexRecursive(currentUri) {
        try {
            if (shouldAbort && shouldAbort()) {
                return;
            }
            // Yield to event loop every 50 operations
            operationCount++;
            if (operationCount % 50 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
            const entries = await vscode.workspace.fs.readDirectory(currentUri);
            for (const [name, type] of entries) {
                if (shouldExclude(name, currentUri)) {
                    continue;
                }
                if (type === vscode.FileType.File) {
                    const childUri = vscode.Uri.joinPath(currentUri, name);
                    onFileFound(childUri, name);
                }
                else if (type === vscode.FileType.Directory) {
                    const childUri = vscode.Uri.joinPath(currentUri, name);
                    await indexRecursive(childUri);
                }
            }
        }
        catch (error) {
            // Ignore errors
        }
    }
    await indexRecursive(uri);
}
exports.indexWorkspace = indexWorkspace;
//# sourceMappingURL=utils.js.map