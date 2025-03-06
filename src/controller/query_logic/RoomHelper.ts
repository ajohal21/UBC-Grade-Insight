import { Room } from "../types/Room";
import { InsightError } from "../IInsightFacade";

export class RoomHelper {
	/**
	 * Retrieves the value of a specific field from a Room object.
	 * @param room - The Room instance containing room data.
	 * @param key - The dataset-prefixed column name (e.g., "rooms_lat").
	 * @returns The corresponding field value as a string or number.
	 * @throws InsightError if the key does not correspond to a valid room field.
	 */
	private static fieldMap: Record<string, (r: Room) => string | number> = {
		fullname: (r) => r.getFullname(),
		shortname: (r) => r.getShortname(),
		number: (r) => r.getNumber(),
		name: (r) => r.getName(),
		address: (r) => r.getAddress(),
		lat: (r) => r.getLat(),
		lon: (r) => r.getLon(),
		seats: (r) => r.getSeats(),
		type: (r) => r.getType(),
		furniture: (r) => r.getFurniture(),
		href: (r) => r.getHref(),
	};

	public static getRoomValue(room: Room, key: string): string | number {
		const fieldName = key.split("_")[1];

		if (!this.fieldMap[fieldName]) {
			throw new InsightError(`Column '${key}' not found in room.`);
		}

		return this.fieldMap[fieldName](room);
	}
}
