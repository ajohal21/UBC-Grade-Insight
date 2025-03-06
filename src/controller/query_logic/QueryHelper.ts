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
	 * Checks if two sets contain the same elements.
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
	 * Extracts dataset IDs from TRANSFORMATIONS.
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

		const datasetIds = new Set<string>();
		this.extractDatasetIds(query.WHERE, datasetIds, validKeys);

		// query.OPTIONS.COLUMNS.forEach(column => {
		// 	if (column.includes("_")) {  // Check if the column name has an underscore
		// 		datasetIds.add(column.split("_")[0]); // Extract dataset ID if it does
		// 	} else {
		// 		datasetIds.add("sections"); // Otherwise, assume it's from the "sections" dataset
		// 	}
		// });
		// const datasetMappings: { [key: string]: string } = {
		// 	"someRoomColumn": "rooms",
		// 	"someSectionColumn": "sections",
		// };

		const addedColumns = new Set<string>();
		this.processOptions(query.OPTIONS, datasetIds, addedColumns);

		if (query.TRANSFORMATIONS) {
			this.extractDatasetIdsFromTransformations(query.TRANSFORMATIONS, datasetIds, addedColumns);
		}

		if (datasetIds.size !== 1) {
			throw new InsightError(`Invalid query: Must reference exactly one dataset, found: ${Array.from(datasetIds).join(", ")}`);
		}

		return Array.from(datasetIds)[0];
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
	 * Recursively evaluates a WHERE condition on a section.
	 * @param filter - The filter condition (e.g., "AND", "OR", "GT", "LT", "EQ", "IS").
	 * @param content - The section or room to evaluate against the filter.
	 * @returns `true` if the section satisfies the filter condition, otherwise `false`.
	 * @throws InsightError if the filter contains an unsupported condition type.
	 */
	public static evaluateCondition(filter: Record<string, any>, content: Section | Room): boolean {
		const key = Object.keys(filter)[0];
		switch (key) {
			case "AND":
				return filter.AND.every((subCondition: any) => this.evaluateCondition(subCondition, content));
			case "OR":
				return filter.OR.some((subCondition: any) => this.evaluateCondition(subCondition, content));
			case "NOT":
				return !this.evaluateCondition(filter.NOT, content);
			case "GT":
			case "LT":
			case "EQ":
			case "IS":
				return this.handleComparator(key, filter[key], content);
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
