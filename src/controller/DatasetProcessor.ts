import fs from "fs-extra";
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
		const fileID = this.encodeDatasetId(datasetId);

		const filePath = path.join(__dirname, this.storagePath, `${fileID}.json`);
		return new Promise((resolve, reject) => {
			fs.readFile(filePath, "utf8", (err, data) => {
				if (err) {
					reject(new InsightError(`Failed to load dataset ${fileID}: ${err.message}`));
					return;
				}

				try {
					const parsed = JSON.parse(data);
					const sections = parsed.sections.map((s: any) => {
						const uuid = s.uuid;
						const id = s.id;
						const title = s.title;
						const instructor = s.instructor;
						const dept = s.dept;
						const year = s.year;
						const avg = s.avg;
						const pass = s.pass;
						const fail = s.fail;
						const audit = s.audit;

						return new Section(uuid, id, title, instructor, dept, year, avg, pass, fail, audit);
					});
					resolve(new Dataset(datasetId, sections));
				} catch {
					reject(new InsightError(`Failed to parse dataset.`));
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
		const fileID = this.encodeDatasetId(dataset.getId());
		const filePath = path.join(__dirname, this.storagePath, `${fileID}.json`);
		try {
			const jsonData = JSON.stringify(dataset, null, 2);
			await fs.ensureDir(path.dirname(filePath));
			await fs.writeFile(filePath, jsonData, "utf8");
		} catch (error) {
			throw new InsightError(`Error saving dataset ${dataset.getId()}: ${error}`);
		}
	}

	public async doesDatasetExist(id: string): Promise<boolean> {
		const fileID = this.encodeDatasetId(id);
		const filePath = path.join(__dirname, this.storagePath, `${fileID}.json`);
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	public async getAllDatasets(): Promise<Dataset[]> {
		const dataDirPath = path.join(__dirname, this.storagePath);
		try {
			const files = await fs.readdir(dataDirPath);

			const datasetPromises = files
				.filter((fileName) => fileName.endsWith(".json"))
				.map(async (fileName) => {
					const filePath = path.join(dataDirPath, fileName);
					const data = await fs.readFile(filePath, "utf8");
					const parsed = JSON.parse(data);

					const id = parsed.id;
					const sections = parsed.sections.map((s: any) => {
						const uuid = s.uuid;
						//const id = s.id;
						const title = s.title;
						const instructor = s.instructor;
						const dept = s.dept;
						const year = s.year;
						const avg = s.avg;
						const pass = s.pass;
						const fail = s.fail;
						const audit = s.audit;

						return new Section(uuid, id, title, instructor, dept, year, avg, pass, fail, audit);
					});

					return new Dataset(id, sections);
				});

			return Promise.all(datasetPromises); // Wait for all datasets to be loaded
		} catch (error) {
			throw new InsightError(`Failed to retrieve datasets: ${error}`);
		}
	}

	public async getAllDatasetIds(): Promise<string[]> {
		const dataDirPath = path.join(__dirname, this.storagePath);

		try {
			// Ensure the data directory exists
			await fs.ensureDir(dataDirPath);

			const files = await fs.readdir(dataDirPath);

			const datasetIds = files
				.filter((fileName) => fileName.endsWith(".json"))
				.map((fileName) => {
					const encodedId = fileName.replace(/\.json$/, "");
					return this.decodeDatasetId(encodedId);
				});

			return Promise.resolve(datasetIds);
		} catch (error) {
			throw new InsightError(`Failed to retrieve datasets: ${error}`);
		}
	}

	public encodeDatasetId(id: string): string {
		return encodeURIComponent(id);
	}

	public decodeDatasetId(encodedId: string): string {
		return decodeURIComponent(encodedId);
	}
}
