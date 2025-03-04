import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
} from "./IInsightFacade";
import { DatasetProcessor } from "./DatasetProcessor";
import JSZip from "jszip";
import { Section } from "./types/Section";
import { Dataset } from "./types/Dataset";
import { QueryEngine } from "./QueryEngine";
import fs from "fs-extra";
import path from "path";
import { RoomProcessor } from "./RoomProcessor";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasets: any[] = []; // Using a simple object to store datasets for now
	private queryEngine: QueryEngine = new QueryEngine();
	private roomProcessor: RoomProcessor = new RoomProcessor();
	private processor = new DatasetProcessor("../../data/");
	private sectionDatasetArray: any[] = [];

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		this.validDatasetID(id);
		if (await this.processor.doesDatasetExist(id)) {
			throw new InsightError("dataset with id already exists");
		}

		if (kind === InsightDatasetKind.Rooms) {
			return this.roomProcessor.processRoomKind(id, content);
		} else {
			return this.processSectionKind(id, content);
		}
	}

	public async processSectionKind(id: string, content: string): Promise<string[]> {
		if (!this.isBase64(content)) {
			throw new InsightError("Not base64 string");
		}

		try {
			this.sectionDatasetArray = [];
			const zip = new JSZip();
			const zipResult = await zip.loadAsync(content, { base64: true });

			this.validZip(zipResult);

			const filePromises: Promise<void>[] = [];
			zip.forEach((local, file) => {
				if (!file.dir && local.startsWith("courses/")) {
					// process data into sections
					filePromises.push(this.processJsonData(file));
				}
			});
			await Promise.all(filePromises);

			// all sections now in sectionDatasetArray
			// now make Dataset with id and DatasetArray
			const newDataset = new Dataset(id, this.sectionDatasetArray, InsightDatasetKind.Sections);
			await this.processor.saveToDisk(newDataset);

			// now we just load the diskID after an add
			const diskDatasetID = await this.processor.getAllDatasetIds();

			return diskDatasetID;
		} catch (err) {
			return Promise.reject(new InsightError(`invalid content: ${err}`));
		}
	}

	/**
	 * Check that the file unzipped has
	 * 1) courses root folder
	 * 2) Only 1 folder
	 * 3) some JsonData
	 * */
	public validZip(zip: JSZip): void {
		const rootFolder: string[] = [];
		const jsonData: string[] = [];

		zip.forEach((relativePath, file) => {
			if (file.dir) {
				rootFolder.push(relativePath);
			} else if (relativePath.startsWith("courses/")) {
				jsonData.push(relativePath);
			}
		});

		if (rootFolder.length > 1 || rootFolder[0] !== "courses/" || jsonData.length === 0) {
			throw new InsightError("wrong courses structure or course folder is empty");
		}
	}

	public async processJsonData(file: JSZip.JSZipObject): Promise<void> {
		try {
			const jsonContent = await file.async("text");
			const parsedContent = JSON.parse(jsonContent);

			if (!parsedContent.hasOwnProperty("result") || !Array.isArray(parsedContent.result)) {
				throw new InsightError(`Invalid JSON format in ${file.name}: Missing or invalid "result" key.`);
			}

			const setYear = 1900;

			for (const field of parsedContent.result) {
				let year: number;
				if (field.Section === "overall") {
					year = setYear;
				} else {
					year = field.Year;
				}

				const result = this.processSection(field, year);

				if (result instanceof InsightError) {
					throw result; // Throw the InsightError if one was returned
				} else if (result === null) {
					// Should not happen with this implementation, but included for robustness
					throw new InsightError("Unexpected error processing section.");
				} else {
					this.sectionDatasetArray.push(result); // result is the Section object
				}
			}

			return parsedContent;
		} catch (err) {
			if (err instanceof InsightError) {
				// Re-throw InsightErrors as they are
				throw err;
			} else {
				throw new InsightError(`Error processing file: ${err}`); // Wrap other errors
			}
		}
	}

	private processSection(field: any, year: number): Section | InsightError | null {
		const requiredFields = ["id", "Course", "Title", "Professor", "Subject", "Avg", "Pass", "Fail", "Audit"];

		// Check for missing fields using a loop
		for (const fieldName of requiredFields) {
			if (field[fieldName] === undefined || field[fieldName] === null) {
				return new InsightError(`Missing required field: ${fieldName}`);
			}
		}

		// Check year separately
		if (year === undefined || year === null) {
			return new InsightError("Missing required field: year");
		}

		try {
			// Create the Section object
			return new Section(
				field.id.toString(),
				field.Course,
				field.Title,
				field.Professor,
				field.Subject,
				+year,
				field.Avg,
				field.Pass,
				field.Fail,
				field.Audit
			);
		} catch (e) {
			return new InsightError(`Error creating section: ${e}`);
		}
	}

	public async removeDataset(id: string): Promise<string> {
		// 1. Validate the ID
		this.validDatasetID(id);

		// 2. Check if the dataset exists
		if (!(await this.processor.doesDatasetExist(id))) {
			throw new NotFoundError(`Dataset with ID ${id} does not exist`);
		}

		try {
			// 3. Remove from memory

			// 4. Remove from disk (cache)
			const filePath = path.join(__dirname, "../../data", `${id}.json`);
			await fs.remove(filePath); // Use fs.remove to delete the file

			const index = this.datasets.indexOf(id);
			this.datasets.splice(index, 1);

			return Promise.resolve(id); // Return the removed ID
		} catch (error) {
			// Handle potential errors during file removal
			throw new InsightError(`Failed to remove dataset ${id}: ${error}`);
		}
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		if (typeof query !== "object" || query === null) {
			throw new InsightError("Query must be an object.");
		}
		return await this.queryEngine.handleQuery(query, this.processor);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		let allData: Dataset[] = [];
		const insightData: InsightDataset[] = [];

		const currentData = await this.processor.getAllDatasetIds();

		if (currentData.length < 1) {
			return insightData;
		}

		allData = await this.processor.getAllDatasets();

		//loop through all Data and for each element in the array make InsightDataset and add to insightData array
		for (const dataset of allData) {
			insightData.push({
				id: dataset.getId(),
				kind: dataset.getKind(),
				numRows: dataset.getContent().length,
			});
		}
		return insightData;
	}

	public validDatasetID(id: string): void {
		if (!id || id.includes("_") || id.trim().length === 0) {
			throw new InsightError("White space, empty string, or underscore id");
		}
	}

	public isBase64(str: string): boolean {
		try {
			// Attempt to decode the string. If it's not base64, this will throw an error.
			Buffer.from(str, "base64").toString("ascii");
			return true; // If decoding succeeds, it's valid base64.
		} catch {
			return false; // If decoding fails, it's not valid base64.
		}
	}
}
