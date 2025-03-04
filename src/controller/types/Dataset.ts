import {Section} from "./Section";
import {InsightDatasetKind} from "../IInsightFacade";

export class Dataset {
	private readonly id: string;
	private readonly sections: Section[];
	private readonly kind: InsightDatasetKind;

	constructor(id: string, sections: Section[] = [], kind: InsightDatasetKind) {
		this.id = id;
		this.sections = sections;
		this.kind = kind;
	}

	public getId(): string {
		return this.id;
	}

	public getSections(): Section[] {
		return [...this.sections]; // Return a copy to prevent modification
	}

	public addSection(section: Section): void {
		this.sections.push(section);
	}
}
