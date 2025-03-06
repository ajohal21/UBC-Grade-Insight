import { Section } from "../types/Section";
import { InsightError } from "../IInsightFacade";

export class SectionHelper {

	/**
	 * Retrieves the value of a specific field from a Section object.
	 * @param section - The Section instance containing course data.
	 * @param key - The dataset-prefixed column name (e.g., "courses_avg").
	 * @returns The corresponding field value as a string or number.
	 * @throws InsightError if the key does not correspond to a valid section field.
	 */
	public static getSectionValue(section: Section, key: string): string | number {
		const fieldMap: Record<string, (s: Section) => string | number> = {
			uuid: (s) => s.getUuid(),
			id: (s) => s.getId(),
			title: (s) => s.getTitle(),
			instructor: (s) => s.getInstructor(),
			dept: (s) => s.getDept(),
			year: (s) => s.getYear(),
			avg: (s) => s.getAvg(),
			pass: (s) => s.getPass(),
			fail: (s) => s.getFail(),
			audit: (s) => s.getAudit(),
		};

		const fieldName = key.split("_")[1];
		if (!fieldMap[fieldName]) {
			throw new InsightError(`Column '${key}' not found in section.`);
		}

		return fieldMap[fieldName](section);
	}
}
