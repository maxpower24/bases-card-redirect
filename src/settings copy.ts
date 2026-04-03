import {
    App,
    PluginSettingTab,
    Setting,
} from "obsidian";
import BasesCardRedirect from "./main";

export interface RedirectRule {
    matchProperty: string;     // e.g. "Kind"
    matchValue: string;        // e.g. "Stay"
    targetProperty: string;    // e.g. "Country"
};

export interface BasesCardRedirectSettings {
    redirectCssClass: string;    // only run in notes with this cssclass if populated
    redirectFolders: string[];   // only run in notes within these folders if populated
    sourceProperty: string;    // link to the source file (i.e. the note being redirected from)
    rules: RedirectRule[];     // ordered; first match wins
};

export const DEFAULT_SETTINGS: BasesCardRedirectSettings = {
    redirectCssClass: "card-redirect",
    redirectFolders: [],
    sourceProperty: "fileLink",
    rules: [
        {matchProperty: "Kind", matchValue: "Stay", targetProperty: "Country"}
    ]
};

// ------------------------
// Settings UI (with reorder)
// ------------------------
export class BasesCardRedirectSettingTab extends PluginSettingTab {
    plugin: BasesCardRedirect;

    constructor(app: App, plugin: BasesCardRedirect) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Bases Card Redirect" });

        new Setting(containerEl)
            .setName("Redirect cssclass")
            .setDesc("Only redirect clicks inside notes that have this cssclass in frontmatter (cssclasses). If left blank then redirect will apply to all notes assuming other criteria are met")
            .addText((t) =>
                t
                    .setPlaceholder("card-redirect")
                    .setValue(this.plugin.settings.redirectCssClass)
                    .onChange(async (v) => {
                        this.plugin.settings.redirectCssClass = v.trim();
                        await this.plugin.saveSettings();
                })
            );

        containerEl.createEl("h3", { text: "Redirect folders" })
        containerEl.createEl("small", { text: "Only redirect clinks inside notes that are within these folders or their subfolders. If left blank then redirect will apply to all notes assuming other criteria are met." })

        this.plugin.settings.redirectFolders.forEach((folder, idx) => {
            const setting = new Setting(containerEl).setName(`Folder ${idx + 1}`);

            setting.addText((t) => 
                t
                    .setPlaceholder("Redirect folder")
                    .setValue(folder)
                    .onChange(async (v) => {
                        const trimmed = v.trim();
                        const valid = trimmed === "" || !!this.plugin.app.vault.getFolderByPath(trimmed);

                        t.inputEl.style.borderColor = valid ? "" : "red";

                        if (valid) {
                            this.plugin.settings.redirectFolders[idx] = trimmed;
                            await this.plugin.saveSettings();
                        }
                    })
            );

            setting.addExtraButton((b) =>
                b
                    .setIcon("trash")
                    .setTooltip("Remove folder")
                    .onClick(async () => {
                        this.plugin.settings.redirectFolders.splice(idx, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );
        })

        new Setting(containerEl).addButton((b) =>
            b.setButtonText("Add folder").onClick(async () => {
                this.plugin.settings.redirectFolders.push("");
                await this.plugin.saveSettings();
                this.display();
            })
        );

        new Setting(containerEl)
            .setName("Source Property")
            .setDesc("The property name in the base card that contains the source file link.")
            .addText((t) =>
                t
                    .setPlaceholder("source")
                    .setValue(this.plugin.settings.sourceProperty)
                    .onChange(async (v) => {
                        this.plugin.settings.sourceProperty = v.trim();
                        await this.plugin.saveSettings();
                    })
            );

        containerEl.createEl("h3", { text: "Mapping rules (first match wins). Each rule: Match Property | Match Value | Target Property" });

        this.plugin.settings.rules.forEach((rule, idx) => {
            const setting = new Setting(containerEl).setName(`Rule ${idx + 1}`);

            setting.addText((t) =>
                t
                    .setPlaceholder("Match property")
                    .setValue(rule.matchProperty)
                    .onChange(async (v) => {
                        rule.matchProperty = v.trim();
                        await this.plugin.saveSettings();
                    })
            );

            setting.addText((t) =>
                t
                    .setPlaceholder("Match value")
                    .setValue(rule.matchValue)
                    .onChange(async (v) => {
                        rule.matchValue = v;
                        await this.plugin.saveSettings();
                    })
            );

            setting.addText((t) =>
                t
                    .setPlaceholder("Target property")
                    .setValue(rule.targetProperty)
                    .onChange(async (v) => {
                        rule.targetProperty = v.trim();
                        await this.plugin.saveSettings();
                    })
            );

            // Reorder controls
            setting.addExtraButton((b) =>
                b
                    .setIcon("arrow-up")
                    .setTooltip("Move up")
                    .setDisabled(idx === 0)
                    .onClick(async () => {
                        if (idx <= 0) return;
                        const rules = this.plugin.settings.rules;
                        [rules[idx - 1], rules[idx]] = [rules[idx], rules[idx - 1]];
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

            setting.addExtraButton((b) =>
                b
                    .setIcon("arrow-down")
                    .setTooltip("Move down")
                    .setDisabled(idx === this.plugin.settings.rules.length - 1)
                    .onClick(async () => {
                        const rules = this.plugin.settings.rules;
                        if (idx >= rules.length - 1) return;
                        [rules[idx], rules[idx + 1]] = [rules[idx + 1], rules[idx]];
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

            setting.addExtraButton((b) =>
                b
                    .setIcon("trash")
                    .setTooltip("Remove rule")
                    .onClick(async () => {
                        this.plugin.settings.rules.splice(idx, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );
        });

        new Setting(containerEl).addButton((b) =>
            b.setButtonText("Add rule").onClick(async () => {
                this.plugin.settings.rules.push({
                    matchProperty: "",
                    matchValue: "",
                    targetProperty: ""
                });
                await this.plugin.saveSettings();
                this.display();
            })
        );
    }
}