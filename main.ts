import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface SoftBreaksSettings {
    col: string;
}

const DEFAULT_SETTINGS: SoftBreaksSettings = {
    col: '80'
}

export default class SoftBreaks extends Plugin {
    settings: SoftBreaksSettings;

    isSpace(ch: string): boolean {
        return ch === ' ' || ch === '\t';
    }

    isNotSpace(ch: string): boolean {
        return !(ch === ' ' || ch === '\t');
    }

    nextCh(pred: (t: string) => boolean, text: string, idx: number): number {
        if (idx < 0) {
            return text.length;
        }
        for (let i = idx; i < text.length; i++) {
            if (pred(text[i])) return i;
        }
        return text.length;
    }

    prevCh(pred: (t: string) => boolean, text: string, idx: number): number {
        if (idx >= text.length) {
            return -1;
        }
        for (let i = idx; i >= 0; i--) {
            if (pred(text[i])) return i;
        }
        return -1;
    }

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'insert-soft-breaks',
            name: 'Insert soft breaks',
            hotkeys: [{
                modifiers: ['Mod', 'Shift'],
                key: ';'
            }],
            editorCallback: (editor: Editor, view: MarkdownView) => {
                let COL = parseInt(this.settings.col);
                if (isNaN(COL) || COL < 2) {
                    COL = parseInt(DEFAULT_SETTINGS.col);
                }
                let inCodeBlock = false;
                for (let l = 0; l < editor.lineCount(); l++) {
                    const rawLine = editor.getLine(l);
                    let line = rawLine;

                    // check for ``` to change inCodeBlock
                    if (/^\s*```/.test(line)) {
                        inCodeBlock = !inCodeBlock;
                    }
                    if (inCodeBlock) {
                        continue;
                    }

                    if (line.length <= COL) {
                        continue;
                    }

                    let offset = "";
                    do {
                        // unordered lists
                        const ulistMatches = line.match(/^(\t*|[ ]*)-[ ]+/);
                        if (ulistMatches) {
                            offset = ulistMatches[0].replace(/[^\t ]/g, ' ');
                            break;
                        }

                        // ordered lists
                        const olistMatches = line.match(/^(\t*|[ ]*)\d+\.[ ]+/);
                        if (olistMatches) {
                            offset = olistMatches[0].replace(/[^\t ]/g, ' ');
                            break;
                        }

                        // quotes
                        const quoteMatches = line.match(/^(\t*|[ ]*)>[ ]+/)
                        if (quoteMatches) {
                            offset = quoteMatches[0].replace(/[^\t ]/g, ' ');
                            break;
                        }

                        // indentation
                        const indentMatches = line.match(/^\t*[ ]+/);
                        if (indentMatches) {
                            offset = indentMatches[0];
                            break;
                        }
                    } while (0);
                    line = offset + line.slice(offset.length);

                    let overflowWordBeg;
                    if (line[COL] === ' ') { // if COL is a space
                        overflowWordBeg = this.nextCh(this.isNotSpace, line, COL + 1);
                    } else { // if COL is not a space
                        overflowWordBeg = 1 + this.prevCh(this.isSpace, line, COL - 1);

                        if (overflowWordBeg === 0) { // if COL is inside a really long word that takes the whole line
                            let nextSpace = this.nextCh(this.isSpace, line, COL + 1);
                            if (nextSpace === line.length) {
                                continue; // the whole line is a single word
                            }
                            overflowWordBeg = this.nextCh(this.isNotSpace, line, nextSpace + 1);
                        }
                    }

                    let lastWordEnd = this.prevCh(this.isNotSpace, line, overflowWordBeg - 1);
                    if (lastWordEnd === -1) {
                        continue;
                    }

                    line = rawLine.slice(0, lastWordEnd + 1) + '\n' + offset + line.slice(overflowWordBeg);
                    editor.setLine(l, line);
                }
            }
        });

        this.addSettingTab(new SoftBreaksSettingTab(this.app, this));
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SoftBreaksSettingTab extends PluginSettingTab {
    plugin: SoftBreaks;

    constructor(app: App, plugin: SoftBreaks) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Column')
            .addText(text => text
                .setPlaceholder('80')
                .setValue(this.plugin.settings.col)
                .onChange(async (value) => {
                    this.plugin.settings.col = value;
                    await this.plugin.saveSettings();
                }));
    }
}
