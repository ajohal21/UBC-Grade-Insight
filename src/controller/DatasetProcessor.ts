import fs from "fs-extra";
import path from "path";
import { Dataset } from "./types/Dataset";
import { Section } from "./types/Section";

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
		return new Promise((resolve, reject) => {
			fs.readFile(filePath, "utf8", (err, data) => {
				if (err) {
					reject(new Error(`Failed to load dataset ${datasetId}: ${err.message}`));
					return;
				}

				try {
					const parsed = JSON.parse(data);
					const sections = parsed.sections.map(
						(s: any) => new Section(s.uuid, s.id, s.title, s.instructor, s.dept, s.year, s.avg, s.pass, s.fail, s.audit)
					);
					resolve(new Dataset(datasetId, sections));
				} catch {
					reject(new Error(`Failed to parse dataset.`));
				}
			});
		});
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
}
