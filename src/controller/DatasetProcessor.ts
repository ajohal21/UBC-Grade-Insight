import { promises as fs } from "fs"; // For reading/writing files asynchronously
import path from "path"; // For handling file paths
import { Dataset } from "./types/Dataset";
import { Section } from "./types/Section";
import { InsightError } from "./IInsightFacade";

export class DatasetProcessor {
	private storagePath: string;

	constructor(storagePath: string) {
		this.storagePath = storagePath;
	}

	/**
	 * Loads a dataset from disk if it exists.
	 * @param datasetId - The ID of the dataset to load.
	 * @returns A promise resolving to a Dataset object or null if not found.
	 */
	public async loadFromDisk(datasetId: string): Promise<Dataset | null> {
		const filePath = path.join(this.storagePath, `${datasetId}.json`);
		try {
			const data = await fs.readFile(filePath, "utf8");
			const parsed = JSON.parse(data);
			const sections = parsed.sections.map(
				(s: any) => new Section(s.uuid, s.id, s.title, s.instructor, s.dept, s.year, s.avg, s.pass, s.fail, s.audit)
			);
			return new Dataset(datasetId, sections);
		} catch (error) {
			throw new Error(`Failed to load dataset ${datasetId}: ${error}`);
		}
	}

	/**
	 * Saves a dataset to disk as a JSON file.
	 * @param dataset - The Dataset object to save.
	 * @returns A promise resolving when the operation is complete.
	 */
	public async saveToDisk(dataset: Dataset): Promise<void> {
		const filePath = path.join(this.storagePath, `${dataset.getId()}.json`);
		try {
			const jsonData = JSON.stringify(dataset, null, 2);
			await fs.writeFile(filePath, jsonData, "utf8");
		} catch (error) {
			throw new Error(`Error saving dataset ${dataset.getId()}: ${error}`);
		}
	}

	/**
	 * Converts raw section data into a valid dataset with valid query keys and saves to disk.
	 * @param id - Dataset id
	 * @param rawSections - An array of raw section objects.
	 * @returns Promise that resolves to the id.
	 */
	public async convertToDataset(id: string, rawSections: any[]): Promise<String> {
		// Create an instance of Dataset with the list of sections
		const newDataset = new Dataset(
			id,
			rawSections.map((s) => {
				return new Section(
					s.id, // Maps to uuid
					s.Course, // Maps to id
					s.Title, // Maps to title
					s.Professor, // Maps to instructor
					s.Subject, // Maps to dept
					s.Year, // Maps to year
					s.Avg, // Maps to avg
					s.Pass, // Maps to pass
					s.Fail, // Maps to fail
					s.Audit // Maps to audit
				);
			})
		);

		try {
			await this.saveToDisk(newDataset);
			return id;
		} catch (error) {
			throw new InsightError(`Failed to save dataset to disk: ${(error as Error).message}`);
		}
	}
}
