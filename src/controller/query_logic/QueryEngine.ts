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
	 * Filters sections in a dataset based on a WHERE condition.
	 * @param where - The WHERE condition to evaluate.
	 * @param dataset - The dataset containing the sections to filter.
	 * @returns A list of sections that satisfy the WHERE condition.
	 */
	public handleWhere(where: Record<string, any>, dataset: Dataset): Section[] | Room[] {
		if (Object.keys(where).length === 0) {
			return dataset.getContent(); // No filtering needed
		}

		const datasetContent = dataset.getContent();
		if (datasetContent.length > 0) {
			if (datasetContent[0] instanceof Section) {
				return datasetContent.filter((content) => {
					return QueryHelper.evaluateCondition(where, content);
				}) as Section[];
			} else if (datasetContent[0] instanceof Room) {
				return datasetContent.filter((content) => {
					return QueryHelper.evaluateCondition(where, content);
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
			} else if (b instanceof Room) {
				keyName = key.split("_")[1] as keyof Room;
			} else{
				keyName = key;
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
	 * Computes an aggregate operation on a group of sections or rooms.
	 * @param operator - The aggregation operation to perform (AVG, SUM, COUNT, MAX, MIN).
	 * @param field - The field on which the aggregation is performed.
	 * @param groupItems - The array of sections or rooms to process.
	 * @returns The computed aggregation result as a number.
	 * @throws InsightError if the operator is invalid or values are not numbers (where required).
	 */
	private computeApplyOperation(
		operator: string,
		field: string,
		groupItems: Section[] | Room[]
	): number {
		const values = groupItems.map((item) =>
			item instanceof Section
				? SectionHelper.getSectionValue(item, field)
				: RoomHelper.getRoomValue(item, field)
		);

		this.validateNumericValues(operator, values);

		switch (operator) {
			case "AVG":
				const Decimal = require("decimal.js");
				if (values.length === 0) {
					throw new InsightError(`Cannot divide by 0 in AVG.`);
				}
				return Number(
					(values.reduce((sum, val) => sum.add(new Decimal(val)), new Decimal(0))
						.toNumber() / values.length).toFixed(2)
				);
			case "SUM":
				return parseFloat((values as number[]).reduce((sum, val) => sum + val, 0).toFixed(2));
			case "COUNT":
				return new Set(values).size;
			case "MAX":
				return Math.max(...(values as number[]));
			case "MIN":
				return Math.min(...(values as number[]));
			default:
				throw new InsightError(`Invalid APPLY operation: ${operator}`);
		}
	}

	/**
	 * Validates that all values are numeric for applicable operations.
	 * @param operator - The aggregation operator.
	 * @param values - The array of values to validate.
	 * @throws InsightError if values are not numeric for AVG, SUM, MAX, or MIN.
	 */
	private validateNumericValues(operator: string, values: any[]): void {
		if (["AVG", "SUM", "MAX", "MIN"].includes(operator) &&
			values.some(val => typeof val !== "number" || isNaN(val))) {
			throw new InsightError(`Invalid ${operator} operation: All values must be numbers.`);
		}
	}

	/**
	 * Processes a group of items (either Section or Room) and applies transformations (e.g., aggregations).
	 *
	 * - The GROUP keys are used to split the groupKey, and then each item is processed according to APPLY.
	 *
	 * @param groupKey - The unique key that identifies the group, formed by joining the GROUP field values with "|".
	 * @param groupItems - The array of items (either Section[] or Room[]) that belong to this group.
	 * @param GROUP - The list of fields used for grouping the items.
	 * @param APPLY - The list of transformation rules specifying how to apply operations (e.g., AVG, MAX) to the grouped items.
	 * @returns The transformed item, which includes the GROUP values and the result of the APPLY transformations.
	 * @throws InsightError - Throws an error if the transformation cannot be applied or if the grouping is invalid.
	 */
	private processGroup(
		groupKey: string,
		groupItems: Section[] | Room[],
		GROUP: string[],
		APPLY: any[]
	): Record<string, any> {
		const transformedItem: Record<string, any> = this.processGroupKeys(groupKey, GROUP);
		this.processApplyRules(transformedItem, APPLY, groupItems);
		this.ensureNumericConsistency(transformedItem);
		return transformedItem;
	}

	/**
	 * Processes the group keys and assigns them to the transformed item.
	 *
	 * @param groupKey - The unique key that identifies the group, formed by joining the GROUP field values with "|".
	 * @param GROUP - The list of fields used for grouping the items.
	 * @returns The transformed item with the group keys assigned.
	 */
	private processGroupKeys(groupKey: string, GROUP: string[]): Record<string, any> {
		const transformedItem: Record<string, any> = {};

		GROUP.forEach((key, index) => {
			const value = groupKey.split("|")[index];

			if (this.shouldBeNumber(key)) {
				const parsedValue = parseFloat(value);
				transformedItem[key] = isNaN(parsedValue) ? value : parsedValue;
			} else {
				transformedItem[key] = value;
			}
		});

		return transformedItem;
	}

	/**
	 * Processes the APPLY rules and applies the transformations to the transformed item.
	 *
	 * @param transformedItem - The transformed item to which the APPLY rules will be applied.
	 * @param APPLY - The list of transformation rules specifying how to apply operations (e.g., AVG, MAX) to the grouped items.
	 * @param groupItems - The array of items (either Section[] or Room[]) that belong to this group.
	 */
	private processApplyRules(
		transformedItem: Record<string, any>,
		APPLY: any[],
		groupItems: Section[] | Room[]
	): void {
		for (const applyRule of APPLY) {
			const applyKey = Object.keys(applyRule)[0];
			const applyObj = applyRule[applyKey];

			const applyOperator = Object.keys(applyObj)[0];
			const field = applyObj[applyOperator];

			transformedItem[applyKey] = this.computeApplyOperation(applyOperator, field, groupItems);
		}
	}

	/**
	 * Ensures that numeric values are consistently handled for any results of APPLY (like AVG, MAX).
	 *
	 * @param transformedItem - The transformed item to ensure numeric consistency.
	 */
	private ensureNumericConsistency(transformedItem: Record<string, any>): void {
		const validNumericKey = [
			"year",
			"avg",
			"pass",
			"fail",
			"audit",
			"lat",
			"lon",
			"seats",
			"sections_avg",
		];

		Object.keys(transformedItem).forEach(key => {
			if (validNumericKey.includes(key) && typeof transformedItem[key] === "string") {
				transformedItem[key] = parseFloat(transformedItem[key]);
			}
		});
	}

	// /**
	//  * Processes a group of items (either Section or Room) and applies transformations (e.g., aggregations).
	//  *
	//  * - The GROUP keys are used to split the groupKey, and then each item is processed according to APPLY.
	//  *
	//  * @param groupKey - The unique key that identifies the group, formed by joining the GROUP field values with "|".
	//  * @param groupItems - The array of items (either Section[] or Room[]) that belong to this group.
	//  * @param GROUP - The list of fields used for grouping the items.
	//  * @param APPLY - The list of transformation rules specifying how to apply operations (e.g., AVG, MAX) to the grouped items.
	//  * @returns The transformed item, which includes the GROUP values and the result of the APPLY transformations.
	//  * @throws InsightError - Throws an error if the transformation cannot be applied or if the grouping is invalid.
	//  */
	// private processGroup(
	// 	groupKey: string,
	// 	groupItems: Section[] | Room[],
	// 	GROUP: string[],
	// 	APPLY: any[]
	// ): Record<string, any> {
	// 	const transformedItem: Record<string, any> = {};
	//
	// 	// Assign GROUP keys to transformed item, preserving numbers
	// 	GROUP.forEach((key, index) => {
	// 		const value = groupKey.split("|")[index];
	//
	// 		// Check if the field should be a number (you'll need to define this logic)
	// 		if (this.shouldBeNumber(key)) {
	// 			const parsedValue = parseFloat(value);
	// 			transformedItem[key] = isNaN(parsedValue) ? value : parsedValue; // if parse fails, return string.
	// 		} else {
	// 			transformedItem[key] = value;
	// 		}
	// 	});
	//
	// 	// Process APPLY transformations
	// 	for (const applyRule of APPLY) {
	// 		const applyKey = Object.keys(applyRule)[0];
	// 		const applyObj = applyRule[applyKey];
	//
	// 		const applyOperator = Object.keys(applyObj)[0];
	// 		const field = applyObj[applyOperator];
	//
	// 		// Apply transformation (compute operation)
	// 		transformedItem[applyKey] = this.computeApplyOperation(applyOperator, field, groupItems);
	// 	}
	//
	// 	// Ensure that numeric values are consistently handled for any results of APPLY (like AVG, MAX)
	// 	const validNumericKey = [
	// 		"year",
	// 		"avg",
	// 		"pass",
	// 		"fail",
	// 		"audit",
	// 		"lat",
	// 		"lon",
	// 		"seats",
	// 		"sections_avg", // Ensure sections_avg is considered numeric
	// 	];
	//
	// 	Object.keys(transformedItem).forEach(key => {
	// 		if (validNumericKey.includes(key) && typeof transformedItem[key] === "string") {
	// 			transformedItem[key] = parseFloat(transformedItem[key]);
	// 		}
	// 	});
	//
	// 	return transformedItem;
	// }

	// Helper function to determine if a field should be a number
	private shouldBeNumber(key: string): boolean {
		return key.endsWith("_lat") || key.endsWith("_lon") || key.endsWith("_seats");
	}

	/**
	 * Groups the dataset by the specified GROUP keys (Sections or Rooms).
	 * @param dataset - The dataset to group (Sections or Rooms).
	 * @param GROUP - The GROUP keys used to group the dataset.
	 * @returns A tuple containing two maps: one for sections and one for rooms.
	 */
	private groupByKeys(
		dataset: Section[] | Room[],
		GROUP: string[]
	): [Map<string, Section[]>, Map<string, Room[]>] {
		const sectionGroups = new Map<string, Section[]>();
		const roomGroups = new Map<string, Room[]>();

		dataset.forEach(item => {
			// Loop over the Group Columns and create a unique key based on GROUP values
			const groupKey = GROUP.map((key) =>
				item instanceof Section
					? SectionHelper.getSectionValue(item, key)
					: RoomHelper.getRoomValue(item, key)
			).join("|"); // i.e., groupKey = ["Math 101", "Dr. Smith"].join("|") => "Math 101|Dr. Johnson"

			// Add to appropriate group (Section or Room)
			if (item instanceof Section) {
				if (!sectionGroups.has(groupKey)) {
					sectionGroups.set(groupKey, []);
				}
				sectionGroups.get(groupKey)!.push(item);
			} else {
				if (!roomGroups.has(groupKey)) {
					roomGroups.set(groupKey, []);
				}
				roomGroups.get(groupKey)!.push(item);
			}
		});

		return [sectionGroups, roomGroups];
	}

	/**
	 * TODO.
	 * @param query - TODO.
	 * @param dataset - TODO.
	 * @returns TODO.
	 * @throws InsightError TODO.
	 */
	private handleTransformations(
		query: Record<string, any>,
		dataset: Section[] | Room[]
	): any[] {
		if (!query.TRANSFORMATIONS) {
			return dataset; // No transformations, return as-is
		}

		const { GROUP, APPLY } = query.TRANSFORMATIONS;

		if (!Array.isArray(GROUP) || !Array.isArray(APPLY)) {
			throw new InsightError("Invalid TRANSFORMATIONS format");
		}

		// Step 1: Group dataset by GROUP keys
		const [sectionGroups, roomGroups] = this.groupByKeys(dataset, GROUP);

		// Step 2: Apply aggregations
		const transformedData: any[] = [];
		for (const [groupKey, groupItems] of sectionGroups.entries()) {
			transformedData.push(this.processGroup(groupKey, groupItems, GROUP, APPLY));
		}

		for (const [groupKey, groupItems] of roomGroups.entries()) {
			transformedData.push(this.processGroup(groupKey, groupItems, GROUP, APPLY));
		}

		return transformedData;
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

		const optionsArray = ["COLUMNS", "ORDER"];
		for (const key in options) {
			if (!optionsArray.includes(key)) {
				throw new InsightError(`Unrecognized Options key: '${key}'`);
			}
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
				} else if (section_or_room instanceof Room) {
					result[column] = RoomHelper.getRoomValue(section_or_room, column);
				} else {
					result[column] = section_or_room[column];
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
			TRANSFORMATIONS: rawQuery.TRANSFORMATIONS
		};

		const datasetId = QueryHelper.validateQuery(query, this.validKeys);

		const dataset: Dataset | null = await dp.loadFromDisk(datasetId);
		if (!dataset) {
			throw new InsightError(`Dataset with ID '${datasetId}' not found.`);
		}

		// Filter dataset using WHERE
		let queriedContent: Section[] | Room[] = this.handleWhere(query.WHERE ?? {}, dataset);

		// Handle TRANSFORMATIONS if present
		if (query.TRANSFORMATIONS) {
			queriedContent = this.handleTransformations(query, queriedContent);
		}

		// Apply OPTIONS (select columns, order results)
		return this.handleOptions(query.OPTIONS ?? {}, queriedContent);
	}
}
