import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

type TarResult = {
  success: boolean;
  outputTarPath: string;
  errorMessage?: string;
};

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'tarMaker.createTar',
    async (uri: vscode.Uri) => {
      if (!uri) {
        vscode.window.showErrorMessage('Directory not selected.');
        return;
      }

      const folderPath = uri.fsPath;

      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        vscode.window.showErrorMessage('Target is not a directory.');
        return;
      }

      const folderName = path.basename(folderPath);
      const parentDir = path.dirname(folderPath);
      const outputTarPath = path.join(parentDir, `${folderName}.tar`);

      if (fs.existsSync(outputTarPath)) {
        const answer = await vscode.window.showWarningMessage(
          `${folderName}.tar already exists. Overwrite?`,
          'Overwrite',
          'Cancel'
        );

        if (answer !== 'Overwrite') {
          return;
        }
      }

      const result = await vscode.window.withProgress<TarResult>(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Creating ${folderName}.tar`,
          cancellable: false
        },
        async () => {
          return new Promise<TarResult>((resolve) => {
            const args = [
              '-cf',
              outputTarPath,
              '-C',
              parentDir,
              folderName
            ];

            const tarProcess = spawn('tar', args, {
              cwd: parentDir,
              shell: false
            });

            let stderr = '';
            let resolved = false;

            const finish = (result: TarResult) => {
              if (!resolved) {
                resolved = true;
                resolve(result);
              }
            };

            tarProcess.stderr.on('data', (data) => {
              stderr += data.toString();
            });

            tarProcess.on('error', (error) => {
              finish({
                success: false,
                outputTarPath,
                errorMessage: `tar command execution failed: ${error.message}`
              });
            });

            tarProcess.on('close', (code) => {
              if (code === 0) {
                finish({
                  success: true,
                  outputTarPath
                });
              } else {
                finish({
                  success: false,
                  outputTarPath,
                  errorMessage: stderr || `Exit code: ${code}`
                });
              }
            });
          });
        }
      );

      if (result.success) {
        const open = await vscode.window.showInformationMessage(
          `Created: ${result.outputTarPath}`,
          'Open parent directory'
        );

        if (open === 'Open parent directory') {
          await vscode.commands.executeCommand(
            'revealFileInOS',
            vscode.Uri.file(result.outputTarPath)
          );
        }
      } else {
        vscode.window.showErrorMessage(
          `Failed to create tar. ${result.errorMessage ?? ''}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}