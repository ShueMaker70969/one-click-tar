import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'tarMaker.createTar',
    async (uri: vscode.Uri) => {
      if (!uri) {
        vscode.window.showErrorMessage('directory not selected');
        return;
      }

      const folderPath = uri.fsPath;

      if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        vscode.window.showErrorMessage('target is not a directory');
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

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Creating ${folderName}.tar`,
          cancellable: false
        },
        async () => {
          return new Promise<void>((resolve) => {
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

            tarProcess.stderr.on('data', (data) => {
              stderr += data.toString();
            });

            tarProcess.on('error', (error) => {
              vscode.window.showErrorMessage(
                `tar command execution failed: ${error.message}`
              );
              resolve();
            });

            tarProcess.on('close', async (code) => {
              if (code === 0) {
                const open = await vscode.window.showInformationMessage(
                  `Created: ${outputTarPath}`,
                  'Open parent directory'
                );

                if (open === 'Open parent directory') {
                  vscode.commands.executeCommand(
                    'revealFileInOS',
                    vscode.Uri.file(outputTarPath)
                  );
                }
              } else {
                vscode.window.showErrorMessage(
                  `Failed to create tar.${stderr || `Exit code: ${code}`}`
                );
              }

              resolve();
            });
          });
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}