import * as vscode from 'vscode';

export interface FileItem {
    name: string;
    uri: vscode.Uri;
    type: vscode.FileType;
}

export type FileSortOrder = 'default' | 'mixed' | 'filesFirst' | 'type' | 'modified';
