// test/rest/Server.spec.ts
import Server from "../../src/rest/Server";
import request from "supertest";
import { expect } from "chai";
import { StatusCodes } from "http-status-codes";
import { before, after, beforeEach, afterEach } from "mocha";
import { clearDisk, getContentFromArchives } from "../TestUtil";

describe("Server", () => {
	let server: Server;
	let agent: any; // Corrected type
	const port = 4321;
	let sectionsBase64: string;
	let sectionsBuffer: Buffer;

	before(async () => {
		sectionsBase64 = await getContentFromArchives("pair.zip");
		sectionsBuffer = Buffer.from(sectionsBase64, "base64");

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

	// Test Cases for PUT request
	it("should successfully add a valid dataset", async () => {
		const response = await agent
			.put("/dataset/sections/courses")
			.set("Content-Type", "application/octet-stream") // Match express.raw
			.send(sectionsBuffer); // <<<--- SEND THE BUFFER
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.be.an("array");
	});

	it("should return status 400 given dataset with invalid ID (underscore)", async () => {
		const response = await agent
			.put("/dataset/sections_test/courses")
			.set("Content-Type", "application/octet-stream")
			.send(sectionsBuffer); // <<<--- SEND THE BUFFER
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	// Ensure server-side ID validation middleware is active for this to pass
	it("should return status 400 given dataset with invalid ID (empty)", async () => {
		const response = await agent
			.put("/dataset/%20%20/courses")
			.set("Content-Type", "application/octet-stream")
			.send(sectionsBuffer); // <<<--- SEND THE BUFFER
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	it("should return status 400 given dataset with ID already present", async () => {
		await agent.put("/dataset/aman/courses").set("Content-Type", "application/octet-stream").send(sectionsBuffer);

		const response = await agent
			.put("/dataset/aman/courses")
			.set("Content-Type", "application/octet-stream")
			.send(sectionsBuffer);
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	// Ensure server-side kind validation or routing handles this
	it("should return status 400/404 given an invalid kind in URL", async () => {
		const response = await agent
			.put("/dataset/sections/invalidkind") // Changed kind in URL
			.set("Content-Type", "application/octet-stream")
			.send(sectionsBuffer); // <<<--- SEND THE BUFFER
		// Expect 400 if validation middleware catches it, 404 if routing fails
		expect([StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND]).to.include(response.status);
		if (response.status === StatusCodes.BAD_REQUEST) {
			expect(response.body.error).to.be.a("string");
		}
	});

	// Test Cases for DELETE Request
	it("should successfully delete a dataset", async () => {
		// Add the dataset first
		await agent.put("/dataset/sections/courses").set("Content-Type", "application/octet-stream").send(sectionsBuffer);

		// Then delete it
		const response = await agent.delete("/dataset/sections");
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.equal("sections");
	});

	it("should return status 400 given delete request with invalid ID (underscore)", async () => {
		// Assumes ID validation middleware runs before checking existence
		const response = await agent.delete("/dataset/sections_test");
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	it("should return status 400 given delete request with invalid ID (empty)", async () => {
		// Assumes ID validation middleware runs
		const response = await agent.delete("/dataset/%20%20");
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	it("should return status 404 given delete request for non-existent id", async () => {
		// Don't add the dataset first
		const response = await agent.delete("/dataset/nonexistent");
		expect(response.status).to.equal(StatusCodes.NOT_FOUND);
		expect(response.body.error).to.be.a("string");
	});

	// Test Cases for POST Request
	it("should successfully perform a valid query", async () => {
		// Add the dataset first
		await agent.put("/dataset/sections/courses").set("Content-Type", "application/octet-stream").send(sectionsBuffer);

		const query = {
			/* ... your valid query ... */
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

	it("should return status 400 given query request with invalid key format (underscore)", async () => {
		// Add dataset first
		await agent.put("/dataset/sections/courses").set("Content-Type", "application/octet-stream").send(sectionsBuffer);

		const query = {
			/* ... query with sections_year_ in keys ... */
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
					keys: ["sections_year_"], // Invalid key
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

	it("should return status 400 for an empty query", async () => {
		const response = await agent.post("/query").send({}).set("Content-Type", "application/json");
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	//Test Cases for GET Request
	it("should list datasets", async () => {
		// Add a dataset first to ensure there's something to list
		await agent.put("/dataset/sections/courses").set("Content-Type", "application/octet-stream").send(sectionsBuffer);

		const response = await agent.get("/datasets");
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.be.an("array");
		expect(response.body.result.some((ds: any) => ds.id === "sections")).to.be.true;
	});
});
