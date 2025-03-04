import {Section} from "./Section";
import {Room} from "./Room";
import {InsightDatasetKind} from "../IInsightFacade";


export class Dataset {
	private readonly id: string;
	private readonly kind: InsightDatasetKind;
	private readonly sections?: Section[];
	private readonly rooms?: Room[];

	constructor(id: string, content: Section[] | Room[] = [], kind: InsightDatasetKind) {
		this.id = id;
		this.kind = kind;

		if (kind === InsightDatasetKind.Sections) {
			this.sections = content as Section[];  // Cast to Section[]
		} else if (kind === InsightDatasetKind.Rooms) {
			this.rooms = content as Room[];  // Cast to Room[]
		}
	}

	public getId(): string {
		return this.id;
	}

	public getKind(): InsightDatasetKind {
		return this.kind;
	}

	public getContent(): Section[] | Room[] {
		if (this.kind === InsightDatasetKind.Sections) {
			return this.sections!;
		} else {
			return this.rooms!;
		}
	}

	public addSection(section: Section): void {
		if (this.kind === InsightDatasetKind.Sections) {
			this.sections!.push(section);
		} else {
			throw new Error(`Cannot add Section to Dataset of kind ${this.kind}`);
		}
	}

	public addRoom(room: Room): void {
		if (this.kind === InsightDatasetKind.Rooms) {
			this.rooms!.push(room);
		} else {
			throw new Error(`Cannot add Room to Dataset of kind ${this.kind}`);
		}
	}
}
