import JSZip from "jszip";
import { InsightDatasetKind, InsightError } from "./IInsightFacade";
import { Room } from "./types/Room";
import { Dataset } from "./types/Dataset";
import { DatasetProcessor } from "./DatasetProcessor";
//import parse5 from "parse5";

export class RoomProcessor {
	private processor = new DatasetProcessor("../../data/");

	//code adapted from Sections processing with the aid of AI (gemini) to help with htm file node traversal
	public async processRoomKind(id: string, content: string): Promise<string[]> {
		const zip = new JSZip();
		const data = await zip.loadAsync(content, { base64: true });
		const parse5 = require("parse5");
		const indexFile = data.file("index.htm");

		//no index file
		if (!indexFile) {
			throw new InsightError("Index.htm file not present");
		}

		//need to find first VALID table
		const indexFileContent = await indexFile.async("text");
		const parsedDoc = parse5.parse(indexFileContent);

		const validTable = this.firstValidTable(parsedDoc);

		if (!validTable) {
			throw new InsightError("No valid table!");
		}

		const buildings = await this.parseBuildings(validTable);
		//all buildings have now been added and their relevant data

		//next map building to Room data

		const allRooms: any[] = [];
		await Promise.all(
			buildings.map(async (building: any) => {
				const room = await this.parseBuildingRooms(building, data);
				allRooms.push(...room);
			})
		);
		{
			const newDataset = new Dataset(id, allRooms, InsightDatasetKind.Rooms);
			await this.processor.saveToDisk(newDataset);

			// now we just load the diskID after an add
			const diskDatasetID = await this.processor.getAllDatasetIds();

			return diskDatasetID;
		}
	}

	//AI assisted code -- used to navigate sub folders
	public async parseBuildingRooms(building: any, data: any): Promise<any[]> {
		const parse5 = require("parse5");
		const buildingFile = data.file(building.buildinghref);
		if (!buildingFile) {
			return [];
		}

		const buildingContent = await buildingFile.async("text");
		const buildingDoc = parse5.parse(buildingContent);
		const roomTable = this.firstValidTableRoom(buildingDoc);

		if (!roomTable) {
			return [];
		}

		return this.parseRooms(buildingDoc, building);
	}

	//Gemini adopted code to create a building from table entry
	public async parseBuildings(buildingTable: any): Promise<any> {
		const rows = this.findByName(buildingTable, "tr");

		const buildings = await Promise.all(rows.map(async (row) => this.parseBuildingRow(row)));

		return buildings.filter((building) => building !== null);
	}

	//AI assisted code to help navigate to the tr header which contains the relevant room data
	public parseRooms(roomsTable: any, building: any): any[] {
		const tableBody = this.findByName(roomsTable, "tbody")[0];
		const rows = this.findByName(tableBody, "tr");

		return rows.map((row) => this.parseRoomRow(row, building)).filter((room) => room !== null);
	}

	public parseRoomRow(row: any, building: any): Room {
		let number = this.getContent(row, "views-field-field-room-number");
		const seats = this.getContent(row, "views-field-field-room-capacity");
		let furniture = this.getContent(row, "views-field-field-room-furniture");
		let type = this.getContent(row, "views-field-field-room-type");
		let href = this.getHref(row, "views-field-field-room-number");

		if (furniture) {
			furniture = furniture.replace(/&amp;/g, "&");
		}

		if (number && seats && furniture && type && href) {
			const sname = building.shortname + "_" + number.trim();
			number = String(number.trim());
			const seatsNum = Number(seats.trim());
			furniture = furniture.trim();
			type = type.trim();
			href = href.trim();
			const room = new Room(
				building.fullname,
				building.shortname,
				number,
				sname,
				building.address,
				building.lat,
				building.lon,
				seatsNum,
				type,
				furniture,
				href
			);
			return room;
		}
		throw new InsightError();
	}
	//gemini adapted code -- prompt to get text from tr tag
	public getContent(row: any, className: string): string | null {
		const parse5 = require("parse5");
		const cell = this.findByName(row, "td").find((cel) => {
			const classAttr = cel.attrs?.find((attr: any) => attr.name === "class");
			return classAttr?.value.includes(className);
		});
		return cell ? parse5.serialize(cell).replace(/(<([^>]+)>)/gi, "") : null;
	}

	// gemini referenced to get href from room tag -- this is the url we need
	public getHref(row: any, className: string): string | null {
		const cell = this.findByName(row, "td").find((cel) => {
			const classAttr = cel.attrs?.find((attr: any) => attr.name === "class");
			return classAttr?.value.includes(className);
		});

		if (cell) {
			const anchorTag = this.findByName(cell, "a")[0];
			const hrefAttr = anchorTag?.attrs?.find((attr: any) => attr.name === "href");
			return hrefAttr ? hrefAttr.value : null;
		}
		return null;
	}

	public async parseBuildingRow(row: any): Promise<any> {
		const titleCell = this.findCell(row, "views-field-title");
		const addressCell = this.findCell(row, "views-field-field-building-address");

		if (titleCell && addressCell) {
			const fullname = this.getFullname(titleCell);
			const link = this.getLink(titleCell);
			const shortname = this.getShortName(link);
			const href = link ? link.attrs.find((attr: any) => attr.name === "href")?.value.replace("./", "") : null;
			const address = this.getAddress(addressCell);

			try {
				// Fetch geolocation
				const geoResponse = await this.fetchGeolocation(address);

				// Check if there was an error in fetching geolocation
				if (geoResponse.error) {
					return null;
				}

				return {
					fullname: fullname,
					shortname: shortname,
					address: address,
					lat: geoResponse.lat,
					lon: geoResponse.lon,
					buildinghref: href,
				};
			} catch (e) {
				throw new InsightError(`invalid GeoLocation: ${e}`);
			}
		}
		return null;
	}

	public getLink(cell: any): any {
		const links = this.findByName(cell, "a");
		if (links.length > 0) {
			return links[0];
		}
		return null;
	}
	//gemini adapted to get shortName from the link -- prompt from inspect element
	public getShortName(link: any): string | null {
		if (link?.attrs) {
			const href = link.attrs.find((attr: any) => attr.name === "href")?.value;
			if (href) {
				const match = href.match(/\/([A-Z]+)\.htm/); // Extract the shortname from the href
				if (match?.[1]) {
					return match[1];
				}
			}
		}
		return null;
	}

	//gemini consulted code
	public getFullname(cell: any): string {
		let fullname = "";
		if (cell.childNodes) {
			for (const childNode of cell.childNodes) {
				if (childNode.nodeName === "a") {
					// Extract text content directly from the <a> tag
					if (childNode.childNodes) {
						for (const textNode of childNode.childNodes) {
							if (textNode.nodeName === "#text") {
								fullname += textNode.value.trim();
							}
						}
					}
					break; // Assuming there's only one <a> tag with the full name
				}
			}
		}
		return fullname;
	}

	public getAddress(cell: any): string {
		let address = "";
		if (cell.childNodes) {
			for (const textNode of cell.childNodes) {
				if (textNode.nodeName === "#text") {
					address += textNode.value.trim();
				}
			}
		}
		return address;
	}

	public findCell(row: any, text: string): any {
		return this.findByName(row, "td").find((cell) => {
			const classAttr = cell.attrs?.find((attr: any) => attr.name === "class");
			return classAttr?.value.split(" ").includes(text);
		});
	}

	//function to check that Table exists and is valid
	public firstValidTable(doc: string): any {
		//first check that table exists
		const allTables = this.findByName(doc, "table");
		for (const table of allTables) {
			if (this.hasValidBuilding(table)) {
				return table;
			}
		}
		return null;
	}

	public firstValidTableRoom(doc: string): any {
		//first check that table exists
		const allTables = this.findByName(doc, "table");
		for (const table of allTables) {
			if (this.hasValidRoom(table)) {
				return table;
			}
		}
		return null;
	}

	//Function to retrieve the cells with TD tag and verify the presence of the two fields we need as
	//described in the spec
	public hasValidBuilding(table: any): boolean {
		const cells = this.findByName(table, "td");
		let viewsFieldTitle = false;
		let buildingAddress = false;

		for (const cell of cells) {
			const classAttribute = cell.attrs?.find((attr: any) => attr.name === "class");
			if (classAttribute) {
				const cellClasses = classAttribute.value.split(" ");
				if (cellClasses.includes("views-field") && cellClasses.includes("views-field-title")) {
					viewsFieldTitle = true;
				}
				if (cellClasses.includes("views-field") && cellClasses.includes("views-field-field-building-address")) {
					buildingAddress = true;
				}
			}
		}

		return viewsFieldTitle && buildingAddress;
	}

	//same code as above just for room info.
	//info derived from inspect element
	public hasValidRoom(table: any): boolean {
		const cells = this.findByName(table, "th");
		let roomNum = false;
		let capacity = false;
		let furniture = false;
		let type = false;

		for (const cell of cells) {
			const classAttribute = cell.attrs?.find((attr: any) => attr.name === "class");
			if (classAttribute) {
				const cellClasses = classAttribute.value.split(" ");
				if (cellClasses.includes("views-field") && cellClasses.includes("views-field-field-room-number")) {
					roomNum = true;
				}
				if (cellClasses.includes("views-field") && cellClasses.includes("views-field-field-room-capacity")) {
					capacity = true;
				}
				if (cellClasses.includes("views-field") && cellClasses.includes("views-field-field-room-furniture")) {
					furniture = true;
				}
				if (cellClasses.includes("views-field") && cellClasses.includes("views-field-field-room-type")) {
					type = true;
				}
			}
		}

		return roomNum && capacity && furniture && type;
	}

	//recursive function to add "table" tag to array -- adapted from Gemini
	public findByName(doc: any, text: string): any[] {
		const tables: any[] = [];
		if (doc.tagName === text) {
			tables.push(doc);
		}

		if (doc.childNodes && Array.isArray(doc.childNodes)) {
			for (const child of doc.childNodes) {
				tables.push(...this.findByName(child, text));
			}
		}
		return tables;
	}

	//AI assisted code
	public async fetchGeolocation(address: string): Promise<any> {
		const encodedAddress = encodeURIComponent(address); // URL-encode the address
		const url = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team180/${encodedAddress}`;
		const response = await fetch(url);
		return await response.json();
	}
}
