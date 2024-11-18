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
    buttonMockTextElement;
    static customHighlight;
    static maxHighlights = 100;
    constructor(selectElement) {
        if (AtmosSelect.selects.has(selectElement))
            return;
        this.selectElement = selectElement;
        selectElement.style.display = "none";
        this.generateMocks();
        this.selectElement.selectButton = this.buttonMock;
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
                if (this.visibleOptions <= 1 || this.selectElement.multiple)
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
                    (previousOption && nextOption === previousOption) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.selectElement.selectedIndex = -1;
                nextOption.selectOption.selected = true;
                selectElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: {
                        filterMenu: false,
                        optionToSelect: nextOption
                    }
                }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "ArrowUp") {
                e.preventDefault();
                if (this.visibleOptions <= 1 || this.selectElement.multiple)
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
                    (previousOption && nextOption === previousOption) ||
                    nextOption.classList.contains("hidden") ||
                    nextOption.classList.contains("disabled"));
                this.selectElement.selectedIndex = -1;
                nextOption.selectOption.selected = true;
                selectElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: {
                        filterMenu: false,
                        optionToSelect: nextOption
                    }
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
                let firstAvailableOption = [...this.selectElement.options].find(o => o.textContent.toLowerCase().trim().includes(tempValue));
                if (firstAvailableOption) {
                    this.selectElement.selectedIndex = -1;
                    firstAvailableOption.selected = true;
                    this.selectElement.dispatchEvent(new Event("change", { bubbles: true }));
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
        this.listeners.selectElementChangeListener = async (e) => {
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (!this.selectElement.options?.length)
                return;
            let optionsToSelect;
            if (e.detail?.optionToSelect) {
                optionsToSelect =
                    [e.detail.optionToSelect.textContent.trim() || e.detail.optionToSelect.dataset.subtext?.trim()];
            }
            else {
                optionsToSelect = [...this.selectElement.selectedOptions]
                    ?.map(so => so.textContent.trim() || so.dataset.subtext?.trim());
            }
            this.updateButtonMock(optionsToSelect);
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
            this.buttonMock.focus();
        });
        this.listeners.labelClickListener = () => this.buttonMock.focus();
        for (const label of this.selectElement.labels) {
            label?.addEventListener("click", this.listeners.labelClickListener);
        }
        this.optionsChangeMutationObserver = new MutationObserver(() => {
            if (this.selectElement.options.length !== this.menuItemMocks.length ||
                [...this.selectElement.options].some(o => !o.selectMenuOption)) {
                this.generateOptionMocks();
                this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim() || so.dataset.subtext?.trim()));
            }
        });
        this.optionsChangeMutationObserver.observe(selectElement, {
            childList: true
        });
        this.selectElementAttributesChangeMutationObserver = new MutationObserver(() => {
            this.buttonMock.disabled = this.selectElement.disabled;
            if (this.selectElement.title)
                this.buttonMock.title = this.selectElement.title;
            else
                this.buttonMock.removeAttribute("title");
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
    get areShorthandButtonsEnabled() {
        return this.selectElement.dataset.shorthandButtons === "true";
    }
    get placeholder() {
        return this.selectElement.dataset.placeholder ?? "None selected";
    }
    get additionalButtonHtml() {
        return this.selectElement.dataset.buttonHtml ?? "";
    }
    get menuPosition() {
        return this.selectElement.dataset.menuPosition ?? "";
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
            else if (target instanceof HTMLAnchorElement && target.href === "#" + AtmosSelect.openedSelect.selectElement.id) {
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
            if (!AtmosSelect.openedSelect ||
                AtmosSelect.openedSelect.hidden ||
                e.target === AtmosSelect.openedSelect.menuMock)
                return;
            let buttonRect = AtmosSelect.openedSelect.buttonMock.getBoundingClientRect();
            if (!initialRect)
                initialRect = buttonRect;
            if (e.target !== document)
                AtmosSelect.openedSelect.menuMock.style.transform =
                    `translate(${buttonRect.right - initialRect.right}px, ${(buttonRect.bottom - initialRect.bottom)}px)`;
        }, { capture: true, passive: true });
        window.addEventListener("scrollend", (e) => {
            if (!AtmosSelect.openedSelect ||
                AtmosSelect.openedSelect.hidden ||
                e.target === AtmosSelect.openedSelect.menuMock)
                return;
            AtmosSelect.openedSelect.positionMenuMock();
            initialRect = null;
        }, { capture: true, passive: true });
        if (CSS.highlights) {
            this.customHighlight = new Highlight();
            CSS.highlights.set("atmos-select-highlight", this.customHighlight);
        }
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
    refreshMenu() {
        if (this.selectElement.options.length !== this.menuItemMocks.length ||
            [...this.selectElement.options].some(o => !o.selectMenuOption)) {
            this.generateOptionMocks();
        }
        else {
            this.updateMenuMock([...this.selectElement.selectedOptions]);
        }
        this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim() || so.dataset.subtext?.trim()));
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
            this.buttonMockTextElement.textContent = values?.[0]?.toString();
        }
        else {
            this.buttonMockTextElement.textContent =
                values.length <= 3 ? values.join(", ") || this.placeholder : `${values.length} options selected`;
        }
    }
    updateMenuMock(selectedOptions) {
        console.debug(`Update menu's options.`);
        let value = this.searchInputMock.value.trim().toLowerCase();
        for (const menuItemMock of this.menuItemMocks) {
            let hasContentBeenUpdated = false;
            let itemText = menuItemMock.querySelector(".atmos-select-menu-item-text");
            if (itemText.textContent !== menuItemMock.selectOption.textContent) {
                itemText.textContent = menuItemMock.selectOption.textContent;
                hasContentBeenUpdated = true;
            }
            let valueToTestAgainst = menuItemMock.selectOption.dataset.subtext ?? "";
            let itemSubtext = menuItemMock.querySelector(".atmos-select-menu-item-value");
            if (itemSubtext.textContent !== valueToTestAgainst) {
                itemSubtext.textContent = valueToTestAgainst;
                hasContentBeenUpdated = true;
            }
            menuItemMock?.classList.remove("selected");
            if (hasContentBeenUpdated && value) {
                this.adjustHighlightRange(menuItemMock, menuItemMock.selectOption.textContent.trim().toLowerCase(), menuItemMock.selectOption.dataset.subtext?.trim().toLowerCase(), value);
            }
        }
        this.selectedMenuItemMock = null;
        for (const selectedOption of selectedOptions) {
            selectedOption.selectMenuOption.classList.add("selected");
            this.selectedMenuItemMock = selectedOption.selectMenuOption;
        }
    }
    filterMenuMock(value, clearHighlights = true) {
        console.debug(`Filtering menu.`);
        this.visibleOptions = 0;
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".atmos-select-menu-item.hidden")) {
                menuItemMock.classList.remove("hidden");
            }
            this.visibleOptions = this.selectElement.children.length;
            if (clearHighlights)
                AtmosSelect.customHighlight?.clear();
            return;
        }
        if (clearHighlights)
            AtmosSelect.customHighlight?.clear();
        for (const menuItemMock of this.menuItemMocks) {
            let normalizedOptionText = menuItemMock.selectOption.textContent.toLowerCase().trim();
            let normalizedOptionSubtext = menuItemMock.selectOption.dataset.subtext?.toLowerCase().trim() ?? "";
            let normalizedText = value.toLowerCase().trim();
            if (menuItemMock.selectOption.textContent === value ||
                menuItemMock.selectOption.dataset.subtext === value) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedText);
            }
            else if (normalizedOptionText.includes(normalizedText) ||
                normalizedOptionSubtext.includes(normalizedText)) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedText);
            }
            else {
                menuItemMock.classList.add("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.add("hidden");
                this.hideHighlightRange(menuItemMock);
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
            if (this.menuPosition === "up") {
                this.menuMock.style.top = `${window.scrollY + 5}px`;
                this.menuMock.style.height = `${buttonRect.top - 10}px`;
            }
            else {
                this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
                this.menuMock.style.height = `${window.innerHeight - buttonRect.bottom - 10}px`;
            }
        }
        else if (buttonRect.bottom + menuRect.height + 15 > window.innerHeight) {
            this.menuMock.style.top = `${buttonRect.top - menuRect.height - 5 + window.scrollY}px`;
        }
        else if (this.menuPosition === "up" && buttonRect.top - 15 < menuRect.height) {
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
        }
        else {
            if (this.menuPosition === "up") {
                this.menuMock.style.top = `${buttonRect.top - menuRect.height - 5 + window.scrollY}px`;
            }
            else {
                this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
            }
        }
        let left = buttonRect.left;
        if (buttonRect.left + menuRect.width + 15 > window.innerWidth) {
            left -= buttonRect.left + menuRect.width + 15 + window.scrollY - window.innerWidth;
        }
        console.debug(`Positioning menu to ${buttonRect.width}, ${buttonRect.left}.`);
        this.menuMock.style.minWidth = `${buttonRect.width}px`;
        this.menuMock.style.left = `${left}px`;
        this.menuMock.style.removeProperty("transform");
    }
    generateMocks() {
        let buttonMock = Redom.el("button.atmos-select-button", {
            type: "button",
            disabled: this.selectElement.disabled,
        });
        this.buttonMockTextElement = Redom.el("span", this.placeholder);
        buttonMock.append(this.buttonMockTextElement);
        if (this.selectElement.title)
            buttonMock.title = this.selectElement.title;
        if (this.additionalButtonHtml)
            buttonMock.insertAdjacentHTML("afterbegin", this.additionalButtonHtml);
        this.selectElement.insertAdjacentElement("afterend", buttonMock);
        this.buttonMock = buttonMock;
        if (this.selectElement.selectedIndex >= 0) {
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim() ||
                so.dataset.subtext?.trim()));
        }
        let menuMock = Redom.el("ul.atmos-select-menu.hidden");
        if (this.selectElement.id)
            menuMock.dataset.origin = this.selectElement.id;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;
        let searchMock = Redom.el("li.atmos-select-menu-control");
        this.searchInputMock = Redom.el("input", { name: "atmos-select-search" });
        if (!this.isLiveSearchEnabled)
            this.searchInputMock.classList.add("hidden");
        let selectAllButton = Redom.el("button.atmos-select-all-button", "Select all", {
            type: "button",
            onclick: () => {
                [...this.selectElement.options].forEach(o => o.selected = !o.disabled);
                this.selectElement.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });
        let selectNoneButton = Redom.el("button.atmos-select-none-button", "Select none", {
            type: "button",
            onclick: () => {
                this.selectElement.selectedIndex = -1;
                this.selectElement.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });
        if (!this.areShorthandButtonsEnabled) {
            selectAllButton.classList.add("hidden");
            selectNoneButton.classList.add("hidden");
        }
        if (!this.selectElement.multiple)
            selectAllButton.classList.add("hidden");
        searchMock.append(this.searchInputMock, selectAllButton, selectNoneButton);
        this.menuMock.append(searchMock);
        this.generateOptionMocks();
    }
    generateOptionMocks() {
        for (const menuItemMock of this.menuMock.querySelectorAll(".atmos-select-menu-item,.atmos-select-menu-optgroup")) {
            menuItemMock.remove();
        }
        AtmosSelect.customHighlight?.clear();
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
        let menuItemMock = Redom.el("li.atmos-select-menu-item");
        if (option.title)
            menuItemMock.title = option.title;
        Redom.mount(parent, menuItemMock);
        let textMock = Redom.el("span.atmos-select-menu-item-text", option.textContent);
        Redom.mount(menuItemMock, textMock);
        let menuItemSubtext = Redom.el("small.atmos-select-menu-item-value", option.dataset.subtext ?? "");
        Redom.mount(menuItemMock, menuItemSubtext);
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
        let value = this.searchInputMock.value.trim().toLowerCase();
        if (value) {
            this.adjustHighlightRange(menuItemMock, option.textContent.trim().toLowerCase(), option.dataset.subtext?.trim().toLowerCase(), value);
        }
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
    adjustHighlightRange(menuItemMock, optionText, optionSubtext, valueToTestAgainst) {
        if (!CSS.highlights)
            return;
        let start = optionText.indexOf(valueToTestAgainst);
        if (start >= 0 && AtmosSelect.customHighlight.size < AtmosSelect.maxHighlights) {
            if (!menuItemMock.textHighlightRange) {
                menuItemMock.textHighlightRange = new Range();
            }
            let textNode = menuItemMock.querySelector(".atmos-select-menu-item-text").childNodes[0];
            menuItemMock.textHighlightRange.setStart(textNode, start);
            menuItemMock.textHighlightRange.setEnd(textNode, start + valueToTestAgainst.length);
            AtmosSelect.customHighlight.add(menuItemMock.textHighlightRange);
        }
        else if (menuItemMock.textHighlightRange) {
            AtmosSelect.customHighlight.delete(menuItemMock.textHighlightRange);
            menuItemMock.textHighlightRange = null;
        }
        if (optionSubtext && optionSubtext !== optionText) {
            start = optionSubtext.indexOf(valueToTestAgainst);
            if (start >= 0 && AtmosSelect.customHighlight.size < AtmosSelect.maxHighlights) {
                if (!menuItemMock.subtextHighlightRange) {
                    menuItemMock.subtextHighlightRange = new Range();
                }
                let textNode = menuItemMock.querySelector(".atmos-select-menu-item-value").childNodes[0];
                menuItemMock.subtextHighlightRange.setStart(textNode, start);
                menuItemMock.subtextHighlightRange.setEnd(textNode, start + valueToTestAgainst.length);
                AtmosSelect.customHighlight.add(menuItemMock.subtextHighlightRange);
            }
            else if (menuItemMock.subtextHighlightRange) {
                AtmosSelect.customHighlight.delete(menuItemMock.subtextHighlightRange);
                menuItemMock.subtextHighlightRange = null;
            }
        }
    }
    hideHighlightRange(menuItemMock) {
        if (!CSS.highlights)
            return;
        if (menuItemMock.textHighlightRange) {
            AtmosSelect.customHighlight.delete(menuItemMock.textHighlightRange);
            menuItemMock.textHighlightRange = null;
        }
        if (menuItemMock.subtextHighlightRange) {
            AtmosSelect.customHighlight.delete(menuItemMock.subtextHighlightRange);
            menuItemMock.subtextHighlightRange = null;
        }
    }
}
window["AtmosSelect"] = AtmosSelect;
AtmosSelect.init();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NTZWxlY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NTZWxlY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxXQUFXO0lBQ3BCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQWtDLENBQUM7SUFDM0QsTUFBTSxDQUFDLFlBQVksQ0FBYztJQUVqQyxhQUFhLENBQW9CO0lBQ2pDLFVBQVUsQ0FBb0I7SUFDOUIsUUFBUSxDQUFjO0lBQ3RCLG9CQUFvQixDQUFnQjtJQUNwQyxlQUFlLENBQW1CO0lBRWxDLDZCQUE2QixDQUFtQjtJQUNoRCw2Q0FBNkMsQ0FBbUI7SUFDaEUsU0FBUyxHQUFRLEVBQUUsQ0FBQztJQUNwQixjQUFjLEdBQVcsQ0FBQyxDQUFDO0lBQzNCLGFBQWEsR0FBRyxJQUFJLEtBQUssRUFBaUIsQ0FBQztJQUMzQyxxQkFBcUIsQ0FBa0I7SUFFdkMsTUFBTSxDQUFDLGVBQWUsQ0FBWTtJQUNsQyxNQUFNLENBQUMsYUFBYSxHQUFHLEdBQUcsQ0FBQztJQUVuQyxZQUFZLGFBQWdDO1FBQ3hDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQUUsT0FBTztRQUNuRCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUVuQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFHckMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRXJCLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDbEQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBR3RELElBQUksQ0FBQyxTQUFTLENBQUMsMEJBQTBCLEdBQUcsR0FBRyxFQUFF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