import { IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, InsightResult } from "./IInsightFacade";
import { DatasetProcessor } from "/Users/aman/Documents/2025 Term 2/project_team180/src/controller/DatasetProcessor";
import JSZip from "jszip";
import { Section } from "./types/Section";
import { Dataset } from "./types/Dataset";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasets: any[] = []; // Using a simple object to store datasets for now
	private processor = new DatasetProcessor("data");
	private sectionDatasetArray: any[] = [];

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		this.validDatasetID(id);

		if (this.datasets.includes(id)) {
			throw new InsightError("Dataset with this ID already exists.");
		}

		try {
			const zip = new JSZip();
			const zipResult = await zip.loadAsync(content, { base64: true });

			this.validZip(zipResult);

			const filePromises: Promise<void>[] = [];
			zip.forEach((path, file) => {
				if (!file.dir && path.startsWith("courses/")) {
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

	public validDatasetID(id: string): void {
		if (!id || id.includes("_") || id.trim().length === 0) {
			throw new InsightError("White space, empty string, or underscore id");
		}
	}
}
