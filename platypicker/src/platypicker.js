"use strict";

export default class Platypicker {
    static #selects = new Map();
    static #highlight;
    static maxHighlights = 100;
    static languageMap = {
        searchPlaceholder: "Type to filter...",
        selectAllButton: "Select all",
        selectNoneButton: "Select none"
    }

    #select;
    #popover;
    #listControls;
    #search;
    #isShown;
    #optionsChangeMutationObserver;

    #selectClickListener;
    #selectChangeListener;
    #selectKeydownListener;
    #popoverToggleListener;
    #popoverHideListener;

    get #isSearchEnabled() {
        return this.#select.dataset?.search?.trim()?.toLowerCase() === "true";
    }

    get #areControlsEnabled() {
        return this.#select.dataset.controls?.trim()?.toLowerCase() === "true";
    }

    static get(element) {
        return Platypicker.#selects.get(element);
    }

    constructor(selectElement) {
        if (Platypicker.#selects.has(selectElement) ||
            !window.matchMedia("(any-pointer: fine), (any-hover: hover)").matches)
            return;

        if (!selectElement["mutationObserver"]) {
            // Watch the select element's attributes for changes, mirroring their state in the input mock.
            selectElement["mutationObserver"] = new MutationObserver(() => {
                this.#search.classList.toggle("d-none", !this.#isSearchEnabled);
                for (const button of this.#listControls.querySelectorAll("button")) {
                    button.disabled = !this.#areControlsEnabled;
                }
            });
            selectElement["mutationObserver"].observe(selectElement, {
                attributes: true,
                attributeFilter: ["data-toggle", "data-search", "data-controls"]
            });
        }

        this.#select = selectElement;
        this.#setPopover();

        this.#select["popoverElement"] = this.#popover;
        this.#popover["selectElement"] = this.#select;

        this.#popover.querySelector("ul").addEventListener("click", e => {
            if (!this.#select.options?.length) return;

            let closestListItem = e.target.closest("li:not(:has(.dropdown-divider, .dropdown-header)) .dropdown-item:not(.disabled)");
            if (!closestListItem) return;

            if (this.#select.multiple) {
                closestListItem["option"].selected = !closestListItem["option"].selected;
            } else {
                this.#select.value = closestListItem["option"].value;
                this.#updatePopover();

                this.#popover.hidePopover();
                this.#isShown = undefined;
            }

            closestListItem.scrollIntoView({ block: "nearest", });

            if (!this.#select.multiple) this.#select.focus();
            this.#select.dispatchEvent(new Event("change", { bubbles: true }));
        });

        this.#selectChangeListener = async () => {
            if (!this.#select.options?.length) return;

            // Wait for any incomplete additions of options.
            await new Promise(resolve => requestAnimationFrame(resolve));

            this.#updatePopover();
        };
        this.#select.addEventListener("change", this.#selectChangeListener);

        this.#search.form.addEventListener("submit", e => e.preventDefault());
        this.#search.addEventListener("input", e => this.#filterPopover(e.target.value));
        this.#search.addEventListener("keydown", e => {
            if (e.code === "Escape") this.#select.click();
        });

        this.#selectClickListener = () => {
            this.#isShown = this.#popover.togglePopover(!this.#isShown);
            if (this.#isShown) this.#popover.querySelector("input:not(.d-none), .dropdown-item:not(.disabled, .d-none)")?.focus();
            else this.#select.focus();
        };
        this.#select.addEventListener("click", this.#selectClickListener);
        this.#popoverToggleListener = e => {
            if (this.#popover.contains(e.target) || this.#select.contains(e.target)) return;

            this.#popover.hidePopover();
            this.#isShown = undefined;
        };
        document.addEventListener("click", this.#popoverToggleListener);
        this.#popoverHideListener = e => {
            if (e.code !== "Escape") return;

            this.#popover.hidePopover();
            this.#isShown = undefined;
        };
        document.addEventListener("keydown", this.#popoverHideListener);

        this.#selectKeydownListener = e => {
            if (e.code === "Enter" || e.code === "Space" || e.code === "ArrowDown") this.#isShown = this.#popover.togglePopover(!this.#isShown);
        };
        this.#select.addEventListener("keydown", this.#selectKeydownListener, true);

        let debounced;
        let tempValue = "";
        this.#popover.addEventListener("keydown", e => {
            if (this.#search.contains(e.target)) return;

            let charCode = e.key.toLowerCase().charCodeAt(0);
            if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1 || charCode < 48 || (charCode > 57 && charCode < 97) || charCode > 122)
                return;

            tempValue += e.key.toLowerCase();
            let firstAvailableOption =
                [...this.#select.options].find(o =>
                    o !== this.#select.selectedOptions[0] &&
                    o.textContent.toLowerCase().trim().startsWith(tempValue) &&
                    !o.disabled &&
                    !o.closest("optgroup")?.disabled &&
                    !o["popoverItem"].classList.contains("d-none"));
            if (!firstAvailableOption) firstAvailableOption =
                this.#select.selectedOptions[0].textContent.toLowerCase().trim().startsWith(tempValue) &&
                !this.#select.selectedOptions[0].disabled &&
                !this.#select.selectedOptions[0].closest("optgroup")?.disabled &&
                !this.#select.selectedOptions[0]["popoverItem"].classList.contains("d-none")
                    ? this.#select.selectedOptions[0] : undefined;
            if (firstAvailableOption) {
                if (this.#select.multiple) {
                    this.#select.selectedIndex = -1;
                    firstAvailableOption.selected = true;
                    this.#select.dispatchEvent(new Event("change", { bubbles: true }));
                } else {
                    firstAvailableOption["popoverItem"].focus();
                }

                requestAnimationFrame(() => firstAvailableOption["popoverItem"]?.scrollIntoView({ block: "nearest", }));

                if (!debounced) debounced = Platypicker.#debounce(() => tempValue = "", 350);
                else debounced();
            } else {
                tempValue = "";
            }
        });

        this.#popover.querySelector("ul").addEventListener("keydown", e => {
            if (e.code === "Escape") {
                this.#isShown = this.#popover.togglePopover(false);
                this.#select.focus();
            }
        }, true);

        // Watch the select element's options for additions or removals, mirroring the structure every time.
        this.#optionsChangeMutationObserver = new MutationObserver(Platypicker.#debounce(() => {
            // If the options count has changed (added/removed options) or it has stayed the same, but some options
            // have been swapped (detected by the custom selectMenuOption property), regenerate the list items.
            // This helps to not needlessly regenerate every time the slightest change is made, or the options
            // have been manually regenerated by calling the #setListItems() method.
            if (this.#select.options.length !== this.#select.length ||
                [...this.#select.options].some(o => !o["option"]))
                this.#setListItems();
        }, 100));
        this.#optionsChangeMutationObserver.observe(selectElement, { childList: true, subtree: true });

        Platypicker.#selects.set(this.#select, this);
    }

    #setPopover() {
        this.#popover = document.createElement("div");
        this.#popover.classList.add("dropdown-menu", "rounded-3", "shadow", "p-0");
        this.#popover.popover = "manual";

        this.#select.parentElement.classList.add("dropdown");
        this.#select.classList.add("platypicker");
        this.#select.dataset.bsToggle = "dropdown";
        this.#select.insertAdjacentElement("afterend", this.#popover);

        this.#listControls = document.createElement("form");
        this.#listControls.classList.add("input-group", "p-2", "bg-body-tertiary", "border-bottom", "sticky-top");
        this.#popover.append(this.#listControls);

        this.#search = document.createElement("input");
        this.#search.classList.add("form-control", "form-control-sm");
        this.#search.type = "search";
        this.#search.name = "platypicker-search";
        this.#search.placeholder = Platypicker.languageMap.searchPlaceholder;
        this.#search.autofocus = true;
        if (!this.#isSearchEnabled) this.#search.classList.add("d-none");

        this.#listControls.append(this.#search);

        const selectAllButton = document.createElement("button");
        selectAllButton.classList.add("btn", "btn-outline-secondary", "btn-sm")
        selectAllButton.type = "button";
        selectAllButton.textContent = Platypicker.languageMap.selectAllButton;
        selectAllButton.addEventListener("click", () => {
            for (const option of [...this.#select.options].filter(o =>
                !o.disabled &&
                !o["popoverItem"].classList.contains("d-none") &&
                !o.closest("optgroup")?.disabled))
                option.selected = true;

            this.#select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        if (!this.#select.multiple || !this.#areControlsEnabled)
            selectAllButton.classList.add("d-none");

        this.#listControls.append(selectAllButton);

        const selectNoneButton = document.createElement("button");
        selectNoneButton.classList.add("btn", "btn-outline-secondary", "btn-sm");
        selectNoneButton.type = "button";
        selectNoneButton.textContent = Platypicker.languageMap.selectNoneButton;
        selectNoneButton.addEventListener("click", () => {
            this.#select.selectedIndex = -1;
            this.#select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        if (!this.#areControlsEnabled)
            selectNoneButton.classList.add("d-none");

        this.#listControls.append(selectNoneButton);

        this.#setListItems();
    }

    #setListItems() {
        let list = this.#popover.querySelector("ul");
        if (!list) {
            list = document.createElement("ul");
            list.classList.add("list-unstyled", "d-grid", "gap-1", "p-2", "mb-0");
            this.#popover.append(list);
        } else list.innerHTML = "";

        for (const child of this.#select.children) {
            if (child instanceof HTMLOptionElement) {
                this.#setItem(list, child);
            } else if (child instanceof HTMLOptGroupElement) {
                const listItem = document.createElement("li");
                list.append(listItem);
                const header = document.createElement("h6");
                header.classList.add("dropdown-header");
                header.textContent = child.label;
                listItem.append(header);

                header["optgroup"] = child;
                child["header"] = header;

                for (const option of child.children) {
                    this.#setItem(list, option);
                }

                if (child.nextElementSibling instanceof HTMLOptionElement) {
                    const dividerListItem = document.createElement("li");
                    list.append(dividerListItem);
                    const divider = document.createElement("hr");
                    divider.classList.add("dropdown-divider");
                    dividerListItem.append(divider);

                    divider["optgroup"] = child;
                    child["divider"] = divider;
                }
            } else if (child instanceof HTMLHRElement) {
                const listItem = document.createElement("li");
                list.append(listItem);
                const line = document.createElement("hr");
                line.classList.add("dropdown-divider");
                listItem.append(line);
            }
        }
    }

    #setItem(parent, option) {
        const listItem = document.createElement("li");
        parent.append(listItem);

        const item = document.createElement("button");
        item.classList.add("dropdown-item", "rounded-2");
        item.type = "button";
        item.textContent = option.textContent;
        if (option.title) item.title = option.title;

        listItem.append(item);

        const subtext = document.createElement("small");
        subtext.textContent = option.dataset.subtext;
        if (option.selected && !option.disabled)
            item.classList.add("active");
        if (option.disabled || option.closest("optgroup")?.disabled)
            item.classList.add("disabled");
        item.append(subtext);

        item["option"] = option;
        option["popoverItem"] = item;

        const searchValue = this.#search.value.trim().toLowerCase();
        if (searchValue) this.#adjustHighlightRange(item, searchValue);
    }

    #updatePopover() {
        const searchValue = this.#search.value.trim().toLowerCase();
        for (const item of this.#popover.querySelectorAll("li:not(:has(.dropdown-divider, .dropdown-header)) .dropdown-item")) {
            let hasContentBeenUpdated = false;
            if (item.childNodes[0].textContent !== item["option"].textContent) {
                // The list item might not have a text or value because
                // the select option doesn't have one either.
                item.childNodes[0].textContent = item["option"].textContent;
                hasContentBeenUpdated = true;
            }

            let subtextElement = item.querySelector("small");
            if (item["option"].dataset.subtext && subtextElement.textContent !== item["option"].dataset.subtext) {
                subtextElement.textContent = item["option"].dataset.subtext;
                hasContentBeenUpdated = true;
            }

            item.classList.remove("active");
            if (hasContentBeenUpdated && searchValue)
                this.#adjustHighlightRange(item, searchValue);
        }

        for (const selectedOption of this.#select.selectedOptions) {
            selectedOption["popoverItem"].classList.add("active");
        }
    }

    #adjustHighlightRange(item, searchValue) {
        searchValue = searchValue.trim().toLowerCase();

        const optionText = item["option"].textContent.trim().toLowerCase();
        let start = optionText.indexOf(searchValue);
        if (start >= 0 && Platypicker.#highlight.size < Platypicker.maxHighlights) {
            if (!item["textHighlightRange"]) item["textHighlightRange"] = new Range();

            item["textHighlightRange"].setStart(item.childNodes[0], start);
            item["textHighlightRange"].setEnd(item.childNodes[0], start + searchValue.length);
            Platypicker.#highlight.add(item["textHighlightRange"]);
        } else if (item["textHighlightRange"]) {
            Platypicker.#highlight.delete(item["textHighlightRange"]);
            delete item["textHighlightRange"];
        }

        const optionSubtext = item["option"].dataset.subtext?.trim().toLowerCase();
        if (!(optionSubtext && optionSubtext !== optionText)) return;

        start = optionSubtext.indexOf(searchValue);
        if (start >= 0 && Platypicker.#highlight.size < Platypicker.maxHighlights) {
            if (!item["subtextHighlightRange"]) item["subtextHighlightRange"] = new Range();

            const subtextNode = item.querySelector("small").childNodes[0]
            item["subtextHighlightRange"].setStart(subtextNode, start);
            item["subtextHighlightRange"].setEnd(subtextNode, start + searchValue.length);
            Platypicker.#highlight.add(item["subtextHighlightRange"]);
        } else if (item["subtextHighlightRange"]) {
            Platypicker.#highlight.delete(item["subtextHighlightRange"]);
            delete item["subtextHighlightRange"];
        }
    }

    #filterPopover(value, clearHighlights = true) {
        const sanitizedValue = value.trim().toLowerCase();
        if (!sanitizedValue) {
            for (const item of this.#popover.querySelectorAll("li .dropdown-item.d-none, li .dropdown-divider.d-none, li .dropdown-header.d-none")) {
                item.classList.remove("d-none");
            }

            if (clearHighlights) Platypicker.#highlight?.clear();
            return;
        }

        if (clearHighlights) Platypicker.#highlight?.clear();

        let optgroupIsPartiallyMatching = false;
        let optgroupElement = null;
        for (const item of this.#popover.querySelectorAll("li:not(:has(.dropdown-divider, .dropdown-header)) .dropdown-item")) {
            // if (item.classList.contains("dropdown-divider") &&
            //     item.parentElement.previousElementSibling.querySelector(".d-none") &&
            //     item.parentElement.nextElementSibling.querySelector(".d-none"))
            //     item.classList.add("d-none");

            const normalizedOptionText = item["option"].textContent.toLowerCase().trim();
            const normalizedOptionSubtext = item["option"].dataset.subtext?.toLowerCase().trim() ?? "";
            if (!item["option"].closest("optgroup") || item["option"].closest("optgroup") !== optgroupElement)
                optgroupIsPartiallyMatching = false;

            optgroupElement = item["option"].closest("optgroup");

            if (normalizedOptionText === sanitizedValue || normalizedOptionSubtext === sanitizedValue) {
                item.classList.remove("d-none");
                if (optgroupElement) {
                    optgroupIsPartiallyMatching = true;
                    optgroupElement["header"].classList.remove("d-none");
                    optgroupElement["divider"]?.classList.remove("d-none");
                }

                this.#adjustHighlightRange(item, sanitizedValue);
            } else if (normalizedOptionText.includes(sanitizedValue) || normalizedOptionSubtext.includes(sanitizedValue)) {
                // Case in which we have a partially matching option.
                item.classList.remove("d-none");
                if (optgroupElement) {
                    optgroupIsPartiallyMatching = true;
                    optgroupElement["header"].classList.remove("d-none");
                    optgroupElement["divider"]?.classList.remove("d-none");
                }

                this.#adjustHighlightRange(item, sanitizedValue);
            } else {
                // Case in which we have a non-matching option and must hide it.
                item.classList.add("d-none");
                if (optgroupElement && !optgroupIsPartiallyMatching) {
                    optgroupIsPartiallyMatching = true;
                    optgroupElement["header"].classList.add("d-none");
                    optgroupElement["divider"]?.classList.add("d-none");
                }

                this.#adjustHighlightRange(item, sanitizedValue);
            }
        }
    }

    static #init() {
        this.#highlight = new Highlight();
        CSS.highlights.set("platypicker-highlight", this.#highlight);

        for (const select of document.querySelectorAll("select[data-toggle=platypicker]")) {
            new Platypicker(select);
        }
    }

    static {
        Platypicker.#init();
    }

    destroy() {
        if (!Platypicker.#selects.has(this.#select)) return;

        this.#select.removeEventListener("change", this.#selectChangeListener);
        this.#select.removeEventListener("click", this.#selectClickListener);
        this.#select.removeEventListener("keydown", this.#selectKeydownListener);
        document.removeEventListener("click", this.#popoverToggleListener);
        document.removeEventListener("click", this.#popoverHideListener);

        // Disconnect all associated mutation observers.
        this.#optionsChangeMutationObserver.disconnect();

        this.#select.classList.remove("platypicker");
        this.#select.parentElement.classList.remove("dropdown");
        this.#select.removeAttribute("data-bs-toggle");

        // Remove the mocks from the DOM tree and the select collection.
        this.#popover.remove();
        Platypicker.#selects.delete(this.#select);

        this.#select = null;
        this.#popover = null;
        this.#listControls = null;
        this.#search = null;
        this.#isShown = null;
        this.#optionsChangeMutationObserver = null;

        this.#popoverToggleListener = null;
        this.#popoverHideListener = null;

        delete this;
    }

    static #debounce(func, wait = 50, immediate) {
        // The returned function will be able to reference this due to closure.
        // Each call to the returned function will share this common timer.
        let timeout;

        return function () {
            // reference the context and args for the setTimeout function
            const context = this,
                args = arguments;

            // Should the function be called now? If immediate is true
            //   and not already in a timeout, then the answer is: Yes
            const callNow = immediate && !timeout;

            // This is the basic debounced behavior where you can call this
            //   function several times, but it will only execute once
            //   [before or after imposing a delay].
            //   Each time the returned function is called, the timer starts over.
            clearTimeout(timeout);

            // Set the new timeout
            timeout = window.setTimeout(function () {
                // Inside the timeout function, clear the timeout variable
                // which will let the next execution run when in 'immediate' mode
                timeout = null;

                // Check if the function already ran with the immediate flag
                if (!immediate) {
                    // Call the original function with "apply".
                    // Apply lets you define the 'this' object as well as the arguments
                    //    (both captured before setTimeout)
                    func.apply(context, args);
                }
            }, wait);

            // Immediate mode and no wait timer? Execute the function.
            if (callNow) func.apply(context, args);
        };
    }
}