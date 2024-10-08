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
                if (!this.visibleOptions || this.selectElement.multiple)
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
                if (!this.visibleOptions || this.selectElement.multiple)
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
        this.listeners.selectElementChangeListener = async () => {
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (!this.selectElement.options?.length)
                return;
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim() || so.dataset.subtext?.trim()));
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
                this.selectElement.dispatchEvent(new Event("change"));
            }
        });
        let selectNoneButton = Redom.el("button.atmos-select-none-button", "Select none", {
            type: "button",
            onclick: () => {
                this.selectElement.selectedIndex = -1;
                this.selectElement.dispatchEvent(new Event("change"));
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