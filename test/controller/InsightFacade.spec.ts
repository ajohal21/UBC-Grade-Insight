import {
	IInsightFacade,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
//
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	let sections: string;

	//zip that does not have courses folder as root
	let notCourses: string;
	//zip with courses root but nothing in it
	let noContent: string;
	//Zip with courses but each course is empty
	let badJSON: string;

	let course: string;

	let invalidSection: string;

	let noResultskey: string;

	let jsonMissingComma: string;

	let campus: string;

	let campusNoIndex: string;

	let campusNoTables: string;

	let campusNoBuidlingandRoom: string;

	let campusEmptyBuildings: string;

	let campusNoGoodTd: string;

	before(async function () {
		sections = await getContentFromArchives("pair.zip");
		notCourses = await getContentFromArchives("NoCoursesRoot.zip");
		noContent = await getContentFromArchives("NoContent.zip");
		badJSON = await getContentFromArchives("badJSON.zip");
		//notAZip = await getContentFromArchives("notAZip.zip");
		course = await getContentFromArchives("course.zip");
		invalidSection = await getContentFromArchives("invalidSection.zip");
		noResultskey = await getContentFromArchives("noResultkey.zip");
		jsonMissingComma = await getContentFromArchives("jsonMissingComma.zip");
		campus = await getContentFromArchives("campus.zip");
		campusNoIndex = await getContentFromArchives("campusNoIndex.zip");
		campusNoTables = await getContentFromArchives("campusNoTables.zip");
		campusNoBuidlingandRoom = await getContentFromArchives("campusNoBuildingandRoom.zip");
		campusEmptyBuildings = await getContentFromArchives("campusEmptyBuildings.zip");
		campusNoGoodTd = await getContentFromArchives("campusNoGoodTd.zip");
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		afterEach(async function () {
			//await clearDisk();
		});

		it("should reject with an empty dataset id - Rooms", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			let err: any;

			try {
				await facade.addDataset("", campus, InsightDatasetKind.Rooms);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with an dataset ID with an underscore -- Rooms", async function () {
			let err: any;
			try {
				await facade.addDataset("6983_", campus, InsightDatasetKind.Rooms);
				expect.fail("Expected Fail because of underscore");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with an no index.htm file -- Rooms", async function () {
			let err: any;
			try {
				await facade.addDataset("noIndex", campusNoIndex, InsightDatasetKind.Rooms);
				expect.fail("Expected Fail because of no Index file");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with no table in index.htm file -- Rooms", async function () {
			let err: any;
			try {
				await facade.addDataset("noIndex", campusNoTables, InsightDatasetKind.Rooms);
				expect.fail("Expected Fail because of no tables in index file");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with no buildingsandRoom file -- Rooms", async function () {
			let err: any;
			try {
				await facade.addDataset("noIndex", campusNoBuidlingandRoom, InsightDatasetKind.Rooms);
				expect.fail("Expected Fail because of no tables in index file");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with empty buildings file -- Rooms", async function () {
			let err: any;
			try {
				await facade.addDataset("noIndex", campusEmptyBuildings, InsightDatasetKind.Rooms);
				expect.fail("Expected Fail because of no tables in index file");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with no good td file in Index", async function () {
			let err: any;
			try {
				await facade.addDataset("noIndex", campusNoGoodTd, InsightDatasetKind.Rooms);
				expect.fail("Expected Fail because of no tables in index file");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should successfully add a dataset -- Rooms", async function () {
			const result = await facade.addDataset("aman", campus, InsightDatasetKind.Rooms);
			return expect(result).to.have.members(["aman"]);
		});

		it("should reject with  an empty dataset id", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			let err: any;

			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with an dataset ID with an underscore", async function () {
			let err: any;
			try {
				await facade.addDataset("6983_", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because of underscore");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with an nonbase 64 content", async function () {
			let err: any;
			try {
				await facade.addDataset("aman", "SGVsbG8gV29ybGQh", InsightDatasetKind.Sections);
				expect.fail("Expected Fail because of invalid base64");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should successfully add a dataset", async function () {
			const result = await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			return expect(result).to.have.members(["aman"]);
		});

		it("should successfully add a dataset clear disk, add have just the one", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			const result = await facade.addDataset("kylee", course, InsightDatasetKind.Sections);
			expect(result).to.have.members(["aman", "kylee"]);
			const newFacade = new InsightFacade();
			const res = await newFacade.listDatasets();
			expect(res.length).to.equal(2);
			await clearDisk();
			const rez = await newFacade.listDatasets();
			expect(rez.length).to.equal(0);

			const r = await newFacade.addDataset("aman", course, InsightDatasetKind.Sections);
			expect(r).to.have.members(["aman"]);
		});

		it("should successfully add a dataset with / in name", async function () {
			const result = await facade.addDataset("/yay/", course, InsightDatasetKind.Sections);
			return expect(result).to.have.members(["/yay/"]);
		});

		it("should reject with a dataset ID that already exists /", async function () {
			let err: any;
			try {
				await facade.addDataset("/hello", sections, InsightDatasetKind.Sections);
				await facade.addDataset("/hello", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because ID already exists!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should successfully add a dataset with multiple facades", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			const facade2: InsightFacade = new InsightFacade();
			const result = await facade2.addDataset("kylee", course, InsightDatasetKind.Sections);
			expect(result).to.have.deep.members(["aman", "kylee"]);
		});

		it("should successfully add a dataset with multiple facades remove one add", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			const facade2: InsightFacade = new InsightFacade();
			await facade2.addDataset("kylee", course, InsightDatasetKind.Sections);

			const facade3: InsightFacade = new InsightFacade();
			await facade3.removeDataset("aman");
			const result = await facade3.addDataset("coolguy", course, InsightDatasetKind.Sections);
			expect(result).to.have.deep.members(["kylee", "coolguy"]);
		});

		it("should successfully add a dataset with multiple facades", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			const facade2: InsightFacade = new InsightFacade();
			await facade2.addDataset("kylee", course, InsightDatasetKind.Sections);

			const facade3: InsightFacade = new InsightFacade();
			const result = await facade3.addDataset("coolguy", course, InsightDatasetKind.Sections);
			expect(result).to.have.deep.members(["kylee", "coolguy", "aman"]);
		});

		it("should successfully add a dataset with multiple facades but one of them is bad", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			const facade2: InsightFacade = new InsightFacade();
			try {
				await facade2.addDataset("", course, InsightDatasetKind.Sections);
			} catch (e) {
				e;
			}

			const facade3: InsightFacade = new InsightFacade();
			const result = await facade3.addDataset("coolguy", course, InsightDatasetKind.Sections);
			expect(result).to.have.deep.members(["coolguy", "aman"]);
		});

		it("should successfully add a dataset with multiple facades but one already exists", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			const facade2: InsightFacade = new InsightFacade();
			try {
				await facade2.addDataset("aman", course, InsightDatasetKind.Sections);
			} catch (e) {
				e;
			}

			const facade3: InsightFacade = new InsightFacade();
			const result = await facade3.addDataset("coolguy", course, InsightDatasetKind.Sections);
			expect(result).to.have.deep.members(["coolguy", "aman"]);
		});

		it("should reject with a dataset ID that already exists from previous facade", async function () {
			let err: any;
			try {
				await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
				await facade.addDataset("kylee", sections, InsightDatasetKind.Sections);

				const facade2: InsightFacade = new InsightFacade();
				await facade2.addDataset("aman2", course, InsightDatasetKind.Sections);
				await facade2.addDataset("kylee", course, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because ID already exists!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with a dataset ID that already exists aman", async function () {
			let err: any;
			try {
				await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
				await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because ID already exists!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("Should reject a dataset ID that is just whitespace", async function () {
			let err: any;
			try {
				await facade.addDataset("   ", sections, InsightDatasetKind.Sections);
				expect.fail("Expected Fail because of whitespace");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should successfully add multiple valid datasets", async function () {
			const result = await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			expect(result).to.have.members(["aman"]);
			const result2 = await facade.addDataset("aman2", course, InsightDatasetKind.Sections);

			expect(result2).to.have.members(["aman", "aman2"]);
		});

		it("should successfully add a rooms and sections", async function () {
			const result = await facade.addDataset("aman", campus, InsightDatasetKind.Rooms);
			expect(result).to.have.members(["aman"]);
			const result2 = await facade.addDataset("aman2", course, InsightDatasetKind.Sections);

			expect(result2).to.have.members(["aman", "aman2"]);
		});

		it("should successfully add with ID that is any characters except underscore", async function () {
			const result = await facade.addDataset("aman2133!?", course, InsightDatasetKind.Sections);
			expect(result).to.have.members(["aman2133!?"]);
		});

		it("should reject with a zip file that does not have courses as the root", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", notCourses, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with a zip file that has zero courses in the course root folder", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", noContent, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with a zip file that has coursese but no JSON data in them", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", badJSON, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject with a zip file that has is not actually a zip file", async function () {
			let err: any;
			const notAZip = "notAZip";

			try {
				await facade.addDataset("aman", notAZip, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});
		it("should reject with a zip file that has one section but that section isnt valid", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", invalidSection, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject a course that no resutls key", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", noResultskey, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should reject a with a json that is missing a comma (invalid)", async function () {
			let err: any;

			try {
				await facade.addDataset("aman", jsonMissingComma, InsightDatasetKind.Sections);
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("it should handling crashes on multiple adds", async function () {
			// add id (resolve), add id (reject), add id2 (resolve)
			try {
				const result = await facade.addDataset("id", sections, InsightDatasetKind.Sections);
				expect(result.length).to.equal(1);
				expect(result).have.deep.members(["id"]);
				facade = new InsightFacade();
				await facade.addDataset("id", sections, InsightDatasetKind.Sections);
				expect.fail();
			} catch (err) {
				expect(err).to.be.instanceof(InsightError);
			}

			try {
				const res = await facade.addDataset("id2", sections, InsightDatasetKind.Sections);
				expect(res).to.be.an.instanceof(Array);
				expect(res).to.have.length(2);
				expect(res).have.deep.members(["id", "id2"]);
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			facade = new InsightFacade();
			await clearDisk();
		});

		afterEach(async function () {
			await clearDisk();
		});

		it("should throw insight error with invalid dataset id of empty string", async function () {
			let err: any;

			try {
				await facade.removeDataset("");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should throw insight error with invalid dataset id of _", async function () {
			let err: any;

			try {
				await facade.removeDataset("aman_");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should throw insight error with invalid dataset id of white space", async function () {
			let err: any;

			try {
				await facade.removeDataset("   ");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(InsightError);
		});

		it("should throw notFound error with an ID that is not present", async function () {
			let err: any;

			try {
				await facade.removeDataset("amanj21");
				expect.fail("Expected Fail here!");
			} catch (error) {
				err = error;
			}
			expect(err).to.be.instanceOf(NotFoundError);
		});

		it("should successfully remove a dataset aman", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			const result = await facade.removeDataset("aman");
			expect(result).to.equal("aman");
		});

		it("should successfully remove a dataset /", async function () {
			await facade.addDataset("/ r", course, InsightDatasetKind.Sections);
			const result = await facade.removeDataset("/ r");
			expect(result).to.equal("/ r");
		});

		it("should successfully add 2 datasets and remove 2 a datasets", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			await facade.addDataset("aman2", sections, InsightDatasetKind.Sections);

			const remove = await facade.removeDataset("aman");
			expect(remove).to.equal("aman");
			const remove2 = await facade.removeDataset("aman2");
			expect(remove2).to.equal("aman2");
		});

		it("should successfully remove a dataset aman and then add a dataset to check members", async function () {
			await facade.addDataset("aman", course, InsightDatasetKind.Sections);
			await facade.removeDataset("aman");

			const add2 = await facade.addDataset("secondAdd", course, InsightDatasetKind.Sections);
			expect(add2).to.have.members(["secondAdd"]);
		});

		it("should successfully remove a dataset as a second facade", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			await facade.addDataset("secondAdd", sections, InsightDatasetKind.Sections);

			const facade2: InsightFacade = new InsightFacade();
			const remove = await facade2.removeDataset("secondAdd");
			expect(remove).to.equal("secondAdd");
		});

		it("remove dataset and add back without problem", async function () {
			try {
				const result = await facade.addDataset("id", sections, InsightDatasetKind.Sections);
				expect(result.length).to.equal(1);
				expect(result).have.deep.members(["id"]);
				const res = await facade.removeDataset("id");
				expect(res).to.equal("id");
				const re = await facade.addDataset("id", sections, InsightDatasetKind.Sections);
				expect(result.length).to.equal(1);
				expect(re).have.deep.members(["id"]);
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("after a rejected remove, the next remove resolves", async function () {
			return facade
				.addDataset("id", sections, InsightDatasetKind.Sections)
				.then(async (result) => {
					expect(result.length).to.equal(1);
					expect(result).have.deep.members(["id"]);
					return facade.removeDataset("id2");
				})
				.then((res) => {
					return expect.fail("removed a not added id, shouldn't resolve");
				})
				.catch(async (err) => {
					expect(err).to.be.instanceof(NotFoundError);
					return facade.removeDataset("id");
				})
				.then((re) => {
					return expect(re).to.equal("id");
				});
		});
	});

	describe("ListDataset", function () {
		beforeEach(async function () {
			facade = new InsightFacade();
		});

		afterEach(async function () {
			await clearDisk();
		});

		it("should list dataset after add, new facade and second add", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);

			await facade.addDataset("kylee", sections, InsightDatasetKind.Sections);
			const facade2: InsightFacade = new InsightFacade();
			await facade2.addDataset("aj21", sections, InsightDatasetKind.Sections);
			await facade2.removeDataset("aman");

			const facade3: InsightFacade = new InsightFacade();
			await facade3.removeDataset("kylee");
			const result = await facade3.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.have.deep.members([{ id: "aj21", kind: InsightDatasetKind.Sections, numRows: 64612 }]);
		});

		it("should list dataset after add, new facade and second add", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);

			await facade.addDataset("kylee", sections, InsightDatasetKind.Sections);
			const facade2: InsightFacade = new InsightFacade();
			await facade2.addDataset("aj21", sections, InsightDatasetKind.Sections);

			const facade3: InsightFacade = new InsightFacade();
			const result = await facade3.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.have.deep.members([
				{ id: "aj21", kind: InsightDatasetKind.Sections, numRows: 64612 },
				{ id: "kylee", kind: InsightDatasetKind.Sections, numRows: 64612 },
				{ id: "aman", kind: InsightDatasetKind.Sections, numRows: 64612 },
			]);
		});

		it("should list dataset as an array", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.deep.equal([{ id: "aman", kind: InsightDatasetKind.Sections, numRows: 64612 }]);
		});

		it("should list dataset as an array - Rooms", async function () {
			await facade.addDataset("aman", campus, InsightDatasetKind.Rooms);
			const result = await facade.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.deep.equal([{ id: "aman", kind: InsightDatasetKind.Rooms, numRows: 364 }]);
		});

		it("should list dataset as an array with /", async function () {
			await facade.addDataset("/hello", sections, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.deep.equal([{ id: "/hello", kind: InsightDatasetKind.Sections, numRows: 64612 }]);
		});

		it("should list dataset as an array with 2 datasets", async function () {
			await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
			await facade.addDataset("kylee", sections, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.have.deep.members([
				{ id: "aman", kind: InsightDatasetKind.Sections, numRows: 64612 },
				{ id: "kylee", kind: InsightDatasetKind.Sections, numRows: 64612 },
			]);
		});

		it("should list empty dataset", async function () {
			const result = await facade.listDatasets();
			//expect(result).to.be.an("array");
			expect(result).to.deep.equal([]);
		});

		it("after remove crashes, return the empty listDataset", async function () {
			try {
				const result = await facade.addDataset("id", sections, InsightDatasetKind.Sections);
				expect(result).to.be.an.instanceof(Array);
				expect(result).to.have.length(1);
				await facade.removeDataset("id");
				facade = new InsightFacade();
				const res = await facade.listDatasets();
				expect(res).to.be.instanceof(Array);
				expect(res.length).to.equal(0);
				await facade.addDataset("aman", sections, InsightDatasetKind.Sections);
				const res2 = await facade.listDatasets();
				expect(res2).to.be.instanceof(Array);
				expect(res2.length).to.equal(1);
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
	});

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<any> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[]; // dummy value before being reassigned
			try {
				result = await facade.performQuery(input);
			} catch (err) {
				if (!errorExpected) {
					return expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				if (expected === "InsightError") {
					return expect(err).to.be.instanceOf(InsightError);
				} else {
					return expect(err).to.be.instanceOf(ResultTooLargeError);
				}
			}
			if (errorExpected) {
				return expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
			}
			// return expect(result).to.deep.equal(expected);
			if ((input as { OPTIONS: { ORDER?: string } }).OPTIONS.ORDER) {
				// return expect(result).to.deep.equal(expected);

				const orderColumn = (input as { OPTIONS: { ORDER?: string } }).OPTIONS.ORDER as string;
				let previousValue: any = null;

				for (const resultItem of result) {
					if (previousValue !== null && (resultItem as any)[orderColumn] < previousValue) {
						return expect.fail(`ORDER key ${orderColumn} is not increasing`);
					}

					const matchingItem = expected.find((item: InsightResult) => {
						return JSON.stringify(item) === JSON.stringify(resultItem);
					});

					if (!matchingItem) {
						return expect.fail(`Result item ${JSON.stringify(resultItem)} not found in expected`);
					}

					previousValue = resultItem[orderColumn];
				}
				return expect(true).to.be.true;
			} else {
				return expect(result).to.have.deep.members(expected);
			}
		}

		before(async function () {
			facade = new InsightFacade();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
				facade.addDataset("rooms", campus, InsightDatasetKind.Rooms),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.
		//valid
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[valid/sections_dept osc asterix at beginning and end.json] sections_dept *osc*", checkQuery);
		it("[valid/valid sections_dept asterix at end.json] sections_dept cp*", checkQuery);
		it("[valid/valid sections_dept asterix in front.json] sections_dept *sc", checkQuery);
		it("[valid/valid sections_deptCpsc no asterix.json] sections_dept cpsc", checkQuery);
		it("[valid/validAverageGt90ANDIsCpsc.json] valid average gt 90 AND is cpsc", checkQuery);
		it("[valid/validAllColumns.json] valid all columns", checkQuery);
		it("[valid/validAllColumnsSections_fail.json] valid all columns sections_fail", checkQuery);
		it("[valid/validBut0Results.json] valid but 0 results", checkQuery);
		it("[valid/validComplexWithORAND.json] valid complex with OR AND", checkQuery);
		it("[valid/validEQ68.9NoOrder.json] valid EQ 68.9 no order", checkQuery);
		it("[valid/validLT70NoOrder.json] valid LT 70 no order", checkQuery);
		it("[valid/validOrderByInstructor.json] valid order by instructor", checkQuery);
		it("[valid/validOrderKeyIsRedundantWithDept.json] valid order key is redundant with dept", checkQuery);
		it(
			"[valid/validCoursesThatHaveAverageNOTGreaterThan76AndNOTLessThan75.6.json] valid courses that have average NOT greater than 76 and NOT less than 75.6",
			checkQuery
		);
		it("[valid/validORLookingForCpscOrPharm.json] valid OR looking for cpsc or pharm", checkQuery);
		it(
			"[valid/validUsingDoubleAsterixAndInstructorByName.json] valid using double asterix and instructor by name",
			checkQuery
		);
		it("[valid/validUsingGTAndOR.json] valid using GT and OR", checkQuery);
		it("[valid/validUsingNOTGT.json] valid using NOT GT", checkQuery);
		it("[valid/validDoubleNotNegatingThemselves.json] valid double not negating themselves", checkQuery);
		it("[valid/validSortingWithStringTypeColumn.json] valid sorting with string type column", checkQuery);
		it("[valid/validANDORGTLTEQISNOTWILDCARD.json] valid AND OR GT LT EQ IS NOT WILDCARD", checkQuery);

		// C2 tests
		it("[valid/order_by_ins_and_dept.json] valid sort down by two columns", checkQuery);
		it("[valid/order_by_ins_and_dept_up.json] valid sort up by two columns", checkQuery);
		it("[valid/use_rooms.json] test using rooms datatype", checkQuery);
		it("[valid/validPlainRoom.json] test using rooms to see plain output", checkQuery);
		it("[valid/validMaxTest.json] test Max", checkQuery);
		it("[valid/validOverallAvg.json] test overall avg", checkQuery);
		it("[valid/validOverallSum.json] test overall sum", checkQuery);
		it("[valid/validOverallMin.json] test overall min", checkQuery);
		it("[valid/validOverallCount.json] test overall count", checkQuery);
		it("[valid/validRoomComplicated.json] test Room Complicated", checkQuery);
		it("[valid/validRoomVeryComplicated.json] test Room very Complicated", checkQuery);
		it("[valid/validMinMax.json] test min max", checkQuery);
		it("[valid/validApplySum.json] valid apply sum", checkQuery);
		it("[valid/validOnlyApplyColumns.json] no dataset id in WHERE or OPTIONS", checkQuery);

		//Invalid
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/invalid sections_dept cpsc AsterixInMiddle.json] sections_dept cp*sc asterix in middle", checkQuery);
		it("[invalid/invalidLowercaseOptions.json] invalid lowercase options", checkQuery);
		it("[invalid/invalidLowercaseWhere.json] invalid lowercase where", checkQuery);
		it("[invalid/invalidNoColumns.json] invalid no columns", checkQuery);
		it("[invalid/invalidNoOptions.json] invalid no options", checkQuery);
		it("[invalid/invalidTooManyResults.json] invalid too many results", checkQuery);
		it("[invalid/invalidNoDataset.json] invalid no dataset", checkQuery);
		it("[invalid/invalidOrderKeyIsNotInColumns.json] invalid order key is not in columns", checkQuery);
		it("[invalid/invalidUsingEQForAString.json] invalid using EQ for a string", checkQuery);
		it("[invalid/invalidUsingADifferentDataset.json] invalid using a different dataset", checkQuery);
		it("[invalid/invalidUsingISForANumber.json] invalid using IS for a number", checkQuery);
		it("[invalid/invalidKeyInColumnsClause.json] invalid key in columns clause", checkQuery);
		it("[invalid/invalidKeyInWhereClause.json] invalid key in where clause", checkQuery);
		it("[invalid/invalidTransformation.json] invalid key in where clause", checkQuery);
		it("[invalid/invalidTransformationNoApply.json] invalid key in where clause", checkQuery);
		it("[invalid/invalidFilterKey.json] invalid filter key", checkQuery);
		it("[invalid/invalidKeyInOptions.json] invalid key in options", checkQuery);
		it("[invalid/invalidNullData.json] invalid null", checkQuery);
		it("[invalid/invalidOrderType.json] invalid ordertype", checkQuery);
		it("[invalid/invalidNotReal.json] invalid not real type", checkQuery);
		it("[invalid/invalidNotJson.json] invalid empty string", checkQuery);
		it("[invalid/invalidWhereNull.json] invalid not real type", checkQuery);
		it("[invalid/invalidColumnl.json] invalid column", checkQuery);

	});
});
