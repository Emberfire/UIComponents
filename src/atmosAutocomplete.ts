import * as Redom from "redom";
import {Utils} from "./utils";

export default class Select {
    private static selectButtonMockTemplate =
        `<button class="form-field select relative" type="button">
            <span class="flex items-center select-current-selection"></span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <i class="fi fi-rr-sort text-gray-500 pt-1" title="Open menu"></i>
            </span>
        </button>`;
    private static selectMenuMockTemplate =
        `<ul class="select-menu mt-1 hidden dark:border dark:border-gray-700"></ul>`;
    private static selectMenuItemMockTemplate =
        `<li class="relative flex cursor-pointer select-none items-center justify-between px-3 py-2 text-gray-900 select-menu-item hover:bg-indigo-600 hover:text-white dark:text-slate-200">
            <span class="block truncate font-normal select-menu-item-text"></span>
            <span class="pl-4 text-indigo-600 select-menu-item-tick">
                <img src="/src/img/icon/check.png" alt="Close" title="Close" class="h-4 w-auto">
            </span>
        </li>`;

    private static selects = new Map<HTMLElement, Select>();

    private selectElement: HTMLSelectElement;
    private selectButtonMock: HTMLButtonElement;
    private selectMenuMock: HTMLElement;

    constructor(selectElement: HTMLSelectElement) {
        let { selectButtonMock, selectMenuMock } = this.generateSelectMock(selectElement);
        this.updateSelectMenu(selectElement, selectMenuMock, selectButtonMock);

        selectButtonMock.addEventListener("click", () => {
            if (!selectElement.disabled) {
                this.toggle();
            }
        });

        selectElement.addEventListener("focus", () => {
            if (!selectElement.disabled) {
                this.selectButtonMock.focus();
            }
        });

        selectButtonMock.addEventListener("keydown", (e) => {
            if (e.code === "ArrowDown") {
                e.preventDefault();

                selectElement.selectedIndex += 1;
                if (selectElement.selectedIndex < 0) {
                    selectElement.selectedIndex = 0;
                }

                selectElement.dispatchEvent(new Event("change"));
            } else if (e.code === "ArrowUp") {
                e.preventDefault();

                selectElement.selectedIndex -= 1;
                if (selectElement.selectedIndex < 0) {
                    selectElement.selectedIndex = selectElement.options.length - 1;
                }

                selectElement.dispatchEvent(new Event("change"));
            } else if (e.code === "Escape") {
                e.preventDefault();
                this.hide();
            } else if (e.code === "Enter") {
                e.preventDefault();
                this.toggle();
            }
        });

        selectElement.addEventListener("change", () => this.updateSelectMenu(selectElement, selectMenuMock, selectButtonMock));

        selectMenuMock.addEventListener("click", e => {
            let target = (<HTMLElement>e.target).closest(".select-menu-item") as HTMLElement;
            if (!target) return;

            selectElement.selectedIndex = [ ...selectMenuMock.children ].indexOf(target);

            selectElement.dispatchEvent(new Event("change"));
        });

        document.addEventListener("click", (e) => {
            let target = e.target as HTMLElement;
            if (target.closest(".select-menu") === selectMenuMock) {
                // return;
            } else if (target.closest(".select") === selectButtonMock) {
                return;
            }

            this.hide();
        });

        new MutationObserver(() => {
            this.generateSelectMenuChildren(selectElement, selectMenuMock);
        }).observe(selectElement, {
            childList: true
        });

        new MutationObserver(() => {
            selectButtonMock.disabled = selectElement.disabled;
        }).observe(selectElement, {
            attributes: true,
            attributeFilter: [ "disabled" ]
        });

        selectElement.style.display = "none";

        this.selectElement = selectElement;
        this.selectButtonMock = selectButtonMock;
        this.selectMenuMock = selectMenuMock;
    }

    static init() {
        let selectElements = document.querySelectorAll<HTMLSelectElement>("[data-toggle='select']");

        for (const selectElement of selectElements) {
            // if (!selectElement.options.length) return console.warn("Select element has no options! Skipping initialization.", selectElement);

            let select = new Select(selectElement);
            this.selects.set(selectElement, select);
        }

        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (!(addedNode instanceof HTMLElement)) continue;

                    let toggles = addedNode.dataset.toggle === "select" ? [addedNode] : [];
                    toggles.push(...addedNode.querySelectorAll<HTMLSelectElement>("[data-toggle=select]"));

                    for (const toggle of toggles) {
                        let select = new Select((<HTMLSelectElement>toggle));
                        this.selects.set(toggle, select);
                    }
                }

                for (const removedNode of mutation.removedNodes) {
                    if (!(removedNode instanceof HTMLElement)) continue;

                    let toggles = removedNode.dataset.toggle === "select" ? [removedNode] : [];
                    toggles.push(...removedNode.querySelectorAll<HTMLElement>("[data-toggle=modal]"));

                    for (const toggle of toggles) {
                        this.selects.delete(toggle);
                    }
                }
            }
        }).observe(document, {
            childList: true,
            subtree: true
        });
    }

    hide() {
        this.selectMenuMock.classList.add("hidden");

        this.selectMenuMock.dispatchEvent(new CustomEvent("hide.select"));
    }

    show() {
        this.selectMenuMock.classList.remove("hidden");
        this.positionMenu();

        this.selectMenuMock.dispatchEvent(new CustomEvent("show.select"));
    }

    toggle() {
        this.selectMenuMock.classList.toggle("hidden");
        this.positionMenu();

        let customEvent = this.selectMenuMock.classList.contains("hidden")
            ? new CustomEvent("hide.select")
            : new CustomEvent("show.select");
        this.selectMenuMock.dispatchEvent(customEvent);
    }

    updateSelectMenu(selectElement: HTMLSelectElement, selectMenuMock: HTMLElement, selectMock: HTMLButtonElement) {
        let selectedMockOption = selectMenuMock.children[Math.max(0, selectElement.selectedIndex)];

        selectMenuMock.querySelector(".selected")?.classList.remove("selected");
        selectedMockOption.classList.add("selected");
        selectMock.querySelector(".select-current-selection").textContent = selectedMockOption.textContent;
    }

    private generateSelectMenuChildren(selectElement: HTMLSelectElement, selectMenuMock: HTMLElement) {
        Redom.setChildren(selectMenuMock, []);

        for (const option of selectElement.options) {
            let selectMenuItemMock = Utils.htmlToElement(Select.selectMenuItemMockTemplate);
            let itemTextElement = selectMenuItemMock.querySelector(".select-menu-item-text");
            if (option.textContent.trim()) {
                itemTextElement.textContent = option.textContent;
            } else {
                itemTextElement.innerHTML = "&nbsp;"
            }

            Redom.mount(selectMenuMock, selectMenuItemMock);
        }
    }

    private positionMenu() {
        let buttonRect = this.selectButtonMock.getBoundingClientRect();
        let menuRect = this.selectMenuMock.getBoundingClientRect();
        if (buttonRect.top + buttonRect.height + menuRect.height + 4 > window.innerHeight) {
            this.selectMenuMock.style.top = `${buttonRect.top - menuRect.height - 10 + window.scrollY}px`;
        } else {
            this.selectMenuMock.style.top = `${buttonRect.top + buttonRect.height + window.scrollY}px`;
        }

        this.selectMenuMock.style.width = `${buttonRect.width}px`;
        this.selectMenuMock.style.left = `${buttonRect.left}px`;
    }

    private generateSelectMock(selectElement: HTMLSelectElement) {
        let selectButtonMock = Utils.htmlToElement<HTMLButtonElement>(Select.selectButtonMockTemplate);
        selectButtonMock.disabled = selectElement.disabled;
        selectElement.insertAdjacentElement("afterend", selectButtonMock);

        let selectMenuMock = Utils.htmlToElement<HTMLUListElement>(Select.selectMenuMockTemplate);
        Redom.mount(document.body, selectMenuMock);

        this.generateSelectMenuChildren(selectElement, selectMenuMock);

        return { selectButtonMock, selectMenuMock };
    }
}