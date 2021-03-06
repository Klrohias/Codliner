import process from 'process';
import chalk from 'chalk';
import * as codliner from './index.js';
import * as progress from 'cli-progress';
(async function (args) {
    function printHelp() {
        console.log(
            `
Codliner - A tools to help count lines of your code.

Usage: codliner (...paths to your project) [...options]
Options:
    -v\t\t\tPrint the number of lines for each language in your project
    -vv\t\t\tPrint the number of lines in each code file in your project
    -e (.ext,.ext...)\t\tUse custom extension names
`
        );
    }

    // parse args
    if (args.length == 0) {
        printHelp();
        return;
    }

    let verboseLevel = 0;
    let projectPaths = [];
    let customExts = null;
    let currentArg = '';
    for (const arg of args) {
        switch (arg) {
            case '-v': { verboseLevel = 1; break; }
            case '-vv': { verboseLevel = 2; break; }
            case '-e': { currentArg = '-e'; break; }
            default: {
                switch (currentArg) {
                    case '-e': {
                        customExts = arg; currentArg = '';
                        break;
                    }
                    default: {
                        projectPaths.push(arg);
                        break;
                    }
                }
                break;
            }
        }
    }

    // start work
    let tasks = [];
    for (const path of projectPaths) {
        const progressBar = new progress.SingleBar({
            format: 'Scanning for ' + chalk.underline.blueBright(path) + ' || ' + chalk.grey('{bar}') + ' || {percentage}% ({value} / {total})',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
        }, progress.Presets.shades_classic);

        progressBar.start(100, 0);
        tasks.push(codliner.totalOf(path, {
            ...(function () {
                switch (verboseLevel) {
                    case 1: return { needExts: true };
                    case 2: return { needFiles: true };
                    default: return {};
                }
            })(),
            ...(function () {
                if (customExts != null)
                    return { inputExts: customExts.split(',') };
                else return {};
            })(),
            resultUpdater: function ({ totalDir, scanedDir }) {
                progressBar.setTotal(totalDir);
                progressBar.update(scanedDir);
            }
        }).then(result => {
            progressBar.update(0xffffffff);
            progressBar.stop();
            let report = '';
            report += ' --- Report for path: ' + result.path + '\n\n';

            if (Object.keys(result.files) != 0) {
                report += ' * Files: \n';
                for (const file in result.files) {
                    if (Object.hasOwnProperty.call(result.files, file)) {
                        const element = result.files[file];
                        report += 'FILE: ' + chalk.underline.blueBright(file)
                            + `, LINES: ${chalk.red.bold.underline(element.total)}`
                            + `, EMPTY: ${chalk.red.bold.underline(element.empty)}`
                            + `, COMMENT: ${chalk.red.bold.underline(element.comment)}\n`;
                    }
                }
                report += '\n';
            }

            if (Object.keys(result.exts) != 0) {
                report += ' * Exts: \n';
                for (const ext in result.exts) {
                    if (Object.hasOwnProperty.call(result.exts, ext)) {
                        const element = result.exts[ext];
                        report += 'EXT: ' + chalk.underline.blueBright(ext)
                            + `, LINES: ${chalk.red.bold.underline(element.lines.total)}`
                            + `, EMPTY: ${chalk.red.bold.underline(element.lines.empty)}`
                            + `, COMMENT: ${chalk.red.bold.underline(element.lines.comment)}`
                            + `, FILES: ${chalk.red.bold.underline(element.files)}\n`;
                    }
                }
                report += '\n';
            }
            report += ' * Total: '
            report +=
                `LINES: ${chalk.red.bold.underline(result.total)}`
                + `, EMPTY: ${chalk.red.bold.underline(result.empty)}`
                + `, COMMENT: ${chalk.red.bold.underline(result.comment)}`
                + `, FILES: ${chalk.red.bold.underline(result.fileCount)}\n`;
            report += '\n';
            console.log(report);
        }));
    }
    await Promise.all(tasks);
})(process.argv.slice(2)); // get the real args


