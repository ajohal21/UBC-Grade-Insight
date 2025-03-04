import { Dataset } from "./types/Dataset";
import { DatasetProcessor } from "./DatasetProcessor";
import { Section } from "./types/Section";
import { Query } from "./types/Query";
import { InsightError, InsightResult, ResultTooLargeError } from "./IInsightFacade";

export class QueryEngine {
	private limit: number = 5000;

	/**
	 * Retrieves the value of a specific field from a Section object.
	 * @param section - The Section instance containing course data.
	 * @param key - The dataset-prefixed column name (e.g., "courses_avg").
	 * @returns The corresponding field value as a string or number.
	 * @throws InsightError if the key does not correspond to a valid section field.
	 */
	private getSectionValue(section: Section, key: string): string | number {
		const fieldMap: Record<string, (s: Section) => string | number> = {
			uuid: (s) => s.getUuid(),
			id: (s) => s.getId(),
			title: (s) => s.getTitle(),
			instructor: (s) => s.getInstructor(),
			dept: (s) => s.getDept(),
			year: (s) => s.getYear(),
			avg: (s) => s.getAvg(),
			pass: (s) => s.getPass(),
			fail: (s) => s.getFail(),
			audit: (s) => s.getAudit(),
		};

		// Extract field name by removing dataset ID prefix (section_avg -> avg)
		const fieldName = key.split("_")[1];

		if (!fieldMap[fieldName]) {
			throw new InsightError(`Column '${key}' not found in section.`);
		}

		const value = fieldMap[fieldName](section);
		if (["avg", "pass", "fail", "audit", "year"].includes(fieldName)) {
			return Number(value);
		}
		return String(value);
	}

	/**
	 * Recursively extracts dataset IDs from query filters.
	 * @param obj - The query object containing filtering conditions.
	 * @param datasetIds - A set to store extracted dataset IDs.
	 * @throws InsightError if an invalid query key is encountered.
	 */
	private extractDatasetIds(obj: any, datasetIds: Set<string>): void {
		if (typeof obj !== "object" || obj === null) return;

		const validKeys = new Set(["avg", "pass", "fail", "audit", "year", "dept", "instructor", "title", "uuid", "id"]);

		for (const key in obj) {
			if (key.includes("_")) {
				const datasetId = key.split("_")[0];
				datasetIds.add(datasetId);

				const queryKey = key.split("_")[1];
				if (!validKeys.has(queryKey)) {
					throw new InsightError(`Invalid query key '${queryKey}'.`);
				}
			}
			this.extractDatasetIds(obj[key], datasetIds);
		}
	}

	/**
	 * Validates a query against dataset requirements.
	 * @param query - The query to validate.
	 * @throws InsightError if the query is invalid.
	 */
	public validateQuery(query: Query): string {
		if (!query.WHERE) {
			throw new InsightError("Invalid query: 'WHERE' clause is missing.");
		}

		if (!query.OPTIONS?.COLUMNS) {
			throw new InsightError("Invalid query: 'OPTIONS' or 'COLUMNS' missing.");
		}

		// Extract dataset IDs from query keys
		const datasetIds = new Set<string>();

		// Check WHERE clause
		this.extractDatasetIds(query.WHERE, datasetIds);

		// Check only one dataset is referenced in WHERE
		for (const column of query.OPTIONS.COLUMNS) {
			const datasetId = column.split("_")[0]; // Extract dataset prefix
			datasetIds.add(datasetId);
		}

		// Check only one dataset is referenced in OPTIONS
		if (query.OPTIONS.ORDER) {
			if (typeof query.OPTIONS.ORDER === "string") {
				const datasetId = query.OPTIONS.ORDER.split("_")[0];
				datasetIds.add(datasetId);
			} else {
				for (const key of query.OPTIONS.ORDER.keys) {
					const datasetId = key.split("_")[0];
					datasetIds.add(datasetId);
				}
			}
		}

		if (datasetIds.size !== 1) {
			throw new InsightError(
				`Invalid query: Must reference exactly one dataset, found: ${Array.from(datasetIds).join(", ")}`
			);
		}

		return Array.from(datasetIds)[0];
	}

	/**
	 * Evaluates an AND condition: all subconditions must be true for the overall condition to be true.
	 * @param conditions - An array of conditions to be evaluated.
	 * @param section - The section being evaluated against the conditions.
	 * @returns `true` if all subconditions are true, otherwise `false`.
	 */
	private handleAND(conditions: any[], section: Section): boolean {
		return conditions.every((subCondition) => this.evaluateCondition(subCondition, section));
	}

	/**
	 * Evaluates an OR condition: at least one subcondition must be true for the overall condition to be true.
	 * @param conditions - An array of conditions to be evaluated.
	 * @param section - The section being evaluated against the conditions.
	 * @returns `true` if at least one subcondition is true, otherwise `false`.
	 */
	private handleOR(conditions: any[], section: Section): boolean {
		return conditions.some((subCondition) => this.evaluateCondition(subCondition, section));
	}

	/**
	 * Handles comparisons using GT, LT, EQ, and IS operators.
	 * @param operator - The comparison operator to use.
	 * @param condition - The condition object containing the dataset key (e.g., "sections_avg") and the value.
	 * @param section - The section being evaluated against the condition.
	 * @returns `true` if the condition is satisfied, otherwise `false`.
	 * @throws InsightError if the comparison operator is invalid or if the data types do not match the expected types.
	 */
	private handleComparator(
		operator: "GT" | "LT" | "EQ" | "IS",
		condition: Record<string, any>,
		section: Section
	): boolean {
		const datasetKey = Object.keys(condition)[0]; // "sections_avg"
		const column = datasetKey.split("_")[1]; // Extract "avg"
		const value = condition[datasetKey]; // the value

		// Get the actual value from this Section
		const sectionValue = this.getSectionValue(section, datasetKey);

		if (operator !== "IS" && typeof sectionValue !== "number") {
			throw new InsightError(`Invalid query: '${column}' must be a numeric field for '${operator}' operator.`);
		}

		switch (operator) {
			case "GT":
				return sectionValue > value;
			case "LT":
				return sectionValue < value;
			case "EQ":
				return sectionValue === value;
			case "IS":
				if (typeof sectionValue !== "string" || typeof value !== "string") {
					throw new InsightError(`Invalid query: '${column}' must be a string field for 'IS' operator.`);
				}

				// Ensure '*' appears only at the start or end, or both
				const middleWildcard = value.slice(1, -1).includes("*");
				if (middleWildcard) {
					throw new InsightError(`Invalid query: Wildcard '*' can only be at the beginning or end.`);
				}

				const regexPattern = "^" + value.replace(/\*/g, ".*") + "$";
				const regex = new RegExp(regexPattern);
				return regex.test(sectionValue);
			default:
				throw new InsightError(`Invalid operator: '${operator}'.`);
		}
	}

	/**
	 * Recursively evaluates a WHERE condition on a section.
	 * @param filter - The filter condition (e.g., "AND", "OR", "GT", "LT", "EQ", "IS").
	 * @param section - The section to evaluate against the filter.
	 * @returns `true` if the section satisfies the filter condition, otherwise `false`.
	 * @throws InsightError if the filter contains an unsupported condition type.
	 */
	private evaluateCondition(filter: Record<string, any>, section: Section): boolean {
		// get the key (OR
		// i.e., OR [{"GT": {"sections_avg": 97}},{"LT": {"sections_pass": 50}}]
		const key = Object.keys(filter)[0];

		switch (key) {
			case "AND":
				return this.handleAND(filter.AND, section);
			case "OR":
				return this.handleOR(filter.OR, section);
			case "NOT":
				return !this.evaluateCondition(filter.NOT, section);
			case "GT":
			case "LT":
			case "EQ":
			case "IS":
				return this.handleComparator(key, filter[key], section);
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
	public handleWhere(where: Record<string, any>, dataset: Dataset): Section[] {
		if (Object.keys(where).length === 0) {
			return dataset.getSections(); // No filtering needed
		}

		return dataset.getSections().filter((section) => {
			return this.evaluateCondition(where, section);
		});
	}

	/**
	 * Sorts the given sections based on the provided order criteria.
	 * @param order - The sorting order, which can be a string or an object specifying multiple sorting keys.
	 * @param columns - The list of columns included in the query result.
	 * @param sections - The array of sections to be sorted.
	 * @throws InsightError if the order specification is invalid.
	 */
	private handleSort(order: any, columns: string[], sections: Section[]): void {
		const { keys, ascending } = this.validateOrder(order, columns);
		sections.sort((a, b) => this.compareSections(a, b, keys, ascending));
	}

	/**
	 * Compares two sections based on multiple sorting keys.
	 * @param a - The first section to compare.
	 * @param b - The second section to compare.
	 * @param keys - The sorting keys in priority order.
	 * @param ascending - Boolean indicating whether sorting should be in ascending order.
	 * @returns A negative number if 'a' should be ranked before 'b',
	 *          a positive number if 'b' should be ranked before 'a',
	 *          or zero if they are equal based on the sorting keys.
	 */
	private compareSections(a: Section, b: Section, keys: string[], ascending: boolean): number {
		for (const key of keys) {
			const keyName = key.split("_")[1] as keyof Section;
			const valA = a[keyName] as any;
			const valB = b[keyName] as any;

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
	 * @param sections - The array of sections that match the query conditions.
	 * @returns An array of InsightResult objects containing only the requested columns.
	 * @throws ResultTooLargeError if the query result exceeds the allowed limit.
	 */
	public handleOptions(options: Record<string, any>, sections: Section[]): InsightResult[] {
		if (sections.length > this.limit) {
			throw new ResultTooLargeError(`Query result too large.`);
		}

		const columns: string[] = options.COLUMNS ?? [];

		// Validate ORDER in COLUMNS if it exists, and sort if so
		// Validate and sort sections
		if ("ORDER" in options) {
			this.handleSort(options.ORDER, columns, sections);
		}

		// Transform each section into an InsightResult object
		return sections.map((section) => {
			const result: InsightResult = {};
			for (const column of columns) {
				result[column] = this.getSectionValue(section, column);
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

		const datasetId = this.validateQuery(query);

		const dataset: Dataset | null = await dp.loadFromDisk(datasetId);
		if (!dataset) {
			throw new InsightError(`Dataset with ID '${datasetId}' not found.`);
		}

		const queriedSections: Section[] = this.handleWhere(query.WHERE ?? {}, dataset);
		return this.handleOptions(query.OPTIONS ?? {}, queriedSections);
	}
}
