// @ts-ignore
import * as Redom from "redom";

export default class AtmosSelect {
    private static selects = new Map<HTMLSelectElement, AtmosSelect>();
    private static openedSelect: AtmosSelect;

    private selectElement: HTMLSelectElement;
    private buttonMock: HTMLButtonElement;
    private menuMock: HTMLElement;
    private selectedMenuItemMock: HTMLLIElement;
    private searchInputMock: HTMLInputElement;

    private optionsChangeMutationObserver: MutationObserver;
    private selectElementAttributesChangeMutationObserver: MutationObserver;
    private listeners: any = {};
    private visibleOptions: number = 0;
    private menuItemMocks = new Array<HTMLLIElement>();

    constructor(selectElement: HTMLSelectElement) {
        if (AtmosSelect.selects.has(selectElement)) return;
        this.selectElement = selectElement;

        selectElement.style.display = "none";

        // First, generate the extra elements.
        this.generateMocks();

        this.selectElement["selectButton"] = this.buttonMock;
        this.buttonMock["selectElement"] = this.selectElement;

        // If the hidden select element somehow gets focus, move that focus to the button mock and open the menu.
        this.listeners.selectElementFocusListener = () => {
            if (!selectElement.disabled) this.buttonMock.focus();
        }
        selectElement.addEventListener("focus", this.listeners.selectElementFocusListener);

        this.buttonMock.addEventListener("click", () => {
            if (this.hidden) {
                let result = this.selectElement.dispatchEvent(new CustomEvent("beforeshow.atmos-select", { cancelable: true }));
                if (!result) return;
            } else if (!this.visibleOptions && !this.isLiveSearchEnabled) {
                this.hide();
            }

            this.toggle();

            if (!this.hidden && this.isLiveSearchEnabled) requestAnimationFrame(() => this.searchInputMock.focus());
        });

        let debounced: () => void;
        let tempValue: string = "";
        // Keyboard navigation to match the native select element's feature
        this.buttonMock.addEventListener("keydown", (e) => {
            if (!this.selectElement.options?.length) return;

            if (e.code === "ArrowDown") {
                e.preventDefault();
                if (!this.visibleOptions) return;

                // If the user pressed the down arrow, search the first visible option below the currently selected one
                // or cycle back to the first visible one.
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption: HTMLLIElement;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[++i] as HTMLLIElement;
                    if (!nextOption) {
                        i = 0;
                        nextOption = this.menuItemMocks[0] as HTMLLIElement
                    }
                } while (!nextOption ||
                (previousOption && nextOption.selectOption.textContent === previousOption.selectOption.textContent) ||
                nextOption.classList.contains("hidden") ||
                nextOption.classList.contains("disabled"))

                this.selectElement.selectedIndex = -1;
                nextOption.selectOption.selected = true;

                selectElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));

                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            } else if (e.code === "ArrowUp") {
                e.preventDefault();
                if (!this.visibleOptions) return;

                // If the user pressed the up arrow, search the first visible option above the currently selected one
                // or cycle back to the last visible one.
                let nextOption = this.selectedMenuItemMock;
                let i = this.menuItemMocks.indexOf(nextOption);
                let previousOption: HTMLLIElement;
                do {
                    previousOption = nextOption;
                    nextOption = this.menuItemMocks[--i] as HTMLLIElement;
                    if (!nextOption) {
                        i = this.menuItemMocks.length - 1;
                        nextOption = this.menuItemMocks[this.menuItemMocks.length - 1] as HTMLLIElement
                    }
                } while (!nextOption ||
                (previousOption && nextOption.selectOption.textContent === previousOption.selectOption.textContent) ||
                nextOption.classList.contains("hidden") ||
                nextOption.classList.contains("disabled"))

                this.selectElement.selectedIndex = -1;
                nextOption.selectOption.selected = true;

                selectElement.dispatchEvent(new CustomEvent("change", {
                    bubbles: true,
                    detail: { filterMenu: false }
                }));

                this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });
            } else if (e.code === "Escape") {
                // Close the option menu on Escape key
                e.preventDefault();
                this.hide();
            } else if (e.code === "Enter") {
                // Toggle the option menu on Enter key
                e.preventDefault();
                this.toggle();

                if (!this.hidden && this.isLiveSearchEnabled) requestAnimationFrame(() => this.searchInputMock.focus());
            } else if (e.code === "Tab") {
                this.hide()
            } else {
                if (!this.isHiddenLiveSearchEnabled) return;

                let charCode = e.key.toLowerCase().charCodeAt(0);
                // If the input character is not a lowercase letter or number or a modifier key was pressed, ignore the input.
                if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1 || charCode < 48 || (charCode > 57 && charCode < 97) || charCode > 122)
                    return;

                tempValue += e.key.toLowerCase();
                let firstAvailableOption = [...this.selectElement.options].find(o =>
                    o.textContent.toLowerCase().trim().includes(tempValue) ||
                    o.value.toLowerCase().trim().includes(tempValue));
                if (firstAvailableOption) {
                    this.selectElement.selectedIndex = -1;
                    firstAvailableOption.selected = true;
                    this.selectElement.dispatchEvent(new Event("change"));

                    if (!debounced) debounced = AtmosSelect.debounce(() => tempValue = "", 350);
                    else debounced();
                } else {
                    tempValue = "";
                }
            }
        });

        this.searchInputMock.addEventListener("keydown", (e) => {
            if (this.hidden || !this.selectElement.options?.length) return;

            if (e.code === "Enter") {
                // Toggle the option menu on Enter key
                e.preventDefault();
                this.toggle();
                this.buttonMock.focus();
            } else if (e.code === "ArrowDown" || e.code === "ArrowUp") {
                e.preventDefault();
                this.buttonMock.dispatchEvent(new KeyboardEvent("keydown", { code: e.code }));
            }
        });

        // When the select element gets its selected option changed for whatever reason,
        // also update the selected value in the select menu.
        this.listeners.selectElementChangeListener = async () => {
            // Wait for any incomplete additions of options.
            await new Promise(resolve => requestAnimationFrame(resolve));

            if (!this.selectElement.options?.length) return;

            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
            this.updateButtonMockTitle(this.selectElement.selectedOptions[0]?.title);

            this.updateMenuMock([...this.selectElement.selectedOptions]);

            if (!this.visibleOptions) this.hide();
        };
        selectElement.addEventListener("change", this.listeners.selectElementChangeListener);

        let inputListener = () => {
            this.filterMenuMock(this.searchInputMock.value);
            this.positionMenuMock();
        }
        this.searchInputMock.addEventListener("input", inputListener);
        this.searchInputMock.addEventListener("change", inputListener);

        // When the user clicks on an option in the menu mock, select the option in the select element
        // and set the input mock value to it.
        this.menuMock.addEventListener("click", e => {
            if (!this.selectElement.options?.length) return;

            let target = (<HTMLElement>e.target).closest<HTMLLIElement>(".atmos-select-menu-item");
            if (!target) return;

            if (target.classList.contains("disabled")) return;

            this.updateSelectElement(this.menuItemMocks.indexOf(target));

            this.selectedMenuItemMock = target;

            this.selectedMenuItemMock?.scrollIntoView({ block: "nearest", });

            this.selectElement.dispatchEvent(new CustomEvent("change", {
                bubbles: true,
                detail: { filterMenu: false }
            }));
        });

        // When the user clicks on any of the hidden select element's labels, focus the button mock instead.
        this.listeners.labelClickListener = (e: MouseEvent) => {
            e.stopPropagation();
            this.buttonMock.focus();
        }
        for (const label of this.selectElement.labels) {
            label?.addEventListener("click", this.listeners.labelClickListener);
        }

        // Watch the select element's options for additions or removals, mirroring the structure every time.
        this.optionsChangeMutationObserver = new MutationObserver(() => {
            this.generateOptionMocks();
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        });
        this.optionsChangeMutationObserver.observe(selectElement, {
            childList: true
        });

        // Watch the select element's attributes for changes, mirroring their state in the input mock.
        this.selectElementAttributesChangeMutationObserver = new MutationObserver(() => {
            this.buttonMock.disabled = this.selectElement.disabled;
            this.buttonMock.title = this.selectElement.title;

            if (this.isLiveSearchEnabled) {
                this.searchInputMock.classList.remove("hidden");
            } else {
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

    private get isLiveSearchEnabled() {
        return this.selectElement.dataset?.liveSearch === "true";
    }

    private get isHiddenLiveSearchEnabled() {
        return this.selectElement.dataset?.hiddenLiveSearch !== "false";
    }

    private get isSubtextShown() {
        return this.selectElement.dataset.subtext === "true";
    }

    private get placeholder() {
        return this.selectElement.dataset.placeholder;
    }

    private get hidden() {
        return this.menuMock.classList.contains("hidden");
    }

    static init() {
        let selectElements = document.querySelectorAll<HTMLSelectElement>("[data-toggle=select]");

        // Autodetect and create a select component for each select element found.
        for (const selectElement of selectElements) {
            new AtmosSelect(selectElement);
        }

        // Place an observer to create a select whenever a select element with a select toggle gets added.
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLElement)) continue;

                    let toggles = [];
                    if (addedNode.dataset?.toggle === "select") toggles.push(addedNode as HTMLSelectElement);
                    toggles.push(...addedNode.querySelectorAll<HTMLSelectElement>("[data-toggle=select]"));

                    for (const toggle of toggles) {
                        // Skip initialization if component has already been initialized before detection.
                        if (this.selects.has(toggle)) continue;

                        new AtmosSelect(toggle);
                    }
                }

                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement)) continue;

                    let toggles = [];
                    if (removedNode.dataset?.toggle === "select") toggles.push(removedNode as HTMLSelectElement);
                    toggles.push(...removedNode.querySelectorAll<HTMLSelectElement>("[data-toggle=select]"));

                    for (const toggle of toggles) {
                        AtmosSelect.get(toggle)?.destroy();
                    }
                }
            }
        }).observe(document, {
            childList: true,
            subtree: true
        });

        // When the user clicks somewhere else, close the opened menu mock.
        document.addEventListener("click", (e) => {
            // There is no menu open, and we don't need to execute more logic.
            if (!AtmosSelect.openedSelect) return;

            let target = e.target as HTMLElement;
            if (target.closest(".atmos-select-menu") === AtmosSelect.openedSelect.menuMock) {
                // Don't close the menu if the user clicks inside of it.

                if (target.closest(".atmos-select-menu-item.disabled")) {
                    // Don't close the menu if the user clicks on a disabled option.
                    return;
                } else if (AtmosSelect.openedSelect.selectElement.multiple) {
                    return;
                } else if (target.closest(".atmos-select-menu-optgroup") &&
                    !target.closest(".atmos-select-menu-item")) {
                    return;
                } else if (target.closest(".atmos-select-menu-control")) {
                    return;
                }
            } else if (target.closest(".atmos-select-button") === AtmosSelect.openedSelect.buttonMock) {
                // Don't close the menu if the user clicks on the button mock.
                return;
            }

            AtmosSelect.openedSelect.hide();
        });

        // Reposition the menu mock when the user resizes the container in any way (for example Ctrl+Scroll).
        window.addEventListener("resize", () => {
            if (!AtmosSelect.openedSelect) return;

            if (!AtmosSelect.openedSelect.hidden) AtmosSelect.openedSelect.positionMenuMock();
        });

        let initialRect: DOMRect;
        // Scroll-linked positioning for the menu mock. Disabled until a more elegant way is found to
        // position menu without causing so much reflow and triggering browser warnings.
        window.addEventListener("scroll", (e) => {
            if (!AtmosSelect.openedSelect || AtmosSelect.openedSelect.hidden || e.target === AtmosSelect.openedSelect.menuMock) return;

            let buttonRect = AtmosSelect.openedSelect.buttonMock.getBoundingClientRect();
            if (!initialRect) initialRect = buttonRect;

            AtmosSelect.openedSelect.menuMock.style.transform =
                `translate(${buttonRect.right - initialRect.right}px, ${buttonRect.bottom - initialRect.bottom}px)`;
        }, { capture: true, passive: true });

        window.addEventListener("scrollend", (e) => {
            if (!AtmosSelect.openedSelect || AtmosSelect.openedSelect.hidden || e.target === AtmosSelect.openedSelect.menuMock) return;

            AtmosSelect.openedSelect.positionMenuMock();
            initialRect = null;
        }, { capture: true, passive: true });
    }

    static get(element: HTMLSelectElement) {
        return this.selects.get(element);
    }

    hide() {
        this.menuMock.classList.add("hidden");

        AtmosSelect.openedSelect = null;

        this.menuMock.dispatchEvent(new CustomEvent("hide.atmos-select"));
    }

    show() {
        if (!this.visibleOptions && !this.isLiveSearchEnabled) return;

        // First hide other menu mocks, since only one needs to be shown at one time.
        if (!AtmosSelect.openedSelect?.hidden) AtmosSelect.openedSelect?.hide();

        this.menuMock.classList.remove("hidden");

        AtmosSelect.openedSelect = this;

        this.menuMock.dispatchEvent(new CustomEvent("show.atmos-select"));
    }

    toggle() {
        if (!this.visibleOptions && this.hidden && !this.isLiveSearchEnabled) return;

        if (this.hidden) {
            // First hide other menu mocks, since only one needs to be shown at one time.
            if (!AtmosSelect.openedSelect?.hidden) AtmosSelect.openedSelect?.hide();
        }

        this.menuMock.classList.toggle("hidden");
        this.positionMenuMock();

        let customEvent: CustomEvent;
        if (!this.menuMock.classList.contains("hidden")) {
            customEvent = new CustomEvent("show.atmos-select");
            AtmosSelect.openedSelect = this;
        } else {
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
        // Wait for any incomplete additions of options.
        await new Promise(resolve => requestAnimationFrame(resolve));

        this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        this.updateButtonMockTitle(this.selectElement.selectedOptions[0]?.title);

        if (!this.selectElement.options?.length) return;

        this.updateMenuMock([...this.selectElement.selectedOptions]);
    }

    destroy() {
        // First remove all associated event listeners on elements that will remain.
        // The rest of the listeners will be removed when we remove the mocks.
        this.selectElement.removeEventListener("focus", this.listeners.selectElementFocusListener);
        this.selectElement.removeEventListener("change", this.listeners.selectElementChangeListener);
        for (const label of this.selectElement.labels) {
            label.removeEventListener("click", this.listeners.labelClickListener);
        }

        // Disconnect all associated mutation observers.
        this.optionsChangeMutationObserver.disconnect();
        this.selectElementAttributesChangeMutationObserver.disconnect();

        // Remove the mocks from the DOM tree and the select collection.
        this.buttonMock.remove();
        this.menuMock.remove();
        AtmosSelect.selects.delete(this.selectElement);

        if (AtmosSelect.openedSelect === this) AtmosSelect.openedSelect = null;

        // Show the original select element
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

    private updateSelectElement(selectedOptionIndex: number) {
        if (!this.selectElement.multiple) {
            this.selectElement.selectedIndex = selectedOptionIndex;
        } else {
            this.selectElement.options[selectedOptionIndex].selected =
                !this.selectElement.options[selectedOptionIndex].selected;
        }
    }

    private updateButtonMock(values: string[]) {
        if (!this.selectElement.multiple) {
            if (!values.length || !values[0] === null || values[0] === undefined)
                values[0] = this.placeholder ?? "None selected";

            this.buttonMock.childNodes[0].textContent = values?.[0]?.toString();
        } else {
            this.buttonMock.childNodes[0].textContent =
                values.length <= 3 ? values.join(", ") || this.placeholder : `${values.length} options selected`;
        }
    }

    private updateButtonMockTitle(value?: string) {
        if (!value === null || value === undefined) value = "";

        this.buttonMock.title = value?.toString();
    }

    private updateMenuMock(selectedOptions: HTMLOptionElement[]) {
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

    private filterMenuMock(value: string) {
        console.debug(`Filtering menu.`);

        this.visibleOptions = 0;

        // If input value is empty, show all the options.
        if (!value) {
            for (const menuItemMock of this.menuMock.querySelectorAll(".atmos-select-menu-item.hidden")) {
                menuItemMock.classList.remove("hidden");
            }

            this.visibleOptions = this.selectElement.children.length;
            return;
        }

        // Iterate the available options
        for (const menuItemMock of this.menuItemMocks) {
            // First normalize the values before comparing them.
            let normalizedOptionText = menuItemMock.selectOption.textContent.toLowerCase().trim();
            let normalizedOptionValue = menuItemMock.selectOption.value.toLowerCase().trim();
            let normalizedText = value.toLowerCase().trim();
            if (menuItemMock.selectOption.textContent === value || menuItemMock.selectOption.value === value) {
                // Case in which we have a perfectly matching option.
                // Show the option mock.
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");

                this.visibleOptions++;
            } else if (normalizedOptionText.includes(normalizedText) || normalizedOptionValue.includes(normalizedText)) {
                // Case in which we have a partially matching option.
                menuItemMock.classList.remove("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.remove("hidden");

                this.visibleOptions++;
            } else {
                // Case in which we have a non-matching option and must hide it.
                menuItemMock.classList.add("hidden");
                if (menuItemMock.parentElement.classList.contains("atmos-select-menu-optgroup"))
                    menuItemMock.parentElement.classList.add("hidden");
            }
        }

        let visibleMenuItemMocksWithHiddenOptgroup =
            this.menuMock.querySelectorAll(".atmos-select-menu-optgroup.hidden .atmos-select-menu-item:not(.hidden)");
        for (const menuItemMock of visibleMenuItemMocksWithHiddenOptgroup) {
            menuItemMock.parentElement.classList.remove("hidden");
        }
    }

    private positionMenuMock() {
        this.menuMock.style.removeProperty("height");

        let buttonRect = this.buttonMock.getBoundingClientRect();
        let menuRect = this.menuMock.getBoundingClientRect();

        if (buttonRect.bottom + menuRect.height + 15 > window.innerHeight && buttonRect.top - 15 < menuRect.height) {
            // If the menu can't be positioned either on top or bottom of the button mock,
            // position it below the input and limit its height.
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
            this.menuMock.style.height = `${window.innerHeight - buttonRect.bottom - 10}px`;
        } else if (buttonRect.bottom + menuRect.height + 15 > window.innerHeight) {
            // If there isn't enough space to position the menu below the button mock, position it above it instead.
            this.menuMock.style.top = `${buttonRect.top - menuRect.height - 5 + window.scrollY}px`;
        } else {
            // Else position the menu directly below the button element, with a little margin.
            this.menuMock.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
        }

        console.debug(`Positioning menu to ${buttonRect.width}, ${buttonRect.left}.`);
        // Set the option menu's width to the button's width.
        this.menuMock.style.minWidth = `${buttonRect.width}px`;
        this.menuMock.style.left = `${buttonRect.left}px`;

        this.menuMock.style.removeProperty("transform");
    }

    private generateMocks() {
        let buttonMock = Redom.el("button.atmos-select-button", this.placeholder ?? "None selected", {
            type: "button",
            disabled: this.selectElement.disabled,
            title: this.selectElement.title
        }) as HTMLButtonElement;
        this.selectElement.insertAdjacentElement("afterend", buttonMock);
        
        this.buttonMock = buttonMock;
        if (this.selectElement.selectedIndex >= 0) {
            this.updateButtonMock([...this.selectElement.selectedOptions]?.map(so => so.textContent.trim()));
        }

        // Create the dropdown and insert it at the end of the body element,
        // since if placed in an overflowing container it might become partly hidden.
        let menuMock = Redom.el("ul.atmos-select-menu.hidden") as HTMLUListElement;
        if (this.selectElement.id) menuMock.dataset.origin = this.selectElement.id;
        Redom.mount(document.body, menuMock);
        this.menuMock = menuMock;

        let searchMock = Redom.el("li.atmos-select-menu-control", Redom.el("input"));
        this.searchInputMock = searchMock.children[0] as HTMLInputElement;
        if (!this.isLiveSearchEnabled) this.searchInputMock.classList.add("hidden");
        Redom.mount(this.menuMock, searchMock);

        // Generate the option elements in the dropdown
        this.generateOptionMocks();
    }

    private generateOptionMocks() {
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
            } else if (child instanceof HTMLOptionElement) {
                this.generateOptionMock(this.menuMock, child);
            }
        }

        this.visibleOptions = this.selectElement.options.length;
    }

    private generateOptionMock(parent: HTMLElement, option: HTMLOptionElement) {
        // Create an option element with its tick box, which will remain hidden until the element is selected.
        let menuItemMock = <HTMLLIElement>Redom.el("li.atmos-select-menu-item", option.textContent, {
            title: option.title
        });
        Redom.mount(parent, menuItemMock);

        if (option.value !== option.textContent && this.isSubtextShown) {
            let menuItemSubtext = Redom.el("small.atmos-select-menu-item-value", option.value);
            Redom.mount(menuItemMock, menuItemSubtext);
        }

        menuItemMock["selectOption"] = option;
        option["selectMenuOption"] = menuItemMock as HTMLLIElement;

        if (option.selected && !option.disabled) {
            menuItemMock.classList.add("selected");
            this.selectedMenuItemMock = menuItemMock as HTMLLIElement;
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

        this.menuItemMocks.push(menuItemMock);
    }

    private static debounce(
        func: Function,
        wait: number = 50,
        immediate?: boolean
    ): any {
        // 'private' variable for instance
        // The returned function will be able to reference this due to closure.
        // Each call to the returned function will share this common timer.
        let timeout;

        // Calling debounce returns a new anonymous function
        return function () {
            // reference the context and args for the setTimeout function
            const context = this,
                args = arguments;

            // Should the function be called now? If immediate is true
            //   and not already in a timeout then the answer is: Yes
            const callNow = immediate && !timeout;

            // This is the basic debounce behaviour where you can call this
            //   function several times, but it will only execute once
            //   [before or after imposing a delay].
            //   Each time the returned function is called, the timer starts over.
            clearTimeout(timeout);

            // Set the new timeout
            timeout = setTimeout(function () {
                // Inside the timeout function, clear the timeout variable
                // which will let the next execution run when in 'immediate' mode
                timeout = null;

                // Check if the function already ran with the immediate flag
                if (!immediate) {
                    // Call the original function with apply
                    // apply lets you define the 'this' object as well as the arguments
                    //    (both captured before setTimeout)
                    func.apply(context, args);
                }
            }, wait);

            // Immediate mode and no wait timer? Execute the function..
            if (callNow) func.apply(context, args);
        };
    }
}

window["AtmosSelect"] = AtmosSelect;
AtmosSelect.init();