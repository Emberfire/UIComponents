interface HTMLOptionElement {
    selectMenuOption: HTMLLIElement;
}

interface HTMLLIElement {
    selectOption: HTMLOptionElement;
    textHighlightRange: Range;
    subtextHighlightRange: Range;
}