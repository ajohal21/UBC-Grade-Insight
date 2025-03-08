import {Query} from "../types/Query";
import {Section} from "../types/Section";
import {Room} from "../types/Room";
import {SectionHelper} from "./SectionHelper";
import {RoomHelper} from "./RoomHelper";
import { InsightError } from "../IInsightFacade";

type ApplyRule = {
	[key: string]: {
		[aggFunc: string]: string;  // e.g., "MAX": "some_field"
	};
};

export class QueryHelper {

	/**
	 * Compares two sets to check if they contain the same elements.
	 *
	 * @param setA - The first set to compare.
	 * @param setB - The second set to compare.
	 * @returns `true` if the sets are equal, otherwise `false`.
	 */
	private static areSetsEqual(setA: Set<string>, setB: Set<string>): boolean {
		if (setA.size !== setB.size) {
			return false;
		}

		for (const item of setA) {
			if (!setB.has(item)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Processes the APPLY rules in the TRANSFORMATIONS section of the query.
	 *
	 * - Ensures each APPLY rule has exactly one key (the custom column name).
	 * - Extracts dataset IDs from the aggregation field used in APPLY.
	 * - Tracks added columns that must be referenced in OPTIONS.
	 *
	 * @param APPLY - An array of APPLY rules, each containing a single key-value pair.
	 * @param datasetIds - A set to store dataset IDs referenced in APPLY rules.
	 * @param addedColumnsTransformations - A set to track added columns from APPLY transformations.
	 * @throws InsightError if an APPLY rule is incorrectly formatted.
	 */
	private static processApplyRules(APPLY: Array<Record<string,
		Record<string, string>>>, datasetIds: Set<string>,
									 addedColumnsTransformations: Set<string>): void {
		APPLY.forEach((applyRule: ApplyRule) => {
			const applyKeys = Object.keys(applyRule);
			if (applyKeys.length !== 1) {
				throw new InsightError("Invalid APPLY rule: Each rule must have exactly one key.");
			}

			const applyKey = applyKeys[0]; // Extract added column name
			addedColumnsTransformations.add(applyKey);

			const applyObj = applyRule[applyKey]; // Get aggregation object

			if (typeof applyObj === "object" && applyObj !== null) {
				const field = Object.values(applyObj)[0]; // Extract field name

				if (typeof field === "string" && field.includes("_")) {
					datasetIds.add(field.split("_")[0]);
				}
			}
		});
	}

	/**
	 * Extracts dataset IDs from the TRANSFORMATIONS section of the query.
	 *
	 * - Validates that TRANSFORMATIONS only contains the allowed keys: GROUP and APPLY.
	 * - Ensures GROUP is a non-empty array and extracts dataset IDs from its fields.
	 * - Processes APPLY rules to extract dataset IDs and track added columns.
	 * - Verifies that all added columns in OPTIONS are used in APPLY.
	 *
	 * @param transformations - The TRANSFORMATIONS object from the query.
	 * @param datasetIds - A set to store dataset IDs referenced in GROUP and APPLY.
	 * @param addedColumns - A set containing columns added through APPLY transformations.
	 * @throws InsightError if the TRANSFORMATIONS section is invalid.
	 */
	private static extractDatasetIdsFromTransformations(transformations: any,
														datasetIds: Set<string>,
														addedColumns: Set<string>): void {
		const { GROUP, APPLY } = transformations;

		const validKeys = new Set(["GROUP", "APPLY"]);
		const transformationKeys = new Set(Object.keys(transformations));

		if (!this.areSetsEqual(validKeys, transformationKeys)) {
			throw new InsightError(
				`Invalid TRANSFORMATIONS: Contains unexpected keys. Allowed keys are ${Array.from(validKeys).join(", ")}.`
			);
		}

		if (!Array.isArray(GROUP) || GROUP.length === 0) {
			throw new InsightError("Invalid TRANSFORMATIONS: GROUP must be a non-empty array.");
		}

		if (!Array.isArray(APPLY)) {
			throw new InsightError("Invalid TRANSFORMATIONS: APPLY must be array.");
		}

		GROUP.forEach(column => {
			if (column.includes("_")) {
				datasetIds.add(column.split("_")[0]);
			}
		});

		const addedColumnsTransformations = new Set<string>();
		this.processApplyRules(APPLY, datasetIds, addedColumnsTransformations);

		if (!this.areSetsEqual(addedColumns, addedColumnsTransformations)) {
			throw new InsightError("Invalid TRANSFORMATIONS: All added columns in OPTIONS must be used in APPLY.");
		}
	}

	/**
	 * Processes the OPTIONS section of a query to extract dataset IDs and added columns.
	 * @param options - The OPTIONS part of the query, containing COLUMNS and optional ORDER.
	 * @param datasetIds - A set to store dataset IDs extracted from column references.
	 * @param addedColumns - A set to store columns that are not prefixed with a dataset ID.
	 * @throws InsightError if OPTIONS is missing required fields or ORDER is incorrectly formatted.
	 */
	private static processOptions(options: Query["OPTIONS"], datasetIds: Set<string>, addedColumns: Set<string>): void {
		if (!options?.COLUMNS) {
			throw new InsightError("Invalid OPTIONS: COLUMNS must be defined.");
		}

		// Handle COLUMNS
		options.COLUMNS.forEach(column => {
			if (column.includes("_")) {
				datasetIds.add(column.split("_")[0]);
			} else {
				addedColumns.add(column);
			}
		});

		// Handle ORDER
		if (options.ORDER) {
			if (typeof options.ORDER === "string") {
				// Single column order case
				const column = options.ORDER;
				if (column.includes("_")) {
					datasetIds.add(column.split("_")[0]);
				} else {
					addedColumns.add(column);
				}
			} else if (typeof options.ORDER === "object" && Array.isArray(options.ORDER.keys)) {

				if (options.ORDER.keys.length === 0) {
					throw new InsightError("Order key must be non zero array");
				}
				// Multiple keys in ORDER case
				options.ORDER.keys.forEach(column => {
					if (column.includes("_")) {
						datasetIds.add(column.split("_")[0]);
					} else {
						addedColumns.add(column);
					}
				});
			} else {
				throw new InsightError("Invalid ORDER format.");
			}
		}
	}

	/**
	 * Validates a query against dataset requirements.
	 * @param query - The query to validate.
	 * @param validKeys - The valid query keys possible for Sections and Rooms.
	 * @throws InsightError if the query is invalid.
	 */
	public static validateQuery(query: Query, validKeys: Set<string>): string {
		if (!query.WHERE || !query.OPTIONS?.COLUMNS) {
			throw new InsightError("Invalid query: Missing required fields (WHERE or OPTIONS).");
		}

		if (!(query.OPTIONS?.COLUMNS instanceof Array) || query.OPTIONS?.COLUMNS.length === 0) {
			throw new InsightError("Invalid query: Column must be non-empty array");
		}

		if (typeof query.OPTIONS.ORDER === "object" && Array.isArray(query.OPTIONS.ORDER.keys)) {
			const orderKeys = query.OPTIONS.ORDER.keys;
			const columns = new Set(query.OPTIONS.COLUMNS);

			// Ensure all ORDER keys exist in COLUMNS
			if (!orderKeys.every((key) => columns.has(key))) {
				throw new InsightError("All ORDER keys must be present in COLUMNS.");
			}
		}

		const datasetIds = new Set<string>();
		this.extractDatasetIds(query.WHERE, datasetIds, validKeys);

		query.OPTIONS.COLUMNS.forEach(column => {
			if (column.includes("_")) {  // Check if the column name has an underscore
				datasetIds.add(column.split("_")[0]); // Extract dataset ID if it does
			}
		});

		const addedColumns = new Set<string>();
		this.processOptions(query.OPTIONS, datasetIds, addedColumns);

		if (query.TRANSFORMATIONS) {
			this.validateTransformations(query.TRANSFORMATIONS, query.OPTIONS.COLUMNS);
			this.extractDatasetIdsFromTransformations(query.TRANSFORMATIONS, datasetIds, addedColumns);
		}

		if (datasetIds.size !== 1) {
			throw new InsightError(`Invalid query: Must reference exactly one dataset, found: ${Array.from(datasetIds).join(", ")}`);
		}

		return Array.from(datasetIds)[0];
	}

	/**
	 * Validates that all GROUP and APPLY keys in TRANSFORMATIONS are present in COLUMNS.
	 * @param transformations - The TRANSFORMATIONS object from the query.
	 * @param columns - The list of columns in OPTIONS.COLUMNS.
	 * @throws InsightError if GROUP or APPLY keys are missing in COLUMNS.
	 */
	private static validateTransformations(transformations: { GROUP: string[]; APPLY?: Array<Record<string,
			Record<string, string>>> }, columns: string[]): void {
		const columnsSet = new Set(columns);

		// Ensure GROUP is a valid array
		if (!Array.isArray(transformations.GROUP)) {
			throw new InsightError("Invalid query: GROUP must be an array.");
		}

		// Ensure APPLY is an array (or default to empty)
		const applyArray = transformations.APPLY ?? []; // Default to empty array if APPLY is undefined
		if (!Array.isArray(applyArray)) {
			throw new InsightError("Invalid query: APPLY must be an array.");
		}

		// Ensure all APPLY keys are in COLUMNS
		for (const applyRule of applyArray) {
			const applyKey = Object.keys(applyRule)[0]; // Get the APPLY key name
			if (!columnsSet.has(applyKey)) {
				throw new InsightError(`Invalid query: APPLY key '${applyKey}' must be present in COLUMNS.`);
			}
		}
	}

	/**
	 * Recursively extracts dataset IDs from query filters.
	 * @param obj - The query object containing filtering conditions.
	 * @param datasetIds - A set to store extracted dataset IDs.
	 * @param validKeys - The valid query keys possible for Sections and Rooms.
	 * @throws InsightError if an invalid query key is encountered.
	 */
	public static extractDatasetIds(obj: any, datasetIds: Set<string>, validKeys: Set<string>): void {
		if (typeof obj !== "object" || obj === null) return;
		for (const key in obj) {
			if (key.includes("_")) {
				const datasetId = key.split("_")[0];
				datasetIds.add(datasetId);
				const queryKey = key.split("_")[1];
				if (!validKeys.has(queryKey)) {
					throw new InsightError(`Invalid query key '${queryKey}'.`);
				}
			}
			this.extractDatasetIds(obj[key], datasetIds, validKeys);
		}
	}

	/**
	 * Validates numeric filters (GT, LT, EQ) in the WHERE clause.
	 * Ensures that the filter values are numbers.
	 *
	 * @param filter - The filter object to validate.
	 * @throws InsightError if the filter contains a non-numeric value.
	 */
	private static validateNumericFilter(filter: Record<string, any>): void {
		const [key, value] = Object.entries(filter)[0]; // Extract key-value pair

		if (typeof value !== "number" || isNaN(value)) {
			throw new InsightError(`Invalid numeric filter: ${key} must have a numeric value.`);
		}
	}

	/**
	 * Recursively evaluates a WHERE condition on a section.
	 * @param filter - The filter condition (e.g., "AND", "OR", "GT", "LT", "EQ", "IS").
	 * @param content - The section or room to evaluate against the filter.
	 * @returns `true` if the section satisfies the filter condition, otherwise `false`.
	 * @throws InsightError if the filter contains an unsupported condition type.
	 */
	public static evaluateCondition(filter: Record<string, any>, content: Section | Room): boolean {
		if (!filter || typeof filter !== "object" || Object.keys(filter).length !== 1) {
			throw new InsightError("Invalid WHERE clause: Malformed filter.");
		}

		const key = Object.keys(filter)[0];
		const value = filter[key];

		switch (key) {
			case "AND":
				if (!Array.isArray(value) || value.length === 0) {
					throw new InsightError("AND must contain a non-empty array of conditions.");
				}
				return value.every((subCondition) => this.evaluateCondition(subCondition, content));

			case "OR":
				if (!Array.isArray(value) || value.length === 0) {
					throw new InsightError("OR must contain a non-empty array of conditions.");
				}
				return value.some((subCondition) => this.evaluateCondition(subCondition, content));

			case "NOT":
				if (typeof value !== "object" || value === null) {
					throw new InsightError("NOT must contain a valid condition.");
				}
				return !this.evaluateCondition(value, content);

			case "IS":
				return this.handleComparator(key, value, content);

			case "GT":
			case "LT":
			case "EQ":
				const numValues = Object.values(value);
				if (numValues.length !== 1 || typeof numValues[0] !== "number")
					throw new InsightError(`Invalid numeric filter: ${key} must have a numeric value.`);
				return this.handleComparator(key, value, content);
			default:
				throw new InsightError(`Unsupported filter type: ${key}`);
		}
	}

	/**
	 * Evaluates a comparator condition ("GT", "LT", "EQ", "IS") on a given section or room.
	 * @param operator - The comparator operator to apply (e.g., "GT", "LT", "EQ", "IS").
	 * @param condition - The condition object containing the dataset key and its expected value.
	 * @param content - The section or room to evaluate against the condition.
	 * @returns `true` if the content satisfies the comparator condition, otherwise `false`.
	 * @throws InsightError if a numeric comparator ("GT", "LT", "EQ") is used on a non-numeric field.
	 */
	public static handleComparator(operator: "GT" | "LT" | "EQ" | "IS", condition: Record<string, any>, content: Section | Room): boolean {
		const datasetKey = Object.keys(condition)[0];
		const value = condition[datasetKey];

		const contentValue = content instanceof Section
			? SectionHelper.getSectionValue(content, datasetKey)
			: RoomHelper.getRoomValue(content, datasetKey);

		if (operator === "IS") {
			return this.handleISComparator(contentValue, value);
		}

		if (typeof contentValue !== "number") {
			throw new InsightError(`Invalid query: Numeric field expected for '${operator}' operator.`);
		}

		return operator === "GT" ? contentValue > value :
			operator === "LT" ? contentValue < value :
				operator === "EQ" ? contentValue === value : false;
	}

	/**
	 * Evaluates the "IS" comparator by checking if a string field matches a wildcard pattern.
	 * @param contentValue - The actual value of the field from the dataset.
	 * @param value - The pattern to match, where `*` acts as a wildcard.
	 * @returns `true` if the contentValue matches the wildcard pattern, otherwise `false`.
	 * @throws InsightError if the field is not a string.
	 */
	public static handleISComparator(contentValue: string | number, value: string): boolean {
		if (typeof contentValue !== "string") {
			throw new InsightError("Invalid query: String field expected for 'IS' operator.");
		}

		const middleWildcard = value.slice(1, -1).includes("*");
		if (middleWildcard) {
			throw new InsightError(`Invalid query: Wildcard '*' can only be at the beginning or end.`);
		}

		const regexPattern = "^" + value.replace(/\*/g, ".*") + "$";
		return new RegExp(regexPattern).test(contentValue);
	}
}
