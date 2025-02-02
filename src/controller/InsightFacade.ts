import { IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, InsightResult } from "./IInsightFacade";
import JSZip from "jszip";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasets: Map<string, any> = new Map<string, any>();

	public async addDataset(id: string, content: string): Promise<string> {
		// 1. Input Validation (ID)
		if (!id || id.includes("_") || id.trim().length === 0) {
			throw new InsightError("Invalid dataset ID: ID cannot contain underscores or be empty/whitespace only.");
		}

		if (this.datasets.has(id)) {
			throw new InsightError("Dataset with this ID already exists.");
		}

		// 2. Process Zip File (Assuming 'courses.json' for now)
		try {
			const zip = new JSZip();
			const zipResult = await zip.loadAsync(content, { base64: true });

			const dataFile = zipResult.files['courses/']; // Assumes 'courses.json'

			if (!dataFile) {
				throw new InsightError(`No courses.json file found in the zip archive.`);
			}

			const dataString = await dataFile.async('string');
			const jsonData = JSON.parse(dataString);

			// Basic JSON validation (customize as needed)
			if (!Array.isArray(jsonData)) {
				throw new InsightError("Invalid JSON data: Root should be an array.");
			}

			if (jsonData.length === 0) {
				throw new InsightError("No data entries found in the JSON file.");
			}

			// Store the dataset
			this.datasets.set(id, jsonData);

		} catch (error: any) {
			if (error instanceof InsightError) {
				throw error;
			} else if (error instanceof SyntaxError) {
				throw new InsightError("Invalid JSON format in dataset: " + error.message);
			} else {
				throw new InsightError("Error processing dataset: " + error.message);
			}
		}

		const addedDatasetIds = Array.from(this.datasets.keys());
		return Promise.resolve(addedDatasetIds); // Correctly return the array of IDs
	}


	public async removeDataset(id: string): Promise<string> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::removeDataset() is unimplemented! - id=${id};`);
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::listDatasets is unimplemented!`);
	}
}
