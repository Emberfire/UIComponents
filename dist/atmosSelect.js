import * as Redom from "redom";
export default class AtmosSelect {
    static selects = new Map();
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
                this.selectElement.dispatchEvent(new CustomEvent("beforeshow.atmos-select"));
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
                detail: { filterMenu: false }
            }));
            this.selectedMenuItemMock = target;
            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
        });
        this.listeners.documentClickListener = (e) => {
            let target = e.target;
            if (target.closest(".atmos-select-menu") === this.menuMock) {
                if (this.selectElement.multiple)
                    return;
            }
            else if (target.closest(".atmos-select-button") === this.buttonMock) {
                return;
            }
            this.hide();
        };
        document.addEventListener("click", this.listeners.documentClickListener);
        this.listeners.documentResizeListener = () => {
            if (!this.hidden)
                this.positionMenuMock();
        };
        window.addEventListener("resize", this.listeners.documentResizeListener);
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
    }
    static get(element) {
        return this.selects.get(element);
    }
    hide() {
        this.menuMock.classList.add("hidden");
        this.menuMock.dispatchEvent(new CustomEvent("hide.atmos-select"));
    }
    show() {
        if (!this.visibleOptions)
            return;
        for (const [_, select] of AtmosSelect.selects) {
            if (!select.hidden)
                select.hide();
        }
        this.menuMock.classList.remove("hidden");
        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-select"));
    }
    toggle() {
        if (!this.visibleOptions && this.hidden)
            return;
        if (this.hidden) {
            for (const [_, select] of AtmosSelect.selects) {
                if (!select.hidden)
                    select.hide();
            }
        }
        this.menuMock.classList.toggle("hidden");
        this.positionMenuMock();
        let customEvent = this.menuMock.classList.contains("hidden")
            ? new CustomEvent("hide.atmos-select")
            : new CustomEvent("show.atmos-select");
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
        if (!this.selectElement.options?.length)
            return;
        this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        this.updateButtonMockTitle(this.selectElement.selectedOptions[0]?.title);
        this.updateMenuMock([...this.selectElement.selectedOptions]);
    }
    destroy() {
        document.removeEventListener("click", this.listeners.documentClickListener);
        document.removeEventListener("resize", this.listeners.documentResizeListener);
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
                values[0] = this.selectElement.dataset.placeholder || "";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXRtb3NTZWxlY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvYXRtb3NTZWxlY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFFL0IsTUFBTSxDQUFDLE9BQU8sT0FBTyxXQUFXO0lBQ3BCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7SUFFckQsYUFBYSxDQUFvQjtJQUNqQyxZQUFZLENBQWM7SUFDbEMsVUFBVSxDQUFvQjtJQUN0QixRQUFRLENBQWM7SUFDdEIsb0JBQW9CLENBQWdCO0lBQ3BDLDZCQUE2QixDQUFtQjtJQUNoRCw2Q0FBNkMsQ0FBbUI7SUFDaEUsU0FBUyxHQUFRLEVBQUUsQ0FBQztJQUNwQixjQUFjLEdBQVcsQ0FBQyxDQUFDO0lBQzNCLGFBQWEsR0FBRyxJQUFJLEtBQUssRUFBaUIsQ0FBQztJQUVuRCxZQUFZLGFBQWdDO1FBQ3hDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQUUsT0FBTztRQUNuRCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUVuQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFHckMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRXJCLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNyRCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7UUFHdEQsSUFBSSxDQUFDLFNBQVMsQ0FBQywwQkFBMEIsR0FBRyxHQUFHLEVBQUU7WUFDN0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUU7Z0JBQ3pCLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7YUFDM0I7UUFDTCxDQUFDLENBQUE7UUFD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