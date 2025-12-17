import * as vscode from 'vscode';

export class SearchViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'fileExplorePlusPlus.searchView';
    private _view?: vscode.WebviewView;
    private _onSearchChange: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
    private _onFilterChange: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
    private _onAbort: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    private _onClear: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    public readonly onSearchChange: vscode.Event<string> = this._onSearchChange.event;
    public readonly onFilterChange: vscode.Event<string> = this._onFilterChange.event;
    public readonly onAbort: vscode.Event<void> = this._onAbort.event;
    public readonly onClear: vscode.Event<void> = this._onClear.event;

    private _currentSearch: string = '';
    private _currentFilter: string = '';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {
        // Restore saved state
        this._currentSearch = this._context.workspaceState.get('fileExplorePlusPlus.searchQuery', '');
        this._currentFilter = this._context.workspaceState.get('fileExplorePlusPlus.filterSuffix', '');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
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

    private _restoreState() {
        if (this._view && (this._currentSearch || this._currentFilter)) {
            this._view.webview.postMessage({
                type: 'restore',
                search: this._currentSearch,
                filter: this._currentFilter
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
        }
        .search-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .input-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
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
            margin-top: 8px;
            padding: 6px 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-editorWidget-background);
            border-radius: 3px;
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
            <label for="searchBox">Search files:</label>
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
        <div id="statusMessage" class="status-message"></div>
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
