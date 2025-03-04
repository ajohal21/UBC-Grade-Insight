import fs from "fs-extra";
import path from "path"; // For handling file paths
import { Dataset } from "./types/Dataset";
import { Section } from "./types/Section";
import { InsightDatasetKind, InsightError } from "./IInsightFacade";
import { Room } from "./types/Room";

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
					resolve(new Dataset(datasetId, sections, InsightDatasetKind.Sections));
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
					const kind = parsed.kind;

					if (kind === InsightDatasetKind.Sections) {
						return this.parseSectionsDataset(id, parsed.sections);
					} else if (kind === InsightDatasetKind.Rooms) {
						return this.parseRoomsDataset(id, parsed.rooms);
					} else {
						// Handle invalid kind if necessary
						throw new InsightError(`Invalid dataset kind: ${kind}`);
					}
				});

			return Promise.all(datasetPromises);
		} catch (err) {
			throw new InsightError("error" + err);
		}
	}

	private async parseSectionsDataset(id: string, sectionsData: any): Promise<Dataset> {
		const sections = sectionsData.map((s: any) => {
			const { uuid, ids, title, instructor, dept, year, avg, pass, fail, audit } = s;
			return new Section(uuid, ids, title, instructor, dept, year, avg, pass, fail, audit);
		});
		return new Dataset(id, sections, InsightDatasetKind.Sections);
	}

	private async parseRoomsDataset(id: string, roomsData: any): Promise<Dataset> {
		const rooms = roomsData.map((r: any) => {
			const { fullname, shortname, number, name, address, lat, lon, seats, type, furniture, href } = r;
			return new Room(fullname, shortname, number, name, address, lat, lon, seats, type, furniture, href);
		});
		return new Dataset(id, rooms, InsightDatasetKind.Rooms);
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
