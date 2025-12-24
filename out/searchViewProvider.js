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
exports.SearchViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class SearchViewProvider {
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
        this._onSearchChange = new vscode.EventEmitter();
        this._onFilterChange = new vscode.EventEmitter();
        this._onAbort = new vscode.EventEmitter();
        this._onClear = new vscode.EventEmitter();
        this.onSearchChange = this._onSearchChange.event;
        this.onFilterChange = this._onFilterChange.event;
        this.onAbort = this._onAbort.event;
        this.onClear = this._onClear.event;
        this._currentSearch = '';
        this._currentFilter = '';
        // Restore saved state
        this._currentSearch = this._context.workspaceState.get('fileExplorePlusPlus.searchQuery', '');
        this._currentFilter = this._context.workspaceState.get('fileExplorePlusPlus.filterSuffix', '');
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Restore state after webview loads
        setTimeout(() => {
            this._restoreState();
        }, 100);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'search':
                    this._currentSearch = data.value;
                    this._context.workspaceState.update('fileExplorePlusPlus.searchQuery', data.value);
                    this._onSearchChange.fire(data.value);
                    // If search includes a filter, also update and apply that filter
                    if (data.filter !== undefined) {
                        this._currentFilter = data.filter;
                        this._context.workspaceState.update('fileExplorePlusPlus.filterSuffix', data.filter);
                        this._onFilterChange.fire(data.filter);
                    }
                    break;
                case 'filter':
                    this._currentFilter = data.value;
                    this._context.workspaceState.update('fileExplorePlusPlus.filterSuffix', data.value);
                    this._onFilterChange.fire(data.value);
                    break;
                case 'abort':
                    // Fire abort event to stop search
                    this._onAbort.fire();
                    break;
                case 'clear':
                    // Clear both search and filter
                    this._currentSearch = '';
                    this._currentFilter = '';
                    this._context.workspaceState.update('fileExplorePlusPlus.searchQuery', '');
                    this._context.workspaceState.update('fileExplorePlusPlus.filterSuffix', '');
                    this._onClear.fire();
                    break;
                case 'ready':
                    // Webview is ready, restore state
                    this._restoreState();
                    break;
            }
        });
    }
    setStatus(status) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'status',
                status: status
            });
        }
    }
    _restoreState() {
        if (this._view && (this._currentSearch || this._currentFilter)) {
            this._view.webview.postMessage({
                type: 'restore',
                search: this._currentSearch,
                filter: this._currentFilter
            });
        }
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search</title>
    <style>
        body {
            padding: 10px;
            padding-bottom: 5px;
            font-family: var(--vscode-font-family);
            overflow-y: auto;
            box-sizing: border-box;
        }
        .search-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            height: 100%;
        }
        .input-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .label-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .filter-row {
            display: flex;
            gap: 4px;
            align-items: flex-end;
        }
        .search-row {
            display: flex;
            gap: 4px;
            align-items: flex-end;
        }
        .filter-input {
            flex: 1;
        }
        .search-input {
            flex: 1;
        }
        label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }
        input {
            width: 100%;
            padding: 4px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 13px;
            box-sizing: border-box;
        }
        input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        button {
            padding: 4px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            font-size: 13px;
            cursor: pointer;
            white-space: nowrap;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button:active {
            background: var(--vscode-button-background);
        }
        .abort-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .abort-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .status-message {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            display: none;
            align-items: center;
            gap: 6px;
        }
        .status-message.visible {
            display: flex;
        }
        .status-message.searching {
            color: var(--vscode-charts-blue);
        }
        .status-message.aborted {
            color: var(--vscode-charts-orange);
        }
        .spinner {
            width: 12px;
            height: 12px;
            border: 2px solid var(--vscode-charts-blue);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="search-container">
        <div class="input-group">
            <div class="label-row">
                <label for="searchBox">Search files:</label>
                <div id="statusMessage" class="status-message"></div>
            </div>
            <div class="search-row">
                <input 
                    type="text" 
                    id="searchBox" 
                    class="search-input"
                    placeholder="Enter search query..."
                    autocomplete="off"
                />
                <button id="abortBtn" class="abort-btn">Abort</button>
                <button id="clearBtn">Clear</button>
            </div>
        </div>
        <div class="input-group">
            <label for="filterBox">Filter by suffix:</label>
            <div class="filter-row">
                <input 
                    type="text" 
                    id="filterBox" 
                    class="filter-input"
                    placeholder=".ts, .js, .md..."
                    autocomplete="off"
                />
                <button id="applyFilterBtn">Apply</button>
            </div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const searchBox = document.getElementById('searchBox');
        const filterBox = document.getElementById('filterBox');
        const applyFilterBtn = document.getElementById('applyFilterBtn');
        const abortBtn = document.getElementById('abortBtn');
        const clearBtn = document.getElementById('clearBtn');
        const statusMessage = document.getElementById('statusMessage');

        // Track the currently applied filter (separate from what's typed in the box)
        let appliedFilter = '';
        let searchInProgress = false;
        let isTyping = false;

        // Notify extension that webview is ready
        window.addEventListener('load', () => {
            vscode.postMessage({ type: 'ready' });
        });

        // Handle state restoration from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'restore') {
                if (message.search) {
                    searchBox.value = message.search;
                }
                if (message.filter) {
                    filterBox.value = message.filter;
                    appliedFilter = message.filter;
                }
            } else if (message.type === 'status') {
                if (message.status === 'indexing') {
                    showStatus('Indexing workspace...');
                } else if (message.status === 'ready') {
                    if (!isTyping) {
                        hideStatus();
                    }
                }
            }
        });

        function showStatus(message) {
            if (statusMessage) {
                statusMessage.innerHTML = '<div class="spinner"></div><span>' + message + '</span>';
                statusMessage.className = 'status-message visible searching';
                searchInProgress = true;
            }
        }

        function showAborted() {
            if (statusMessage) {
                statusMessage.innerHTML = '<span>Aborted.</span>';
                statusMessage.className = 'status-message visible aborted';
                searchInProgress = false;
            }
        }

        function hideStatus() {
            if (statusMessage) {
                statusMessage.className = 'status-message';
                searchInProgress = false;
            }
        }

        let searchTimeout;
        searchBox.addEventListener('input', (e) => {
            const value = e.target.value;
            isTyping = true;
            
            // If search is in progress, abort it first
            if (searchInProgress) {
                vscode.postMessage({
                    type: 'abort'
                });
                searchInProgress = false;
            }
            
            // Clear existing timeout
            clearTimeout(searchTimeout);
            
            // Show "preparing to search" status immediately if there's text
            if (value || appliedFilter) {
                showStatus('Typing...');
            } else {
                hideStatus();
            }
            
            // Wait 500ms (0.5 seconds) before starting search
            searchTimeout = setTimeout(() => {
                isTyping = false;
                if (value || appliedFilter) {
                    showStatus('Searching...');
                }
                
                // When searching, also send the currently applied filter
                vscode.postMessage({
                    type: 'search',
                    value: value,
                    filter: appliedFilter
                });
                
                if (!value && !appliedFilter) {
                    hideStatus();
                }
            }, 500);
        });

        // Apply filter only when button is clicked
        function applyFilter() {
            const value = filterBox.value;
            appliedFilter = value;
            if (value || searchBox.value) {
                showStatus('Filtering...');
            }
            vscode.postMessage({
                type: 'filter',
                value: value
            });
            if (!value && !searchBox.value) {
                hideStatus();
            }
        }

        applyFilterBtn.addEventListener('click', applyFilter);
        
        // Allow pressing Enter in filter box to apply
        filterBox.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyFilter();
            }
        });

        // Abort button - stops current search
        abortBtn.addEventListener('click', () => {
            if (searchInProgress) {
                showAborted();
                vscode.postMessage({
                    type: 'abort'
                });
            }
        });

        // Clear button - clears search and filter
        clearBtn.addEventListener('click', () => {
            // First abort any ongoing search
            if (searchInProgress) {
                showAborted();
                vscode.postMessage({
                    type: 'abort'
                });
            }
            
            // Then clear everything
            searchBox.value = '';
            filterBox.value = '';
            appliedFilter = '';
            hideStatus();
            vscode.postMessage({
                type: 'clear'
            });
        });
    </script>
</body>
</html>`;
    }
}
exports.SearchViewProvider = SearchViewProvider;
SearchViewProvider.viewType = 'fileExplorePlusPlus.searchView';
//# sourceMappingURL=searchViewProvider.js.map