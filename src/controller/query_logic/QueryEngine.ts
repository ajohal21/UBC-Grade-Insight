import { Dataset } from "../types/Dataset";
import { DatasetProcessor } from "../DatasetProcessor";
import { Section } from "../types/Section";
import { Room } from "../types/Room";
import { Query } from "../types/Query";
import { SectionHelper } from "./SectionHelper";
import { RoomHelper } from "./RoomHelper";
import { QueryHelper } from "./QueryHelper";
import { InsightError, InsightResult, ResultTooLargeError } from "../IInsightFacade";

export class QueryEngine {
	private limit: number = 5000;
	private validKeys = new Set([
		// Section keys
		"avg",
		"pass",
		"fail",
		"audit",
		"year",
		"dept",
		"instructor",
		"title",
		"uuid",
		"id",
		// Room keys
		"fullname",
		"shortname",
		"number",
		"name",
		"address",
		"lat",
		"lon",
		"seats",
		"type",
		"furniture",
		"href",
	]);

	/**
	 * Evaluates an AND condition: all subconditions must be true for the overall condition to be true.
	 * @param conditions - An array of conditions to be evaluated.
	 * @param content - The section or room being evaluated against the conditions.
	 * @returns `true` if all subconditions are true, otherwise `false`.
	 */
	private handleAND(conditions: any[], content: Section | Room): boolean {
		return conditions.every((subCondition) => this.evaluateCondition(subCondition, content));
	}

	/**
	 * Evaluates an OR condition: at least one subcondition must be true for the overall condition to be true.
	 * @param conditions - An array of conditions to be evaluated.
	 * @param content - The section or room being evaluated against the conditions.
	 * @returns `true` if at least one subcondition is true, otherwise `false`.
	 */
	private handleOR(conditions: any[], content: Section | Room): boolean {
		return conditions.some((subCondition) => this.evaluateCondition(subCondition, content));
	}

	/**
	 * Handles comparisons using GT, LT, EQ, and IS operators.
	 * @param operator - The comparison operator to use.
	 * @param condition - The condition object containing the dataset key (e.g., "sections_avg") and the value.
	 * @param content - The section being evaluated against the condition.
	 * @returns `true` if the condition is satisfied, otherwise `false`.
	 * @throws InsightError if the comparison operator is invalid or if the data types do not match the expected types.
	 */
	// NOLINTNEXTLINE
	private handleComparator(
		operator: "GT" | "LT" | "EQ" | "IS",
		condition: Record<string, any>,
		content: Section | Room
	): boolean {
		const datasetKey = Object.keys(condition)[0];
		const column = datasetKey.split("_")[1];
		const value = condition[datasetKey];

		let contentValue: string | number;
		if (content instanceof Section) {
			contentValue = SectionHelper.getSectionValue(content, datasetKey);
		} else {
			contentValue = RoomHelper.getRoomValue(content, datasetKey);
		}

		// Use a helper function for the "IS" operator
		if (operator === "IS") {
			return this.handleISComparator(column, contentValue, value);
		}

		// Handle numeric comparators
		if (typeof contentValue !== "number") {
			throw new InsightError(`Invalid query: '${column}' must be a numeric field for '${operator}' operator.`);
		}

		switch (operator) {
			case "GT":
				return contentValue > value;
			case "LT":
				return contentValue < value;
			case "EQ":
				return contentValue === value;
			default:
				throw new InsightError(`Invalid operator: '${operator}'.`);
		}
	}

	private handleISComparator(column: string, contentValue: string | number, value: string): boolean {
		if (typeof contentValue !== "string" || typeof value !== "string") {
			throw new InsightError(`Invalid query: '${column}' must be a string field for 'IS' operator.`);
		}

		const middleWildcard = value.slice(1, -1).includes("*");
		if (middleWildcard) {
			throw new InsightError(`Invalid query: Wildcard '*' can only be at the beginning or end.`);
		}

		const regexPattern = "^" + value.replace(/\*/g, ".*") + "$";
		const regex = new RegExp(regexPattern);
		return regex.test(contentValue);
	}

	/**
	 * Recursively evaluates a WHERE condition on a section.
	 * @param filter - The filter condition (e.g., "AND", "OR", "GT", "LT", "EQ", "IS").
	 * @param content - The section or room to evaluate against the filter.
	 * @returns `true` if the section satisfies the filter condition, otherwise `false`.
	 * @throws InsightError if the filter contains an unsupported condition type.
	 */
	private evaluateCondition(filter: Record<string, any>, content: Section | Room): boolean {
		// get the key (OR
		// i.e., OR [{"GT": {"sections_avg": 97}},{"LT": {"sections_pass": 50}}]
		const key = Object.keys(filter)[0];

		switch (key) {
			case "AND":
				return this.handleAND(filter.AND, content);
			case "OR":
				return this.handleOR(filter.OR, content);
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
	 * Filters sections in a dataset based on a WHERE condition.
	 * @param where - The WHERE condition to evaluate.
	 * @param dataset - The dataset containing the sections to filter.
	 * @returns A list of sections that satisfy the WHERE condition.
	 */
	public handleWhere(where: Record<string, any>, dataset: Dataset): Section[] | Room[] {
		if (Object.keys(where).length === 0) {
			return dataset.getContent(); // No filtering needed
		}

		// return dataset.getContent().filter((content) => {
		// 	return this.evaluateCondition(where, content);
		// });

		const datasetContent = dataset.getContent();
		if (datasetContent.length > 0) {
			if (datasetContent[0] instanceof Section) {
				return datasetContent.filter((content) => {
					return this.evaluateCondition(where, content);
				}) as Section[];
			} else if (datasetContent[0] instanceof Room) {
				return datasetContent.filter((content) => {
					return this.evaluateCondition(where, content);
				}) as Room[];
			}
		}
		return [];
	}

	/**
	 * Sorts the given sections based on the provided order criteria.
	 * @param order - The sorting order, which can be a string or an object specifying multiple sorting keys.
	 * @param columns - The list of columns included in the query result.
	 * @param content - The array of sections or rooms to be sorted.
	 * @throws InsightError if the order specification is invalid.
	 */
	private handleSort(order: any, columns: string[], content: Section[] | Room[]): void {
		const { keys, ascending } = this.validateOrder(order, columns);
		content.sort((a, b) => this.compareSectionsOrRooms(a, b, keys, ascending));
	}

	private getValueFromObject(obj: Section | Room, key: string): string | number {
		if (obj instanceof Section) {
			return obj[key as keyof Section] as any;
		} else {
			return obj[key as keyof Room] as any;
		}
	}

	/**
	 * Compares two sections or rooms based on multiple sorting keys.
	 * @param a - The first section to compare.
	 * @param b - The second section to compare.
	 * @param keys - The sorting keys in priority order.
	 * @param ascending - Boolean indicating whether sorting should be in ascending order.
	 * @returns A negative number if 'a' should be ranked before 'b',
	 *          a positive number if 'b' should be ranked before 'a',
	 *          or zero if they are equal based on the sorting keys.
	 */
	private compareSectionsOrRooms(a: Section | Room, b: Section | Room, keys: string[], ascending: boolean): number {
		for (const key of keys) {
			let keyName: string;
			if (a instanceof Section) {
				keyName = key.split("_")[1] as keyof Section;
			} else {
				keyName = key.split("_")[1] as keyof Room;
			}

			const valA = this.getValueFromObject(a, keyName);
			const valB = this.getValueFromObject(b, keyName);

			let comparison = 0;
			if (typeof valA === "number" && typeof valB === "number") {
				comparison = valA - valB;
			} else if (typeof valA === "string" && typeof valB === "string") {
				comparison = valA.localeCompare(valB);
			}

			if (comparison !== 0) {
				return ascending ? comparison : -comparison;
			}
		}
		return 0;
	}

	/**
	 * Validates the ORDER clause of a query and extracts sorting keys and order direction.
	 * @param order - The ORDER clause, which can be a string (single key) or an object (multiple keys).
	 * @param columns - The list of columns included in the query result.
	 * @returns An object containing the sorting keys and the sorting direction.
	 * @throws InsightError if the ORDER clause is incorrectly formatted or references a column not in COLUMNS.
	 */
	private validateOrder(order: any, columns: string[]): { keys: string[]; ascending: boolean } {
		let keys: string[];
		let ascending = true;

		if (typeof order === "string") {
			keys = [order];
		} else if (typeof order === "object" && "dir" in order && "keys" in order) {
			if (!Array.isArray(order.keys) || !["UP", "DOWN"].includes(order.dir)) {
				throw new InsightError(`Invalid ORDER format.`);
			}
			keys = order.keys;
			ascending = order.dir === "UP";
		} else {
			throw new InsightError(`Invalid ORDER format.`);
		}

		for (const key of keys) {
			if (!columns.includes(key)) {
				throw new InsightError(`Invalid query: ORDER column '${key}' must be present in COLUMNS.`);
			}
		}

		return { keys, ascending };
	}

	/**
	 * Processes the OPTIONS section of the query, applying sorting and selecting specified columns.
	 * @param options - The OPTIONS clause of the query, containing COLUMNS and optionally ORDER.
	 * @param content - The array of sections or rooms that match the query conditions.
	 * @returns An array of InsightResult objects containing only the requested columns.
	 * @throws ResultTooLargeError if the query result exceeds the allowed limit.
	 */
	public handleOptions(options: Record<string, any>, content: Section[] | Room[]): InsightResult[] {
		if (content.length > this.limit) {
			throw new ResultTooLargeError(`Query result too large.`);
		}

		const columns: string[] = options.COLUMNS ?? [];

		// Validate ORDER in COLUMNS if it exists, and sort if so
		// Validate and sort content
		if ("ORDER" in options) {
			this.handleSort(options.ORDER, columns, content);
		}

		// Transform each section or room into an InsightResult object
		return content.map((section_or_room) => {
			const result: InsightResult = {};
			for (const column of columns) {
				if (section_or_room instanceof Section) {
					result[column] = SectionHelper.getSectionValue(section_or_room, column);
				} else {
					result[column] = RoomHelper.getRoomValue(section_or_room, column);
				}
			}
			return result;
		});
	}

	/**
	 * Executes a query on the dataset by filtering and processing results based on the provided query structure.
	 * @param rawQuery - A JSON object representing the query, containing WHERE and OPTIONS clauses.
	 * @param dp - The DatasetProcessor responsible for loading datasets from disk.
	 * @returns A promise resolving to an array of InsightResult objects containing the query results.
	 * @throws InsightError if the dataset is not found or the query is invalid.
	 */
	public async handleQuery(rawQuery: Record<string, any>, dp: DatasetProcessor): Promise<InsightResult[]> {
		const query: Query = {
			WHERE: rawQuery.WHERE,
			OPTIONS: rawQuery.OPTIONS,
		};

		const datasetId = QueryHelper.validateQuery(query, this.validKeys);

		const dataset: Dataset | null = await dp.loadFromDisk(datasetId);
		if (!dataset) {
			throw new InsightError(`Dataset with ID '${datasetId}' not found.`);
		}

		const queriedContent: Section[] | Room[] = this.handleWhere(query.WHERE ?? {}, dataset);
		return this.handleOptions(query.OPTIONS ?? {}, queriedContent);
	}
}
