// test/rest/Server.spec.ts
import Server from "../../src/rest/Server";
import request from "supertest";
import { expect } from "chai";
import { readFileSync } from "fs"; // We *will* use readFileSync to get a Buffer
import path from "path";
import { StatusCodes } from "http-status-codes";
import { before, after, beforeEach, afterEach } from "mocha";
import { clearDisk } from "../TestUtil";

describe("Server", () => {
	let server: Server;
	let agent: any; // Corrected type
	const port = 4321;

	before(async () => {
		server = new Server(port);
		await server.start();
		agent = request(server.getExpressApp()); // Create the agent in beforeAll
	});

	after(async () => {
		await clearDisk();
		await server.stop();
	});

	beforeEach(async () => {
		// Attempt to delete the 'sections' dataset before each test.
		await clearDisk();
	});
	afterEach(async () => {
		//delete the data after each test!
		await clearDisk();
	});

	it("should respond to /echo/:msg with the message", async () => {
		const message = "hello";
		const response = await agent.get(`/echo/${message}`); // Use agent
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.equal(`${message}...${message}`);
	});

	// it("should respond with 400 for /echo with no message", async () => {
	// 	const response = await agent.get("/echo/"); // Use agent
	// 	expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
	// 	expect(response.body).to.have.property("error");
	// });

	// Test Cases for PUT request
	it("should successfully add a valid dataset", async () => {
		// 1. Read the file into a Buffer:
		const filePath = path.resolve(__dirname, "../../test/resources/archives/pair.zip");
		const fileBuffer = readFileSync(filePath); // Read as a Buffer

		// 3. Send the base64 string in the request body:
		const response = await agent
			.put("/dataset/sections/courses")
			.set("Content-Type", "application/octet-stream") // IMPORTANT: Set correct content type
			.send(fileBuffer); // Send the raw buffer

		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.be.an("array"); // Assuming addDataset returns an array
	});

	//invalid id (contains underscore)
	it("should return status 400 given dataset with invalid ID (underscore)", async () => {
		const filePath = path.resolve(__dirname, "../../test/resources/archives/pair.zip");
		const fileBuffer = readFileSync(filePath);

		const response = await agent
			.put("/dataset/sections_test/courses")
			.set("Content-Type", "application/octet-stream")
			.send(fileBuffer);
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	//invalid id (empty)
	// it("should return status 400 given dataset with invalid ID (empty)", async () => {
	// 	const filePath = path.resolve(__dirname, "../../test/resources/archives/pair.zip");
	// 	const fileBuffer = readFileSync(filePath);
	// 	const response = await agent
	// 		.put("/dataset//courses")
	// 		.set("Content-Type", "application/octet-stream")
	// 		.send(fileBuffer);
	// 	expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
	// 	expect(response.body.error).to.be.a("string");
	// });

	// Test Cases for DELETE Request
	it("should successfully delete a dataset", async () => {
		const filePath = path.resolve(__dirname, "../../test/resources/archives/pair.zip");
		const fileBuffer = readFileSync(filePath); // Read as a Buffer

		// 3. Send the base64 string in the request body:
		await agent
			.put("/dataset/sections/courses")
			.set("Content-Type", "application/octet-stream") // IMPORTANT: Set correct content type
			.send(fileBuffer); // Send the raw buffer
		const response = await agent.delete("/dataset/sections");
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.equal("sections");
	});

	//invalid id (contains underscore)
	it("should return status 404 given delete request with invalid ID (underscore)", async () => {
		const response = await agent.delete("/dataset/sections_test");
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST); //now 404 since data is removed
		expect(response.body.error).to.be.a("string");
	});

	//invalid id (empty)
	// it("should return status 400 given delete request with invalid ID (empty)", async () => {
	// 	const response = await agent.delete("/dataset/");
	// 	expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
	// 	expect(response.body.error).to.be.a("string");
	// });

	it("should return status 404 given delete request with invalid id", async () => {
		const filePath = path.resolve(__dirname, "../../test/resources/archives/pair.zip");
		const fileBuffer = readFileSync(filePath); // Read as a Buffer

		// 3. Send the base64 string in the request body:
		await agent
			.put("/dataset/sections/courses")
			.set("Content-Type", "application/octet-stream") // IMPORTANT: Set correct content type
			.send(fileBuffer);
		const response = await agent.delete("/dataset/sectionstest");
		expect(response.status).to.equal(StatusCodes.NOT_FOUND);
		expect(response.body.error).to.be.a("string");
	});

	// Test Cases for POST Request
	it("should successfully perform a valid query", async () => {
		const filePath = path.resolve(__dirname, "../../test/resources/archives/pair.zip");
		const fileBuffer = readFileSync(filePath); // Read as a Buffer

		// 3. Send the base64 string in the request body:
		await agent
			.put("/dataset/sections/courses")
			.set("Content-Type", "application/octet-stream") // IMPORTANT: Set correct content type
			.send(fileBuffer);
		const query = {
			WHERE: {
				AND: [
					{
						IS: {
							sections_dept: "cpsc",
						},
					},
					{
						IS: {
							sections_id: "310",
						},
					},
				],
			},
			OPTIONS: {
				COLUMNS: ["sections_avg", "sections_year", "avgGrade"],
				ORDER: {
					dir: "UP",
					keys: ["sections_year"],
				},
			},
			TRANSFORMATIONS: {
				GROUP: ["sections_year"],
				APPLY: [
					{
						avgGrade: {
							AVG: "sections_avg",
						},
					},
				],
			},
		};
		const response = await agent.post("/query").send(query).set("Content-Type", "application/json");
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.be.an("array");
	});

	//invalid id (contains underscore)
	it("should return status 400 given query request with invalid ID (underscore)", async () => {
		const query = {
			WHERE: {
				AND: [
					{
						IS: {
							sections_dept: "cpsc",
						},
					},
					{
						IS: {
							sections_id: "310",
						},
					},
				],
			},
			OPTIONS: {
				COLUMNS: ["sections_avg", "sections_year", "avgGrade"],
				ORDER: {
					dir: "UP",
					keys: ["sections_year_"],
				},
			},
			TRANSFORMATIONS: {
				GROUP: ["sections_year"],
				APPLY: [
					{
						avgGrade: {
							AVG: "sections_avg",
						},
					},
				],
			},
		};
		const response = await agent.post("/query").send(query).set("Content-Type", "application/json");
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	//empty query
	it("should return status 400 for an empty query", async () => {
		const response = await agent
			.post("/query")
			.send({}) // Send an empty object
			.set("Content-Type", "application/json");

		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	//Test Cases for GET Request
	it("should list datasets", async () => {
		const response = await agent.get("/datasets");
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.be.an("array");
	});
});
