import * as Redom from "redom";
export default class AtmosSelect {
    static selects = new Map();
    static openedSelect;
    selectElement;
    buttonMock;
    menuMock;
    selectedMenuItemMock;
    searchInputMock;
    optionsChangeMutationObserver;
    selectElementAttributesChangeMutationObserver;
    listeners = {};
    visibleOptions = 0;
    menuItemMocks = new Array();
    constructor(selectElement) {
        if (AtmosSelect.selects.has(selectElement))
            return;
        this.selectElement = selectElement;
        selectElement.style.display = "none";
        this.generateMocks();
        this.selectElement["selectButton"] = this.buttonMock;
        this.buttonMock["selectElement"] = this.selectElement;
        this.listeners.selectElementFocusListener = () => {
            if (!selectElement.disabled)
                this.buttonMock.focus();
        };
        selectElement.addEventListener("focus", this.listeners.selectElementFocusListener);
        this.buttonMock.addEventListener("click", () => {
            if (this.hidden) {
                let result = this.selectElement.dispatchEvent(new CustomEvent("beforeshow.atmos-select", { cancelable: true }));
                if (!result)
                    return;
            }
            else if (!this.visibleOptions && !this.isLiveSearchEnabled) {
                this.hide();
            }
            this.toggle();
            if (!this.hidden && this.isLiveSearchEnabled)
                requestAnimationFrame(() => this.searchInputMock.focus());
        });
        let debounced;
        let tempValue = "";
        this.buttonMock.addEventListener("keydown", (e) => {
            if (!this.selectElement.options?.length)
                return;
            if (e.code === "ArrowDown") {
                e.preventDefault();
                if (!this.visibleOptions)
                    return;
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[++i];
                    if (!nextOption) {
                        i = 0;
                        nextOption = this.menuItemMocks[0];
                    }
                } while (!nextOption ||
                    (previousOption && nextOption.selectOption.textContent === previousOption.selectOption.textContent) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.selectElement.selectedIndex = -1;
                nextOption.selectOption.selected = true;
                selectElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "ArrowUp") {
                e.preventDefault();
                if (!this.visibleOptions)
                    return;
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[--i];
                    if (!nextOption) {
                        i = this.menuItemMocks.length - 1;
                        nextOption = this.menuItemMocks[this.menuItemMocks.length - 1];
                    }
                } while (!nextOption ||
                    (previousOption && nextOption.selectOption.textContent === previousOption.selectOption.textContent) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.selectElement.selectedIndex = -1;
                nextOption.selectOption.selected = true;
                selectElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "Escape") {
                e.preventDefault();
                this.hide();
            }
            else if (e.code === "Enter") {
                e.preventDefault();
                this.toggle();
                if (!this.hidden && this.isLiveSearchEnabled)
                    requestAnimationFrame(() => this.searchInputMock.focus());
            }
            else if (e.code === "Tab") {
                this.hide();
            }
            else {
                if (!this.isHiddenLiveSearchEnabled)
                    return;
                let charCode = e.key.toLowerCase().charCodeAt(0);
                if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1 || charCode < 48 || (charCode > 57 && charCode < 97) || charCode > 122)
                    return;
                tempValue += e.key.toLowerCase();
                let firstAvailableOption = [...this.selectElement.options].find(o => o.textContent.toLowerCase().trim().includes(tempValue) ||
                    o.value.toLowerCase().trim().includes(tempValue));
                if (firstAvailableOption) {
                    this.selectElement.selectedIndex = -1;
                    firstAvailableOption.selected = true;
                    this.selectElement.dispatchEvent(new Event("change"));
                    if (!debounced)
                        debounced = AtmosSelect.debounce(() => tempValue = "", 350);
                    else
                        debounced();
                }
                else {
                    tempValue = "";
                }
            }
        });
        this.searchInputMock.addEventListener("keydown", (e) => {
            if (this.hidden || !this.selectElement.options?.length)
                return;
            if (e.code === "Enter") {
                e.preventDefault();
                this.toggle();
                this.buttonMock.focus();
            }
            else if (e.code === "ArrowDown" || e.code === "ArrowUp") {
                e.preventDefault();
                this.buttonMock.dispatchEvent(new KeyboardEvent("keydown", { code: e.code }));
            }
        });
        this.listeners.selectElementChangeListener = async () => {
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (!this.selectElement.options?.length)
                return;
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
            this.updateMenuMock([...this.selectElement.selectedOptions]);
            if (!this.visibleOptions)
                this.hide();
        };
        selectElement.addEventListener("change", this.listeners.selectElementChangeListener);
        let inputListener = () => {
            this.filterMenuMock(this.searchInputMock.value);
            this.positionMenuMock();
        };
        this.searchInputMock.addEventListener("input", inputListener);
        this.searchInputMock.addEventListener("change", inputListener);
        this.menuMock.addEventListener("click", e => {
            if (!this.selectElement.options?.length)
                return;
            let target = e.target.closest(".atmos-select-menu-item");
            if (!target)
                return;
            if (target.classList.contains("disabled"))
                return;
            this.updateSelectElement(this.menuItemMocks.indexOf(target));
            this.selectedMenuItemMock = target;
            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            this.selectElement.dispatchEvent(new CustomEvent("change", {
                bubbles: true,
                detail: { filterMenu: false }
            }));
        });
        this.listeners.labelClickListener = (e) => {
            e.stopPropagation();
            this.buttonMock.focus();
        };
        for (const label of this.selectElement.labels) {
            label?.addEventListener("click", this.listeners.labelClickListener);
        }
        this.optionsChangeMutationObserver = new MutationObserver(() => {
            this.generateOptionMocks();
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        });
        this.optionsChangeMutationObserver.observe(selectElement, {
            childList: true
        });
        this.selectElementAttributesChangeMutationObserver = new MutationObserver(() => {
            this.buttonMock.disabled = this.selectElement.disabled;
            this.buttonMock.title = this.selectElement.title;
            if (this.isLiveSearchEnabled) {
                this.searchInputMock.classList.remove("hidden");
            }
            else {
                this.searchInputMock.classList.add("hidden");
            }
        });
        this.selectElementAttributesChangeMutationObserver.observe(this.selectElement, {
            attributes: true,
            attributeFilter: ["disabled", "title", "data-live-search"]
        });
        this.visibleOptions = this.selectElement.options?.length ?? 0;
        AtmosSelect.selects.set(this.selectElement, this);
    }
    get isLiveSearchEnabled() {
        return this.selectElement.dataset?.liveSearch === "true";
    }
    get isHiddenLiveSearchEnabled() {
        return this.selectElement.dataset?.hiddenLiveSearch !== "false";
    }
    get isSubtextShown() {
        return this.selectElement.dataset.subtext === "true";
    }
    get placeholder() {
        return this.selectElement.dataset.placeholder ?? "None selected";
    }
    get hidden() {
        return this.menuMock.classList.contains("hidden");
    }
    static init() {
        let selectElements = document.querySelectorAll("[data-toggle=select]");
        for (const selectElement of selectElements) {
            new AtmosSelect(selectElement);
        }
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLElement))
                        continue;
                    let toggles = [];
                    if (addedNode.dataset?.toggle === "select")
                        toggles.push(addedNode);
                    toggles.push(...addedNode.querySelectorAll("[data-toggle=select]"));
                    for (const toggle of toggles) {
                        if (this.selects.has(toggle))
                            continue;
                        new AtmosSelect(toggle);
                    }
                }
                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement))
                        continue;
                    let toggles = [];
                    if (removedNode.dataset?.toggle === "select")
                        toggles.push(removedNode);
                    toggles.push(...removedNode.querySelectorAll("[data-toggle=select]"));
                    for (const toggle of toggles) {
                        AtmosSelect.get(toggle)?.destroy();
                    }
                }
            }
        }).observe(document, {
            childList: true,
            subtree: true
        });
        document.addEventListener("click", (e) => {
            if (!AtmosSelect.openedSelect)
                return;
            let target = e.target;
            if (target.closest(".atmos-select-menu") === AtmosSelect.openedSelect.menuMock) {
                if (target.closest(".atmos-select-menu-item.disabled")) {
                    return;
                }
                else if (AtmosSelect.openedSelect.selectElement.multiple) {
                    return;
                }
                else if (target.closest(".atmos-select-menu-optgroup") &&
                    !target.closest(".atmos-select-menu-item")) {
                    return;
                }
                else if (target.closest(".atmos-select-menu-control")) {
                    return;
                }
            }
            else if (target.closest(".atmos-select-button") === AtmosSelect.openedSelect.buttonMock) {
                return;
            }
            AtmosSelect.openedSelect.hide();
        });
        window.addEventListener("resize", () => {
            if (!AtmosSelect.openedSelect)
                return;
            if (!AtmosSelect.openedSelect.hidden)
                AtmosSelect.openedSelect.positionMenuMock();
        });
        let initialRect;
        window.addEventListener("scroll", (e) => {
            if (!AtmosSelect.openedSelect || AtmosSelect.openedSelect.hidden || e.target === AtmosSelect.openedSelect.menuMock)
                return;
            let buttonRect = AtmosSelect.openedSelect.buttonMock.getBoundingClientRect();
            if (!initialRect)
                initialRect = buttonRect;
            AtmosSelect.openedSelect.menuMock.style.transform =
                `translate(${buttonRect.right - initialRect.right}px, ${buttonRect.bottom - initialRect.bottom}px)`;
        }, { capture: true, passive: true });
        window.addEventListener("scrollend", (e) => {
            if (!AtmosSelect.openedSelect || AtmosSelect.openedSelect.hidden || e.target === AtmosSelect.openedSelect.menuMock)
                return;
            AtmosSelect.openedSelect.positionMenuMock();
            initialRect = null;
        }, { capture: true, passive: true });
    }
    static get(element) {
        return this.selects.get(element);
    }
    hide() {
        this.menuMock.classList.add("hidden");
        AtmosSelect.openedSelect = null;
        this.menuMock.dispatchEvent(new CustomEvent("hide.atmos-select"));
    }
    show() {
        if (!this.visibleOptions && !this.isLiveSearchEnabled)
            return;
        if (!AtmosSelect.openedSelect?.hidden)
            AtmosSelect.openedSelect?.hide();
        this.menuMock.classList.remove("hidden");
        AtmosSelect.openedSelect = this;
        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-select"));
    }
    toggle() {
        if (!this.visibleOptions && this.hidden && !this.isLiveSearchEnabled)
            return;
        if (this.hidden) {
            if (!AtmosSelect.openedSelect?.hidden)
                AtmosSelect.openedSelect?.hide();
        }
        this.menuMock.classList.toggle("hidden");
        this.positionMenuMock();
        let customEvent;
        if (!this.menuMock.classList.contains("hidden")) {
            customEvent = new CustomEvent("show.atmos-select");
            AtmosSelect.openedSelect = this;
        }
        else {
            customEvent = new CustomEvent("hide.atmos-select");
            AtmosSelect.openedSelect = null;
        }
        this.menuMock.dispatchEvent(customEvent);
    }
    pauseOptionsObserver() {
        this.optionsChangeMutationObserver.disconnect();
    }
    resumeOptionsObserver() {
        this.optionsChangeMutationObserver.observe(this.selectElement, {
            childList: true
        });
    }
    async refreshMenu() {
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        if (!this.selectElement.options?.length)
            return;
        this.updateMenuMock([...this.selectElement.selectedOptions]);
    }
    destroy() {
        this.selectElement.removeEventListener("focus", this.listeners.selectElementFocusListener);
        this.selectElement.removeEventListener("change", this.listeners.selectElementChangeListener);
        for (const label of this.selectElement.labels) {
            label.removeEventListener("click", this.listeners.labelClickListener);
        }
        this.optionsChangeMutationObserver.disconnect();
        this.selectElementAttributesChangeMutationObserver.disconnect();
        this.buttonMock.remove();
        this.menuMock.remove();
        AtmosSelect.selects.delete(this.selectElement);
        if (AtmosSelect.openedSelect === this)
            AtmosSelect.openedSelect = null;
        this.selectElement.style.removeProperty("display");
        this.selectElement = null;
        this.menuMock = null;
        this.selectedMenuItemMock = null;
        this.optionsChangeMutationObserver = null;
        this.selectElementAttributesChangeMutationObserver = null;
        this.listeners = null;
        this.visibleOptions = null;
        this.buttonMock = null;
        this.searchInputMock = null;
    }
    updateSelectElement(selectedOptionIndex) {
        if (!this.selectElement.multiple) {
            this.selectElement.selectedIndex = selectedOptionIndex;
        }
        else {
            this.selectElement.options[selectedOptionIndex].selected =
                !this.selectElement.options[selectedOptionIndex].selected;
        }
    }
    updateButtonMock(values) {
        if (!this.selectElement.multiple) {
            if (!values.length || !values[0] === null || values[0] === undefined)
                values[0] = this.placeholder;
            this.buttonMock.children[0].textContent = values?.[0]?.toString();
        }
        else {
            this.buttonMock.children[0].textContent =
                values.length <= 3 ? values.join(", ") || this.placeholder : `${values.length} options selected`;
        }
    }
    updateMenuMock(selectedOptions) {
        console.debug(`Update menu's options.`);
        for (const menuItemMock of this.menuItemMocks) {
            menuItemMock?.classList.remove("selected");
        }
        this.selectedMenuItemMock = null;
        for (const selectedOption of selectedOptions) {
            selectedOption.selectMenuOption.classList.add("selected");
            this.selectedMenuItemMock = selectedOption.selectMenuOption;
        }
    }
    filterMenuMock(value) {
        console.debug(`Filtering menu.`);
        this.visibleOptions = 0;
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".atmos-select-menu-item.hidden")) {
                menuItemMock.classList.remove("hidden");
            }
            this.visibleOptions = this.selectElement.children.length;
            return;
        }
        for (const menuItemMock of this.menuItemMocks) {
            let normalizedOptionText = menuItemMock.selectOption.textContent.toLowerCase().trim();
            let normalizedOptionValue = menuItemMock.selectOption.value.toLowerCase().trim();
            let normalizedOptionSubtext = menuItemMock.selectOption.dataset.subtext?.toLowerCase().trim() ?? "";
            let normalizedText = value.toLowerCase().trim();
            if (menuItemMock.selectOption.textContent === value ||
                menuItemMock.selectOption.dataset.subtext === value ||
                menuItemMock.selectOption.value === value) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
            }
            else if (normalizedOptionText.includes(normalizedText) ||
                normalizedOptionSubtext.includes(normalizedText) ||
                normalizedOptionValue.includes(normalizedText)) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
            }
            else {
                menuItemMock.classList.add("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.add("hidden");
            }
        }
        let visibleMenuItemMocksWithHiddenOptgroup = this.menuMock.querySelectorAll(".atmos-select-menu-optgroup.hidden .atmos-select-menu-item:not(.hidden)");
        for (const menuItemMock of visibleMenuItemMocksWithHiddenOptgroup) {
            menuItemMock.parentElement.classList.remove("hidden");
        }
    }
    positionMenuMock() {
        this.menuMock.style.removeProperty("height");
        let buttonRect = this.buttonMock.getBoundingClientRect();
        let menuRect = this.menuMock.getBoundingClientRect();
        if (buttonRect.bottom + menuRect.height + 15 > window.innerHeight && buttonRect.top - 15 < menuRect.height) {
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
            this.menuMock.style.height = `${window.innerHeight - buttonRect.bottom - 10}px`;
        }
        else if (buttonRect.bottom + menuRect.height + 15 > window.innerHeight) {
            this.menuMock.style.top = `${buttonRect.top - menuRect.height - 5 + window.scrollY}px`;
        }
        else {
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
        }
        console.debug(`Positioning menu to ${buttonRect.width}, ${buttonRect.left}.`);
        this.menuMock.style.minWidth = `${buttonRect.width}px`;
        this.menuMock.style.left = `${buttonRect.left}px`;
        this.menuMock.style.removeProperty("transform");
    }
    generateMocks() {
        let buttonMock = Redom.el("button.atmos-select-button", Redom.el("span", this.placeholder), {
            type: "button",
            disabled: this.selectElement.disabled,
            title: this.selectElement.title
        });
        this.selectElement.insertAdjacentElement("afterend", buttonMock);
        this.buttonMock = buttonMock;
        if (this.selectElement.selectedIndex >= 0) {
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        }
        let menuMock = Redom.el("ul.atmos-select-menu.hidden");
        if (this.selectElement.id)
            menuMock.dataset.origin = this.selectElement.id;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;
        let searchMock = Redom.el("li.atmos-select-menu-control", Redom.el("input"));
        this.searchInputMock = searchMock.children[0];
        if (!this.isLiveSearchEnabled)
            this.searchInputMock.classList.add("hidden");
        Redom.mount(this.menuMock, searchMock);
        this.generateOptionMocks();
    }
    generateOptionMocks() {
        for (const menuItemMock of this.menuMock.querySelectorAll(".atmos-select-menu-item")) {
            menuItemMock.remove();
        }
        if (!this.selectElement.options?.length) {
            this.visibleOptions = 0;
            return;
        }
        this.menuItemMocks = [];
        for (const child of this.selectElement.children) {
            if (child instanceof HTMLOptGroupElement) {
                let optgroupMock = Redom.el("li.atmos-select-menu-optgroup", Redom.el("span.atmos-select-menu-optgroup-text", child.label));
                Redom.mount(this.menuMock, optgroupMock);
                for (const option of child.querySelectorAll("option")) {
                    this.generateOptionMock(optgroupMock, option);
                }
            }
            else if (child instanceof HTMLOptionElement) {
                this.generateOptionMock(this.menuMock, child);
            }
        }
        this.visibleOptions = this.selectElement.options.length;
    }
    generateOptionMock(parent, option) {
        let menuItemMock = Redom.el("li.atmos-select-menu-item", {
            title: option.title
        });
        Redom.mount(parent, menuItemMock);
        let textMock = Redom.el("span", option.textContent);
        Redom.mount(menuItemMock, textMock);
        if (this.isSubtextShown && (option.dataset.subtext || option.value !== option.textContent)) {
            let menuItemSubtext = Redom.el("small.atmos-select-menu-item-value", option.dataset.subtext || option.value);
            Redom.mount(textMock, menuItemSubtext);
        }
        menuItemMock["selectOption"] = option;
        option["selectMenuOption"] = menuItemMock;
        if (option.selected && !option.disabled) {
            menuItemMock.classList.add("selected");
            this.selectedMenuItemMock = menuItemMock;
        }
        if (option.disabled ||
            (parent.classList.contains("atmos-select-menu-optgroup") &&
                option.parentElement instanceof HTMLOptGroupElement &&
                option.parentElement.disabled)) {
            menuItemMock.classList.add("disabled");
        }
        let selectedTickImage = Redom.el("span.atmos-select-menu-item-tick");
        Redom.mount(menuItemMock, selectedTickImage);
        this.menuItemMocks.push(menuItemMock);
    }
    static debounce(func, wait = 50, immediate) {
        let timeout;
        return function () {
            const context = this, args = arguments;
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            }, wait);
            if (callNow)
                func.apply(context, args);
        };
    }
}
window["AtmosSelect"] = AtmosSelect;
AtmosSelect.init();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NTZWxlY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NTZWxlY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxXQUFXO0lBQ3BCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQWtDLENBQUM7SUFDM0QsTUFBTSxDQUFDLFlBQVksQ0FBYztJQUVqQyxhQUFhLENBQW9CO0lBQ2pDLFVBQVUsQ0FBb0I7SUFDOUIsUUFBUSxDQUFjO0lBQ3RCLG9CQUFvQixDQUFnQjtJQUNwQyxlQUFlLENBQW1CO0lBRWxDLDZCQUE2QixDQUFtQjtJQUNoRCw2Q0FBNkMsQ0FBbUI7SUFDaEUsU0FBUyxHQUFRLEVBQUUsQ0FBQztJQUNwQixjQUFjLEdBQVcsQ0FBQyxDQUFDO0lBQzNCLGFBQWEsR0FBRyxJQUFJLEtBQUssRUFBaUIsQ0FBQztJQUVuRCxZQUFZLGFBQWdDO1FBQ3hDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQUUsT0FBTztRQUNuRCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUVuQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFHckMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRXJCLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNyRCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7UUFHdEQsSUFBSSxDQUFDLFNBQVMsQ0FBQywwQkFBMEIsR0FBRyxHQUFHLEVBQUU7WUFDN0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO2dCQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7UUFD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