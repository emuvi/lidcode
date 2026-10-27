import * as vscode from "vscode";

function getFolder(path: string) {
  if (!path) {
    return path;
  }
  let pos = path.lastIndexOf("/");
  if (pos > -1) {
    return path.substring(0, pos + 1);
  }
  return path;
}

function joinPaths(parent: string, child: string) {
  let result = parent;
  if (!result) {
    result = "/";
  }
  if (!result.endsWith("/")) {
    result += "/";
  }
  if (child.startsWith("/")) {
    child = child.substring(1);
  }
  result += child;
  return result;
}

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand("lidcode.newLidCode", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(
        "You must have an active editor to generate a LidCode"
      );
      return;
    }

    let projectIdentifier = vscode.workspace.name;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (workspaceFolder) {
      projectIdentifier = workspaceFolder.name;
    }

    const lidCodePrefix =
      (projectIdentifier ? "{" + projectIdentifier + "}" : "") + "(LidCode-";

    const fileName = editor.document.fileName;
    const dotPosition = fileName.lastIndexOf(".");
    if (dotPosition === -1) {
      vscode.window.showErrorMessage(
        "You must have an active editor with an extension to generate a LidCode"
      );
      return;
    }
    const extension = fileName.substring(dotPosition);

    const [gitIgnoreFiles, allFoundFiles] = await Promise.all([
      vscode.workspace.findFiles(".gitignore"),
      vscode.workspace.findFiles("**/*" + extension),
    ]);

    const foldersToBeIgnored: string[] = [];
    await Promise.all(
      gitIgnoreFiles.map(async (ignoreFile) => {
        const doc = await vscode.workspace.openTextDocument(ignoreFile);
        const folder = getFolder(ignoreFile.path);
        for (let line of doc.getText().split(/\r?\n/)) {
          if (line.startsWith("/") || line.endsWith("/")) {
            if (!line.endsWith("/")) {
              line += "/";
            }
            foldersToBeIgnored.push(joinPaths(folder, line));
          }
        }
      })
    );

    const filteredFiles = allFoundFiles.filter((file) => {
      const elementFolder = getFolder(file.path);
      return !foldersToBeIgnored.some((ignored) => elementFolder.startsWith(ignored));
    });

    let maxLidCodeFound = 0;
    await Promise.all(
      filteredFiles.map(async (foundFile) => {
        const doc = await vscode.workspace.openTextDocument(foundFile);
        const text = doc.getText();
        let starting = 0;
        while (true) {
          const found = text.indexOf(lidCodePrefix, starting);
          if (found === -1) {
            break;
          }
          const end = text.indexOf(")", found + lidCodePrefix.length);
          if (end === -1) {
            break;
          }
          const lidCodeText = text.substring(found + lidCodePrefix.length, end);
          const lidCodeVal = parseInt(lidCodeText, 10);
          if (!isNaN(lidCodeVal) && lidCodeVal > maxLidCodeFound) {
            maxLidCodeFound = lidCodeVal;
          }
          starting = end + 1;
        }
      })
    );

    const nextCode = (maxLidCodeFound + 1).toString().padStart(6, "0");
    const newLidCode = lidCodePrefix + nextCode + ")";
    const position = editor.selection.end;
    await editor.edit((editBuilder) => {
      editBuilder.insert(position, newLidCode);
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
