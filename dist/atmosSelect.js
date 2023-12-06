import * as Redom from "redom";
export default class AtmosSelect {
    static selects = new Map();
    static openedSelect;
    selectElement;
    mocksWrapper;
    buttonMock;
    menuMock;
    selectedMenuItemMock;
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
            if (!selectElement.disabled) {
                this.buttonMock.focus();
            }
        };
        selectElement.addEventListener("focus", this.listeners.selectElementFocusListener);
        this.buttonMock.addEventListener("click", () => {
            if (this.hidden) {
                let result = this.selectElement.dispatchEvent(new CustomEvent("beforeshow.atmos-select", { cancelable: true }));
                if (!result)
                    return;
            }
            else if (!this.visibleOptions) {
                this.hide();
            }
            this.toggle();
            this.positionMenuMock();
        });
        this.mocksWrapper.addEventListener("keydown", (e) => {
            if (!this.selectElement.options?.length)
                return;
            if (e.code === "ArrowDown") {
                e.preventDefault();
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
                selectElement.dispatchEvent(new Event("change", { bubbles: true }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "ArrowUp") {
                e.preventDefault();
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
                selectElement.dispatchEvent(new Event("change", { bubbles: true }));
                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            }
            else if (e.code === "Escape") {
                e.preventDefault();
                this.hide();
            }
            else if (e.code === "Enter") {
                e.preventDefault();
                this.toggle();
            }
            else if (e.code === "Tab") {
                this.hide();
            }
        });
        this.listeners.selectElementChangeListener = async () => {
            await new Promise(resolve => requestAnimationFrame(resolve));
            if (!this.selectElement.options?.length)
                return;
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
            this.updateButtonMockTitle(this.selectElement.selectedOptions[0]?.title);
            this.updateMenuMock([...this.selectElement.selectedOptions]);
            if (!this.visibleOptions)
                this.hide();
        };
        selectElement.addEventListener("change", this.listeners.selectElementChangeListener);
        this.menuMock.addEventListener("click", e => {
            if (!this.selectElement.options?.length)
                return;
            let target = e.target.closest(".atmos-select-menu-item");
            if (!target)
                return;
            if (target.classList.contains("disabled"))
                return;
            this.updateSelectElement(this.menuItemMocks.indexOf(target));
            this.selectElement.dispatchEvent(new CustomEvent("change", {
                bubbles: true,
                detail: {
                    filterMenu: false
                }
            }));
            this.selectedMenuItemMock = target;
            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
        });
        this.listeners.labelClickListener = (e) => {
            e.stopPropagation();
            this.buttonMock.focus();
        };
        for (const label of selectElement.labels) {
            label?.addEventListener("click", this.listeners.labelClickListener);
        }
        this.optionsChangeMutationObserver = new MutationObserver(() => {
            this.generateOptionMocks();
        });
        this.optionsChangeMutationObserver.observe(selectElement, {
            childList: true
        });
        this.selectElementAttributesChangeMutationObserver = new MutationObserver(() => {
            this.buttonMock.disabled = selectElement.disabled;
        });
        this.selectElementAttributesChangeMutationObserver.observe(selectElement, {
            attributes: true,
            attributeFilter: ["disabled"]
        });
        this.visibleOptions = this.selectElement.options?.length ?? 0;
        AtmosSelect.selects.set(selectElement, this);
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
                    if (addedNode.dataset?.toggles === "select")
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
                    if (removedNode.dataset?.toggles === "select")
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
                if (AtmosSelect.openedSelect.selectElement.multiple) {
                    return;
                }
                else if (target.closest(".atmos-select-menu-optgroup") &&
                    !target.closest(".atmos-select-menu-item")) {
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
        if (!this.visibleOptions)
            return;
        if (!AtmosSelect.openedSelect?.hidden)
            AtmosSelect.openedSelect?.hide();
        this.menuMock.classList.remove("hidden");
        AtmosSelect.openedSelect = this;
        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-select"));
    }
    toggle() {
        if (!this.visibleOptions && this.hidden)
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
        this.updateButtonMockTitle(this.selectElement.selectedOptions[0]?.title);
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
        this.mocksWrapper.remove();
        this.menuMock.remove();
        AtmosSelect.selects.delete(this.selectElement);
        if (AtmosSelect.openedSelect === this)
            AtmosSelect.openedSelect = null;
        this.selectElement.style.removeProperty("display");
        this.selectElement = null;
        this.mocksWrapper = null;
        this.menuMock = null;
        this.selectedMenuItemMock = null;
        this.optionsChangeMutationObserver = null;
        this.selectElementAttributesChangeMutationObserver = null;
        this.listeners = null;
        this.visibleOptions = null;
        this.buttonMock = null;
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
                values[0] = this.selectElement.dataset.placeholder ?? "None selected";
            this.buttonMock.childNodes[0].textContent = values?.[0]?.toString();
        }
        else {
            this.buttonMock.childNodes[0].textContent =
                values.length <= 3 ? values.join(", ") || this.selectElement.dataset.placeholder : `${values.length} options selected`;
        }
    }
    updateButtonMockTitle(value) {
        if (!value === null || value === undefined)
            value = "";
        this.buttonMock.title = value?.toString();
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
        let mocksWrapper = Redom.el("div.atmos-select-wrapper");
        this.selectElement.insertAdjacentElement("afterend", mocksWrapper);
        this.mocksWrapper = mocksWrapper;
        let buttonMock = Redom.el("button.atmos-select-button", this.selectElement.dataset.placeholder ?? "None selected", {
            type: "button",
            disabled: this.selectElement.disabled,
        });
        Redom.mount(mocksWrapper, buttonMock);
        this.buttonMock = buttonMock;
        if (this.selectElement.selectedIndex >= 0) {
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        }
        let menuMock = Redom.el("ul.atmos-select-menu.hidden");
        if (this.selectElement.id)
            menuMock.dataset.origin = this.selectElement.id;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;
        if (this.selectElement.dataset.wrapperClass)
            mocksWrapper.classList.add(this.selectElement.dataset.wrapperClass);
        if (this.selectElement.dataset.inputClass)
            buttonMock.classList.add(this.selectElement.dataset.inputClass);
        if (this.selectElement.dataset.menuClass)
            menuMock.classList.add(this.selectElement.dataset.menuClass);
        this.generateOptionMocks();
    }
    generateOptionMocks() {
        Redom.setChildren(this.menuMock, []);
        if (!this.selectElement.options?.length)
            return;
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
        let menuItemMock = Redom.el("li.atmos-select-menu-item", option.textContent, {
            title: option.title
        });
        Redom.mount(parent, menuItemMock);
        if (option.value !== option.textContent && this.selectElement.dataset.showValues !== "false") {
            let menuItemSubtext = Redom.el("small.atmos-select-menu-item-value", option.value);
            Redom.mount(menuItemMock, menuItemSubtext);
        }
        menuItemMock["selectOption"] = option;
        option["selectMenuOption"] = menuItemMock;
        if (option.selected && !option.disabled) {
            menuItemMock.classList.add("selected");
            this.selectedMenuItemMock = menuItemMock;
            this.updateButtonMockTitle(this.selectedMenuItemMock.title);
        }
        if (option.disabled ||
            (parent.classList.contains("atmos-select-menu-optgroup") &&
                option.parentElement instanceof HTMLOptGroupElement &&
                option.parentElement.disabled)) {
            menuItemMock.classList.add("disabled");
        }
        let selectedTickImage = Redom.el("span.atmos-select-menu-item-tick");
        Redom.mount(menuItemMock, selectedTickImage);
        if (this.selectElement.dataset.menuItemClass)
            menuItemMock.classList.add(this.selectElement.dataset.menuItemClass);
        this.menuItemMocks.push(menuItemMock);
    }
}
window["AtmosSelect"] = AtmosSelect;
AtmosSelect.init();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NTZWxlY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NTZWxlY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxXQUFXO0lBQ3BCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7SUFDckQsTUFBTSxDQUFDLFlBQVksQ0FBYztJQUVqQyxhQUFhLENBQW9CO0lBQ2pDLFlBQVksQ0FBYztJQUNsQyxVQUFVLENBQW9CO0lBQ3RCLFFBQVEsQ0FBYztJQUN0QixvQkFBb0IsQ0FBZ0I7SUFDcEMsNkJBQTZCLENBQW1CO0lBQ2hELDZDQUE2QyxDQUFtQjtJQUNoRSxTQUFTLEdBQVEsRUFBRSxDQUFDO0lBQ3BCLGNBQWMsR0FBVyxDQUFDLENBQUM7SUFDM0IsYUFBYSxHQUFHLElBQUksS0FBSyxFQUFpQixDQUFDO0lBRW5ELFlBQVksYUFBZ0M7UUFDeEMsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUM7WUFBRSxPQUFPO1FBQ25ELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBRW5DLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUdyQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFckIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ3JELElBQUksQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztRQUd0RCxJQUFJLENBQUMsU0FBUyxDQUFDLDBCQUEwQixHQUFHLEdBQUcsRUFBRTtZQUM3QyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBRTtnQkFDekIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FB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