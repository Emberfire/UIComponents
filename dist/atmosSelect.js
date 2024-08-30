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
            this.updateButtonMock([...this.selectElement.selectedOptions]
                ?.map(so => so.textContent.trim() ||
                so.dataset.subtext?.trim() ||
                so.value.trim()));
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
                this.updateButtonMock([...this.selectElement.selectedOptions]
                    ?.map(so => so.textContent.trim() ||
                    so.dataset.subtext?.trim() ||
                    so.value.trim()));
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
    get areValuesShownAsSubtext() {
        return this.selectElement.dataset.showValuesAsSubtext === "true";
    }
    get placeholder() {
        return this.selectElement.dataset.placeholder ?? "None selected";
    }
    get additionalButtonHtml() {
        return this.selectElement.dataset.buttonHtml ?? "";
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
        this.updateButtonMock([...this.selectElement.selectedOptions]
            ?.map(so => so.textContent.trim() ||
            so.dataset.subtext?.trim() ||
            so.value.trim()));
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
            let valueToTestAgainst = menuItemMock.selectOption.dataset.subtext ||
                (itemText.textContent !==
                    menuItemMock.selectOption.value ?
                    menuItemMock.selectOption.value :
                    undefined);
            let itemSubtext = menuItemMock.querySelector(".atmos-select-menu-item-value");
            if (itemSubtext && valueToTestAgainst && itemSubtext.textContent !== valueToTestAgainst) {
                itemSubtext.textContent = valueToTestAgainst;
                hasContentBeenUpdated = true;
            }
            menuItemMock?.classList.remove("selected");
            if (hasContentBeenUpdated && value) {
                this.adjustHighlightRange(menuItemMock, menuItemMock.selectOption.textContent.trim().toLowerCase(), menuItemMock.selectOption.dataset.subtext?.trim().toLowerCase(), menuItemMock.selectOption.value.trim().toLowerCase(), value);
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
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedOptionValue, normalizedText);
            }
            else if (normalizedOptionText.includes(normalizedText) ||
                normalizedOptionSubtext.includes(normalizedText) ||
                normalizedOptionValue.includes(normalizedText)) {
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");
                this.visibleOptions++;
                this.adjustHighlightRange(menuItemMock, normalizedOptionText, normalizedOptionSubtext, normalizedOptionValue, normalizedText);
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
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
            this.menuMock.style.height = `${window.innerHeight - buttonRect.bottom - 10}px`;
        }
        else if (buttonRect.bottom + menuRect.height + 15 > window.innerHeight) {
            this.menuMock.style.top = `${buttonRect.top - menuRect.height - 5 + window.scrollY}px`;
        }
        else {
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
        }
        let left = buttonRect.left;
        if (buttonRect.left + menuRect.width + 15 > window.innerWidth) {
            left -= buttonRect.left + menuRect.width + 15 + window.scrollY - window.innerWidth;
        }
        else {
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
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
            this.updateButtonMock([...this.selectElement.selectedOptions]
                ?.map(so => so.textContent.trim() ||
                so.dataset.subtext?.trim() ||
                so.value.trim()));
        }
        let menuMock = Redom.el("ul.atmos-select-menu.hidden");
        if (this.selectElement.id)
            menuMock.dataset.origin = this.selectElement.id;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;
        let searchMock = Redom.el("li.atmos-select-menu-control", Redom.el("input", { name: "atmos-select-search" }));
        this.searchInputMock = searchMock.children[0];
        if (!this.isLiveSearchEnabled)
            this.searchInputMock.classList.add("hidden");
        Redom.mount(this.menuMock, searchMock);
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
        if (option.dataset.subtext || (this.areValuesShownAsSubtext && option.value !== option.textContent)) {
            let menuItemSubtext = Redom.el("small.atmos-select-menu-item-value", option.dataset.subtext || option.value);
            Redom.mount(menuItemMock, menuItemSubtext);
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
        let value = this.searchInputMock.value.trim().toLowerCase();
        if (value) {
            this.adjustHighlightRange(menuItemMock, option.textContent.trim().toLowerCase(), option.dataset.subtext?.trim().toLowerCase(), option.value.trim().toLowerCase(), value);
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
    adjustHighlightRange(menuItemMock, optionText, optionSubtext, optionValue, valueToTestAgainst) {
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
        let subtext = optionSubtext || optionValue;
        if ((subtext && subtext !== optionText) && menuItemMock.querySelector(".atmos-select-menu-item-value")) {
            start = subtext.indexOf(valueToTestAgainst);
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