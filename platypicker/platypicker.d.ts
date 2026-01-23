declare class Platypicker {
    /**
     * Maximum number of highlights in search results
     */
    static maxHighlights: number;

    /**
     * Localization strings
     */
    static languageMap: {
        searchPlaceholder: string;
        selectAllButton: string;
        selectNoneButton: string;
        [key: string]: string;
    };

    /**
     * Retrieve the Platypicker instance for a select element
     */
    static get(element: HTMLSelectElement): Platypicker | undefined;

    /**
     * Destroy this Platypicker instance, remove listeners and DOM mocks
     */
    destroy(): void;

    /**
     * Creates a new Platypicker for a <select> element
     * @param selectElement The <select> element to enhance
     */
    constructor(selectElement: HTMLSelectElement);
}

export default Platypicker;
