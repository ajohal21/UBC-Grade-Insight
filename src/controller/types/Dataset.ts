import { Section } from "./Section";

export class Dataset {
	private readonly id: string;
	private readonly sections: Section[];

	constructor(id: string, sections: Section[] = []) {
		this.id = id;
		this.sections = sections;
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
