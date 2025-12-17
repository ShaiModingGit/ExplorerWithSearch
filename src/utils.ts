import * as vscode from 'vscode';
import * as path from 'path';
import { FileItem, FileSortOrder } from './types';

/**
 * Check if a file/folder should be excluded based on configuration
 */
export function shouldExclude(name: string, parentUri: vscode.Uri): boolean {
    const config = vscode.workspace.getConfiguration('fileExplorePlusPlus');
    const excludePatterns = config.get<{ [key: string]: boolean }>('exclude', {});

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

/**
 * Sort file items based on the configured sort order
 */
export function sortFileItems(items: FileItem[], sortOrder: FileSortOrder): FileItem[] {
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
                    } else {
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

/**
 * Get appropriate icon for file or folder
 */
export function getFileIcon(uri: vscode.Uri, isDirectory: boolean): vscode.ThemeIcon {
    if (isDirectory) {
        return vscode.ThemeIcon.Folder;
    }

    const ext = path.extname(uri.fsPath).toLowerCase();

    // Return specific icons for common file types
    /* eslint-disable @typescript-eslint/naming-convention */
    const iconMap: { [key: string]: string } = {
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

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get relative path from workspace folder
 */
export function getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    }
    return uri.fsPath;
}

/**
 * Check if a filename matches the search query
 */
export function matchesSearch(filename: string, query: string): boolean {
    if (!query) {
        return true;
    }
    return filename.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if a filename matches the suffix filter
 */
export function matchesSuffixFilter(filename: string, suffix: string): boolean {
    if (!suffix) {
        return true;
    }
    const ext = path.extname(filename).toLowerCase();
    const filterExt = suffix.startsWith('.') ? suffix.toLowerCase() : `.${suffix.toLowerCase()}`;
    return ext === filterExt;
}

/**
 * Get match index for sorting (prefix matches come first)
 */
export function getMatchIndex(filename: string, query: string): number {
    if (!query) {
        return -1;
    }
    const lowerFilename = filename.toLowerCase();
    const lowerQuery = query.toLowerCase();
    return lowerFilename.indexOf(lowerQuery);
}

/**
 * Sort file items by search relevance
 */
export function sortBySearchRelevance(items: FileItem[], query: string): FileItem[] {
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

/**
 * Recursively search for files matching query and suffix filter
 * Uses callback pattern for progressive results and yields to prevent blocking
 */
export async function searchFiles(
    uri: vscode.Uri,
    query: string,
    suffixFilter: string,
    workspaceRoot: vscode.Uri,
    onResultFound: (result: vscode.Uri, parents: vscode.Uri[]) => void,
    shouldAbort?: () => boolean
): Promise<void> {
    let operationCount = 0;

    async function searchRecursive(currentUri: vscode.Uri): Promise<void> {
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
            const directories: string[] = [];
            const files: string[] = [];

            for (const [name, type] of entries) {
                if (shouldExclude(name, currentUri)) {
                    continue;
                }

                if (type === vscode.FileType.Directory) {
                    directories.push(name);
                } else if (type === vscode.FileType.File) {
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
        } catch (error) {
            // Silently ignore errors in individual directories
        }
    }

    await searchRecursive(uri);
}

/**
 * Get all parent folders of a URI up to the workspace root
 */
export function getParentFolders(uri: vscode.Uri, workspaceRoot: vscode.Uri): vscode.Uri[] {
    const parents: vscode.Uri[] = [];
    let current = vscode.Uri.joinPath(uri, '..');

    while (current.fsPath !== workspaceRoot.fsPath && current.fsPath.startsWith(workspaceRoot.fsPath)) {
        parents.push(current);
        current = vscode.Uri.joinPath(current, '..');
    }

    return parents;
}
