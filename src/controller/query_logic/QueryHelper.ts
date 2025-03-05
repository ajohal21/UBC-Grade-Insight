import {Query} from "../types/Query";
import { InsightError } from "../IInsightFacade";

export class QueryHelper {
	/**
	 * Validates a query against dataset requirements.
	 * @param query - The query to validate.
	 * @param validKeys - TODO
	 * @throws InsightError if the query is invalid.
	 */
	public static validateQuery(query: Query, validKeys: Set<string>): string {
		if (!query.WHERE || !query.OPTIONS?.COLUMNS) {
			throw new InsightError("Invalid query: Missing required fields (WHERE or OPTIONS).");
		}

		const datasetIds = new Set<string>();
		this.extractDatasetIds(query.WHERE, datasetIds, validKeys);

		query.OPTIONS.COLUMNS.forEach(column => datasetIds.add(column.split("_")[0]));

		if (query.OPTIONS.ORDER) {
			const orderKeys = typeof query.OPTIONS.ORDER === "string" ? [query.OPTIONS.ORDER] : query.OPTIONS.ORDER.keys;
			orderKeys.forEach(key => datasetIds.add(key.split("_")[0]));
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
	 * @param validKeys - TODO.
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
}
