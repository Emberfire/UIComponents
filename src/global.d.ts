interface HTMLSelectElement {
    selectButton: HTMLButtonElement;
}
interface HTMLButtonElement {
    selectElement: HTMLSelectElement;
}

interface HTMLOptionElement {
    selectMenuOption: HTMLLIElement;
}

interface HTMLLIElement {
    selectOption: HTMLOptionElement;
    textHighlightRange: Range;
    subtextHighlightRange: Range;
}