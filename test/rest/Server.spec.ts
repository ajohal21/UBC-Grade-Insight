// test/rest/Server.spec.ts
import Server from "../../src/rest/Server";
import request from "supertest"; // Import SuperTest and Test
import { expect } from "chai";
import { readFileSync } from "fs";
import path from "path";
import { StatusCodes } from "http-status-codes";
import { clearDisk } from "../TestUtil";

describe("Server", () => {
	let server: Server;
	let agent: any;
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

	//Test Cases for PUT request
	it("should successfully add a valid dataset", async () => {
		const response = await agent // Use expressApp
			.put("/dataset/sections/courses")
			.set("Content-Type", "application/zip") // Corrected content type
			.send(readFileSync(path.resolve(__dirname, "../../test/resources/archives/pair.zip"))); // Use a test file and path.resolve
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.be.an("array");
	});

	//invalid id (contains underscore)
	it("should return status 400 given dataset with invalid ID (underscore)", async () => {
		const response = await agent // Use expressApp
			.put("/dataset/sections_test/courses")
			.set("Content-Type", "application/zip")
			.send(readFileSync(path.resolve(__dirname, "../../test/resources/archives/pair.zip"))); // and path.resolve
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	//invalid id (empty)
	// it("should return status 400 given dataset with invalid ID (empty)", async () => {
	// 	const response = await agent // Use expressApp
	// 		.put("/dataset//courses")
	// 		.set("Content-Type", "application/zip")
	// 		.send(readFileSync(path.resolve(__dirname, "../../test/resources/archives/pair.zip"))); // and path.resolve
	// 	expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
	// 	expect(response.body.error).to.be.a("string");
	// });

	//invalid kind
	// it("should return status 400 given an invalid kind", async () => {
	// 	const response = await agent // Use expressApp
	// 		.put("/dataset/sections/invalid")
	// 		.set("Content-Type", "application/zip")
	// 		.send(readFileSync(path.resolve(__dirname, "../../test/resources/archives/pair.zip"))); // and path.resolve
	// 	expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
	// 	expect(response.body.error).to.be.a("string");
	// });

	// Test Cases for DELETE Request
	it("should successfully delete a dataset", async () => {
		const response = await agent.delete("/dataset/sections"); // Use expressApp
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.equal("sections");
	});

	//invalid id (contains underscore)
	// it("should return status 400 given delete request with invalid ID (underscore)", async () => {
	// 	const response = await agent.delete("/dataset/sections_test"); // Use expressApp
	// 	expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
	// 	expect(response.body.error).to.be.a("string");
	// });

	//invalid id (empty)
	// it("should return status 400 given delete request with invalid ID (empty)", async () => {
	// 	const response = await agent.delete("/dataset/"); // Use expressApp
	// 	expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
	// 	expect(response.body.error).to.be.a("string");
	// });

	it("should return status 404 given delete request with invalid id", async () => {
		const response = await agent.delete("/dataset/sectionstest"); // Use expressApp
		expect(response.status).to.equal(StatusCodes.NOT_FOUND);
		expect(response.body.error).to.be.a("string");
	});

	// Test Cases for POST Request
	it("should successfully perform a valid query", async () => {
		await agent // Use expressApp
			.put("/dataset/sections/courses")
			.set("Content-Type", "application/zip") // Corrected content type
			.send(readFileSync(path.resolve(__dirname, "../../test/resources/archives/pair.zip")));
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
		const response = await agent // Use expressApp
			.post("/query")
			.send(query)
			.set("Content-Type", "application/json");
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
		const response = await agent // Use expressApp
			.post("/query")
			.send(query)
			.set("Content-Type", "application/json");
		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	//empty query
	it("should return status 400 for an empty query", async () => {
		const response = await agent // Use expressApp
			.post("/query")
			.send({}) // Send an empty object
			.set("Content-Type", "application/json");

		expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
		expect(response.body.error).to.be.a("string");
	});

	//Test Cases for GET Request
	it("should list datasets", async () => {
		const response = await agent.get("/datasets"); // Use expressApp
		expect(response.status).to.equal(StatusCodes.OK);
		expect(response.body.result).to.be.an("array");
	});
});
