import fs from 'fs';
import * as fsP from 'fs/promises';
import * as pathUtil from 'path';
import { setInterval } from 'timers/promises';
import events from 'events';
import readline from 'readline';

let defaultExts = [
    '.cs', '.c', '.cpp', '.cc', '.h', '.hpp', '.ixx', '.inc', '.asm', '.txt', '.log', '.js', '.jsx', '.ts', '.tsx',
    '.csproj', '.sln', 'CMakeLists.txt', 'Makefile', '.sh', '.bash', '.py', '.html', '.css', '.scss', '.less',
    '.vue', '.json', '.yaml', '.yml', '.xml', '.xaml', '.axaml', '.md', '.htm', '.asp', '.php', '.gitignore',
    '.java', '.kt', '.kts', '.gradle', '.bat', '.cmd', '.ps1', '.swift', '.m', '.lua', '.mk', '.csv', '.vbs', '.vba', '.vb',
    '.sql', '.rs', '.shader', '.rb', '.cshtml', '.razor', '.pug', '.jade', '.properties', '.cfg', '.conf', '.pl', '.php4', '.php5',
    '.mm', '.markdown', '.dart', '.go', '.groovy', '.vsh', '.jsp', '.aspx', '.ini'
];
let commentStarts = ['//', '#', '--', 'rem '];
export let SUCCESS = 0;
export let NOT_FOUND = 1;

async function scanFile(resultObj, filePath, { needExts, needFiles, ext }) {
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });
    let totalLines = 0;
    let emptyLines = 0;
    let commentLines = 0;
    rl.on('line', (line) => {
        totalLines++;
        let trimedLine = line.trim();
        if (trimedLine.length == 0) {
            emptyLines++; return;
        }
        if (commentStarts.some(x => trimedLine.startsWith(x))) {
            commentLines++;
        }
    });
    await events.once(rl, 'close');
    if (needFiles) {
        resultObj.files[filePath] = { empty: emptyLines, total: totalLines, comment: commentLines };
    }
    if (needExts) {
        resultObj.exts[ext].lines.empty += emptyLines;
        resultObj.exts[ext].lines.comment += commentLines;
        resultObj.exts[ext].lines.total += totalLines;
    }
    resultObj.empty += emptyLines;
    resultObj.comment += commentLines;
    resultObj.total += totalLines;
    resultObj.fileCount++;
}
async function scanDir(resultObj, path, { needExts, needFiles, exts }) {
    let files = await fsP.readdir(path);
    let dirs = [];
    let scanTasks = [];
    let codeFiles = [];
    for (const file of files) {
        let childPath = pathUtil.join(path, file);
        let stat = await fsP.stat(childPath);
        if (stat.isDirectory()) {
            dirs.push(childPath);
            continue;
        }
        if (stat.isFile()) {
            let matchExt = '.???';
            if ((exts || defaultExts).some(ext => childPath.endsWith(ext) ? function () {
                matchExt = ext;
                return true;
            }() : false)) {
                codeFiles.push({ codePath: childPath, ext: matchExt });
            } else continue;
            if (needExts) {
                resultObj.exts[matchExt] = resultObj.exts[matchExt]
                    || ({ files: 0, lines: { empty: 0, comment: 0, total: 0 } });
                resultObj.exts[matchExt].files++;
            }
            if (needFiles) {
                resultObj.files[childPath] = { empty: 0, comment: 0, total: 0 };
            }
        }
    }
    for (const { codePath, ext } of codeFiles) {
        scanTasks.push(scanFile(resultObj, codePath, { needExts, needFiles, ext }));
    }
    await Promise.all(scanTasks);
    return dirs;
}

export async function totalOf(path, { needExts, needFiles, inputExts, resultUpdater }) {
    // prepare for scanning
    let exts = inputExts == null ? defaultExts : inputExts;
    let resultObj = {
        path,
        empty: 0, comment: 0, total: 0,
        exts: {},
        files: {},
        fileCount: 0,
        returnCode: SUCCESS
    }

    // check is the dir exists
    try { await fsP.stat(path) } catch {
        resultObj.returnCode = NOT_FOUND;
        return resultObj;
    }

    // scan
    let totalDir = 0
    let scanedDir = 0;
    let existsDir = new Set();
    let startScanDir = async function (curPath) {
        totalDir++;
        existsDir.add(curPath);
        let subdirs = await scanDir(resultObj, curPath, { needExts, needFiles, exts });
        totalDir += subdirs.length;
        scanedDir++;
        for (const subdir of subdirs) {
            startScanDir(subdir);
        }
    }
    startScanDir(path);

    // wait
    await (new Promise(async (resolve) => {
        for await (const _ of setInterval(200, Date.now())) {
            if (scanedDir == existsDir.size) {
                break;
            }
            resultUpdater && resultUpdater({ totalDir, scanedDir });
        }
        resolve();
    }));
    return resultObj;
}

