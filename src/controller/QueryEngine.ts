import { Dataset } from "./types/Dataset";
import { DatasetProcessor } from "./DatasetProcessor";
import { Section } from "./types/Section";
import { Query } from "./types/Query";
import { InsightError, InsightResult, ResultTooLargeError } from "./IInsightFacade";

export class QueryEngine {
	private limit: number = 5000;

	/**
	 * TODO.
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
	 * Extract dataset IDs from query filters recursively.
	 */
	private extractDatasetIds(obj: any, datasetIds: Set<string>): void {
		if (typeof obj !== "object" || obj === null) return;

		for (const key in obj) {
			if (key.includes("_")) {
				const datasetId = key.split("_")[0];
				datasetIds.add(datasetId);
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

		// Check only one dataset is referecned in WHERE and OPTIONS
		for (const column of query.OPTIONS.COLUMNS) {
			const datasetId = column.split("_")[0]; // Extract dataset prefix
			datasetIds.add(datasetId);
		}
		if (query.OPTIONS.ORDER) {
			const datasetId = query.OPTIONS.ORDER.split("_")[0];
			datasetIds.add(datasetId);
		}
		if (datasetIds.size !== 1) {
			throw new InsightError(
				`Invalid query: Must reference exactly one dataset, found: ${Array.from(datasetIds).join(", ")}`
			);
		}

		return Array.from(datasetIds)[0];
	}

	/**
	 * Evaluates an AND condition: all subconditions must be true.
	 */
	private handleAND(conditions: any[], section: Section): boolean {
		return conditions.every((subCondition) => this.evaluateCondition(subCondition, section));
	}

	/**
	 * Evaluates an OR condition: at least one subcondition must be true.
	 */
	private handleOR(conditions: any[], section: Section): boolean {
		return conditions.some((subCondition) => this.evaluateCondition(subCondition, section));
	}

	/**
	 * Handles GT, LT, and EQ comparisons.
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
	 * Recursively evaluates a WHERE condition on a section.
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
	 * Handle the OPTIONS section.
	 */
	/**
	 * Handle the OPTIONS section.
	 */
	public handleOptions(options: Record<string, any>, sections: Section[]): InsightResult[] {
		if (sections.length > this.limit) {
			throw new ResultTooLargeError(`Query result too large.`);
		}

		const columns: string[] = options.COLUMNS ?? [];

		// Validate ORDER in COLUMNS if it exists, and sort if so
		if ("ORDER" in options) {
			const orderColumnWithDataset = options.ORDER;
			const orderColumn = options.ORDER.split("_")[1] as keyof Section;
			if (!columns.includes(orderColumnWithDataset)) {
				throw new InsightError(`Invalid query: ORDER column '${orderColumn}' must be present in COLUMNS.`);
			}

			sections.sort((a, b) => {
				const valA = a[orderColumn] as any;
				const valB = b[orderColumn] as any;

				if (typeof valA === "number" && typeof valB === "number") {
					return valA - valB; // Numeric sorting
				} else if (typeof valA === "string" && typeof valB === "string") {
					return valA.localeCompare(valB); // String sorting
				} else {
					return 0; // Keep order if types don't match
				}
			});
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
	 * Performs a query.
	 * @param rawQuery - JSON object of type Record<string, any>.
	 * @param dp - .
	 * @return Promise<InsightResult[]>
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
