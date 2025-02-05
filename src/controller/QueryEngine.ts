import { Dataset } from "./types/Dataset";
import { DatasetProcessor } from "./DatasetProcessor";
import { Section } from "./types/Section";
import { Query } from "./types/Query";
import { InsightError, InsightResult } from "./IInsightFacade";

export class QueryEngine {
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

		// Extract field name by removing dataset ID prefix
		const fieldName = key.split("_")[1];

		if (!fieldMap[fieldName]) {
			throw new Error(`Column '${key}' not found in section.`);
		}

		return fieldMap[fieldName](section);
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
	 * @throws Error if the query is invalid.
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

		// Check OPTIONS -> COLUMNS
		for (const column of query.OPTIONS.COLUMNS) {
			const datasetId = column.split("_")[0]; // Extract dataset prefix
			datasetIds.add(datasetId);
		}

		// Check OPTIONS -> ORDER
		if (query.OPTIONS.ORDER) {
			const datasetId = query.OPTIONS.ORDER.split("_")[0];
			datasetIds.add(datasetId);
		}

		// Ensure only one dataset is referenced
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
	private handleComparator(operator: "GT" | "LT" | "EQ", condition: Record<string, number>, section: Section): boolean {
		const datasetKey = Object.keys(condition)[0]; // "sections_avg"
		const column = datasetKey.split("_")[1]; // Extract "avg"
		const value = condition[column]; // the value

		// check type is numeric, else throw Insight Error
		if (typeof value !== "number") {
			throw new InsightError(`Invalid query: '${column}' must be a numeric value.`);
		}

		// Get the actual value from Section
		const sectionValue = this.getSectionValue(section, column);

		if (typeof sectionValue !== "number") {
			throw new InsightError(`Invalid query: '${column}' must be a numeric value.`);
		}

		switch (operator) {
			case "GT":
				return sectionValue > value;
			case "LT":
				return sectionValue < value;
			case "EQ":
				return sectionValue === value;
		}
	}

	/**
	 * Recursively evaluates a WHERE condition on a section.
	 */
	private evaluateCondition(filter: Record<string, any>, section: Section): boolean {
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
	public handleOptions(options: Record<string, any>, sections: Section[]): InsightResult[] {
		return [];
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
			throw new Error(`Dataset with ID '${datasetId}' not found.`);
		}

		const queriedSections: Section[] = this.handleWhere(query.WHERE ?? {}, dataset);
		return this.handleOptions(query.OPTIONS ?? {}, queriedSections);
	}
}
