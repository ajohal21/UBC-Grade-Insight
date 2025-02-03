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
import fs from "fs-extra";
import path from "path";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasets: any[] = []; // Using a simple object to store datasets for now
	private processor = new DatasetProcessor("../../data/");
	private sectionDatasetArray: any[] = [];

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		this.validDatasetID(id);

		//call load to see if the ID is present
		//is it better to load All or load the specific ID...

		if (await this.processor.doesDatasetExist(id)) {
			throw new InsightError("dataset with id already exists");
		}

		try {
			const zip = new JSZip();
			const zipResult = await zip.loadAsync(content, { base64: true });

			this.validZip(zipResult);

			const filePromises: Promise<void>[] = [];
			zip.forEach((local, file) => {
				if (!file.dir && local.startsWith("courses/")) {
					//process data into sections
					filePromises.push(this.processJsonData(file));
				}
			});
			await Promise.all(filePromises);

			//all sections now in sectionDatasetArray
			//now make Dataset with id and DatasetArray
			const newDataset = new Dataset(id, this.sectionDatasetArray);
			await this.processor.saveToDisk(newDataset);

			this.datasets.push(id);

			return Promise.resolve(this.datasets);
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

			//want to make an array of sections
			for (const field of parsedContent.result) {
				const section = new Section(
					field.id.toString(),
					field.Course,
					field.Title,
					field.Professor,
					field.Subject,
					field.Year,
					field.Avg,
					field.Pass,
					field.Fail,
					field.Audit
				);
				this.sectionDatasetArray.push(section);
			}

			return parsedContent;
		} catch (err) {
			throw new InsightError(`cannot process file: ${err}`);
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
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::listDatasets is unimplemented!`);
	}

	public validDatasetID(id: string): void {
		if (!id || id.includes("_") || id.trim().length === 0) {
			throw new InsightError("White space, empty string, or underscore id");
		}
	}
}
