import {
    Plugin,
    TFile,
    TFolder,
    WorkspaceLeaf
} from "obsidian";
import {
    DEFAULT_SETTINGS,
    BasesCardRedirectSettings,
    BasesCardRedirectSettingTab
} from "./settings";

type NewLeafMode = false | "tab" | "split";

// ------------------------
// Plugin class
// ------------------------
export default class BasesCardRedirect extends Plugin {
    settings!: BasesCardRedirectSettings;

    async onload() {
        // Load settings and settings tab
        await this.loadSettings();
        this.addSettingTab(new BasesCardRedirectSettingTab(this.app, this));

        // Capture so we can stop Bases before it opens the card file.
        document.addEventListener("click", this.onClickCapture, true);
        document.addEventListener("auxclick", this.onClickCapture, true);
    }

    onunload() {
        // Clean up
        document.removeEventListener("click", this.onClickCapture, true);
        document.removeEventListener("auxclick", this.onClickCapture, true);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    // ------------------------
    // Click handler (capture)
    // ------------------------
    private onClickCapture = async (evt: MouseEvent) => {
        try {
            // Only left and middle click
            if (evt.button !== 0 && evt.button !== 1) return;

            const targetEl = evt.target as HTMLElement | null;
            if (!targetEl) return;

            // Do NOT hijack clicks on links/buttons/inputs inside the card.
            if (this.isInteractive(targetEl)) return;

            //Only override within card items
            const cardEl = this.findCardEl(targetEl);
            if (!cardEl) return;

            // Only override in notes with the redirect CSS class (if defined)
            if (!this.isWithinRedirectClass(cardEl)) return;

            // Only override in notes within defined folders (if any)
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) return;

            const activeFolder = activeFile.parent;
            if (!activeFolder) return;

            if (!this.isWithinRedirectFolder(activeFolder)) return;

            // Identify the note the card represents
            const cardFile = this.findCardFile(cardEl);
            if (!cardFile) return;
      
            // Compute redirect target from frontmatter mapping rules
            const targetFile = this.resolveTargetFile(cardFile);
            if (!targetFile) return;

            // Stop default card click opening the row note
            evt.preventDefault();
            evt.stopImmediatePropagation();

            const mode = this.getLeafMode(evt);
            await this.openFile(targetFile, mode);
        }
        catch {
            // Fail silently; worst case Bases opens the row note normally.
        }
    }

    // ------------------------
    // Element class filters
    // ------------------------
    private isInteractive(el: HTMLElement): boolean {
        return !!el.closest(".internal-link");
    }

    private findCardEl(from: HTMLElement): HTMLElement | null {
        const found = from.closest(".bases-cards-item");
        if (found) return found as HTMLElement;

        return null;
    }

    private isWithinRedirectClass(el: HTMLElement): boolean {
        if (!this.settings.redirectCssClass) return true;
        return !!el.closest("." + this.settings.redirectCssClass);
    }

    // ------------------------
    // Redirect folder filter
    // ------------------------
    private isWithinRedirectFolder(folder: TFolder): boolean {
        if (!this.settings.redirectFolders.length) return true;
    
        return this.settings.redirectFolders.some((f) =>
            folder.path === f || folder.path.startsWith(f + "/")
        );
    }

    // ------------------------
    // Card note detection
    // ------------------------
    private findCardFile(cardEl: HTMLElement): TFile | null {
        const source = (this.settings.sourceProperty ?? "").trim();
        if (!source) return null;

        const keys = source.includes(".") ? [source] : [`formula.${source}`, source];

        for (const key of keys) {
            const propEl = cardEl.querySelector<HTMLElement>(
                `.bases-cards-property[data-property="${CSS.escape(key)}"]`
            );
            if (!propEl) continue;
            
            const href = propEl
                .querySelector<HTMLElement>(".bases-cards-line .internal-link[data-href]")
                ?.getAttribute("data-href")
                ?.trim();
            
            if (!href) return null;
            
            const file = this.app.vault.getAbstractFileByPath(href);
            return file instanceof TFile ? file : null;
        }

        return null;
    }

    // ------------------------
    // Rule + target resolution
    // ------------------------
    private resolveTargetFile(sourceFile: TFile): TFile | null {
        const fm = this.app.metadataCache.getFileCache(sourceFile)?.frontmatter;
        if (!fm) return null;

        // Ordered rules: first match wins
        for (const rule of this.settings.rules) {
            const v = fm[rule.matchProperty];
            if (!this.fmEquals(v, rule.matchValue)) continue;

            const targetVal = fm[rule.targetProperty];
            const targetFile = this.resolveLinkToFile(targetVal);
            if (targetFile) return targetFile;

            // Match found, but target missing/unresolvable -> stop here to avoid surprising fallthrough
            return null;
        }
        
        return null;
    }

    private fmEquals(value: any, expected: string): boolean {
        if (value == null) return false;
        if (Array.isArray(value)) return value.some((x) => this.fmEquals(x, expected));
        return String(value) === expected;
    }

    private resolveLinkToFile(link: any): TFile | null {
        if (typeof link !== "string") return null;

        // Expect: "[[Target]]" or "[[Target|Alias]]"
        const m = link.trim().match(/^\[\[([\s\S]+?)\]\]$/);
        if (!m) return null;

        const target = m[1].split("|")[0].trim(); // left of | (or whole thing)
        if (!target) return null;

        const filename = target.toLowerCase().endsWith(".md") ? target : `${target}.md`;

        const file = this.app.metadataCache.getFirstLinkpathDest(filename, "");
        return file instanceof TFile ? file : null;
    }

    // ------------------------
    // Open behaviour (preserve semantics, apply to redirected target)
    // ------------------------
    private getLeafMode(evt: MouseEvent): NewLeafMode {
        const isMiddle = evt.button === 1;
        const isCmdCtrl = evt.ctrlKey || evt.metaKey;
        const isAlt = evt.altKey;

        // ctrl/cmd + alt => split
        if (isCmdCtrl && isAlt) return "split";

        // ctrl/cmd or middle => new tab
        if (isCmdCtrl || isMiddle) return "tab";

        return false;
    }

    private async openFile(file: TFile, mode: NewLeafMode): Promise<void> {
        const leaf: WorkspaceLeaf = this.app.workspace.getLeaf(mode || false);
        await leaf.openFile(file, { active: true });
    }
}