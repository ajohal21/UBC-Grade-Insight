// test/rest/Server.spec.ts
import Server from "../../src/rest/Server";
import request, { Response } from "supertest";
import { expect } from "chai";
import { StatusCodes } from "http-status-codes";
import { before, after, beforeEach, afterEach } from "mocha";
import { clearDisk } from "../TestUtil";
import fs from "fs-extra";
import { Log } from "@ubccpsc310/project-support";

describe("Server", function () {
	let server: Server;

	const port = 4321;

	before(async () => {
		server = new Server(port);
		await server.start().catch((err: Error) => {
			throw err;
		});
	});

	after(async () => {
		if (server) {
			await server.stop();
		}
		await clearDisk();
	});

	beforeEach(async () => {
		// Attempt to delete the 'sections' dataset before each test.
		await clearDisk();
	});
	afterEach(async () => {});

	// Test Cases for PUT request
	it("PUT should successfully add a valid dataset", async function () {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			return await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
					expect(res.body.result).to.be.equal("[aman]");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			Log.error(`error: ${err})`);
		}
	});

	it("PUT should return status 400 given dataset with invalid ID (underscore)", async () => {
		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/ubc_ubc/sections";
		const ZIP_FILE_DATA = await fs.readFile("test/resources/archives/pair.zip");
		try {
			return await request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					expect(res.body.result).to.be.a("string");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			err;
		}
	});

	it("PUT should return status 400 given dataset with invalid ID (empty)", async () => {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/%20%20/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			return await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					Log.info("TYPE OF RES", res.body);
					expect(res.body.result).to.be.a("string");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});

	it("PUT should return status 400 given dataset with ID already present", async () => {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});
			return await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					Log.info("RES body error:", res.body);
					expect(res.body).to.have.property("error").that.is.a("string");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			err;
		}
	});

	// Test Cases for DELETE Request
	it("should successfully delete a dataset", async () => {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});
			return request(SERVER)
				.delete("/dataset/aman")
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
					Log.info("RESULT IS:", res.body);
					expect(res.body.result).to.be.equal("aman");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});

	it("should return status 400 given delete request with invalid ID (underscore)", async () => {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});
			return request(SERVER)
				.delete("/dataset/ama_n")
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					expect(res.body).to.have.property("error").that.is.a("string");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});

	it("should return status 400 given delete request with invalid ID (empty)", async () => {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});
			return request(SERVER)
				.delete("/dataset/%20%20")
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					expect(res.body).to.have.property("error").that.is.a("string");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});

	it("should return status 404 given delete request for non-existent id", async () => {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});
			return request(SERVER)
				.delete("/dataset/kylee")
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.NOT_FOUND);
					expect(res.body).to.have.property("error").that.is.a("string");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});

	// Test Cases for POST Request
	it("should successfully perform a valid query", async () => {
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
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.post(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});
			return request(SERVER)
				.post("/dataset/query")
				.send(query)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
					expect(res.body).to.be.a("array");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});

	it("should return status 400 given query request with invalid key format (underscore)", async () => {
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
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.post(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});
			return request(SERVER)
				.post("/dataset/query")
				.send(query)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.BAD_REQUEST);
					expect(res.error).to.be.a("string");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});

	//Test Cases for GET Request
	it("should list datasets", async () => {
		const SERVER = "http://localhost:4321";
		const ENDPOINT = "/dataset/aman/sections";
		const SECTIONS = await fs.readFile("test/resources/archives/pair.zip");

		try {
			await request(SERVER)
				.put(ENDPOINT)
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					expect.fail();
				});

			return await request(SERVER)
				.get("/dataset/aman")
				.send(SECTIONS)
				.set("Content-Type", "application/x-zip-compressed")
				.then((response) => {
					expect(response.status).to.be.equal(StatusCodes.OK);
					expect(response.body).to.be.a("array");
				})
				.catch(function (err) {
					expect.fail();
				});
		} catch (err) {
			return err;
		}
	});
});
