import { App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface SoftBreaksSettings {
    col: string;
}

const DEFAULT_SETTINGS: SoftBreaksSettings = {
    col: '80'
}

export default class SoftBreaks extends Plugin {
    settings: SoftBreaksSettings;

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
                	let line = editor.getLine(l);

                    // check for ``` to change inCodeBlock
                    if (/\s*```.*/.test(line)) {
                        inCodeBlock = !inCodeBlock;
                    }
                    if (inCodeBlock) continue;

                	if (line.length > COL) {
                        if ((line[0] === '-' && line[1] === ' ')
                            || line[0] === '\t' || line[0] === ' '
                            || (line[0] >= '0' && line[0] <= '9' && line[1] === '.')
                            || (line[0] === '>' && line[1] === ' ')
                        ) {
                            continue; // don't change these lines
                        }

                        let overflowWordBeg = -1;
                        if (line[COL] === ' ') { // if COL is a space
                            for (let i = COL + 1; i < line.length; i++) {
                                if (line[i] !== ' ') {
                                    overflowWordBeg = i; // COL is a space, so find the next word
                                    break;
                                }
                            }
                            if (overflowWordBeg === -1) overflowWordBeg = line.length; // line ends in whitespace
                        } else { // if COL is not a space
                            for (let i = COL - 1; i >= 0; i--) {
                                if (line[i] === ' ') {
                                    overflowWordBeg = i + 1; // find the beginning of the word crossing COL
                                    break;
                                }
                            }
                            if (overflowWordBeg == -1) { // if COL is inside a really long word that takes the whole line
                                let nextSpace = -1;
                                for (let i = COL + 1; i < line.length; i++) {
                                    if (line[i] === ' ') {
                                        nextSpace = i; // if cols 0..COL are non-spaces, then go to the next space after COL
                                        break;
                                    }
                                }
                                if (nextSpace === -1) continue; // the whole line is a single word
                                for (let i = nextSpace + 1; i < line.length; i++) {
                                    if (line[i] !== ' ') {
                                        overflowWordBeg = i; // find the next word after COL
                                        break;
                                    }
                                }
                            }
                            if (overflowWordBeg < 0) continue;
                        }

                        let lastWordEnd = -1;
                        for (let i = overflowWordBeg - 1; i >= 0; i--) {
                            if (line[i] !== ' ') {
                                lastWordEnd = i;
                                break;
                            }
                        }
                        if (lastWordEnd === -1) continue;

                		line = line.slice(0, lastWordEnd + 1) + '\n' + line.slice(overflowWordBeg);
                		editor.setLine(l, line);
                	}
                }
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
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
